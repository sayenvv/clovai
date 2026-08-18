"""Runtime service for testing and executing compiled workflow definitions."""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from copy import deepcopy
from typing import Any, Callable

from eleven_nodes import (
    Agent,
    AgentContext,
    AgentResult,
    FailurePolicy,
    FunctionAgent,
    MicrosoftAgentConfigurationError,
    MicrosoftAgentDefinition,
    MicrosoftModelConfig,
    MicrosoftToolDefinition,
    MicrosoftWorkflowAgentFactory as ElevenNodesMicrosoftWorkflowAgentFactory,
    Orchestrator,
    WorkflowResult,
)

from app.core.llm_settings import llm_settings_to_workflow_model_config
from app.modules.workflows.compiler import (
    CompiledWorkflowDefinition,
    WorkflowAgentFactory,
    WorkflowCompiler,
)
from app.modules.workflows.schemas import (
    WorkflowAgentSpec,
    WorkflowBuildSpec,
    WorkflowEdgeSpec,
    WorkflowExecutionRequest,
    WorkflowModelConfig,
    WorkflowNodeRun,
    WorkflowRunResponse,
    WorkflowToolSpec,
    WorkflowValidationReport,
)


class RuntimeConfigurationError(RuntimeError):
    """Raised when a provider dependency or credential is unavailable."""


class ApprovalRequiredError(RuntimeError):
    """Raised when human-approved edges have not been authorized."""

    def __init__(self, edge_ids: list[str]) -> None:
        self.edge_ids = edge_ids
        super().__init__("Workflow execution requires human approval")


class FeedbackRevisionLimitError(RuntimeError):
    """Raised when a reviewer has exceeded the allowed revision rounds."""

    def __init__(self, limit: int) -> None:
        self.limit = limit
        super().__init__(f"Human feedback revisions exceeded the limit of {limit}")


COMPLETION_GATE_PREFIX = "hitl-complete:"


class WorkflowRunFailedError(RuntimeError):
    """Raised when a caller requests an HTTP error for failed workflow runs."""

    def __init__(self, response: WorkflowRunResponse) -> None:
        self.response = response
        super().__init__("One or more workflow agents failed")


class RetryingAgent(Agent):
    """Retry an ElevenNodes agent according to workflow settings."""

    def __init__(self, delegate: Agent, *, max_retries: int, delay_seconds: float) -> None:
        super().__init__(
            delegate.agent_id,
            name=delegate.name,
            description=delegate.description,
        )
        self._delegate = delegate
        self._max_retries = max_retries
        self._delay_seconds = delay_seconds

    async def execute(self, context: AgentContext) -> AgentResult | Any:
        for attempt in range(self._max_retries + 1):
            try:
                return await self._delegate.run(context)
            except asyncio.CancelledError:
                raise
            except Exception:
                if attempt == self._max_retries:
                    raise
                if self._delay_seconds:
                    await asyncio.sleep(self._delay_seconds)
        raise RuntimeError("unreachable retry state")


class DryRunAgentFactory(WorkflowAgentFactory):
    """Create deterministic agents for graph and context propagation tests."""

    def create(
        self,
        agent: WorkflowAgentSpec,
        tools: Sequence[WorkflowToolSpec],
    ) -> Agent:
        async def execute(context: AgentContext) -> AgentResult:
            return AgentResult(
                output={
                    "mode": "test",
                    "agentId": agent.id,
                    "agentName": agent.name,
                    "inputs": dict(context.inputs),
                    "dependencyOutputs": {
                        node_id: result.output
                        for node_id, result in context.dependency_results.items()
                    },
                    "toolIds": [tool.id for tool in tools],
                },
                metadata={"test": True},
            )

        return FunctionAgent(
            agent.id,
            execute,
            name=agent.display_name,
            description=agent.description,
        )


class MicrosoftWorkflowAgentFactory(WorkflowAgentFactory):
    """Adapt backend JSON schema objects to the ElevenNodes Microsoft factory."""

    def __init__(self, model_config: WorkflowModelConfig) -> None:
        try:
            self._delegate = ElevenNodesMicrosoftWorkflowAgentFactory(
                _microsoft_model_config(model_config)
            )
        except MicrosoftAgentConfigurationError as error:
            raise RuntimeConfigurationError(str(error)) from error

    def create(
        self,
        agent: WorkflowAgentSpec,
        tools: Sequence[WorkflowToolSpec],
    ) -> Agent:
        try:
            return self._delegate.create(
                _microsoft_agent_definition(agent),
                [_microsoft_tool_definition(tool) for tool in tools],
            )
        except MicrosoftAgentConfigurationError as error:
            raise RuntimeConfigurationError(str(error)) from error

class RetryingWorkflowAgentFactory(WorkflowAgentFactory):
    def __init__(
        self,
        delegate: WorkflowAgentFactory,
        *,
        max_retries: int,
        delay_seconds: float,
    ) -> None:
        self._delegate = delegate
        self._max_retries = max_retries
        self._delay_seconds = delay_seconds

    def create(
        self,
        agent: WorkflowAgentSpec,
        tools: Sequence[WorkflowToolSpec],
    ) -> Agent:
        return RetryingAgent(
            self._delegate.create(agent, tools),
            max_retries=self._max_retries,
            delay_seconds=self._delay_seconds,
        )


class WorkflowRuntimeService:
    """Application service shared by validate, test, and execute endpoints."""

    def __init__(
        self,
        compiler: WorkflowCompiler | None = None,
        execution_factory_builder: Callable[[WorkflowModelConfig], WorkflowAgentFactory]
        | None = None,
    ) -> None:
        self._compiler = compiler or WorkflowCompiler()
        self._execution_factory_builder = execution_factory_builder or MicrosoftWorkflowAgentFactory

    def validate(self, spec: WorkflowBuildSpec) -> WorkflowValidationReport:
        return self._compiler.validate(spec)

    async def test(
        self,
        spec: WorkflowBuildSpec,
        request: WorkflowExecutionRequest,
    ) -> WorkflowRunResponse:
        definition = self._compiler.prepare(spec)
        factory = self._with_retries(definition, DryRunAgentFactory())
        return await self._run(definition, factory, request, mode="test")

    async def execute(
        self,
        spec: WorkflowBuildSpec,
        request: WorkflowExecutionRequest,
    ) -> WorkflowRunResponse:
        pending_edges = [
            edge
            for edge in spec.edges
            if edge.human_approval and edge.id not in request.approved_edge_ids
        ]
        completion_gates = _pending_completion_gates(spec, request.approved_edge_ids)
        _assert_revision_limit(pending_edges, request.revision_count)

        runnable_spec = _slice_spec_before_gates(spec, request.approved_edge_ids)
        if not runnable_spec.agents:
            raise ApprovalRequiredError(
                sorted({edge.id for edge in pending_edges} | set(completion_gates))
            )

        definition = self._compiler.prepare(_with_reviewer_prompt(runnable_spec, request, pending_edges))
        factory = self._with_retries(
            definition,
            self._execution_factory_builder(llm_settings_to_workflow_model_config()),
        )
        response = await self._run(
            definition,
            factory,
            _with_reviewer_inputs(request),
            mode="execute",
        )
        waiting_for = _gates_after_run(spec, request.approved_edge_ids, response)
        if waiting_for and response.status != "failed":
            return response.model_copy(
                update={
                    "status": "waiting_approval",
                    "required_edge_ids": waiting_for,
                }
            )
        return response

    def _with_retries(
        self,
        definition: CompiledWorkflowDefinition,
        factory: WorkflowAgentFactory,
    ) -> WorkflowAgentFactory:
        policy = definition.spec.settings.retry_policy
        if policy.max_retries == 0:
            return factory
        return RetryingWorkflowAgentFactory(
            factory,
            max_retries=policy.max_retries,
            delay_seconds=policy.retry_delay_seconds,
        )

    async def _run(
        self,
        definition: CompiledWorkflowDefinition,
        factory: WorkflowAgentFactory,
        request: WorkflowExecutionRequest,
        *,
        mode: str,
    ) -> WorkflowRunResponse:
        workflow = self._compiler.compile(definition, factory)
        orchestrator = Orchestrator(failure_policy=FailurePolicy.FAIL_FAST)
        try:
            async with asyncio.timeout(definition.spec.settings.timeout_seconds):
                result = await orchestrator.run(
                    workflow,
                    inputs=request.inputs,
                    metadata=request.metadata,
                    raise_on_error=False,
                )
        except TimeoutError as error:
            raise TimeoutError(
                f"Workflow exceeded {definition.spec.settings.timeout_seconds:g} seconds"
            ) from error
        response = _run_response(result, mode=mode)
        if request.raise_on_error and response.failures:
            raise WorkflowRunFailedError(response)
        return response


def _run_response(result: WorkflowResult, *, mode: str) -> WorkflowRunResponse:
    nodes: dict[str, WorkflowNodeRun] = {}
    for node_id, execution in result.nodes.items():
        agent_result = execution.result
        nodes[node_id] = WorkflowNodeRun(
            agent_id=execution.agent_id,
            status=execution.status.value,
            output=deepcopy(agent_result.output) if agent_result else None,
            error=execution.error,
            metadata=dict(agent_result.metadata) if agent_result else {},
            started_at=execution.started_at,
            completed_at=execution.completed_at,
        )
    return WorkflowRunResponse(
        run_id=result.run_id,
        workflow_id=result.workflow_id,
        status=result.status.value,
        mode=mode,
        outputs=deepcopy(result.outputs),
        failures=dict(result.failures),
        nodes=nodes,
        started_at=result.started_at,
        completed_at=result.completed_at,
    )


def _microsoft_model_config(model_config: WorkflowModelConfig) -> MicrosoftModelConfig:
    return MicrosoftModelConfig(
        provider=model_config.provider,
        model=model_config.model,
        temperature=model_config.temperature,
        top_p=model_config.top_p,
        max_tokens=model_config.max_tokens,
        presence_penalty=model_config.presence_penalty,
        frequency_penalty=model_config.frequency_penalty,
        seed=model_config.seed,
        stream=model_config.stream,
    )


def _microsoft_agent_definition(agent: WorkflowAgentSpec) -> MicrosoftAgentDefinition:
    return MicrosoftAgentDefinition(
        id=agent.id,
        name=agent.name,
        display_name=agent.display_name,
        description=agent.description,
        instructions=agent.instructions,
        system_prompt=agent.system_prompt,
        user_prompt=agent.user_prompt,
        response_schema=agent.response_schema.parsed,
        metadata=agent.metadata,
    )


def _microsoft_tool_definition(tool: WorkflowToolSpec) -> MicrosoftToolDefinition:
    return MicrosoftToolDefinition(
        id=tool.id,
        name=tool.name,
        description=tool.description,
        configuration=tool.configuration,
        metadata=tool.metadata,
    )


def _pending_completion_gates(spec: WorkflowBuildSpec, approved: set[str]) -> list[str]:
    outgoing = {edge.from_agent_id for edge in spec.edges}
    gates: list[str] = []
    for agent in spec.agents:
        if not agent.metadata.get("humanInTheLoop"):
            continue
        if agent.id in outgoing:
            continue
        gate_id = f"{COMPLETION_GATE_PREFIX}{agent.id}"
        if gate_id not in approved:
            gates.append(gate_id)
    return gates


def _blocked_agent_ids(spec: WorkflowBuildSpec, approved: set[str]) -> set[str]:
    return {
        edge.to_agent_id
        for edge in spec.edges
        if edge.human_approval and edge.id not in approved
    }


def _slice_spec_before_gates(
    spec: WorkflowBuildSpec,
    approved: set[str],
) -> WorkflowBuildSpec:
    blocked = _blocked_agent_ids(spec, approved)
    agents = [agent for agent in spec.agents if agent.id not in blocked]
    allowed = {agent.id for agent in agents}
    tools = [tool for tool in spec.tools if tool.agent_id in allowed]
    edges = [
        edge
        for edge in spec.edges
        if edge.from_agent_id in allowed and edge.to_agent_id in allowed
    ]
    return spec.model_copy(update={"agents": agents, "tools": tools, "edges": edges})


def _assert_revision_limit(pending_edges: list[WorkflowEdgeSpec], revision_count: int) -> None:
    limits = [
        edge.max_feedback_revisions
        for edge in pending_edges
        if edge.feedback_revisions_enabled
    ]
    if not limits:
        return
    limit = min(limits)
    if revision_count > limit:
        raise FeedbackRevisionLimitError(limit)


def _with_reviewer_inputs(request: WorkflowExecutionRequest) -> WorkflowExecutionRequest:
    feedback = request.reviewer_feedback.strip()
    if not feedback and request.previous_output is None:
        return request
    inputs = dict(request.inputs)
    if feedback:
        inputs["reviewerFeedback"] = feedback
        inputs["revisionCount"] = request.revision_count
    if request.previous_output is not None:
        inputs["previousAgentOutput"] = request.previous_output
    return request.model_copy(update={"inputs": inputs})


def _with_reviewer_prompt(
    spec: WorkflowBuildSpec,
    request: WorkflowExecutionRequest,
    pending_edges: list[WorkflowEdgeSpec],
) -> WorkflowBuildSpec:
    feedback = request.reviewer_feedback.strip()
    if not feedback:
        return spec
    revision_ids = {
        edge.from_agent_id
        for edge in pending_edges
        if edge.feedback_revisions_enabled
    }
    if not revision_ids:
        revision_ids = {
            agent.id
            for agent in spec.agents
            if agent.metadata.get("humanInTheLoop")
            and agent.metadata.get("feedbackRevisionsEnabled")
        }
    if not revision_ids:
        return spec
    note = (
        "\n\nHuman reviewer requested changes. Revise your previous answer until it "
        f"addresses this feedback:\n{feedback}"
    )
    if request.previous_output is not None:
        note += f"\n\nYour previous output:\n{request.previous_output}"
    agents = [
        agent.model_copy(update={"user_prompt": f"{agent.user_prompt}{note}".strip()})
        if agent.id in revision_ids
        else agent
        for agent in spec.agents
    ]
    return spec.model_copy(update={"agents": agents})


def _gates_after_run(
    spec: WorkflowBuildSpec,
    approved: set[str],
    response: WorkflowRunResponse,
) -> list[str]:
    waiting: list[str] = []
    for edge in spec.edges:
        if not edge.human_approval or edge.id in approved:
            continue
        source = response.nodes.get(edge.from_agent_id)
        if source and source.status == "completed":
            waiting.append(edge.id)
    for gate_id in _pending_completion_gates(spec, approved):
        agent_id = gate_id.removeprefix(COMPLETION_GATE_PREFIX)
        source = response.nodes.get(agent_id)
        if source and source.status == "completed":
            waiting.append(gate_id)
    return waiting
