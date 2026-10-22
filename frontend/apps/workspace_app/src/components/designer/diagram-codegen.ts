import { resolveNodeStyle, type Diagram, type DiagramNode } from './diagram-types'
import type { PaletteItem, PaletteShape } from '@/types/config'
import { CODE_EXPORT_PREVIEW_BANNER } from '@/constants/designer'
import { slugifyIdentifier } from '@/utils/slug'

export type CodeLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'csharp' | 'go' | 'pseudocode'

export interface CodeLanguageOption {
  id: CodeLanguage
  label: string
  extension: string
}

export const CODE_LANGUAGES: CodeLanguageOption[] = [
  { id: 'javascript', label: 'JavaScript', extension: 'js' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts' },
  { id: 'python', label: 'Python', extension: 'py' },
  { id: 'java', label: 'Java', extension: 'java' },
  { id: 'csharp', label: 'C#', extension: 'cs' },
  { id: 'go', label: 'Go', extension: 'go' },
  { id: 'pseudocode', label: 'Pseudocode', extension: 'txt' },
]

interface FlowEdge {
  label?: string
  targetId: string
}

interface FlowNode {
  node: DiagramNode
  shape: PaletteShape
  outgoing: FlowEdge[]
}

function isDecisionShape(shape: PaletteShape): boolean {
  return shape === 'decision' || shape === 'parallel-gateway' || shape === 'or-gate'
}

function isTerminatorShape(shape: PaletteShape): boolean {
  return shape === 'terminator' || shape === 'event'
}

function buildFlow(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
): FlowNode[] {
  if (diagram.nodes.length === 0) return []

  const incoming = new Map<string, number>()
  diagram.nodes.forEach((node) => incoming.set(node.id, 0))
  diagram.edges.forEach((edge) => {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
  })

  const outgoingByNode = new Map<string, FlowEdge[]>()
  diagram.edges.forEach((edge) => {
    const list = outgoingByNode.get(edge.from) ?? []
    list.push({ label: edge.label, targetId: edge.to })
    outgoingByNode.set(edge.from, list)
  })

  const start =
    diagram.nodes.find((node) => {
      const item = paletteById.get(node.paletteId)
      if (!item) return false
      const { shape } = resolveNodeStyle(node, item)
      return isTerminatorShape(shape) && node.label.toLowerCase().includes('start')
    }) ??
    diagram.nodes.find((node) => (incoming.get(node.id) ?? 0) === 0) ??
    [...diagram.nodes].sort((a, b) => a.y - b.y || a.x - b.x)[0]

  const visited = new Set<string>()
  const ordered: FlowNode[] = []

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = diagram.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) return
    const item = paletteById.get(node.paletteId)
    if (!item) return

    const { shape } = resolveNodeStyle(node, item)
    ordered.push({ node, shape, outgoing: outgoingByNode.get(nodeId) ?? [] })

    const nextIds = (outgoingByNode.get(nodeId) ?? []).map((edge) => edge.targetId)
    nextIds.forEach(visit)
  }

  visit(start.id)

  diagram.nodes
    .filter((node) => !visited.has(node.id))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((node) => visit(node.id))

  return ordered
}

function stepComment(label: string, shape: PaletteShape): string {
  return `${shape}: ${label}`
}

function emitSteps(
  flow: FlowNode[],
  indent: string,
  emitCall: (name: string, comment: string) => string,
  emitDecision: (
    condition: string,
    branches: Array<{ label: string; call: string }>,
  ) => string[],
): string[] {
  const lines: string[] = []

  flow.forEach(({ node, shape, outgoing }) => {
    const name = slugifyIdentifier(node.label, node.id.replace(/[^a-z0-9]/gi, '_'))
    const comment = stepComment(node.label, shape)

    if (isDecisionShape(shape)) {
      const branches = outgoing.map((edge, index) => {
        const target = flow.find((step) => step.node.id === edge.targetId)
        const targetName = target
          ? slugifyIdentifier(target.node.label, `branch_${index}`)
          : `step_${index}`
        return {
          label: edge.label ?? (index === 0 ? 'Yes' : 'No'),
          call: emitCall(targetName, comment),
        }
      })
      if (branches.length === 0) {
        lines.push(`${indent}// ${comment}`)
        return
      }
      lines.push(...emitDecision(node.label, branches))
      return
    }

    if (isTerminatorShape(shape)) {
      lines.push(`${indent}// ${comment}`)
      return
    }

    lines.push(emitCall(name, comment))
  })

  return lines
}

function generateJavaScript(flow: FlowNode[], pageName: string): string {
  const helpers = flow
    .filter(({ shape }) => !isDecisionShape(shape) && !isTerminatorShape(shape))
    .map(({ node }) => {
      const name = slugifyIdentifier(node.label, node.id)
      return `async function ${name}() {\n  // ${node.label}\n  console.log('${node.label.replace(/'/g, "\\'")}');\n}`
    })

  const body = emitSteps(
    flow,
    '  ',
    (name, comment) => `  // ${comment}\n  await ${name}();`,
    (condition, branches) => {
      const [first, second, ...rest] = branches
      const lines = [`  // Decision: ${condition}`]
      if (first) {
        lines.push(`  if (${JSON.stringify(first.label.toLowerCase())} === 'yes') {`)
        lines.push(`    ${first.call.trim()}`)
        if (second) {
          lines.push('  } else {')
          lines.push(`    ${second.call.trim()}`)
        }
        lines.push('  }')
      }
      rest.forEach((branch) => lines.push(`  // ${branch.label}: ${branch.call.trim()}`))
      return lines
    },
  )

  return [
    `// ${pageName}`,
    `// ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    ...helpers,
    '',
    'async function runWorkflow() {',
    ...body,
    '}',
    '',
    'runWorkflow();',
  ].join('\n')
}

function generateTypeScript(flow: FlowNode[], pageName: string): string {
  const js = generateJavaScript(flow, pageName)
  return [
    `// ${pageName}`,
    `// ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    'type WorkflowContext = Record<string, unknown>;',
    '',
    js
      .split('\n')
      .slice(3)
      .join('\n')
      .replace(/^async function (\w+)\(\)/gm, 'async function $1(): Promise<void>'),
  ].join('\n')
}

function generatePython(flow: FlowNode[], pageName: string): string {
  const helpers = flow
    .filter(({ shape }) => !isDecisionShape(shape) && !isTerminatorShape(shape))
    .map(({ node }) => {
      const name = slugifyIdentifier(node.label, node.id)
      return `def ${name}():\n    """${node.label}"""\n    print("${node.label.replace(/"/g, '\\"')}")`
    })

  const body = emitSteps(
    flow,
    '    ',
    (name, comment) => `    # ${comment}\n    ${name}()`,
    (condition, branches) => {
      const lines = [`    # Decision: ${condition}`]
      if (branches[0]) {
        lines.push(`    if True:  # ${branches[0].label}`)
        lines.push(`        ${branches[0].call.trim()}`)
        if (branches[1]) {
          lines.push('    else:')
          lines.push(`        ${branches[1].call.trim()}`)
        }
      }
      return lines
    },
  )

  return [
    `# ${pageName}`,
    `# ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    ...helpers,
    '',
    'def run_workflow():',
    ...body,
    '',
    'if __name__ == "__main__":',
    '    run_workflow()',
  ].join('\n')
}

function generateJava(flow: FlowNode[], pageName: string): string {
  const className = slugifyIdentifier(pageName, 'Workflow')
  const methods = flow
    .filter(({ shape }) => !isDecisionShape(shape) && !isTerminatorShape(shape))
    .map(({ node }) => {
      const name = slugifyIdentifier(node.label, node.id)
      return `    void ${name}() {\n        // ${node.label}\n        System.out.println("${node.label.replace(/"/g, '\\"')}");\n    }`
    })

  const body = emitSteps(
    flow,
    '        ',
    (name, comment) => `        // ${comment}\n        ${name}();`,
    (condition, branches) => {
      const lines = [`        // Decision: ${condition}`]
      if (branches[0]) {
        lines.push(`        if (true) { // ${branches[0].label}`)
        lines.push(`            ${branches[0].call.trim()}`)
        if (branches[1]) {
          lines.push('        } else {')
          lines.push(`            ${branches[1].call.trim()}`)
        }
        lines.push('        }')
      }
      return lines
    },
  )

  return [
    `// ${pageName}`,
    `// ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    `public class ${className} {`,
    ...methods,
    '',
    '    void runWorkflow() {',
    ...body,
    '    }',
    '',
    '    public static void main(String[] args) {',
    `        new ${className}().runWorkflow();`,
    '    }',
    '}',
  ].join('\n')
}

function generateCSharp(flow: FlowNode[], pageName: string): string {
  const className = slugifyIdentifier(pageName, 'Workflow')
  const methods = flow
    .filter(({ shape }) => !isDecisionShape(shape) && !isTerminatorShape(shape))
    .map(({ node }) => {
      const name = slugifyIdentifier(node.label, node.id)
      const pascal = name.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())
      return `    void ${pascal}()\n    {\n        // ${node.label}\n        Console.WriteLine("${node.label.replace(/"/g, '\\"')}");\n    }`
    })

  const body = emitSteps(
    flow,
    '        ',
    (name, comment) => {
      const pascal = name.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())
      return `        // ${comment}\n        ${pascal}();`
    },
    (condition, branches) => {
      const lines = [`        // Decision: ${condition}`]
      if (branches[0]) {
        lines.push(`        if (true) // ${branches[0].label}`)
        lines.push('        {')
        lines.push(`            ${branches[0].call.trim()}`)
        if (branches[1]) {
          lines.push('        }')
          lines.push('        else')
          lines.push('        {')
          lines.push(`            ${branches[1].call.trim()}`)
        }
        lines.push('        }')
      }
      return lines
    },
  )

  return [
    `// ${pageName}`,
    `// ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    `public class ${className}`,
    '{',
    ...methods,
    '',
    '    void RunWorkflow()',
    '    {',
    ...body,
    '    }',
    '',
    '    public static void Main()',
    '    {',
    '        new ' + className + '().RunWorkflow();',
    '    }',
    '}',
  ].join('\n')
}

function generateGo(flow: FlowNode[], pageName: string): string {
  const helpers = flow
    .filter(({ shape }) => !isDecisionShape(shape) && !isTerminatorShape(shape))
    .map(({ node }) => {
      const name = slugifyIdentifier(node.label, node.id)
      const exported = name.charAt(0).toUpperCase() + name.slice(1)
      return `func ${exported}() {\n\t// ${node.label}\n\tfmt.Println("${node.label.replace(/"/g, '\\"')}")\n}`
    })

  const body = emitSteps(
    flow,
    '\t',
    (name, comment) => {
      const exported = name.charAt(0).toUpperCase() + name.slice(1)
      return `\t// ${comment}\n\t${exported}()`
    },
    (condition, branches) => {
      const lines = [`\t// Decision: ${condition}`]
      if (branches[0]) {
        lines.push(`\tif true { // ${branches[0].label}`)
        lines.push(`\t\t${branches[0].call.trim()}`)
        if (branches[1]) {
          lines.push('\t} else {')
          lines.push(`\t\t${branches[1].call.trim()}`)
        }
        lines.push('\t}')
      }
      return lines
    },
  )

  return [
    `// ${pageName}`,
    `// ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    'package main',
    '',
    'import "fmt"',
    '',
    ...helpers,
    '',
    'func runWorkflow() {',
    ...body,
    '}',
    '',
    'func main() {',
    '\trunWorkflow()',
    '}',
  ].join('\n')
}

function generatePseudocode(flow: FlowNode[], pageName: string): string {
  const lines = [`PROCESS ${pageName}`, `  ${CODE_EXPORT_PREVIEW_BANNER}`, '']

  flow.forEach(({ node, shape, outgoing }) => {
    if (isTerminatorShape(shape)) {
      lines.push(`  ${node.label.toUpperCase()}`)
      return
    }
    if (isDecisionShape(shape)) {
      lines.push(`  IF ${node.label} THEN`)
      outgoing.forEach((edge, index) => {
        const branch = edge.label ?? (index === 0 ? 'Yes' : 'No')
        lines.push(`    -> ${branch}`)
      })
      lines.push('  END IF')
      return
    }
    lines.push(`  STEP ${node.label}`)
  })

  lines.push('END PROCESS')
  return lines.join('\n')
}

export function generateDiagramCode(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  language: CodeLanguage,
  pageName: string,
): string {
  const flow = buildFlow(diagram, paletteById)

  if (flow.length === 0) {
    return `// ${pageName}\n// ${CODE_EXPORT_PREVIEW_BANNER}\n\n// Add shapes to the canvas to generate a workflow sample.`
  }

  switch (language) {
    case 'javascript':
      return generateJavaScript(flow, pageName)
    case 'typescript':
      return generateTypeScript(flow, pageName)
    case 'python':
      return generatePython(flow, pageName)
    case 'java':
      return generateJava(flow, pageName)
    case 'csharp':
      return generateCSharp(flow, pageName)
    case 'go':
      return generateGo(flow, pageName)
    case 'pseudocode':
      return generatePseudocode(flow, pageName)
    default:
      return generateJavaScript(flow, pageName)
  }
}
