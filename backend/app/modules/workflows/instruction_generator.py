"""Generate agent system instructions from name and description."""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from pydantic import BaseModel, Field

from app.core.llm_settings import (
    _is_azure_provider,
    chat_completions_headers,
    chat_completions_url,
    get_llm_settings,
)


class GenerateInstructionsRequest(BaseModel):
    agent_name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)


class GenerateInstructionsResponse(BaseModel):
    instructions: str
    model: str
    source: str


def _template_instructions(agent_name: str, description: str) -> str:
    role = description.strip() or f"Handle tasks assigned to the {agent_name} agent."
    return (
        f"You are {agent_name}.\n\n"
        f"Role:\n{role}\n\n"
        "Guidelines:\n"
        "- Follow the workflow context and prior agent outputs.\n"
        "- Use connected tools when they improve accuracy or completeness.\n"
        "- Respond in a clear, actionable format aligned with the output schema.\n"
        "- Ask for clarification only when required inputs are missing."
    )


def _build_chat_payload(settings, agent_name: str, description: str) -> dict:
    prompt = (
        "Write a concise system prompt for an AI workflow agent.\n"
        f"Agent name: {agent_name}\n"
        f"Description: {description or 'General-purpose workflow agent'}\n\n"
        "Return only the system prompt text. No markdown fences."
    )
    payload: dict = {
        "messages": [
            {
                "role": "system",
                "content": "You write precise agent system prompts for multi-agent workflows.",
            },
            {"role": "user", "content": prompt},
        ],
    }

    model = settings.model.lower()
    if model.startswith("gpt-5") or model.startswith("o"):
        payload["max_completion_tokens"] = min(settings.max_tokens, 2048)
    else:
        payload["temperature"] = settings.temperature
        payload["top_p"] = settings.top_p
        payload["max_tokens"] = min(settings.max_tokens, 2048)

    if not _is_azure_provider(settings.provider):
        payload["model"] = settings.model

    return payload


def _llm_instructions(agent_name: str, description: str) -> str | None:
    settings = get_llm_settings()
    if not settings.is_configured:
        return None

    provider = settings.provider.strip().lower()
    if provider not in {"openai", "azure", "azure-openai", "azure_openai"}:
        return None

    payload = _build_chat_payload(settings, agent_name, description)
    request = urllib.request.Request(
        chat_completions_url(settings),
        data=json.dumps(payload).encode("utf-8"),
        headers=chat_completions_headers(settings),
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        text = str(content).strip()
        return text or None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM request failed ({error.code}): {detail}") from error
    except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError, TimeoutError):
        return None


def generate_agent_instructions(request: GenerateInstructionsRequest) -> GenerateInstructionsResponse:
    settings = get_llm_settings()
    llm_text = _llm_instructions(request.agent_name, request.description)

    if llm_text:
        source = "azure-openai" if _is_azure_provider(settings.provider) else "openai"
        return GenerateInstructionsResponse(
            instructions=llm_text,
            model=settings.model,
            source=source,
        )

    return GenerateInstructionsResponse(
        instructions=_template_instructions(request.agent_name, request.description),
        model=settings.model,
        source="template",
    )
