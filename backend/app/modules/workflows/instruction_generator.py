"""Generate agent system instructions from name and description."""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from pydantic import BaseModel, Field

from app.core.llm_settings import (
    _is_azure_provider,
    apply_chat_completion_limits,
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
        f"## {agent_name}\n\n"
        f"### Role\n{role}\n\n"
        "### Guidelines\n"
        "- Follow the workflow context and prior agent outputs.\n"
        "- Use connected tools when they improve accuracy or completeness.\n"
        "- Respond in a clear, actionable format aligned with the output schema.\n"
        "- Ask for clarification only when required inputs are missing."
    )


def _normalize_markdown(text: str) -> str:
    """Strip optional markdown code fences from model output."""
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned

    lines = cleaned.splitlines()
    if lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _build_chat_payload(settings, agent_name: str, description: str) -> dict:
    prompt = (
        "Write a concise system prompt for an AI workflow agent.\n"
        f"Agent name: {agent_name}\n"
        f"Description: {description or 'General-purpose workflow agent'}\n\n"
        "Format the response as Markdown with clear sections, for example:\n"
        "- A level-2 heading with the agent name or role\n"
        "- ## Role — what the agent does\n"
        "- ## Guidelines — bullet list of behavior rules\n"
        "- Optional ## Output format or ## Tools sections when useful\n\n"
        "Return only the Markdown document. No code fences, preamble, or explanation."
    )
    payload: dict = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You write precise agent system prompts for multi-agent workflows. "
                    "Always respond in clean Markdown."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }

    apply_chat_completion_limits(
        payload,
        settings,
        max_tokens=min(settings.max_tokens, 2048),
    )

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
        text = _normalize_markdown(str(content))
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
