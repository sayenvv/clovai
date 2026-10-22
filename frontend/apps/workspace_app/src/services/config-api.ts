import { MOCK_API_DELAY } from '@/constants'
import { validateAppConfig, type ValidationResult } from '@/schemas/config.schema'
import type { AppConfig, ConfigRecord, ConfigRecordSummary } from '@/types/config'
import { configStore } from './config-store'

/**
 * Configuration API service.
 *
 * Every UI consumer goes through these functions — never through fetch or
 * storage directly. The current implementation is backed by a mock store;
 * point these at real endpoints (e.g. via the commented fetch calls) and
 * nothing else in the application changes.
 */

const delay = (ms: number = MOCK_API_DELAY) => new Promise((resolve) => setTimeout(resolve, ms))

function toSummary({ config: _config, ...summary }: ConfigRecord): ConfigRecordSummary {
  return summary
}

/** GET /api/configs/active */
export async function getActiveConfig(): Promise<ConfigRecord> {
  await delay()
  return configStore.getActive()
}

/** GET /api/configs */
export async function listConfigs(): Promise<ConfigRecordSummary[]> {
  await delay()
  return configStore
    .list()
    .map(toSummary)
    .sort((a, b) => b.version - a.version)
}

/** GET /api/configs/:id */
export async function getConfig(id: string): Promise<ConfigRecord> {
  await delay()
  const record = configStore.getById(id)
  if (!record) throw new Error(`Configuration "${id}" not found`)
  return record
}

/** POST /api/configs/validate — validation also runs client-side via Zod. */
export async function validateConfig(input: unknown): Promise<ValidationResult> {
  await delay(120)
  return validateAppConfig(input)
}

/** POST /api/configs */
export async function saveConfig(name: string, config: AppConfig): Promise<ConfigRecord> {
  await delay()
  return configStore.create(name, config)
}

/** PUT /api/configs/:id */
export async function updateConfig(id: string, config: AppConfig, name?: string): Promise<ConfigRecord> {
  await delay()
  return configStore.update(id, config, name)
}

/** POST /api/configs/:id/activate */
export async function activateConfig(id: string): Promise<ConfigRecord> {
  await delay()
  return configStore.activate(id)
}

/** DELETE /api/configs/:id */
export async function deleteConfig(id: string): Promise<void> {
  await delay()
  configStore.remove(id)
}
