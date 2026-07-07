"""Pure domain models used by the orchestration engine."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from types import MappingProxyType
from typing import Any

from eleven_nodes.domain.errors import InvalidStateTransitionError


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)


class NodeStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class RunStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class FailurePolicy(StrEnum):
    FAIL_FAST = "fail_fast"
    CONTINUE = "continue"


class EventType(StrEnum):
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_COMPLETED = "workflow_completed"
    WORKFLOW_FAILED = "workflow_failed"
    NODE_STARTED = "node_started"
    NODE_COMPLETED = "node_completed"
    NODE_FAILED = "node_failed"
    NODE_SKIPPED = "node_skipped"


@dataclass(frozen=True, slots=True)
class Message:
    """A structured message exchanged by agents."""

    sender: str
    recipient: str | None
    content: Any
    topic: str = "default"
    metadata: Mapping[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True, slots=True)
class AgentContext:
    """Read-only execution data provided to an agent."""

    run_id: str
    workflow_id: str
    node_id: str
    inputs: Mapping[str, Any]
    dependency_results: Mapping[str, AgentResult]
    messages: tuple[Message, ...] = ()
    metadata: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        *,
        run_id: str,
        workflow_id: str,
        node_id: str,
        inputs: Mapping[str, Any],
        dependency_results: Mapping[str, AgentResult],
        messages: tuple[Message, ...] = (),
        metadata: Mapping[str, Any] | None = None,
    ) -> AgentContext:
        """Copy and freeze mappings at the agent boundary."""
        return cls(
            run_id=run_id,
            workflow_id=workflow_id,
            node_id=node_id,
            inputs=MappingProxyType(dict(inputs)),
            dependency_results=MappingProxyType(dict(dependency_results)),
            messages=messages,
            metadata=MappingProxyType(dict(metadata or {})),
        )


@dataclass(frozen=True, slots=True)
class AgentResult:
    """The normalized output produced by an agent."""

    output: Any = None
    messages: tuple[Message, ...] = ()
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class NodeExecution:
    """Mutable state for a node during a workflow run."""

    node_id: str
    agent_id: str
    status: NodeStatus = NodeStatus.PENDING
    result: AgentResult | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    def start(self) -> None:
        """Move a pending node into its running state."""
        self._require_status(NodeStatus.PENDING)
        self.status = NodeStatus.RUNNING
        self.started_at = utc_now()

    def complete(self, result: AgentResult) -> None:
        """Finish a running node successfully."""
        self._require_status(NodeStatus.RUNNING)
        self.status = NodeStatus.COMPLETED
        self.result = result
        self.completed_at = utc_now()

    def fail(self, error: BaseException) -> None:
        """Finish a running node with a normalized error description."""
        self._require_status(NodeStatus.RUNNING)
        self.status = NodeStatus.FAILED
        self.error = f"{type(error).__name__}: {error}"
        self.completed_at = utc_now()

    def skip(self) -> None:
        """Skip a pending node whose dependencies cannot be satisfied."""
        self._require_status(NodeStatus.PENDING)
        self.status = NodeStatus.SKIPPED
        self.completed_at = utc_now()

    def _require_status(self, expected: NodeStatus) -> None:
        if self.status is not expected:
            message = (
                f"Node '{self.node_id}' must be '{expected.value}' before this transition; "
                f"current status is '{self.status.value}'"
            )
            raise InvalidStateTransitionError(message)


@dataclass(slots=True)
class WorkflowRun:
    """State snapshot of one workflow execution."""

    run_id: str
    workflow_id: str
    status: RunStatus
    nodes: dict[str, NodeExecution]
    inputs: Mapping[str, Any]
    metadata: Mapping[str, Any]
    created_at: datetime = field(default_factory=utc_now)
    started_at: datetime | None = None
    completed_at: datetime | None = None

    def finish(self) -> None:
        """Derive and set the final run state from its node executions."""
        if self.status is not RunStatus.RUNNING:
            message = f"Run '{self.run_id}' cannot finish from status '{self.status.value}'"
            raise InvalidStateTransitionError(message)
        self.status = (
            RunStatus.FAILED
            if any(node.status is NodeStatus.FAILED for node in self.nodes.values())
            else RunStatus.COMPLETED
        )
        self.completed_at = utc_now()


@dataclass(frozen=True, slots=True)
class WorkflowResult:
    """Stable result returned to framework consumers."""

    run_id: str
    workflow_id: str
    status: RunStatus
    nodes: Mapping[str, NodeExecution]
    started_at: datetime
    completed_at: datetime

    @property
    def outputs(self) -> dict[str, Any]:
        """Return successful node outputs keyed by node identifier."""
        return {
            node_id: execution.result.output
            for node_id, execution in self.nodes.items()
            if execution.status is NodeStatus.COMPLETED and execution.result is not None
        }

    @property
    def failures(self) -> dict[str, str]:
        """Return failed node errors keyed by node identifier."""
        return {
            node_id: execution.error or "Unknown error"
            for node_id, execution in self.nodes.items()
            if execution.status is NodeStatus.FAILED
        }


@dataclass(frozen=True, slots=True)
class ExecutionEvent:
    """Event emitted as orchestration state changes."""

    type: EventType
    run_id: str
    workflow_id: str
    node_id: str | None = None
    data: Mapping[str, Any] = field(default_factory=dict)
    occurred_at: datetime = field(default_factory=utc_now)
