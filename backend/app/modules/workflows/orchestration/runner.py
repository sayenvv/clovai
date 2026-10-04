"""Execute a built orchestration graph and emit SSE-friendly events."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from typing import Any
from uuid import uuid4

from eleven_nodes import FailurePolicy, Orchestrator
from eleven_nodes.domain.models import ExecutionEvent

from app.core.llm_settings import llm_settings_to_workflow_model_config
from app.modules.workflows.compiler import WorkflowAgentFactory
from app.modules.workflows.orchestration.events import STREAM_DONE, QueueEventPublisher, StreamItem
from app.modules.workflows.orchestration.factory import (
    OrchestrationPatternError,
    OrchestrationWorkflowFactory,
)
from app.modules.workflows.orchestration.runs import OrchestrationRunRecord, OrchestrationRunStore, RUN_STORE
from app.modules.workflows.runtime import (
    ApprovalRequiredError,
    DryRunAgentFactory,
    FeedbackRevisionLimitError,
    MicrosoftWorkflowAgentFactory,
    RetryingWorkflowAgentFactory,
    RuntimeConfigurationError,
    _assert_revision_limit,
    _gates_after_run,
    _run_response,
    _slice_spec_before_gates,
    _with_reviewer_inputs,
    _with_reviewer_prompt,
)
from app.modules.workflows.schemas import (
    WorkflowBuildSpec,
    WorkflowEdgeSpec,
    WorkflowExecutionRequest,
    WorkflowModelConfig,
    WorkflowRunResponse,
)

AgentFactoryBuilder = Callable[[WorkflowModelConfig, bool], WorkflowAgentFactory]


def default_agent_factory(model_config: WorkflowModelConfig, dry_run: bool) -> WorkflowAgentFactory:
    if dry_run:
        return DryRunAgentFactory()
    return MicrosoftWorkflowAgentFactory(model_config)


class OrchestrationRunner:
    def __init__(
        self,
        store: OrchestrationRunStore | None = None,
        agent_factory_builder: AgentFactoryBuilder | None = None,
    ) -> None:
        self._store = store or RUN_STORE
        self._agent_factory_builder = agent_factory_builder or default_agent_factory

    async def stream_new_run(
        self,
        *,
        workspace_id: str,
        tab_id: str,
        root_tab_id: str,
        spec: WorkflowBuildSpec,
        nested: dict[str, WorkflowBuildSpec],
        inputs: dict[str, Any],
        metadata: dict[str, Any],
        dry_run: bool,
    ) -> AsyncIterator[dict[str, Any]]:
        record = OrchestrationRunRecord(
            run_id=str(uuid4()),
            workspace_id=workspace_id,
            tab_id=tab_id,
            root_tab_id=root_tab_id,
            pattern=spec.meta.workflow_type,
            spec=spec,
            nested=nested,
            inputs=inputs,
            metadata=metadata,
            dry_run=dry_run,
            approved_edge_ids=set(),
        )
        self._store.put(record)
        async for event in self._stream(record, record.execution_request()):
            yield event

    async def stream_resume(
        self,
        run_id: str,
        *,
        approved_edge_ids: set[str] | None = None,
        reviewer_feedback: str = "",
        previous_output: Any = None,
    ) -> AsyncIterator[dict[str, Any]]:
        record = self._store.get(run_id)
        if record is None:
            raise KeyError(run_id)
        extra = set(approved_edge_ids or ())
        if reviewer_feedback.strip():
            record.revision_count += 1
        record.approved_edge_ids.update(extra)
        record.status = "running"
        self._store.put(record)
        request = record.execution_request(
            extra_approved=extra,
            reviewer_feedback=reviewer_feedback,
            previous_output=previous_output,
        )
        async for event in self._stream(record, request):
            yield event

    async def collect_new_run(self, **kwargs: Any) -> dict[str, Any]:
        events: list[dict[str, Any]] = []
        async for event in self.stream_new_run(**kwargs):
            events.append(event)
        return _summarize_events(events)

    async def collect_resume(self, run_id: str, **kwargs: Any) -> dict[str, Any]:
        events: list[dict[str, Any]] = []
        async for event in self.stream_resume(run_id, **kwargs):
            events.append(event)
        return _summarize_events(events)

    def pending_requests(
        self,
        workspace_id: str | None = None,
        tab_id: str | None = None,
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for record in self._store.waiting(workspace_id, tab_id):
            items.extend(_pending_from_record(record))
        return items

    async def _stream(
        self,
        record: OrchestrationRunRecord,
        request: WorkflowExecutionRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        queue: asyncio.Queue[StreamItem] = asyncio.Queue()
        publisher = QueueEventPublisher(queue)
        task = asyncio.create_task(self._execute(record, request, publisher))
        try:
            while True:
                item = await queue.get()
                if item is STREAM_DONE:
                    break
                if isinstance(item, ExecutionEvent):
                    yield _event_payload(item)
                elif isinstance(item, dict):
                    yield item
        finally:
            if not task.done():
                task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception as error:
                yield {
                    "type": "run_failed",
                    "runId": record.run_id,
                    "workflowId": record.spec.meta.workflow_id,
                    "nodeId": None,
                    "data": {"error": str(error)},
                    "occurredAt": record.updated_at.isoformat(),
                }

    async def _execute(
        self,
        record: OrchestrationRunRecord,
        request: WorkflowExecutionRequest,
        publisher: QueueEventPublisher,
    ) -> None:
        try:
            spec = record.spec
            pending_edges = [
                edge
                for edge in spec.edges
                if edge.human_approval and edge.id not in request.approved_edge_ids
            ]
            _assert_revision_limit(pending_edges, request.revision_count)
            runnable_spec = _slice_spec_before_gates(spec, request.approved_edge_ids)
            if not runnable_spec.agents:
                waiting = sorted(edge.id for edge in pending_edges)
                await self._finish_waiting(record, request, waiting, publisher, None)
                return

            factory = self._agent_factory(spec, record.dry_run)
            built = OrchestrationWorkflowFactory(agent_factory=factory).from_spec(
                _with_reviewer_prompt(runnable_spec, request, pending_edges),
                record.nested,
            )
            record.pattern = built.pattern
            orchestrator = Orchestrator(
                failure_policy=FailurePolicy.FAIL_FAST,
                event_publisher=publisher,
            )
            async with asyncio.timeout(spec.settings.timeout_seconds):
                result = await orchestrator.run(
                    built.workflow,
                    inputs=_with_reviewer_inputs(request).inputs,
                    metadata=request.metadata,
                    run_id=record.run_id,
                    raise_on_error=False,
                )
            response = _run_response(result, mode="test" if record.dry_run else "execute")
            waiting = _gates_after_run(spec, request.approved_edge_ids, response)
            if waiting and response.status != "failed":
                response = response.model_copy(
                    update={"status": "waiting_approval", "required_edge_ids": waiting}
                )
                await self._finish_waiting(record, request, waiting, publisher, response)
                return

            record.status = response.status
            record.required_edge_ids = []
            record.approved_edge_ids = set(request.approved_edge_ids)
            record.last_response = response.model_dump(mode="json", by_alias=True)
            self._store.put(record)
            await publisher.publish_payload(
                {
                    "type": "run_finished",
                    "runId": record.run_id,
                    "workflowId": spec.meta.workflow_id,
                    "nodeId": None,
                    "data": {
                        "status": response.status,
                        "pattern": record.pattern,
                        "outputs": response.outputs,
                        "failures": response.failures,
                        "pendingRequests": [],
                    },
                    "occurredAt": record.updated_at.isoformat(),
                }
            )
        except (OrchestrationPatternError, FeedbackRevisionLimitError, ApprovalRequiredError) as error:
            record.status = "failed"
            record.last_response = {"error": str(error)}
            self._store.put(record)
            await publisher.publish_payload(
                {
                    "type": "run_failed",
                    "runId": record.run_id,
                    "workflowId": record.spec.meta.workflow_id,
                    "nodeId": None,
                    "data": {"error": str(error)},
                    "occurredAt": record.updated_at.isoformat(),
                }
            )
        except RuntimeConfigurationError as error:
            record.status = "failed"
            record.last_response = {"error": str(error)}
            self._store.put(record)
            await publisher.publish_payload(
                {
                    "type": "run_failed",
                    "runId": record.run_id,
                    "workflowId": record.spec.meta.workflow_id,
                    "nodeId": None,
                    "data": {"error": str(error), "code": "runtime_configuration"},
                    "occurredAt": record.updated_at.isoformat(),
                }
            )
        except TimeoutError as error:
            record.status = "failed"
            record.last_response = {"error": str(error)}
            self._store.put(record)
            await publisher.publish_payload(
                {
                    "type": "run_failed",
                    "runId": record.run_id,
                    "workflowId": record.spec.meta.workflow_id,
                    "nodeId": None,
                    "data": {"error": str(error), "code": "timeout"},
                    "occurredAt": record.updated_at.isoformat(),
                }
            )
        finally:
            await publisher.close()

    async def _finish_waiting(
        self,
        record: OrchestrationRunRecord,
        request: WorkflowExecutionRequest,
        waiting: list[str],
        publisher: QueueEventPublisher,
        response: WorkflowRunResponse | None,
    ) -> None:
        record.status = "waiting_approval"
        record.required_edge_ids = waiting
        record.approved_edge_ids = set(request.approved_edge_ids)
        if response is not None:
            record.last_response = response.model_dump(mode="json", by_alias=True)
            outputs = response.outputs
        else:
            outputs = {}
            record.last_response = {"status": "waiting_approval", "requiredEdgeIds": waiting}
        pending = _pending_from_record(record)
        self._store.put(record)
        await publisher.publish_payload(
            {
                "type": "approval_required",
                "runId": record.run_id,
                "workflowId": record.spec.meta.workflow_id,
                "nodeId": None,
                "data": {
                    "status": "waiting_approval",
                    "pattern": record.pattern,
                    "requiredEdgeIds": waiting,
                    "pendingRequests": pending,
                    "outputs": outputs,
                },
                "occurredAt": record.updated_at.isoformat(),
            }
        )
        await publisher.publish_payload(
            {
                "type": "run_finished",
                "runId": record.run_id,
                "workflowId": record.spec.meta.workflow_id,
                "nodeId": None,
                "data": {
                    "status": "waiting_approval",
                    "pattern": record.pattern,
                    "pendingRequests": pending,
                },
                "occurredAt": record.updated_at.isoformat(),
            }
        )

    def _agent_factory(self, spec: WorkflowBuildSpec, dry_run: bool) -> WorkflowAgentFactory:
        factory = self._agent_factory_builder(llm_settings_to_workflow_model_config(), dry_run)
        policy = spec.settings.retry_policy
        if policy.max_retries == 0:
            return factory
        return RetryingWorkflowAgentFactory(
            factory,
            max_retries=policy.max_retries,
            delay_seconds=policy.retry_delay_seconds,
        )


def _summarize_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    terminal = next(
        (
            event
            for event in reversed(events)
            if event.get("type") in {"run_finished", "run_failed", "approval_required"}
        ),
        events[-1] if events else {},
    )
    data = terminal.get("data") or {}
    status = data.get("status")
    if not status and terminal.get("type") == "run_failed":
        status = "failed"
    return {
        "runId": terminal.get("runId"),
        "status": status,
        "pattern": data.get("pattern"),
        "outputs": data.get("outputs", {}),
        "failures": data.get("failures", {}),
        "pendingRequests": data.get("pendingRequests", []),
        "events": events,
    }


def _event_payload(event: ExecutionEvent) -> dict[str, Any]:
    event_type = event.type.value if hasattr(event.type, "value") else str(event.type)
    return {
        "type": event_type,
        "runId": event.run_id,
        "workflowId": event.workflow_id,
        "nodeId": event.node_id,
        "data": dict(event.data),
        "occurredAt": event.occurred_at.isoformat(),
    }


def _pending_from_record(record: OrchestrationRunRecord) -> list[dict[str, Any]]:
    edges = {edge.id: edge for edge in record.spec.edges}
    items: list[dict[str, Any]] = []
    for edge_id in record.required_edge_ids:
        edge = edges.get(edge_id)
        items.append(_pending_item(record, edge_id, edge))
    return items


def _pending_item(
    record: OrchestrationRunRecord,
    edge_id: str,
    edge: WorkflowEdgeSpec | None,
) -> dict[str, Any]:
    item: dict[str, Any] = {
        "runId": record.run_id,
        "workspaceId": record.workspace_id,
        "tabId": record.tab_id,
        "rootTabId": record.root_tab_id,
        "pattern": record.pattern,
        "edgeId": edge_id,
        "updatedAt": record.updated_at.isoformat(),
    }
    if edge is not None:
        item.update(
            {
                "fromAgentId": edge.from_agent_id,
                "toAgentId": edge.to_agent_id,
                "approvalRole": edge.approval_role,
                "approvalMessage": edge.approval_message,
                "feedbackRevisionsEnabled": edge.feedback_revisions_enabled,
            }
        )
    elif edge_id.startswith("hitl-complete:"):
        item["fromAgentId"] = edge_id.removeprefix("hitl-complete:")
        item["approvalMessage"] = "Approve completion of this human-in-the-loop agent."
    return item
