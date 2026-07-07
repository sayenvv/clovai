"""Agent abstraction."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from eleven_nodes.domain.models import AgentContext, AgentResult


class Agent(ABC):
    """Base class and lifecycle template for every workflow agent.

    Subclasses implement :meth:`execute`. Lifecycle hooks may be overridden
    when an integration needs setup, telemetry, or cleanup behavior.
    """

    def __init__(self, agent_id: str, *, name: str | None = None, description: str = "") -> None:
        if not agent_id.strip():
            raise ValueError("agent_id cannot be empty")
        self._agent_id = agent_id
        self._name = name or agent_id
        self._description = description

    @property
    def agent_id(self) -> str:
        return self._agent_id

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    async def run(self, context: AgentContext) -> AgentResult | Any:
        """Run the shared lifecycle around the subclass implementation."""
        await self.before_execute(context)
        try:
            result = await self.execute(context)
        except Exception as error:
            await self.on_error(context, error)
            raise
        await self.after_execute(context, result)
        return result

    async def before_execute(self, context: AgentContext) -> None:
        """Hook called immediately before execution."""
        return None

    async def after_execute(self, context: AgentContext, result: AgentResult | Any) -> None:
        """Hook called after successful execution."""
        return None

    async def on_error(self, context: AgentContext, error: Exception) -> None:
        """Hook called when execution raises an exception."""
        return None

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult | Any:
        """Execute the agent and return a result or a raw output value."""
