import { useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { ADMIN_WORKFLOWS, formatNumber } from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AGENT_WORKFLOW_URL, ROUTES } from '@/constants'

export function WorkflowsView() {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return ADMIN_WORKFLOWS
    return ADMIN_WORKFLOWS.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) || row.owner.toLowerCase().includes(needle),
    )
  }, [query])

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Published and draft agent workflows across the workspace."
        actions={
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]">
            <a href={AGENT_WORKFLOW_URL} target="_blank" rel="noreferrer">
              Open designer
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <PremiumCard className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workflows…"
              className="h-9 pl-8 text-xs"
            />
          </div>
        </PremiumCard>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <PremiumCard key={row.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{row.name}</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Owned by {row.owner}</p>
                </div>
                <StatusBadge
                  label={row.status}
                  tone={
                    row.status === 'published'
                      ? 'success'
                      : row.status === 'draft'
                        ? 'warning'
                        : 'neutral'
                  }
                />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-4 text-center">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Agents</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{row.agents}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Runs</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                    {formatNumber(row.runs30d)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Updated</dt>
                  <dd className="mt-1 text-[11px] font-medium text-muted-foreground">{row.updatedAt}</dd>
                </div>
              </dl>
              <Button asChild variant="ghost" size="sm" className="mt-4 h-8 justify-start px-0 text-[11.5px]">
                <Link to={ROUTES.activity}>View related activity</Link>
              </Button>
            </PremiumCard>
          ))}
        </div>
      </PageBody>
    </>
  )
}
