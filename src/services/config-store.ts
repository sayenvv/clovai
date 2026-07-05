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
    if (raw) return migrateRecords(JSON.parse(raw) as ConfigRecord[])
  } catch {
    // corrupted store — fall through and reseed
  }
  return seedStore()
}

/** Sync designer palettes (and bundle version) from the bundled default when
 *  localStorage still holds an older copy — e.g. the 8-shape flowchart list. */
function migrateRecords(records: ConfigRecord[]): ConfigRecord[] {
  const targetVersion = defaultAppConfig.meta.configBundleVersion ?? 0
  let dirty = false

  const next = records.map((record) => {
    const storedVersion = record.config.meta.configBundleVersion ?? 0
    if (storedVersion >= targetVersion) return record

    dirty = true
    const tools = record.config.megaMenu.tools.map((tool) => {
      const defaultTool = defaultAppConfig.megaMenu.tools.find((candidate) => candidate.id === tool.id)
      if (!defaultTool?.designer) return tool

      const defaultVersion = defaultTool.designer.paletteVersion ?? 0
      const storedVersion = tool.designer?.paletteVersion ?? 0
      const storedCount = tool.designer?.palette.length ?? 0
      const defaultCount = defaultTool.designer.palette.length

      if (storedVersion >= defaultVersion && storedCount >= defaultCount) return tool
      return { ...tool, designer: defaultTool.designer }
    })

    return {
      ...record,
      updatedAt: new Date().toISOString(),
      config: {
        ...record.config,
        meta: { ...record.config.meta, configBundleVersion: targetVersion },
        megaMenu: { ...record.config.megaMenu, tools },
      },
    }
  })

  if (dirty) writeStore(next)
  return next
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
