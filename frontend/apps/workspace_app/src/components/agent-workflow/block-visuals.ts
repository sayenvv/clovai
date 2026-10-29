import {
  AlignLeft,
  BookOpenText,
  Bot,
  BrainCircuit,
  Braces,
  CalendarClock,
  CircleStop,
  DatabaseZap,
  FileSearch,
  FolderOpen,
  FolderTree,
  GitFork,
  Globe,
  Hourglass,
  Layers,
  ListChecks,
  Mail,
  MessageCircleQuestion,
  MessagesSquare,
  Play,
  Plug,
  Puzzle,
  Radio,
  Repeat,
  ScanSearch,
  SearchCheck,
  Server,
  Share2,
  ShieldCheck,
  Signpost,
  Sparkles,
  SquareFunction,
  SquareTerminal,
  Terminal,
  Users,
  Webhook,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * One look per block type, shared by the library, the "+" picker and the canvas cards, so a block shows the
 * same icon everywhere. `tile` is the light tint for lists; `solid` the filled disc on canvas cards.
 */
export interface BlockVisual {
  icon: LucideIcon
  tile: string
  solid: string
}

export const BLOCK_VISUALS: Record<string, BlockVisual> = {
  'aw-start': { icon: Play, tile: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300', solid: 'bg-emerald-500 shadow-emerald-500/30' },
  'aw-end': { icon: CircleStop, tile: 'bg-muted text-foreground/70 ring-border', solid: 'bg-zinc-600 shadow-zinc-600/30' },
  'aw-switch': { icon: GitFork, tile: 'bg-muted text-foreground/70 ring-border', solid: 'bg-zinc-700 shadow-zinc-700/30' },
  'aw-reviewer': { icon: ShieldCheck, tile: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300', solid: 'bg-amber-500 shadow-amber-500/30' },
  'aw-ask-user': { icon: MessageCircleQuestion, tile: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300', solid: 'bg-sky-500 shadow-sky-500/30' },
  'aw-delay': { icon: Hourglass, tile: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-300', solid: 'bg-zinc-500 shadow-zinc-500/30' },
  'aw-wait-event': { icon: Radio, tile: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300', solid: 'bg-violet-500 shadow-violet-500/30' },
  'aw-transform': { icon: Braces, tile: 'bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-300', solid: 'bg-teal-600 shadow-teal-600/30' },
  'aw-loop': { icon: Repeat, tile: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300', solid: 'bg-indigo-500 shadow-indigo-500/30' },
  'aw-agent': { icon: Bot, tile: 'bg-foreground/10 text-foreground ring-foreground/20', solid: 'bg-foreground shadow-foreground/20' },
  'aw-tool': { icon: Wrench, tile: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300', solid: 'bg-sky-600 shadow-sky-600/30' },
  'aw-mcp-tool': { icon: Plug, tile: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300', solid: 'bg-emerald-600 shadow-emerald-600/30' },
  'aw-skill': { icon: Sparkles, tile: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300', solid: 'bg-violet-600 shadow-violet-600/30' },
  'aw-integration': { icon: Puzzle, tile: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300', solid: 'bg-amber-600 shadow-amber-600/30' },
  'aw-sub-workflow': { icon: Layers, tile: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300', solid: 'bg-violet-600 shadow-violet-600/30' },
  'aw-executor': { icon: Terminal, tile: 'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-300', solid: 'bg-zinc-800 shadow-zinc-800/30' },
  'aw-event': { icon: Zap, tile: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300', solid: 'bg-amber-500 shadow-amber-500/30' },
  'aw-schedule': { icon: CalendarClock, tile: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300', solid: 'bg-sky-500 shadow-sky-500/30' },
}

export const blockVisual = (paletteId: string): BlockVisual | undefined => BLOCK_VISUALS[paletteId]

/** Each library tool, skill, integration, MCP server and memory: its own icon (the category's colour stays). */
export const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  web_search: Globe,
  code_interpreter: SquareTerminal,
  file_search: FileSearch,
  function_calling: SquareFunction,
  api_call: Webhook,
  mcp_server: Server,
  mcp_filesystem: FolderTree,
  skill_planning: ListChecks,
  skill_summarization: AlignLeft,
  skill_rag: BookOpenText,
  skill_critique: SearchCheck,
  skill_routing: Signpost,
  memory_workflow: Workflow,
  memory_thread: MessagesSquare,
  memory_vector: DatabaseZap,
  azure_ai_search: ScanSearch,
  microsoft_graph: Share2,
  teams_notify: Users,
  outlook_mail: Mail,
  sharepoint: FolderOpen,
  azure_openai: BrainCircuit,
}
