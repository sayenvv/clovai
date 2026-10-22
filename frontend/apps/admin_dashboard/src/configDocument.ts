import { getDocument, listDocuments, updateDocument, type AdminDocument } from './api'

export async function loadActiveConfig(aiIntegrationId: string): Promise<AdminDocument> {
  const rows = await listDocuments('configs', aiIntegrationId)
  const active = rows.find((row) => row.is_active) ?? rows[0]
  if (!active) throw new Error('No configuration is saved for this application.')
  return getDocument('configs', active.id, aiIntegrationId)
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function saveSection(
  current: AdminDocument,
  aiIntegrationId: string,
  section: string,
  value: unknown,
): Promise<AdminDocument> {
  const document = { ...asRecord(current.document), [section]: value }
  return updateDocument('configs', current.id, aiIntegrationId, { document })
}
