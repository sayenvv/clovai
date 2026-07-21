import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, UserPlus } from 'lucide-react'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { FilterChips } from '@/components/admin-center/FilterChips'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { SearchInput } from '@/components/admin-center/SearchInput'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { UserAvatar } from '@/components/admin-center/UserAvatar'
import { USER_STATUS_TONE } from '@/components/admin-center/status-tones'
import {
  ADMIN_USERS,
  formatCurrency,
  userMonthlyEstimate,
} from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'

const STATUS_FILTERS = ['all', 'active', 'invited', 'suspended'] as const

export function UsersView() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all')

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
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search name, email, company…"
              className="max-w-sm flex-1"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChips
                options={STATUS_FILTERS}
                value={status}
                onChange={setStatus}
                label={(value) => (value === 'all' ? 'All' : value)}
              />
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
                          <UserAvatar name={user.name} />
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
                        <StatusBadge
                          label={user.status}
                          tone={USER_STATUS_TONE[user.status]}
                        />
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
            <EmptyHint
              title="No members match"
              hint="Try another search or status filter."
              className="m-4 rounded-xl border-0 bg-transparent py-10"
            />
          )}
        </PremiumCard>
      </PageBody>
    </>
  )
}
