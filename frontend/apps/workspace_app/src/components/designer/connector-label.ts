/** Shared connector-label layout used by canvas and SVG export. */

const CHAR_WIDTH = 6.5
const LABEL_PAD_X = 16
const MIN_LABEL_WIDTH = 28
const MAX_LABEL_WIDTH = 280

function charsPerLineForWidth(width: number): number {
  return Math.max(4, Math.min(40, Math.floor((width - LABEL_PAD_X) / CHAR_WIDTH)))
}

/**
 * Wrap label text so every line fits `maxCharsPerLine`.
 * Honors existing newlines; breaks long words if needed.
 */
export function wrapConnectorLabel(text: string, maxCharsPerLine: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const limit = Math.max(1, maxCharsPerLine)
  const lines: string[] = []

  for (const paragraph of normalized.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    let current = ''
    for (const word of words) {
      if (word.length > limit) {
        if (current) {
          lines.push(current)
          current = ''
        }
        for (let index = 0; index < word.length; index += limit) {
          lines.push(word.slice(index, index + limit))
        }
        continue
      }

      const next = current ? `${current} ${word}` : word
      if (next.length <= limit) {
        current = next
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }

  return lines
}

/** @deprecated Prefer wrapConnectorLabel — kept for callers that want a single string. */
export function formatConnectorLabel(text: string, maxCharsPerLine = 28): string {
  return wrapConnectorLabel(text, maxCharsPerLine).join('\n')
}

/** Label chip width: snug for short text, never wider than the gap between nodes. */
export function connectorLabelWidth(text: string, maxAvailable: number, editing = false): number {
  const maxWidth = Math.max(MIN_LABEL_WIDTH, Math.min(MAX_LABEL_WIDTH, maxAvailable))
  const charsPerLine = charsPerLineForWidth(maxWidth)
  const lines = wrapConnectorLabel(text || (editing ? 'Short label' : ''), charsPerLine)
  const longest = Math.max(1, ...lines.map((line) => line.length), editing ? 12 : 0)
  const contentWidth = longest * CHAR_WIDTH + LABEL_PAD_X
  return Math.round(
    Math.min(maxWidth, Math.max(editing ? Math.min(96, maxWidth) : MIN_LABEL_WIDTH, contentWidth)),
  )
}

export function connectorLabelLines(text: string, labelWidth: number): string[] {
  return wrapConnectorLabel(text, charsPerLineForWidth(labelWidth))
}

export function connectorLabelHeight(lineCount: number): number {
  const lineHeight = 14
  return Math.max(22, lineCount * lineHeight + 8)
}
