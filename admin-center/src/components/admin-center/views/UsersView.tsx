import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Search, UserPlus } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import {
  ADMIN_USERS,
  formatCurrency,
  initials,
  userMonthlyEstimate,
  type AdminUserStatus,
} from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants'

const STATUS_TONE: Record<AdminUserStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  invited: 'warning',
  suspended: 'danger',
}

export function UsersView() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | AdminUserStatus>('all')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ADMIN_USERS.filter((user) => {
      if (status !== 'all' && user.status !== status) return false
      if (!needle) return true
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        user.role.toLowerCase().includes(needle) ||
        user.company.toLowerCase().includes(needle)
      )
    })
  }, [query, status])

  return (
    <>
      <PageHeader
        title="Users"
        description="Open a member to see details, workflows, and estimated monthly cost."
        actions={
          <Button size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold">
            <UserPlus className="h-3.5 w-3.5" />
            Invite user
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <PremiumCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, company…"
                className="h-9 pl-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'active', 'invited', 'suspended'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={
                    status === value
                      ? 'rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground'
                      : 'rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }
                >
                  {value === 'all' ? 'All' : value}
                </button>
              ))}
              <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">
                {filtered.length} shown
              </span>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="sticky top-0 bg-muted/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Member</th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Workflows</th>
                  <th className="px-4 py-3 text-right font-medium">Est. monthly</th>
                  <th className="px-4 py-3 text-left font-medium">Last active</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const monthly = userMonthlyEstimate(user.id)
                  return (
                    <tr
                      key={user.id}
                      className="border-t border-border/60 transition-colors hover:bg-accent/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={ROUTES.user(user.id)}
                          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground hover:underline">
                              {user.name}
                            </p>
                            <p className="truncate text-[10.5px] text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.company}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{user.role}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={user.status} tone={STATUS_TONE[user.status]} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {user.workflows}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                        {formatCurrency(monthly)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.lastActive}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]">
                          <Link to={ROUTES.user(user.id)}>
                            View
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <Plus className="mb-3 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">No members match</p>
              <p className="mt-1 text-xs text-muted-foreground">Try another search or status filter.</p>
            </div>
          )}
        </PremiumCard>
      </PageBody>
    </>
  )
}
