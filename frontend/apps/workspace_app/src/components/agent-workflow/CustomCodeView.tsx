import { memo, useEffect, useMemo, useState } from 'react'
import { ChevronsLeft, ChevronsRight, Code2, Globe, Plus, Search } from 'lucide-react'
import { CustomCodeEditor } from '@/components/agent-workflow/CustomCodeEditor'
import { CUSTOM_CODE_KINDS, CUSTOM_CODE_KIND_ORDER } from '@/components/agent-workflow/custom-code-templates'
import {
  isOwnCustomCode,
  listCustomCode,
  subscribeCustomCode,
  type CustomCode,
  type CustomCodeKind,
} from '@/services/custom-code-api'
import { cn } from '@/utils/cn'

type KindFilter = CustomCodeKind | 'all'

// Whether the list is folded to a thin strip; remembered in this browser
const COLLAPSED_KEY = 'eleven-nodes-custom-code-list-collapsed'

const ICON_BUTTON =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-foreground/60 transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** What the editor shows: a new block of a kind, an existing block, or nothing yet. */
type Selection = { kind: 'new'; codeKind: CustomCodeKind } | { kind: 'block'; id: string } | null

/**
 * The "Custom code" view in the main area: the user's blocks and everyone's public ones down the
 * left, filtered by kind and name, and the selected block's editor filling the rest.
 */
export const CustomCodeView = memo(function CustomCodeView() {
  const [blocks, setBlocks] = useState<CustomCode[]>([])
  const [filter, setFilter] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Storage blocked: the list just opens expanded next time.
    }
  }, [collapsed])

  useEffect(() => {
    const load = () => void listCustomCode().then(setBlocks)
    load()
    return subscribeCustomCode(load)
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return blocks.filter(
      (block) =>
        (filter === 'all' || block.kind === filter) &&
        (!needle || block.name.toLowerCase().includes(needle) || block.description.toLowerCase().includes(needle)),
    )
  }, [blocks, filter, query])

  const selected = selection?.kind === 'block' ? blocks.find((block) => block.id === selection.id) ?? null : null
  const startNew = () => setSelection({ kind: 'new', codeKind: filter === 'all' ? 'tool' : filter })

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      {/* The blocks; folds to a strip with expand and new */}
      {collapsed ? (
        <aside className="flex w-10 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-[hsl(var(--chrome))] py-2.5">
          <button type="button" onClick={() => setCollapsed(false)} className={ICON_BUTTON} aria-label="Show custom code list" title="Show list">
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={startNew} className={cn(ICON_BUTTON, 'text-primary')} aria-label="New custom code" title="New custom code">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </aside>
      ) : (
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-[hsl(var(--chrome))]">
        <div className="shrink-0 space-y-2.5 px-3 pb-3 pt-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-semibold text-foreground">Custom code</h2>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                Your own tools, middlewares, skills and context providers
              </p>
            </div>
            <button type="button" onClick={() => setCollapsed(true)} className={ICON_BUTTON} aria-label="Hide custom code list" title="Hide list">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="flex w-full items-center justify-center gap-1.5 rounded-[2px] bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New custom code
          </button>
          <div className="flex h-7 items-center gap-2 rounded-[2px] bg-[hsl(var(--chrome-input))] px-2">
            <Search className="h-3 w-3 shrink-0 text-foreground/60" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search custom code"
              aria-label="Search custom code"
              className="min-w-0 flex-1 bg-transparent text-[11.5px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Kind">
            {(['all', ...CUSTOM_CODE_KIND_ORDER] as KindFilter[]).map((kind) => (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={filter === kind}
                onClick={() => setFilter(kind)}
                className={cn(
                  'rounded-[2px] px-2 py-0.5 text-[10.5px] font-medium transition-colors',
                  filter === kind ? 'bg-primary text-primary-foreground' : 'bg-foreground/[0.045] text-muted-foreground hover:text-foreground',
                )}
              >
                {kind === 'all' ? 'All' : CUSTOM_CODE_KINDS[kind].label}
              </button>
            ))}
          </div>
        </div>

        <div className="scrollbar-subtle min-h-0 flex-1 space-y-1 overflow-y-auto border-t border-border px-2 py-2">
          {visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11.5px] leading-relaxed text-muted-foreground">
              {blocks.length === 0 ? 'Nothing written yet.' : 'Nothing matches.'}
            </p>
          ) : (
            visible.map((block) => {
              const meta = CUSTOM_CODE_KINDS[block.kind]
              const active = selection?.kind === 'block' && selection.id === block.id
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => setSelection({ kind: 'block', id: block.id })}
                  aria-current={active || undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left transition-colors',
                    active ? 'bg-primary/[0.08]' : 'hover:bg-foreground/[0.05]',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-primary/10 text-primary">
                    <meta.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-mono text-[12px] font-medium text-foreground">{block.name}</span>
                      {block.visibility === 'public' ? (
                        <Globe className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Public" />
                      ) : null}
                    </span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {meta.label}
                      {isOwnCustomCode(block) ? '' : ` · by ${block.ownerEmail || 'another user'}`}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </aside>
      )}

      {/* The editor */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selection?.kind === 'new' || selected ? (
          <CustomCodeEditor
            key={selection?.kind === 'new' ? `new-${selection.codeKind}` : selected?.id}
            block={selected}
            initialKind={selection?.kind === 'new' ? selection.codeKind : selected?.kind}
            onSaved={(saved) => setSelection({ kind: 'block', id: saved.id })}
            onDeleted={() => setSelection(null)}
            onCancel={() => setSelection(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[hsl(var(--canvas))] px-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-[3px] bg-primary/10 text-primary">
              <Code2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-foreground">Write your own blocks in Python</p>
              <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-muted-foreground">
                Tools agents can call, middlewares around their calls, skills and context providers. Pick one on the
                left or start a new one.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {CUSTOM_CODE_KIND_ORDER.map((kind) => {
                const meta = CUSTOM_CODE_KINDS[kind]
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setSelection({ kind: 'new', codeKind: kind })}
                    className="flex items-center gap-1.5 rounded-[3px] border border-border bg-card px-2.5 py-1.5 text-[11.5px] text-foreground transition-colors hover:border-primary"
                  >
                    <meta.icon className="h-3.5 w-3.5 text-primary" />
                    New {meta.label.toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
