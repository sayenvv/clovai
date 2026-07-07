import pytest

from app.modules.workflows.executor_source_generator import (
    GenerateExecutorSourceRequest,
    _normalize_python,
    generate_executor_source,
)


def test_normalize_python_rewrites_agent_framework_imports():
    source = """
from agent_framework import Executor, WorkflowContext, handler
import agent_framework
await agent_framework.something()
"""
    normalized = _normalize_python(source)
    assert "from elevennodes import" in normalized
    assert "import elevennodes" in normalized
    assert "elevennodes.something" in normalized
    assert "agent_framework" not in normalized


def test_generate_executor_source_template_uses_elevennodes_imports(monkeypatch):
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    result = generate_executor_source(
        GenerateExecutorSourceRequest(
            executor_name="Summarizer",
            description="Summarize incoming text.",
            handler_kind="class",
            executor_id="summarizer_executor",
        ),
    )

    assert result.origin == "template"
    assert "from elevennodes import" in result.source
    assert "agent_framework" not in result.source
    assert "SummarizerExecutor" in result.source


def test_generate_executor_source_function_template(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    result = generate_executor_source(
        GenerateExecutorSourceRequest(
            executor_name="Transform",
            description="Normalize payloads.",
            handler_kind="function",
            executor_id="transform_step",
        ),
    )

    assert "@executor" in result.source
    assert 'id="transform_step"' in result.source
    assert "from elevennodes import WorkflowContext, executor" in result.source


def test_elevennodes_executor_extends_framework_executor():
    pytest.importorskip("agent_framework")
    from agent_framework import Executor as FrameworkExecutor
    from elevennodes import Executor

    assert issubclass(Executor, FrameworkExecutor)
