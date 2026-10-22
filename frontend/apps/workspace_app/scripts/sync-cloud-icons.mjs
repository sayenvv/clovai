#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const providers = [
  { id: 'gcp', name: 'Google Cloud', site: 'https://gcpicons.com' },
  { id: 'aws', name: 'AWS', site: 'https://aws-icons.com' },
]

async function text(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

function slug(value) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function pooled(items, worker, concurrency = 12) {
  let cursor = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) await worker(items[cursor++])
  }))
}

async function syncProvider(provider) {
  const homepage = await text(`${provider.site}/`)
  const bundlePath = homepage.match(/\/assets\/app-[a-zA-Z0-9_-]+\.js/)?.[0]
  if (!bundlePath) throw new Error(`Could not find app bundle for ${provider.name}`)
  const bundle = await text(`${provider.site}${bundlePath}`)
  const pattern = provider.id === 'aws'
    ? /\{Category:"([^"]+)",ID:"([^"]+)",Name:"([^"]+)"[\s\S]*?SVG:"(https:\/\/icon\.icepanel\.io\/AWS\/svg\/[^"]+)"\}/g
    : /\{ID:"([^"]+)",Name:"([^"]+)"[\s\S]*?SVG:"(https:\/\/icon\.icepanel\.io\/GCP\/svg\/[^"]+)"\}/g

  const icons = []
  for (const match of bundle.matchAll(pattern)) {
    icons.push(provider.id === 'aws'
      ? { category: match[1], id: match[2], name: match[3], url: match[4] }
      : { category: 'services', id: match[1], name: match[2], url: match[3] })
  }

  const unique = [...new Map(icons.map((icon) => [icon.url, icon])).values()]
  const out = join(ROOT, 'public', 'cloud-icons', provider.id)
  let completed = 0
  await pooled(unique, async (icon) => {
    const category = slug(icon.category)
    const fileName = basename(new URL(icon.url).pathname)
    const localPath = join(out, category, fileName)
    await mkdir(dirname(localPath), { recursive: true })
    await writeFile(localPath, await text(icon.url), 'utf8')
    icon.path = `/cloud-icons/${provider.id}/${category}/${fileName}`
    if (++completed % 50 === 0) console.log(`${provider.name}: ${completed}/${unique.length}`)
  })

  const manifest = {
    version: 1,
    provider: provider.name,
    source: provider.site,
    terms: provider.id === 'aws' ? 'https://aws.amazon.com/architecture/icons/' : 'https://cloud.google.com/icons/',
    syncedAt: new Date().toISOString(),
    count: unique.length,
    icons: unique.map((icon, order) => ({
      id: `fc-${provider.id}-${slug(icon.id)}`,
      label: icon.name,
      description: `${provider.name} ${icon.name}`,
      category: slug(icon.category),
      categoryLabel: icon.category.replace(/-/g, ' '),
      icon: icon.path,
      order: 2000 + order,
    })),
  }
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`${provider.name}: wrote ${unique.length} icons to ${out}`)
}

for (const provider of providers) await syncProvider(provider)
