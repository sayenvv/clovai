"""Topology helpers shared by orchestration pattern builders."""

from __future__ import annotations

from app.modules.workflows.schemas import WorkflowBuildSpec


def dependencies_from_spec(spec: WorkflowBuildSpec) -> dict[str, tuple[str, ...]]:
    known = {agent.id for agent in spec.agents}
    dependencies: dict[str, list[str]] = {agent.id: [] for agent in spec.agents}
    for edge in spec.edges:
        if edge.from_agent_id in known and edge.to_agent_id in known:
            dependencies[edge.to_agent_id].append(edge.from_agent_id)
    return {
        node_id: tuple(sorted(set(node_dependencies)))
        for node_id, node_dependencies in dependencies.items()
    }


def start_agent_ids(dependencies: dict[str, tuple[str, ...]]) -> tuple[str, ...]:
    return tuple(sorted(node_id for node_id, deps in dependencies.items() if not deps))
