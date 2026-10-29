import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

export const DEFAULT_WORKFLOW_MODEL_CONFIG: WorkflowModelConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  presencePenalty: 0,
  frequencyPenalty: 0,
  seed: null,
  stream: false,
}

/** The name of a 4.0 model preset that stands for the workflow's model (agents without one of their own). */
export const WORKFLOW_MODEL_PRESET = 'Workflow model'

/** The 4.0 connection that stands for the workflow's model client. */
export const WORKFLOW_CONNECTION_NAME = 'Default model client'

/**
 * The model an agent runs on of its own: only one picked from a model client. Anything else (an old
 * default name, a model without a client) means it inherits the workflow's model.
 */
export function agentOwnModel(agent: { model?: string; modelConnectionId?: string } | undefined): string {
  return agent?.modelConnectionId ? (agent.model?.trim() ?? '') : ''
}

export const MODEL_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'bedrock', label: 'AWS Bedrock' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'custom', label: 'Custom' },
] as const

export const OLLAMA_DEFAULT_URL = 'http://localhost:11434'

export function isLocalModel(config?: Partial<WorkflowModelConfig>): boolean {
  return config?.provider === 'ollama'
}

export const SUGGESTED_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
  google: ['gemini-2.5-pro', 'gemini-2.0-flash'],
  azure: ['gpt-4o', 'gpt-4'],
  bedrock: ['anthropic.claude-3-sonnet', 'amazon.titan-text'],
  ollama: ['llama3.2:latest'],
  custom: [],
}

export function resolveWorkflowModelConfig(
  config?: Partial<WorkflowModelConfig>,
): WorkflowModelConfig {
  return {
    ...DEFAULT_WORKFLOW_MODEL_CONFIG,
    ...config,
  }
}

/**
 * The workflow's model: what the toolbar shows, test runs use and agents without their own inherit.
 * The workflow's pick wins; the server's model is the fallback.
 */
export function workflowActiveModelConfig(
  workflow: { modelConfig?: Partial<WorkflowModelConfig> } | undefined,
  server: WorkflowModelConfig,
): WorkflowModelConfig {
  const stored = workflow?.modelConfig
  if (stored?.model?.trim()) {
    return resolveWorkflowModelConfig(stored)
  }
  return resolveWorkflowModelConfig(server)
}
