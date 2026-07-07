import { useEffect, useState } from 'react'
import { resolveWorkflowModelConfig } from '@/components/agent-workflow/workflow-model-config'
import {
  fallbackServerLlmConfig,
  fetchServerLlmConfig,
  type ServerLlmConfig,
} from '@/services/llm-config-api'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface UseServerLlmConfigResult {
  modelConfig: WorkflowModelConfig
  configured: boolean
  isLoading: boolean
}

/** Load the shared server LLM configuration used for all model calls. */
export function useServerLlmConfig(): UseServerLlmConfigResult {
  const [config, setConfig] = useState<ServerLlmConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchServerLlmConfig()
      .then((next) => {
        if (!cancelled) setConfig(next)
      })
      .catch(() => {
        if (!cancelled) setConfig(fallbackServerLlmConfig())
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const modelConfig = resolveWorkflowModelConfig(
    config
      ? {
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          topP: config.topP,
          maxTokens: config.maxTokens,
          presencePenalty: config.presencePenalty,
          frequencyPenalty: config.frequencyPenalty,
          seed: config.seed,
          stream: config.stream,
        }
      : undefined,
  )

  return {
    modelConfig,
    configured: config?.configured ?? false,
    isLoading,
  }
}
