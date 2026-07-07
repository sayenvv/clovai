from unittest.mock import MagicMock, patch

from app.core.env import load_project_env
from app.core.llm_settings import chat_completions_headers, chat_completions_url, get_llm_settings
from app.modules.workflows.instruction_generator import (
    GenerateInstructionsRequest,
    generate_agent_instructions,
)


def test_chat_completions_url_uses_azure_deployment(monkeypatch):
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com/")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)

    settings = get_llm_settings()
    url = chat_completions_url(settings)
    headers = chat_completions_headers(settings)

    assert "/openai/deployments/gpt-5-mini/chat/completions" in url
    assert "api-version=" in url
    assert headers["api-key"] == "azure-key"
    assert "Authorization" not in headers


def test_generate_instructions_uses_azure_llm(monkeypatch):
    load_project_env()
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com/")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)

    mock_response = MagicMock()
    mock_response.read.return_value = (
        b'{"choices":[{"message":{"content":"You are a helpful summarizer."}}]}'
    )
    mock_response.__enter__ = MagicMock(return_value=mock_response)
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_response) as urlopen:
        result = generate_agent_instructions(
            GenerateInstructionsRequest(
                agent_name="Summarizer",
                description="Summarize documents.",
            ),
        )

    assert result.source == "azure-openai"
    assert "summarizer" in result.instructions.lower()
    assert result.model == "gpt-5-mini"

    called_request = urlopen.call_args[0][0]
    assert "deployments/gpt-5-mini" in called_request.full_url
    assert called_request.get_header("Api-key") == "azure-key"


def test_generate_instructions_template_fallback(monkeypatch):
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    result = generate_agent_instructions(
        GenerateInstructionsRequest(
            agent_name="Summarizer",
            description="Summarize long documents into bullet points.",
        ),
    )

    assert "Summarizer" in result.instructions
    assert result.source == "template"
