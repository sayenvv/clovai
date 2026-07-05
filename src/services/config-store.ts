import { STORAGE_KEYS } from '@/constants'
import { defaultAppConfig } from '@/config/default-config'
import type { AppConfig, ConfigRecord } from '@/types/config'

/**
 * Local persistence layer that stands in for the database.
 * The service layer (config-api.ts) is the only consumer, so swapping
 * this for real HTTP calls requires no changes anywhere in the UI.
 */

function readStore(): ConfigRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.configStore)
    if (raw) return JSON.parse(raw) as ConfigRecord[]
  } catch {
    // corrupted store — fall through and reseed
  }
  return seedStore()
}

function writeStore(records: ConfigRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.configStore, JSON.stringify(records))
}

function seedStore(): ConfigRecord[] {
  const now = new Date().toISOString()
  const seed: ConfigRecord[] = [
    {
      id: 'cfg-default',
      name: defaultAppConfig.meta.name,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      config: defaultAppConfig,
    },
  ]
  writeStore(seed)
  return seed
}

export const configStore = {
  list(): ConfigRecord[] {
    return readStore()
  },

  getActive(): ConfigRecord {
    const records = readStore()
    return records.find((r) => r.isActive) ?? records[0] ?? seedStore()[0]
  },

  getById(id: string): ConfigRecord | undefined {
    return readStore().find((r) => r.id === id)
  },

  create(name: string, config: AppConfig): ConfigRecord {
    const records = readStore()
    const now = new Date().toISOString()
    const version = Math.max(0, ...records.map((r) => r.version)) + 1
    const record: ConfigRecord = {
      id: `cfg-${Date.now().toString(36)}`,
      name,
      version,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      config,
    }
    writeStore([...records, record])
    return record
  },

  update(id: string, config: AppConfig, name?: string): ConfigRecord {
    const records = readStore()
    const index = records.findIndex((r) => r.id === id)
    if (index === -1) throw new Error(`Configuration "${id}" not found`)
    const updated: ConfigRecord = {
      ...records[index],
      name: name ?? records[index].name,
      config,
      updatedAt: new Date().toISOString(),
    }
    records[index] = updated
    writeStore(records)
    return updated
  },

  activate(id: string): ConfigRecord {
    const records = readStore()
    const target = records.find((r) => r.id === id)
    if (!target) throw new Error(`Configuration "${id}" not found`)
    // Only one configuration may be active at a time.
    const next = records.map((r) => ({ ...r, isActive: r.id === id }))
    writeStore(next)
    return { ...target, isActive: true }
  },

  remove(id: string): void {
    const records = readStore()
    const target = records.find((r) => r.id === id)
    if (target?.isActive) {
      throw new Error('Cannot delete the active configuration. Activate another one first.')
    }
    writeStore(records.filter((r) => r.id !== id))
  },
}
