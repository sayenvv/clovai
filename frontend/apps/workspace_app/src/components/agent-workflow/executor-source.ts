/** Normalize handler source so only ``elevennodes`` appears — never ``agent_framework``. */
export function normalizeExecutorSource(source: string): string {
  if (!source.trim()) return source

  return source
    .replace(/\bfrom\s+agent_framework(\.[A-Za-z0-9_]+)?\s+import\b/g, 'from elevennodes import')
    .replace(/\bimport\s+agent_framework(?:\.[A-Za-z0-9_]+)?\b/g, 'import elevennodes')
    .replace(/\bagent_framework\./g, 'elevennodes.')
    .replace(/\bagent_framework\b/g, 'elevennodes')
    .replace(/Microsoft Agent Framework/gi, 'Eleven Nodes')
    .replace(/Agent Framework/gi, 'Eleven Nodes')
}

export function executorSourceNeedsNormalization(source: string): boolean {
  return /agent[_\s-]?framework/i.test(source)
}
