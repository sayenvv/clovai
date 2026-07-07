"""Workflow state persistence abstraction."""

from abc import ABC, abstractmethod

from eleven_nodes.domain.models import WorkflowRun


class StateStore(ABC):
    """Boundary for persisting and retrieving workflow run state."""

    @abstractmethod
    async def save(self, run: WorkflowRun) -> None:
        """Create or replace a workflow run snapshot."""

    @abstractmethod
    async def get(self, run_id: str) -> WorkflowRun | None:
        """Retrieve a workflow run snapshot when it exists."""

    async def contains(self, run_id: str) -> bool:
        """Return whether a run exists using the implementation's retrieval behavior."""
        return await self.get(run_id) is not None
