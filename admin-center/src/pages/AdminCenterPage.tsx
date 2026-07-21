import { NavLink, Outlet } from 'react-router-dom'
import {
  Activity,
  Bot,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { AdminSidebar } from '@/components/admin-center/AdminSidebar'
import { APP_NAME, APP_TITLE, ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

const MOBILE_LINKS = [
  { to: ROUTES.dashboard, label: 'Home', icon: LayoutDashboard },
  { to: ROUTES.users, label: 'Users', icon: Users },
  { to: ROUTES.workflows, label: 'Flows', icon: Bot },
  { to: ROUTES.activity, label: 'Activity', icon: Activity },
  { to: ROUTES.access, label: 'Access', icon: ShieldCheck },
  { to: ROUTES.settings, label: 'Settings', icon: Settings },
]

/** Standalone Admin Center micro-app shell. */
export default function AdminCenterPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 md:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{APP_TITLE}</p>
            <p className="truncate text-[10px] text-muted-foreground">{APP_NAME}</p>
          </div>
        </div>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
        <nav className="flex shrink-0 items-center justify-around border-t border-border/60 bg-background/90 px-1 py-1.5 backdrop-blur md:hidden">
          {MOBILE_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[9px] font-medium',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
