"""Convenience adapters for creating agents from callables."""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from typing import Any

from eleven_nodes.domain.models import AgentContext, AgentResult
from eleven_nodes.ports.agent import Agent

AgentCallable = Callable[[AgentContext], AgentResult | Any | Awaitable[AgentResult | Any]]


class FunctionAgent(Agent):
    """Adapt a synchronous or asynchronous function to the Agent interface."""

    def __init__(
        self,
        agent_id: str,
        function: AgentCallable,
        *,
        name: str | None = None,
        description: str = "",
    ) -> None:
        super().__init__(agent_id, name=name, description=description)
        self._function = function

    async def execute(self, context: AgentContext) -> AgentResult | Any:
        result = self._function(context)
        if inspect.isawaitable(result):
            return await result
        return result
