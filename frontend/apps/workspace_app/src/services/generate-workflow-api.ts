/** The AI assistant chat's model choice and file attachments (the assistant itself runs on the 4.0 engine). */

export interface GenerateWorkflowAttachment {
  name: string
  content: string
}

/** Which model runs the assistant: the catalog default or a model picked from the catalog. */
export type GenerateWorkflowModel =
  /** The catalog's default model. */
  | { provider: 'server' }
  /** A model picked from the application's model catalog. */
  | { provider: 'catalog'; providerId: string; modelId: string; label: string }
  /** A local Ollama model (older saved choice; runs on the catalog's `ollama` provider). */
  | { provider: 'ollama'; model: string; baseUrl: string }
  /** A saved model client (Models): the user's own or the admin's. */
  | { provider: 'client'; connectionId: string; label: string; providerType: string; model: string }
