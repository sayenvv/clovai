/**
 * Model clients an agent can run on. Each is an OpenAI-compatible endpoint the backend calls
 * through the same client (native: OpenAI, Azure OpenAI, Groq, Ollama; the others through
 * their OpenAI-compatible APIs). Keys stay as environment placeholders resolved on the server.
 */

import { cn } from '@/utils/cn'

export type ModelProviderId = 'openai' | 'azure-openai' | 'anthropic' | 'gemini' | 'mistral' | 'groq' | 'ollama'

export interface ModelProvider {
  id: ModelProviderId
  label: string
  description: string
  logo: string
  /** Suggested models; any other model name the provider serves can be typed in. */
  models: string[]
  /** Runs on the developer's machine rather than a hosted API. */
  local?: boolean
  /** The `modelConnections` entry the exported workflow carries for this provider. */
  connection: Record<string, unknown>
}

/** Drag data type for a model client dragged from the library onto an agent. */
export const MODEL_PROVIDER_DND_MIME = 'application/x-eleven-model-provider'

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT and o-series models',
    logo: '/agent-providers/openai.svg',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
    connection: {
      provider: 'OpenAI',
      endpoint: '${OPENAI_BASE_URL}',
      authentication: { type: 'apiKey', apiKey: '${OPENAI_API_KEY}' },
    },
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    description: 'OpenAI models on your Azure deployment',
    logo: '/cloud-icons/azure/openai.svg',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    connection: {
      provider: 'Azure',
      endpoint: '${AZURE_OPENAI_ENDPOINT}',
      apiVersion: '${AZURE_OPENAI_API_VERSION}',
      authentication: { type: 'apiKey', azureApiKey: '${AZURE_OPENAI_API_KEY}' },
    },
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models',
    logo: '/agent-providers/anthropic.svg',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    connection: {
      provider: 'Anthropic',
      endpoint: 'https://api.anthropic.com/v1/',
      authentication: { type: 'apiKey', apiKey: '${ANTHROPIC_API_KEY}' },
    },
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini models from Google AI',
    logo: '/agent-providers/gemini.svg',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    connection: {
      provider: 'Google',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      authentication: { type: 'apiKey', apiKey: '${GEMINI_API_KEY}' },
    },
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    description: 'Mistral Large, Small and Codestral',
    logo: '/agent-providers/mistral.svg',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    connection: {
      provider: 'Mistral',
      endpoint: 'https://api.mistral.ai/v1',
      authentication: { type: 'apiKey', apiKey: '${MISTRAL_API_KEY}' },
    },
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Fast open models on Groq',
    logo: '/agent-providers/groq.svg',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    connection: {
      provider: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1',
      authentication: { type: 'apiKey', apiKey: '${GROQ_API_KEY}' },
    },
  },
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'Open models running locally',
    logo: '/agent-providers/ollama.svg',
    models: ['llama3.1', 'qwen2.5', 'mistral'],
    local: true,
    connection: {
      provider: 'Ollama',
      endpoint: '${OLLAMA_BASE_URL}',
    },
  },
]

const BY_ID = new Map(MODEL_PROVIDERS.map((provider) => [provider.id, provider]))

export function modelProviderById(id: string | undefined): ModelProvider | undefined {
  return id ? BY_ID.get(id as ModelProviderId) : undefined
}

/** The provider an agent runs on: its chosen one, else guessed from its model name. */
export function resolveModelProvider(agent: { modelProvider?: string; model?: string } | undefined): ModelProvider | undefined {
  const chosen = modelProviderById(agent?.modelProvider)
  if (chosen) return chosen
  const model = agent?.model?.trim().toLowerCase() ?? ''
  if (!model) return undefined
  if (model.startsWith('claude')) return BY_ID.get('anthropic')
  if (model.startsWith('gemini')) return BY_ID.get('gemini')
  if (model.startsWith('mistral') || model.startsWith('codestral')) return BY_ID.get('mistral')
  if (model.startsWith('gpt') || /^o\d/.test(model)) return BY_ID.get('openai')
  return undefined
}

/** The model to use after switching provider: keep the current one if the provider lists it. */
export function modelForProvider(provider: ModelProvider, current: string | undefined): string {
  const model = current?.trim()
  return model && provider.models.includes(model) ? model : provider.models[0]
}

/** A provider's logo, as a rounded tile. */
export function ModelProviderLogo({ provider, className }: { provider: ModelProvider; className?: string }) {
  return (
    <img
      src={provider.logo}
      alt=""
      draggable={false}
      className={cn('shrink-0 rounded-[8px] object-contain', className)}
    />
  )
}
