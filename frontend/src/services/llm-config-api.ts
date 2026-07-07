const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

import {
  DEFAULT_WORKFLOW_MODEL_CONFIG,
  resolveWorkflowModelConfig,
} from '@/components/agent-workflow/workflow-model-config'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

export interface ServerLlmConfig extends WorkflowModelConfig {
  configured: boolean
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Normalize API payloads that may use camelCase or snake_case keys. */
export function normalizeServerLlmConfig(body: Record<string, unknown>): ServerLlmConfig {
  const defaults = DEFAULT_WORKFLOW_MODEL_CONFIG
  const seedValue = body.seed ?? body.Seed

  return {
    provider: typeof body.provider === 'string' && body.provider ? body.provider : defaults.provider,
    model: typeof body.model === 'string' && body.model ? body.model : defaults.model,
    temperature: readNumber(body.temperature, defaults.temperature),
    topP: readNumber(body.topP ?? body.top_p, defaults.topP),
    maxTokens: readNumber(body.maxTokens ?? body.max_tokens, defaults.maxTokens),
    presencePenalty: readNumber(body.presencePenalty ?? body.presence_penalty, defaults.presencePenalty),
    frequencyPenalty: readNumber(
      body.frequencyPenalty ?? body.frequency_penalty,
      defaults.frequencyPenalty,
    ),
    seed: typeof seedValue === 'number' ? seedValue : null,
    stream: typeof body.stream === 'boolean' ? body.stream : defaults.stream,
    configured: Boolean(body.configured),
  }
}

/** Read the server-managed LLM configuration from environment variables. */
export async function fetchServerLlmConfig(): Promise<ServerLlmConfig> {
  const response = await fetch(`${API_BASE}/api/llm/config`)
  if (!response.ok) {
    throw new Error(`Failed to load LLM config (${response.status})`)
  }
  const body = (await response.json()) as Record<string, unknown>
  return normalizeServerLlmConfig(body)
}

export function fallbackServerLlmConfig(): ServerLlmConfig {
  return {
    ...resolveWorkflowModelConfig(),
    configured: false,
  }
}
