"""Group-chat pattern: participants plus a required manager."""

from __future__ import annotations

from eleven_nodes import Workflow

from app.modules.workflows.compiler import WorkflowAgentFactory
from app.modules.workflows.orchestration.graph import dependencies_from_spec
from app.modules.workflows.orchestration.patterns.base import build_workflow_graph
from app.modules.workflows.schemas import WorkflowBuildSpec


def resolve_groupchat_manager_id(spec: WorkflowBuildSpec) -> str:
    from app.modules.workflows.orchestration.factory import OrchestrationPatternError

    manager_id = _configured_or_flagged_manager(spec)
    if manager_id is None:
        raise OrchestrationPatternError(
            "Group-chat workflows need a manager (isManager, isOrchestrator, or "
            "settings.orchestration.managerAgentId)."
        )
    return manager_id


def build_groupchat(
    spec: WorkflowBuildSpec,
    agent_factory: WorkflowAgentFactory | None = None,
) -> Workflow:
    return build_workflow_graph(spec, dependencies_from_spec(spec), agent_factory)


def _configured_or_flagged_manager(spec: WorkflowBuildSpec) -> str | None:
    from app.modules.workflows.orchestration.factory import OrchestrationPatternError

    known = {agent.id for agent in spec.agents}
    configured = spec.settings.orchestration.manager_agent_id if spec.settings.orchestration else None
    if configured:
        if configured not in known:
            raise OrchestrationPatternError(
                f"settings.orchestration.managerAgentId '{configured}' is not an agent in this workflow."
            )
        return configured
    flagged = [
        agent.id
        for agent in spec.agents
        if agent.is_manager or agent.is_orchestrator
    ]
    if len(flagged) > 1:
        raise OrchestrationPatternError(
            "Group-chat workflows have multiple managers; set settings.orchestration.managerAgentId."
        )
    if len(flagged) == 1:
        return flagged[0]
    return None
