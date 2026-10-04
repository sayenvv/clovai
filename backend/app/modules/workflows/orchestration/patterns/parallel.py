"""Fan-out / fan-in parallel layers from workflow edges."""

from __future__ import annotations

from eleven_nodes import Workflow

from app.modules.workflows.compiler import CompiledWorkflowDefinition, WorkflowAgentFactory
from app.modules.workflows.orchestration.patterns.base import build_workflow_graph
from app.modules.workflows.schemas import WorkflowBuildSpec


def build_parallel(
    spec: WorkflowBuildSpec,
    definition: CompiledWorkflowDefinition,
    agent_factory: WorkflowAgentFactory | None = None,
) -> Workflow:
    return build_workflow_graph(spec, definition.dependencies, agent_factory)
