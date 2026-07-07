from app.core.llm_settings import get_llm_settings, llm_settings_to_workflow_model_config


def test_get_llm_settings_defaults(monkeypatch):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    settings = get_llm_settings()

    assert settings.provider == "openai"
    assert settings.model == "gpt-4o"
    assert settings.temperature == 0.7


def test_azure_provider_auto_detected_from_env(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com/")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "my-gpt-deployment")

    settings = get_llm_settings()

    assert settings.provider == "azure-openai"
    assert settings.model == "my-gpt-deployment"
    assert settings.is_configured is True


def test_llm_settings_to_workflow_model_config(monkeypatch):
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("LLM_MODEL", "gpt-4.1-mini")
    monkeypatch.setenv("LLM_TEMPERATURE", "0.2")

    config = llm_settings_to_workflow_model_config()

    assert config.model == "gpt-4.1-mini"
    assert config.temperature == 0.2
