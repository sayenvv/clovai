"""Eleven Nodes workflow executor runtime — public API is ``elevennodes`` only.

Agent Framework types are re-exported here so user handler code never imports
``agent_framework`` directly.
"""

from __future__ import annotations

from typing import Any


def _load_framework_executor_api() -> tuple[type[Any], type[Any], Any, Any]:
    try:
        from agent_framework import Executor as _FrameworkExecutor
        from agent_framework import WorkflowContext as _FrameworkWorkflowContext
        from agent_framework import executor as _framework_executor
        from agent_framework import handler as _framework_handler
    except ImportError as error:
        raise ImportError(
            "Eleven Nodes workflow executors require the workflow runtime. "
            "Install with: pip install eleven-nodes[microsoft]"
        ) from error

    return _FrameworkExecutor, _FrameworkWorkflowContext, _framework_handler, _framework_executor


_FrameworkExecutor, _FrameworkWorkflowContext, handler, executor = _load_framework_executor_api()


class Executor(_FrameworkExecutor):
    """Base class for Eleven Nodes workflow executor steps."""


WorkflowContext = _FrameworkWorkflowContext

__all__ = ["Executor", "WorkflowContext", "executor", "handler"]
