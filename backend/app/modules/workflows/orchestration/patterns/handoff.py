"""Handoff pattern: start node plus allowed transfers from edges."""

from __future__ import annotations

from eleven_nodes import Workflow

from app.modules.workflows.compiler import WorkflowAgentFactory
from app.modules.workflows.orchestration.graph import dependencies_from_spec, start_agent_ids
from app.modules.workflows.orchestration.patterns.base import build_workflow_graph
from app.modules.workflows.schemas import WorkflowBuildSpec


def resolve_start_agent_id(spec: WorkflowBuildSpec) -> str:
    from app.modules.workflows.orchestration.factory import OrchestrationPatternError

    configured = spec.settings.orchestration.start_agent_id if spec.settings.orchestration else None
    known = {agent.id for agent in spec.agents}
    if configured:
        if configured not in known:
            raise OrchestrationPatternError(
                f"settings.orchestration.startAgentId '{configured}' is not an agent in this workflow."
            )
        return configured
    starts = start_agent_ids(dependencies_from_spec(spec))
    if len(starts) == 1:
        return starts[0]
    if len(starts) == 0:
        raise OrchestrationPatternError("Handoff workflows need a start agent (in-degree 0 or startAgentId).")
    raise OrchestrationPatternError(
        "Handoff workflows need exactly one start agent; set settings.orchestration.startAgentId."
    )


def build_handoff(
    spec: WorkflowBuildSpec,
    agent_factory: WorkflowAgentFactory | None = None,
) -> Workflow:
    return build_workflow_graph(spec, dependencies_from_spec(spec), agent_factory)
