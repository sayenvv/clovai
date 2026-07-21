import { ExternalLink } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CONFIG_CONSOLE_URL } from '@/constants'

export function SettingsView() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace preferences for the Admin Center."
        actions={
          <Button size="sm" className="h-8 text-[11.5px] font-semibold">
            Save changes
          </Button>
        }
      />
      <PageBody className="mx-auto max-w-3xl space-y-4">
        <PremiumCard className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Workspace profile</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Shown across admin surfaces and invite emails.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ws-name" className="text-xs">
                Workspace name
              </Label>
              <Input id="ws-name" defaultValue="Acme Robotics" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-slug" className="text-xs">
                Slug
              </Label>
              <Input id="ws-slug" defaultValue="acme-robotics" className="h-9 font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-region" className="text-xs">
                Region
              </Label>
              <Input id="ws-region" defaultValue="ap-south-1" className="h-9 font-mono text-sm" />
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Control which operational alerts reach admins.
            </p>
          </div>
          {[
            {
              id: 'failed-runs',
              title: 'Failed workflow runs',
              description: 'Email when a published workflow fails twice in a row.',
              defaultChecked: true,
            },
            {
              id: 'new-members',
              title: 'New member invites',
              description: 'Notify owners when someone accepts an invite.',
              defaultChecked: true,
            },
            {
              id: 'security',
              title: 'Security events',
              description: 'Token rotations, suspicious logins, and role changes.',
              defaultChecked: true,
            },
          ].map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/60 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</p>
              </div>
              <Switch id={item.id} defaultChecked={item.defaultChecked} />
            </div>
          ))}
        </PremiumCard>

        <PremiumCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Site configuration</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Edit mega menu, landing, and theme JSON in the config console.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]">
            <a href={CONFIG_CONSOLE_URL} target="_blank" rel="noreferrer">
              Open config console
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </PremiumCard>
      </PageBody>
    </>
  )
}
