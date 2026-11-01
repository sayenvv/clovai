import { useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, File, FileCode2, FileImage, FileJson, FileText, Folder, FolderOpen, Palette, Settings2 } from 'lucide-react'
import { cn } from '@/utils/cn'

interface TreeFolder {
  name: string
  path: string
  folders: TreeFolder[]
  files: { name: string; path: string }[]
}

/** The project's flat file paths as a tree: folders first, then files, each sorted by name. */
function buildTree(paths: string[]): TreeFolder {
  const root: TreeFolder = { name: '', path: '', folders: [], files: [] }
  for (const path of paths) {
    const parts = path.split('/')
    let folder = root
    parts.slice(0, -1).forEach((part, index) => {
      const folderPath = parts.slice(0, index + 1).join('/')
      let next = folder.folders.find((child) => child.path === folderPath)
      if (!next) {
        next = { name: part, path: folderPath, folders: [], files: [] }
        folder.folders.push(next)
      }
      folder = next
    })
    folder.files.push({ name: parts[parts.length - 1], path })
  }
  const sort = (folder: TreeFolder) => {
    folder.folders.sort((a, b) => a.name.localeCompare(b.name))
    folder.files.sort((a, b) => a.name.localeCompare(b.name))
    folder.folders.forEach(sort)
  }
  sort(root)
  return root
}

/** An icon per kind of file, coloured as code editors do. */
function fileIcon(name: string): ReactNode {
  const className = 'h-3.5 w-3.5 shrink-0'
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  if (/^(vite|tsconfig|eslint|prettier|tailwind|postcss)\b/.test(name) || name.startsWith('.')) return <Settings2 className={cn(className, 'text-slate-500')} />
  if (extension === 'json') return <FileJson className={cn(className, 'text-amber-500')} />
  if (['jsx', 'tsx'].includes(extension)) return <FileCode2 className={cn(className, 'text-sky-500')} />
  if (['js', 'mjs', 'cjs'].includes(extension)) return <FileCode2 className={cn(className, 'text-yellow-500')} />
  if (extension === 'ts') return <FileCode2 className={cn(className, 'text-blue-500')} />
  if (['css', 'scss'].includes(extension)) return <Palette className={cn(className, 'text-pink-500')} />
  if (extension === 'html') return <FileCode2 className={cn(className, 'text-orange-500')} />
  if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico'].includes(extension)) return <FileImage className={cn(className, 'text-violet-500')} />
  if (['md', 'txt'].includes(extension)) return <FileText className={cn(className, 'text-muted-foreground')} />
  return <File className={cn(className, 'text-muted-foreground')} />
}

const INDENT = 12
const BASE = 8

/**
 * The project's files as a code editor's explorer: nested folders that open and close, an icon per file type, and
 * `M` beside files the assistant changed in its last turn.
 */
export function FileTree({
  files,
  changed = [],
  selected,
  onOpen,
}: {
  files: string[]
  changed?: string[]
  selected: string | null
  onOpen: (path: string) => void
}) {
  const tree = useMemo(() => buildTree(files), [files])
  const changedSet = useMemo(() => new Set(changed), [changed])
  const [closed, setClosed] = useState<Set<string>>(() => new Set())

  const toggle = (path: string) =>
    setClosed((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  // A folder is marked when something inside it changed, so a closed folder still shows it
  const folderChanged = (path: string) => [...changedSet].some((file) => file.startsWith(`${path}/`))

  const renderFolder = (folder: TreeFolder, depth: number): ReactNode => (
    <>
      {folder.folders.map((child) => {
        const open = !closed.has(child.path)
        return (
          <li key={child.path} role="treeitem" aria-expanded={open}>
            <Row depth={depth} onClick={() => toggle(child.path)} title={child.path}>
              <ChevronRight className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
              {open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate">{child.name}</span>
              {folderChanged(child.path) ? <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="has changes" /> : null}
            </Row>
            {open ? <ul role="group">{renderFolder(child, depth + 1)}</ul> : null}
          </li>
        )
      })}
      {folder.files.map((file) => {
        const isChanged = changedSet.has(file.path)
        return (
          <li key={file.path} role="treeitem" aria-selected={selected === file.path}>
            <Row depth={depth} selected={selected === file.path} onClick={() => onOpen(file.path)} title={file.path}>
              {/* Lines up with folder names, past the chevron */}
              <span className="w-3 shrink-0" />
              {fileIcon(file.name)}
              <span className={cn('truncate', isChanged && 'text-amber-700 dark:text-amber-400')}>{file.name}</span>
              {isChanged ? (
                <span className="ml-auto shrink-0 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400" title="Changed in the last turn">
                  M
                </span>
              ) : null}
            </Row>
          </li>
        )
      })}
    </>
  )

  return (
    <ul role="tree" aria-label="Project files" className="py-1">
      {renderFolder(tree, 0)}
    </ul>
  )
}

function Row({
  depth,
  selected = false,
  onClick,
  title,
  children,
}: {
  depth: number
  selected?: boolean
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        paddingLeft: BASE + depth * INDENT,
        // Indent guides, one per level, as in a code editor
        backgroundImage: depth
          ? Array.from({ length: depth }, () => 'linear-gradient(hsl(var(--border)), hsl(var(--border)))').join(',')
          : undefined,
        backgroundSize: depth ? Array.from({ length: depth }, () => '1px 100%').join(',') : undefined,
        backgroundPosition: depth ? Array.from({ length: depth }, (_, level) => `${BASE + 5 + level * INDENT}px 0`).join(',') : undefined,
        backgroundRepeat: 'no-repeat',
      }}
      className={cn(
        'flex h-[24px] w-full items-center gap-1.5 pr-3 text-left text-[12.5px] text-foreground/80 outline-none hover:bg-foreground/[0.05] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary',
        selected && 'bg-primary/[0.10] text-foreground hover:bg-primary/[0.14]',
      )}
    >
      {children}
    </button>
  )
}
