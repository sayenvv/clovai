"""Replaceable contracts owned by the application layer."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from eleven_nodes.domain.models import AgentContext, AgentResult, WorkflowResult, WorkflowRun

if TYPE_CHECKING:
    from eleven_nodes.application.workflow import Workflow, WorkflowNode


class WorkflowRunner(ABC):
    """Contract for services capable of executing workflow definitions."""

    @abstractmethod
    async def run(
        self,
        workflow: Workflow,
        *,
        inputs: Mapping[str, Any] | None = None,
        metadata: Mapping[str, Any] | None = None,
        run_id: str | None = None,
        raise_on_error: bool = False,
    ) -> WorkflowResult:
        """Execute a workflow and return its result."""

    @abstractmethod
    async def get_run(self, run_id: str) -> WorkflowRun | None:
        """Retrieve persisted execution state when available."""


class ContextFactory(ABC):
    """Contract for constructing the context passed into an agent."""

    @abstractmethod
    def create(self, workflow: Workflow, run: WorkflowRun, node: WorkflowNode) -> AgentContext:
        """Create an isolated context for a node execution."""


class ResultAdapter(ABC):
    """Contract for converting provider-specific outputs into agent results."""

    @abstractmethod
    def adapt(self, value: Any) -> AgentResult:
        """Normalize an arbitrary agent output."""
