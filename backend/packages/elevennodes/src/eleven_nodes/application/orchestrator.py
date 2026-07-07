"""Use-case service that executes multi-agent workflow graphs."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from copy import deepcopy
from typing import Any
from uuid import uuid4

from eleven_nodes.application.abstractions import ContextFactory, ResultAdapter, WorkflowRunner
from eleven_nodes.application.defaults import DefaultResultAdapter, DependencyContextFactory
from eleven_nodes.application.workflow import Workflow, WorkflowNode
from eleven_nodes.domain.errors import AgentExecutionError, WorkflowExecutionError
from eleven_nodes.domain.models import (
    EventType,
    ExecutionEvent,
    FailurePolicy,
    NodeExecution,
    NodeStatus,
    RunStatus,
    WorkflowResult,
    WorkflowRun,
    utc_now,
)
from eleven_nodes.ports.events import EventPublisher
from eleven_nodes.ports.state import StateStore


class Orchestrator(WorkflowRunner):
    """Coordinates agents without depending on any specific AI provider."""

    def __init__(
        self,
        *,
        state_store: StateStore | None = None,
        event_publisher: EventPublisher | None = None,
        failure_policy: FailurePolicy = FailurePolicy.FAIL_FAST,
        context_factory: ContextFactory | None = None,
        result_adapter: ResultAdapter | None = None,
    ) -> None:
        self._state_store = state_store
        self._events = event_publisher
        self._failure_policy = failure_policy
        self._context_factory = context_factory or DependencyContextFactory()
        self._result_adapter = result_adapter or DefaultResultAdapter()

    async def run(
        self,
        workflow: Workflow,
        *,
        inputs: Mapping[str, Any] | None = None,
        metadata: Mapping[str, Any] | None = None,
        run_id: str | None = None,
        raise_on_error: bool = False,
    ) -> WorkflowResult:
        """Execute a workflow and return its complete node-level result."""
        run = WorkflowRun(
            run_id=run_id or str(uuid4()),
            workflow_id=workflow.workflow_id,
            status=RunStatus.RUNNING,
            nodes={
                node_id: NodeExecution(node_id=node_id, agent_id=node.agent.agent_id)
                for node_id, node in workflow.nodes.items()
            },
            inputs=dict(inputs or {}),
            metadata=dict(metadata or {}),
            started_at=utc_now(),
        )
        await self._save(run)
        await self._publish(EventType.WORKFLOW_STARTED, run)

        halted = False
        for layer in workflow.layers():
            runnable: list[WorkflowNode] = []
            for node_id in layer:
                node = workflow.nodes[node_id]
                dependency_failed = any(
                    run.nodes[dependency].status is not NodeStatus.COMPLETED
                    for dependency in node.dependencies
                )
                if halted or dependency_failed:
                    await self._skip_node(run, node_id)
                else:
                    runnable.append(node)

            if runnable:
                outcomes = await asyncio.gather(
                    *(self._execute_node(workflow, run, node) for node in runnable),
                    return_exceptions=True,
                )
                if any(isinstance(outcome, AgentExecutionError) for outcome in outcomes):
                    halted = self._failure_policy is FailurePolicy.FAIL_FAST

        run.finish()
        await self._save(run)
        final_event = (
            EventType.WORKFLOW_FAILED
            if run.status is RunStatus.FAILED
            else EventType.WORKFLOW_COMPLETED
        )
        await self._publish(
            final_event,
            run,
        )
        result = self._to_result(run)
        if raise_on_error and result.failures:
            raise WorkflowExecutionError(run.run_id, result.failures)
        return result

    async def get_run(self, run_id: str) -> WorkflowRun | None:
        """Retrieve a stored run through the configured persistence boundary."""
        if self._state_store is None:
            return None
        return await self._state_store.get(run_id)

    async def _execute_node(
        self,
        workflow: Workflow,
        run: WorkflowRun,
        node: WorkflowNode,
    ) -> None:
        execution = run.nodes[node.node_id]
        execution.start()
        await self._save(run)
        await self._publish(EventType.NODE_STARTED, run, node.node_id)

        context = self._context_factory.create(workflow, run, node)
        try:
            raw_result = await node.agent.run(context)
            execution.complete(self._result_adapter.adapt(raw_result))
            await self._save(run)
            await self._publish(EventType.NODE_COMPLETED, run, node.node_id)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            execution.fail(error)
            await self._save(run)
            await self._publish(
                EventType.NODE_FAILED,
                run,
                node.node_id,
                {"error": execution.error},
            )
            raise AgentExecutionError(node.node_id, error) from error

    async def _skip_node(self, run: WorkflowRun, node_id: str) -> None:
        execution = run.nodes[node_id]
        execution.skip()
        await self._save(run)
        await self._publish(EventType.NODE_SKIPPED, run, node_id)

    async def _publish(
        self,
        event_type: EventType,
        run: WorkflowRun,
        node_id: str | None = None,
        data: Mapping[str, Any] | None = None,
    ) -> None:
        if self._events is None:
            return
        await self._events.publish(
            ExecutionEvent(
                type=event_type,
                run_id=run.run_id,
                workflow_id=run.workflow_id,
                node_id=node_id,
                data=dict(data or {}),
            )
        )

    async def _save(self, run: WorkflowRun) -> None:
        if self._state_store is not None:
            await self._state_store.save(run)

    @staticmethod
    def _to_result(run: WorkflowRun) -> WorkflowResult:
        if run.started_at is None or run.completed_at is None:
            raise RuntimeError("Cannot create a result from an incomplete run")
        return WorkflowResult(
            run_id=run.run_id,
            workflow_id=run.workflow_id,
            status=run.status,
            nodes=deepcopy(run.nodes),
            started_at=run.started_at,
            completed_at=run.completed_at,
        )
