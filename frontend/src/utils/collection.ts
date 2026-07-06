interface Orderable {
  order?: number
}

interface Visible {
  isVisible?: boolean
}

/** Sorts config items by their `order` field (stable for equal values). */
export function byOrder<T extends Orderable>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** Filters out items whose `isVisible` flag is explicitly false. */
export function visibleOnly<T extends Visible>(items: T[]): T[] {
  return items.filter((item) => item.isVisible !== false)
}

/** Common pipeline: keep visible items, sorted by order. */
export function visibleSorted<T extends Orderable & Visible>(items: T[]): T[] {
  return byOrder(visibleOnly(items))
}
