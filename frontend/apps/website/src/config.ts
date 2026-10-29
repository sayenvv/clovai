/**
 * Where the site sends people. The site is the main domain (www.<domain>); the workspace app runs on its own
 * subdomain (cloud.<domain>), set by VITE_APP_URL at build time, so changing domains needs no code change.
 */

const trimSlash = (url: string) => url.replace(/\/+$/, '')

const appUrl = trimSlash(import.meta.env.VITE_APP_URL || 'https://cloud.abc.com')

export const site = {
  name: 'Eleven Nodes',
  appUrl,
  /** "Try now": the workspace at its own address (it opens at its root and asks the visitor to sign in first). */
  tryNow: `${appUrl}/`,
  signIn: `${appUrl}/`,
  contact: `mailto:${import.meta.env.VITE_CONTACT_EMAIL || 'hello@abc.com'}`,
} as const

/** Sections of the home page, linked from its own nav and footer. */
/** Links into the workspace open it in a new tab, so the site stays open behind it. */
export function newTab(href: string | undefined) {
  return href?.startsWith(appUrl) ? ({ target: '_blank', rel: 'noopener' } as const) : {}
}

export const sections = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'models', label: 'Models' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'faq', label: 'FAQ' },
] as const

/** The site's pages. Each is its own HTML file, so any static host serves them as they are. */
export const pages = [
  { href: '/', label: 'Product', id: 'home' },
  { href: '/docs/', label: 'Docs', id: 'docs' },
  { href: '/pricing/', label: 'Pricing', id: 'pricing' },
  { href: '/community/', label: 'Community', id: 'community' },
] as const

export type PageId = (typeof pages)[number]['id']

/**
 * Community channels. Leave a link undefined until the channel exists: the page then shows it as coming soon
 * rather than sending people nowhere.
 */
export const community: Record<'discord' | 'github' | 'x' | 'youtube', string | undefined> = {
  discord: import.meta.env.VITE_COMMUNITY_DISCORD || undefined,
  github: import.meta.env.VITE_COMMUNITY_GITHUB || undefined,
  x: import.meta.env.VITE_COMMUNITY_X || undefined,
  youtube: import.meta.env.VITE_COMMUNITY_YOUTUBE || undefined,
}
