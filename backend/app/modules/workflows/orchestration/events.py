"""Queue-backed publisher used to stream orchestration events over SSE."""

from __future__ import annotations

import asyncio
from typing import Any

from eleven_nodes.domain.models import ExecutionEvent
from eleven_nodes.ports.events import EventPublisher

STREAM_DONE = object()
StreamItem = ExecutionEvent | dict[str, Any] | object


class QueueEventPublisher(EventPublisher):
    def __init__(self, queue: asyncio.Queue[StreamItem]) -> None:
        self._queue = queue

    async def publish(self, event: ExecutionEvent) -> None:
        await self._queue.put(event)

    async def publish_payload(self, payload: dict[str, Any]) -> None:
        await self._queue.put(payload)

    async def close(self) -> None:
        await self._queue.put(STREAM_DONE)
