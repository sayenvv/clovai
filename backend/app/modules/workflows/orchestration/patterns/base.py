"""Shared graph construction for orchestration patterns."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from eleven_nodes import Agent, FunctionAgent, Workflow, WorkflowBuilder

from app.modules.workflows.compiler import WorkflowAgentFactory
from app.modules.workflows.schemas import WorkflowAgentSpec, WorkflowBuildSpec, WorkflowToolSpec


def placeholder_agent(agent_id: str) -> FunctionAgent:
    return FunctionAgent(agent_id, lambda context: context.node_id)


def build_workflow_graph(
    spec: WorkflowBuildSpec,
    dependencies: Mapping[str, Sequence[str]],
    agent_factory: WorkflowAgentFactory | None = None,
) -> Workflow:
    tools_by_id = {tool.id: tool for tool in spec.tools}
    builder = WorkflowBuilder(spec.meta.workflow_id, name=spec.meta.workflow_name)
    for agent in spec.agents:
        node = _create_agent(agent, tools_by_id, agent_factory)
        builder.add_agent(node, node_id=agent.id, depends_on=dependencies.get(agent.id, ()))
    return builder.build()


def _create_agent(
    agent: WorkflowAgentSpec,
    tools_by_id: dict[str, WorkflowToolSpec],
    agent_factory: WorkflowAgentFactory | None,
) -> Agent:
    if agent_factory is None:
        return placeholder_agent(agent.id)
    tools = [tools_by_id[tool_id] for tool_id in agent.tool_ids if tool_id in tools_by_id]
    return agent_factory.create(agent, tools)
