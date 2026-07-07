"""Default event publisher implementations."""

import asyncio

from eleven_nodes.domain.models import ExecutionEvent
from eleven_nodes.ports.events import EventPublisher


class NullEventPublisher(EventPublisher):
    """Discard events when consumers do not configure telemetry."""

    async def publish(self, event: ExecutionEvent) -> None:
        return None


class InMemoryEventPublisher(EventPublisher):
    """Collect events in memory; useful for local apps and tests."""

    def __init__(self) -> None:
        self._events: list[ExecutionEvent] = []
        self._lock = asyncio.Lock()

    @property
    def events(self) -> tuple[ExecutionEvent, ...]:
        return tuple(self._events)

    async def publish(self, event: ExecutionEvent) -> None:
        async with self._lock:
            self._events.append(event)
