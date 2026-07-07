"""Compile saved workflow JSON into an ElevenNodes workflow graph."""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from eleven_nodes import Agent, FunctionAgent, InvalidWorkflowError, Workflow, WorkflowBuilder

from app.modules.workflows.schemas import (
    WorkflowAgentSpec,
    WorkflowBuildSpec,
    WorkflowToolSpec,
    WorkflowValidationIssue,
    WorkflowValidationReport,
    WorkflowValidationSummary,
)

SUPPORTED_PROVIDERS = {"openai", "azure-openai", "azure_openai"}
SUPPORTED_INTEGRATIONS = {"web_search"}
SUPPORTED_WORKFLOW_TYPES = {"sequential", "parallel"}


class WorkflowDefinitionError(ValueError):
    """Raised when a JSON workflow cannot be compiled safely."""

    def __init__(self, report: WorkflowValidationReport) -> None:
        self.report = report
        super().__init__("Workflow definition is invalid")


class WorkflowAgentFactory(Protocol):
    """Create an ElevenNodes agent from one JSON agent definition."""

    def create(
        self,
        agent: WorkflowAgentSpec,
        tools: Sequence[WorkflowToolSpec],
    ) -> Agent: ...


@dataclass(frozen=True, slots=True)
class CompiledWorkflowDefinition:
    """Validated execution plan derived from a workflow specification."""

    spec: WorkflowBuildSpec
    dependencies: dict[str, tuple[str, ...]]
    execution_layers: tuple[tuple[str, ...], ...]


class WorkflowCompiler:
    """Validate workflow semantics and create provider-backed graph nodes."""

    def validate(self, spec: WorkflowBuildSpec) -> WorkflowValidationReport:
        issues: list[WorkflowValidationIssue] = []
        agent_ids = [agent.id for agent in spec.agents]
        tool_ids = [tool.id for tool in spec.tools]
        edge_ids = [edge.id for edge in spec.edges]
        known_agents = set(agent_ids)
        known_tools = set(tool_ids)

        if spec.meta.schema_version != "3.0":
            issues.append(
                self._error(
                    "unsupported_schema_version",
                    "Only workflow schemaVersion '3.0' is supported.",
                    "meta.schemaVersion",
                )
            )
        if not spec.agents:
            issues.append(
                self._error("empty_workflow", "At least one agent is required.", "agents")
            )

        self._report_duplicates("agent", agent_ids, "agents", issues)
        self._report_duplicates("tool", tool_ids, "tools", issues)
        self._report_duplicates("edge", edge_ids, "edges", issues)

        provider = spec.model_config_data.provider.strip().lower()
        if provider not in SUPPORTED_PROVIDERS:
            issues.append(
                self._error(
                    "unsupported_provider",
                    f"Provider '{spec.model_config_data.provider}' is not supported by execution.",
                    "modelConfig.provider",
                )
            )
        if spec.meta.workflow_type not in SUPPORTED_WORKFLOW_TYPES:
            issues.append(
                self._error(
                    "unsupported_workflow_type",
                    (
                        f"Workflow type '{spec.meta.workflow_type}' needs a dedicated runtime; "
                        "this backend currently compiles sequential and parallel DAGs."
                    ),
                    "meta.workflowType",
                )
            )

        name_counts = Counter(agent.name for agent in spec.agents)
        for name, count in name_counts.items():
            if count > 1:
                issues.append(
                    self._warning(
                        "duplicate_agent_name",
                        f"Agent name '{name}' is used {count} times; node IDs remain unique.",
                        "agents",
                    )
                )

        tools_by_id = {tool.id: tool for tool in spec.tools}
        referenced_tools: set[str] = set()
        for index, agent in enumerate(spec.agents):
            if not (agent.system_prompt.strip() or agent.instructions.strip()):
                issues.append(
                    self._warning(
                        "missing_agent_instructions",
                        f"Agent '{agent.id}' has no system prompt or instructions.",
                        f"agents.{index}",
                    )
                )
            for tool_id in agent.tool_ids:
                referenced_tools.add(tool_id)
                if tool_id not in known_tools:
                    issues.append(
                        self._error(
                            "unknown_agent_tool",
                            f"Agent '{agent.id}' references missing tool '{tool_id}'.",
                            f"agents.{index}.toolIds",
                        )
                    )
                    continue
                if tools_by_id[tool_id].agent_id != agent.id:
                    issues.append(
                        self._error(
                            "tool_owner_mismatch",
                            f"Tool '{tool_id}' is not assigned to agent '{agent.id}'.",
                            f"agents.{index}.toolIds",
                        )
                    )

        for index, tool in enumerate(spec.tools):
            if tool.agent_id not in known_agents:
                issues.append(
                    self._error(
                        "unknown_tool_agent",
                        f"Tool '{tool.id}' targets missing agent '{tool.agent_id}'.",
                        f"tools.{index}.agentId",
                    )
                )
            integrations = tool.configuration.get("integrations", [])
            if not isinstance(integrations, list):
                issues.append(
                    self._error(
                        "invalid_tool_integrations",
                        f"Tool '{tool.id}' integrations must be an array.",
                        f"tools.{index}.configuration.integrations",
                    )
                )
            elif not all(isinstance(integration, str) for integration in integrations):
                issues.append(
                    self._error(
                        "invalid_tool_integrations",
                        f"Tool '{tool.id}' integrations must contain only strings.",
                        f"tools.{index}.configuration.integrations",
                    )
                )
            else:
                unsupported = sorted(set(integrations) - SUPPORTED_INTEGRATIONS)
                if unsupported:
                    issues.append(
                        self._error(
                            "unsupported_tool_integration",
                            f"Tool '{tool.id}' uses unsupported integrations: {', '.join(unsupported)}.",
                            f"tools.{index}.configuration.integrations",
                        )
                    )
            if tool.id not in referenced_tools:
                issues.append(
                    self._warning(
                        "unreferenced_tool",
                        f"Tool '{tool.id}' is not referenced by its agent.",
                        f"tools.{index}",
                    )
                )

        dependencies: dict[str, list[str]] = {agent_id: [] for agent_id in agent_ids}
        seen_connections: set[tuple[str, str]] = set()
        for index, edge in enumerate(spec.edges):
            path = f"edges.{index}"
            if edge.from_agent_id not in known_agents:
                issues.append(
                    self._error(
                        "unknown_edge_source",
                        f"Edge '{edge.id}' has missing source '{edge.from_agent_id}'.",
                        f"{path}.fromAgentId",
                    )
                )
            if edge.to_agent_id not in known_agents:
                issues.append(
                    self._error(
                        "unknown_edge_target",
                        f"Edge '{edge.id}' has missing target '{edge.to_agent_id}'.",
                        f"{path}.toAgentId",
                    )
                )
            if edge.from_agent_id == edge.to_agent_id:
                issues.append(
                    self._error(
                        "self_edge",
                        f"Edge '{edge.id}' connects an agent to itself.",
                        path,
                    )
                )
            connection = (edge.from_agent_id, edge.to_agent_id)
            if connection in seen_connections:
                issues.append(
                    self._error(
                        "duplicate_connection",
                        f"Multiple edges connect '{connection[0]}' to '{connection[1]}'.",
                        path,
                    )
                )
            seen_connections.add(connection)
            if edge.from_agent_id in known_agents and edge.to_agent_id in known_agents:
                dependencies[edge.to_agent_id].append(edge.from_agent_id)
            if edge.human_approval:
                issues.append(
                    self._warning(
                        "approval_required",
                        f"Execution requires pre-approval for edge '{edge.id}'.",
                        path,
                    )
                )

        layers: list[list[str]] = []
        if not any(issue.severity == "error" for issue in issues):
            try:
                graph = self._build_graph(spec, dependencies)
                layers = [list(layer) for layer in graph.layers()]
            except InvalidWorkflowError as error:
                issues.append(self._error("invalid_graph", str(error), "edges"))

        if spec.settings.stream_response or spec.model_config_data.stream:
            issues.append(
                self._warning(
                    "streaming_not_enabled",
                    "The current execute endpoint returns an atomic workflow result.",
                    "settings.streamResponse",
                )
            )

        return WorkflowValidationReport(
            valid=not any(issue.severity == "error" for issue in issues),
            workflow_id=spec.meta.workflow_id,
            schema_version=spec.meta.schema_version,
            issues=issues,
            summary=WorkflowValidationSummary(
                agent_count=len(spec.agents),
                tool_count=len(spec.tools),
                edge_count=len(spec.edges),
                execution_layers=layers,
                approval_edge_ids=[edge.id for edge in spec.edges if edge.human_approval],
            ),
        )

    def prepare(self, spec: WorkflowBuildSpec) -> CompiledWorkflowDefinition:
        report = self.validate(spec)
        if not report.valid:
            raise WorkflowDefinitionError(report)
        dependencies: dict[str, list[str]] = {agent.id: [] for agent in spec.agents}
        for edge in spec.edges:
            dependencies[edge.to_agent_id].append(edge.from_agent_id)
        return CompiledWorkflowDefinition(
            spec=spec,
            dependencies={
                node_id: tuple(sorted(node_dependencies))
                for node_id, node_dependencies in dependencies.items()
            },
            execution_layers=tuple(tuple(layer) for layer in report.summary.execution_layers),
        )

    def compile(
        self,
        definition: CompiledWorkflowDefinition,
        agent_factory: WorkflowAgentFactory,
    ) -> Workflow:
        spec = definition.spec
        tools_by_agent: dict[str, list[WorkflowToolSpec]] = defaultdict(list)
        tools_by_id = {tool.id: tool for tool in spec.tools}
        for agent in spec.agents:
            for tool_id in agent.tool_ids:
                tools_by_agent[agent.id].append(tools_by_id[tool_id])

        builder = WorkflowBuilder(spec.meta.workflow_id, name=spec.meta.workflow_name)
        for agent in spec.agents:
            builder.add_agent(
                agent_factory.create(agent, tools_by_agent[agent.id]),
                node_id=agent.id,
                depends_on=definition.dependencies[agent.id],
            )
        return builder.build()

    @staticmethod
    def _build_graph(spec: WorkflowBuildSpec, dependencies: dict[str, list[str]]) -> Workflow:
        builder = WorkflowBuilder(spec.meta.workflow_id, name=spec.meta.workflow_name)
        for agent in spec.agents:
            builder.add_agent(
                FunctionAgent(agent.id, lambda context: context.node_id),
                node_id=agent.id,
                depends_on=dependencies[agent.id],
            )
        return builder.build()

    @staticmethod
    def _report_duplicates(
        kind: str,
        values: list[str],
        path: str,
        issues: list[WorkflowValidationIssue],
    ) -> None:
        for value, count in Counter(values).items():
            if count > 1:
                issues.append(
                    WorkflowCompiler._error(
                        f"duplicate_{kind}_id",
                        f"{kind.title()} ID '{value}' occurs {count} times.",
                        path,
                    )
                )

    @staticmethod
    def _error(code: str, message: str, path: str | None = None) -> WorkflowValidationIssue:
        return WorkflowValidationIssue(severity="error", code=code, message=message, path=path)

    @staticmethod
    def _warning(code: str, message: str, path: str | None = None) -> WorkflowValidationIssue:
        return WorkflowValidationIssue(severity="warning", code=code, message=message, path=path)
