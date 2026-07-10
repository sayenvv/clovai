#!/usr/bin/env node
/**
 * Sync official Azure architecture icons (same collection as az-icons.com / Microsoft Learn)
 * from barrcodes/azure-icons CDN into public/cloud-icons/azure/
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public/cloud-icons/azure')
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json')
const CDN = 'https://cdn.jsdelivr.net/gh/barrcodes/azure-icons@main'
const TREE_URL = 'https://api.github.com/repos/barrcodes/azure-icons/git/trees/main?recursive=1'

const CATEGORY_LABELS = {
  'ai-machine-learning': 'AI + Machine Learning',
  analytics: 'Analytics',
  'app-services': 'App Services',
  'azure-ecosystem': 'Azure Ecosystem',
  'azure-stack': 'Azure Stack',
  blockchain: 'Blockchain',
  compute: 'Compute',
  containers: 'Containers',
  databases: 'Databases',
  devops: 'DevOps',
  general: 'General',
  hybrid: 'Hybrid + Multicloud',
  identity: 'Identity',
  integration: 'Integration',
  intune: 'Intune',
  iot: 'IoT',
  management: 'Management + Governance',
  menu: 'Menu',
  migrate: 'Migrate',
  'mixed-reality': 'Mixed Reality',
  mobile: 'Mobile',
  monitor: 'Monitor',
  networking: 'Networking',
  new: 'New Icons',
  other: 'Other',
  security: 'Security',
  storage: 'Storage',
  web: 'Web',
}

function slugToLabel(slug) {
  return slug
    .replace(/\.svg$/, '')
    .split('-')
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bDb\b/g, 'DB')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bVm\b/g, 'VM')
    .replace(/\bVpn\b/g, 'VPN')
    .replace(/\bDns\b/g, 'DNS')
    .replace(/\bIot\b/g, 'IoT')
    .replace(/\bOpen Ai\b/g, 'OpenAI')
}

async function main() {
  console.log('Fetching icon index from GitHub…')
  const res = await fetch(TREE_URL, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'eleven-nodes-sync' },
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const data = await res.json()
  const svgPaths = data.tree
    .filter((entry) => entry.type === 'blob' && entry.path.startsWith('icons/') && entry.path.endsWith('.svg'))
    .map((entry) => entry.path)
    .sort()

  console.log(`Found ${svgPaths.length} Azure icons`)

  const icons = []
  let order = 1000

  for (const repoPath of svgPaths) {
    const relative = repoPath.replace(/^icons\//, '')
    const slash = relative.indexOf('/')
    const category = relative.slice(0, slash)
    const fileName = relative.slice(slash + 1)
    const slug = fileName.replace(/\.svg$/, '')
    const localPath = join(OUT_DIR, category, fileName)
    const publicPath = `/cloud-icons/azure/${category}/${fileName}`
    const url = `${CDN}/${repoPath}`

    await mkdir(dirname(localPath), { recursive: true })

    const svgRes = await fetch(url)
    if (!svgRes.ok) {
      console.warn(`Skip ${repoPath}: ${svgRes.status}`)
      continue
    }
    const svg = await svgRes.text()
    await writeFile(localPath, svg, 'utf8')

    icons.push({
      id: `fc-azure-${category}-${slug}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      label: slugToLabel(slug),
      description: `Azure ${slugToLabel(slug)}`,
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      icon: publicPath,
      order: order++,
    })

    if (icons.length % 50 === 0) {
      console.log(`  downloaded ${icons.length}/${svgPaths.length}…`)
    }
  }

  const manifest = {
    version: 1,
    source: 'https://learn.microsoft.com/en-us/azure/architecture/icons/',
    syncedAt: new Date().toISOString(),
    count: icons.length,
    icons,
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`Done — ${icons.length} icons → ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
