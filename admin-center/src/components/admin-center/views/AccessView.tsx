import { PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { ADMIN_ROLES } from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'

export function AccessView() {
  const totalMembers = ADMIN_ROLES.reduce((sum, role) => sum + role.members, 0)

  return (
    <>
      <PageHeader
        title="Access control"
        description="Roles, permissions, and who can manage this workspace."
        actions={
          <Button size="sm" variant="outline" className="h-8 text-[11.5px] font-semibold">
            Edit roles
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <PremiumCard className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Role distribution
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{totalMembers} members</p>
            </div>
            <p className="text-[11px] text-muted-foreground">Across {ADMIN_ROLES.length} roles</p>
          </div>
          <div className="mt-5 space-y-3">
            {ADMIN_ROLES.map((role) => {
              const pct = Math.round((role.members / totalMembers) * 100)
              return (
                <div key={role.id}>
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                    <span className="font-medium text-foreground">{role.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {role.members} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </PremiumCard>

        <div className="grid gap-3 md:grid-cols-2">
          {ADMIN_ROLES.map((role) => (
            <PremiumCard key={role.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{role.name}</h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    {role.description}
                  </p>
                </div>
                <StatusBadge label={`${role.members} members`} tone="neutral" />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {role.permissions.map((permission) => (
                  <StatusBadge key={permission} label={permission} tone="violet" />
                ))}
              </div>
            </PremiumCard>
          ))}
        </div>
      </PageBody>
    </>
  )
}
