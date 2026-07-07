"""Workflow graph aggregate and fluent builder."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from types import MappingProxyType
from uuid import uuid4

from eleven_nodes.domain.errors import DuplicateNodeError, InvalidWorkflowError, NodeNotFoundError
from eleven_nodes.ports.agent import Agent


@dataclass(frozen=True, slots=True)
class WorkflowNode:
    """An agent placed in a directed workflow graph."""

    node_id: str
    agent: Agent
    dependencies: frozenset[str] = frozenset()


class Workflow:
    """Validated, immutable directed acyclic graph of agent nodes."""

    def __init__(
        self,
        workflow_id: str,
        nodes: Iterable[WorkflowNode],
        *,
        name: str | None = None,
    ) -> None:
        if not workflow_id.strip():
            raise ValueError("workflow_id cannot be empty")
        node_map: dict[str, WorkflowNode] = {}
        for node in nodes:
            if not node.node_id.strip():
                raise InvalidWorkflowError("node_id cannot be empty")
            if node.node_id in node_map:
                raise DuplicateNodeError(f"Duplicate node id: '{node.node_id}'")
            node_map[node.node_id] = node
        if not node_map:
            raise InvalidWorkflowError("A workflow must contain at least one node")

        self._workflow_id = workflow_id
        self._name = name or workflow_id
        self._nodes: Mapping[str, WorkflowNode] = MappingProxyType(node_map)
        self._layers = self._validate_and_build_layers()

    @property
    def workflow_id(self) -> str:
        return self._workflow_id

    @property
    def name(self) -> str:
        return self._name

    @property
    def nodes(self) -> Mapping[str, WorkflowNode]:
        return self._nodes

    def layers(self) -> tuple[tuple[str, ...], ...]:
        """Return deterministic topological layers that may execute concurrently."""
        return self._layers

    def _validate_and_build_layers(self) -> tuple[tuple[str, ...], ...]:
        """Validate references and compute the graph's reusable execution plan."""
        known = set(self._nodes)
        for node in self._nodes.values():
            missing = node.dependencies - known
            if missing:
                names = ", ".join(sorted(missing))
                message = f"Node '{node.node_id}' depends on missing node(s): {names}"
                raise NodeNotFoundError(message)
            if node.node_id in node.dependencies:
                raise InvalidWorkflowError(f"Node '{node.node_id}' cannot depend on itself")

        remaining = set(self._nodes)
        resolved: set[str] = set()
        layers: list[tuple[str, ...]] = []
        while remaining:
            ready = tuple(
                sorted(
                    node_id
                    for node_id in remaining
                    if self._nodes[node_id].dependencies <= resolved
                )
            )
            if not ready:
                raise InvalidWorkflowError("Workflow contains a dependency cycle")
            layers.append(ready)
            resolved.update(ready)
            remaining.difference_update(ready)
        return tuple(layers)


class WorkflowBuilder:
    """Fluent object-oriented API for constructing workflows."""

    def __init__(self, workflow_id: str | None = None, *, name: str | None = None) -> None:
        self._workflow_id = workflow_id or str(uuid4())
        self._name = name
        self._nodes: list[WorkflowNode] = []

    def add_agent(
        self,
        agent: Agent,
        *,
        node_id: str | None = None,
        depends_on: Iterable[str] = (),
    ) -> WorkflowBuilder:
        """Add an agent node and return the builder for chaining."""
        self._nodes.append(
            WorkflowNode(
                node_id=node_id or agent.agent_id,
                agent=agent,
                dependencies=frozenset(depends_on),
            )
        )
        return self

    def build(self) -> Workflow:
        """Validate and create an immutable workflow."""
        return Workflow(self._workflow_id, self._nodes, name=self._name)
