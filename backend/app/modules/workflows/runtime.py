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
        definition = self._compiler.prepare(spec)
        required_approvals = {
            edge.id for edge in spec.edges if edge.human_approval
        } - request.approved_edge_ids
        if required_approvals:
            raise ApprovalRequiredError(sorted(required_approvals))
        factory = self._with_retries(
            definition,
            self._execution_factory_builder(llm_settings_to_workflow_model_config()),
        )
        return await self._run(definition, factory, request, mode="execute")

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
