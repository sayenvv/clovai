import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  ExternalLink,
  Gauge,
  LayoutDashboard,
  PenLine,
  Rocket,
  Shield,
} from 'lucide-react'
import { ADMIN_CENTER_URL, ROUTES } from '@/constants'

interface ConsoleMenuProps {
  onNavigate: () => void
}

const CONSOLE_LINKS = [
  {
    id: 'dashboard',
    label: 'My dashboard',
    description: 'Track instance health, runs, and spend',
    to: ROUTES.agentWorkflowDashboard,
    icon: LayoutDashboard,
    external: false,
  },
  {
    id: 'instances',
    label: 'My instances',
    description: 'View and manage published deployments',
    to: ROUTES.agentWorkflowDashboardInstances,
    icon: Rocket,
    external: false,
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Latency, credits, and resource load',
    to: ROUTES.agentWorkflowDashboardPerformance,
    icon: Gauge,
    external: false,
  },
  {
    id: 'designer',
    label: 'Workflow designer',
    description: 'Build, validate, and deploy agents',
    to: ROUTES.agentWorkflow,
    icon: PenLine,
    external: false,
  },
] as const

export const ConsoleMenu = memo(function ConsoleMenu({ onNavigate }: ConsoleMenuProps) {
  return (
    <motion.div
      role="menu"
      aria-label="Console"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-xl shadow-black/10 backdrop-blur-xl"
    >
      <div className="border-b border-border/60 bg-gradient-to-br from-red-500/[0.07] via-transparent to-rose-500/[0.05] px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Management console
        </p>
        <p className="mt-1 text-[13px] font-semibold tracking-tight text-foreground">
          Open your workspace portal
        </p>
      </div>

      <div className="p-2">
        {CONSOLE_LINKS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              to={item.to}
              role="menuitem"
              onClick={onNavigate}
              className="group flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-accent/60"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground ring-1 ring-border/60 transition-colors group-hover:bg-gradient-to-br group-hover:from-red-600 group-hover:to-rose-600 group-hover:text-white group-hover:ring-transparent">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground">
                  {item.label}
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>

      <div className="border-t border-border/60 p-2">
        <a
          href={ADMIN_CENTER_URL}
          target="_blank"
          rel="noreferrer noopener"
          role="menuitem"
          onClick={onNavigate}
          className="group flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-accent/60"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground ring-1 ring-border/60 transition-colors group-hover:bg-foreground group-hover:text-background group-hover:ring-transparent">
            <Shield className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground">
              Admin Center
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              Users, workflows, and platform ops
            </span>
          </span>
        </a>
      </div>
    </motion.div>
  )
})
