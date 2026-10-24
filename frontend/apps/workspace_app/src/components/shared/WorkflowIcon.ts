import { createLucideIcon } from 'lucide-react'

/**
 * The app's workflow icon: a step on the left branching out to three. Drawn in lucide's
 * outline style (24px grid, 2px stroke, round caps, no fills) so it sits evenly beside the
 * lucide icons around it, and takes the same props.
 */
export const WorkflowIcon = createLucideIcon('WorkflowBranch', [
  ['rect', { x: '2', y: '9.5', width: '5', height: '5', rx: '1.25', key: 'step' }],
  ['path', { d: 'M7 12h3', key: 'stem' }],
  ['path', { d: 'M10 12c3 0 3-8 6.25-8', key: 'up' }],
  ['path', { d: 'M10 12h6.25', key: 'mid' }],
  ['path', { d: 'M10 12c3 0 3 8 6.25 8', key: 'down' }],
  ['circle', { cx: '19.5', cy: '4', r: '1.75', key: 'a' }],
  ['circle', { cx: '19.5', cy: '12', r: '1.75', key: 'b' }],
  ['circle', { cx: '19.5', cy: '20', r: '1.75', key: 'c' }],
])
