"""Build an orchestration graph from schema 3.0 workflow JSON."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from eleven_nodes import Workflow

from app.modules.workflows.compiler import (
    CompiledWorkflowDefinition,
    WorkflowAgentFactory,
    WorkflowCompiler,
    WorkflowDefinitionError,
)
from app.modules.workflows.orchestration.graph import start_agent_ids
from app.modules.workflows.orchestration.normalize import OrchestrationDocument, from_orchestrate_payload
from app.modules.workflows.orchestration.patterns.groupchat import (
    build_groupchat,
    resolve_groupchat_manager_id,
)
from app.modules.workflows.orchestration.patterns.handoff import build_handoff, resolve_start_agent_id
from app.modules.workflows.orchestration.patterns.magnetic import (
    build_magnetic,
    resolve_magnetic_manager_id,
)
from app.modules.workflows.orchestration.patterns.parallel import build_parallel
from app.modules.workflows.orchestration.patterns.sequential import build_sequential
from app.modules.workflows.schemas import WorkflowBuildSpec


class OrchestrationPatternError(ValueError):
    """Raised when JSON cannot be mapped onto an orchestration pattern."""


@dataclass(frozen=True, slots=True)
class BuiltOrchestration:
    pattern: str
    workflow: Workflow
    spec: WorkflowBuildSpec
    nested: dict[str, WorkflowBuildSpec] = field(default_factory=dict)
    execution_layers: tuple[tuple[str, ...], ...] = ()
    start_agent_id: str | None = None
    manager_agent_id: str | None = None


class OrchestrationWorkflowFactory:
    """Dispatch schema 3.0 JSON onto sequential, parallel, handoff, groupchat, or magnetic graphs."""

    def __init__(
        self,
        *,
        compiler: WorkflowCompiler | None = None,
        agent_factory: WorkflowAgentFactory | None = None,
    ) -> None:
        self._compiler = compiler or WorkflowCompiler()
        self._agent_factory = agent_factory

    def from_spec(
        self,
        spec: WorkflowBuildSpec,
        nested: dict[str, WorkflowBuildSpec] | None = None,
    ) -> BuiltOrchestration:
        pattern = spec.meta.workflow_type
        nested_specs = nested or {}
        if pattern == "sequential":
            definition = self._prepare_dag(spec)
            return BuiltOrchestration(
                pattern=pattern,
                workflow=build_sequential(spec, definition, self._agent_factory),
                spec=spec,
                nested=nested_specs,
                execution_layers=definition.execution_layers,
                start_agent_id=_single_or_configured_start(spec, definition),
            )
        if pattern == "parallel":
            definition = self._prepare_dag(spec)
            return BuiltOrchestration(
                pattern=pattern,
                workflow=build_parallel(spec, definition, self._agent_factory),
                spec=spec,
                nested=nested_specs,
                execution_layers=definition.execution_layers,
                start_agent_id=_single_or_configured_start(spec, definition),
            )
        if pattern == "handoff":
            start_agent_id = resolve_start_agent_id(spec)
            workflow = build_handoff(spec, self._agent_factory)
            return BuiltOrchestration(
                pattern=pattern,
                workflow=workflow,
                spec=spec,
                nested=nested_specs,
                execution_layers=workflow.layers(),
                start_agent_id=start_agent_id,
            )
        if pattern == "groupchat":
            manager_agent_id = resolve_groupchat_manager_id(spec)
            workflow = build_groupchat(spec, self._agent_factory)
            return BuiltOrchestration(
                pattern=pattern,
                workflow=workflow,
                spec=spec,
                nested=nested_specs,
                execution_layers=workflow.layers(),
                manager_agent_id=manager_agent_id,
            )
        if pattern == "magnetic":
            manager_agent_id = resolve_magnetic_manager_id(spec)
            workflow = build_magnetic(spec, self._agent_factory)
            return BuiltOrchestration(
                pattern=pattern,
                workflow=workflow,
                spec=spec,
                nested=nested_specs,
                execution_layers=workflow.layers(),
                manager_agent_id=manager_agent_id,
            )
        raise OrchestrationPatternError(f"Unsupported workflowType '{pattern}'.")

    def from_orchestrate_payload(self, payload: dict[str, Any]) -> BuiltOrchestration:
        document = from_orchestrate_payload(payload)
        return self.from_document(document)

    def from_document(self, document: OrchestrationDocument) -> BuiltOrchestration:
        return self.from_spec(document.spec, document.nested)

    def _prepare_dag(self, spec: WorkflowBuildSpec) -> CompiledWorkflowDefinition:
        try:
            return self._compiler.prepare(spec)
        except WorkflowDefinitionError as error:
            raise OrchestrationPatternError(str(error)) from error


def _single_or_configured_start(
    spec: WorkflowBuildSpec,
    definition: CompiledWorkflowDefinition,
) -> str | None:
    configured = spec.settings.orchestration.start_agent_id if spec.settings.orchestration else None
    if configured:
        return configured
    starts = start_agent_ids(definition.dependencies)
    if len(starts) == 1:
        return starts[0]
    if definition.execution_layers and len(definition.execution_layers[0]) == 1:
        return definition.execution_layers[0][0]
    return None
