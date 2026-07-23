import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  PanelsTopLeft,
  PenLine,
  ScrollText,
  SlidersHorizontal,
} from 'lucide-react'
import { ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

const ITEMS = [
  {
    label: 'Design',
    to: ROUTES.agentWorkflow,
    end: true,
    icon: PenLine,
  },
  {
    label: 'Library',
    to: ROUTES.agentWorkflowLibrary,
    end: true,
    icon: PanelsTopLeft,
  },
  {
    label: 'Inspect',
    to: ROUTES.agentWorkflowInspect,
    end: true,
    icon: SlidersHorizontal,
  },
  {
    label: 'Logs',
    to: ROUTES.agentWorkflowLogs,
    end: true,
    icon: ScrollText,
  },
  {
    label: 'Console',
    to: ROUTES.agentWorkflowDashboard,
    end: false,
    icon: LayoutDashboard,
  },
] as const

/** Professional mobile tab bar — route-based pages, safe-area aware. */
export const MobileWorkspaceNav = memo(function MobileWorkspaceNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
      aria-label="Workspace pages"
    >
      <div className="border-t border-border bg-card px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.35)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="group relative flex flex-col items-center gap-1 px-1 py-2 outline-none"
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'absolute inset-x-3 top-0 h-0.5 rounded-full transition-opacity',
                        isActive ? 'bg-red-600 opacity-100' : 'opacity-0',
                      )}
                    />
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                        isActive
                          ? 'bg-red-600/10 text-red-600 dark:text-red-400'
                          : 'text-muted-foreground group-hover:bg-foreground/[0.05] group-hover:text-foreground',
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.15 : 1.7} />
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold tracking-tight',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
})

export type MobileWorkspaceTab = 'design' | 'library' | 'inspect' | 'logs'

export function mobileTabFromPath(pathname: string): MobileWorkspaceTab {
  if (pathname.startsWith(ROUTES.agentWorkflowLibrary)) return 'library'
  if (pathname.startsWith(ROUTES.agentWorkflowInspect)) return 'inspect'
  if (pathname.startsWith(ROUTES.agentWorkflowLogs)) return 'logs'
  return 'design'
}
