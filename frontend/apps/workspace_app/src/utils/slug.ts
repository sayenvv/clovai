/** Sanitize a label into a code identifier (snake_case). */
export function slugifyIdentifier(label: string, fallback: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || fallback
}

/** Sanitize a label into a kebab-case filename segment. */
export function slugifyFilename(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+|-+$/g, '')
  return slug || 'workflow'
}
