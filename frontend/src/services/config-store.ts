import { STORAGE_KEYS } from '@/constants'
import { defaultAppConfig } from '@/config/default-config'
import type { AppConfig, ConfigRecord, MegaMenuConfig, Tool } from '@/types/config'

/**
 * Local persistence layer that stands in for the database.
 * The service layer (config-api.ts) is the only consumer, so swapping
 * this for real HTTP calls requires no changes anywhere in the UI.
 */

function mergeToolFromDefault(defaultTool: Tool, stored?: Tool): Tool {
  if (!stored) return defaultTool

  const merged: Tool = { ...defaultTool, ...stored }

  if (!defaultTool.designer) return merged

  const defaultVersion = defaultTool.designer.paletteVersion ?? 0
  const storedVersion = stored.designer?.paletteVersion ?? 0
  const storedCount = stored.designer?.palette.length ?? 0
  const defaultCount = defaultTool.designer.palette.length

  if (storedVersion >= defaultVersion && storedCount >= defaultCount) {
    return { ...merged, designer: stored.designer }
  }

  return { ...merged, designer: defaultTool.designer }
}

/** Merge bundled mega menu changes: new tools, palette updates, category copy. */
function migrateMegaMenu(stored: MegaMenuConfig): MegaMenuConfig {
  const storedCategoriesById = new Map(stored.categories.map((category) => [category.id, category]))
  const storedToolsById = new Map(stored.tools.map((tool) => [tool.id, tool]))

  const categories = defaultAppConfig.megaMenu.categories.map((defaultCategory) => {
    const storedCategory = storedCategoriesById.get(defaultCategory.id)
    return storedCategory
      ? { ...defaultCategory, ...storedCategory, description: defaultCategory.description }
      : defaultCategory
  })

  const tools = defaultAppConfig.megaMenu.tools.map((defaultTool) =>
    mergeToolFromDefault(defaultTool, storedToolsById.get(defaultTool.id)),
  )

  return {
    ...stored,
    categories,
    tools,
    featured: defaultAppConfig.megaMenu.featured,
  }
}

/** True when localStorage is missing bundled tools or is on an older bundle version. */
function configNeedsSync(record: ConfigRecord, targetVersion: number): boolean {
  const storedVersion = record.config.meta.configBundleVersion ?? 0
  if (storedVersion < targetVersion) return true

  const storedToolIds = new Set(record.config.megaMenu.tools.map((tool) => tool.id))
  return defaultAppConfig.megaMenu.tools.some((tool) => !storedToolIds.has(tool.id))
}

function readStore(): ConfigRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.configStore)
    if (raw) return migrateRecords(JSON.parse(raw) as ConfigRecord[])
  } catch {
    // corrupted store — fall through and reseed
  }
  return seedStore()
}

/** Sync bundled tools, palettes, and bundle version from default config. */
function migrateRecords(records: ConfigRecord[]): ConfigRecord[] {
  const targetVersion = defaultAppConfig.meta.configBundleVersion ?? 0
  let dirty = false

  const next = records.map((record) => {
    if (!configNeedsSync(record, targetVersion)) return record

    dirty = true
    return {
      ...record,
      updatedAt: new Date().toISOString(),
      config: {
        ...record.config,
        meta: { ...record.config.meta, configBundleVersion: targetVersion },
        megaMenu: migrateMegaMenu(record.config.megaMenu),
        navbar: defaultAppConfig.navbar,
        footer: defaultAppConfig.footer,
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
