import type { WorkflowGenerationPlan } from '@/types/workflow-generation'
import type { WorkflowExecutionType } from '@/types/agent-workflow'

export interface WorkflowTemplate {
  id: string
  title: string
  description: string
  /** Short label shown on the card (Magentic, Sequential, …). */
  badge: string
  /** Maps to workspace execution type / export schema. */
  executionType: WorkflowExecutionType
  /** Backend can compile/run this pattern today. */
  runtimeReady: boolean
  plan: WorkflowGenerationPlan
}

function agent(
  key: string,
  name: string,
  description: string,
  paletteId: string,
  instructions: string,
  tools: string[] = [],
  position?: { x: number; y: number },
): WorkflowGenerationPlan['agents'][number] {
  return {
    key,
    name,
    description,
    paletteId,
    instructions,
    tools,
    ...(position ? { x: position.x, y: position.y } : {}),
  }
}

function edge(
  fromKey: string,
  toKey: string,
  label = '',
  humanApproval = false,
): WorkflowGenerationPlan['edges'][number] {
  return { fromKey, toKey, label, humanApproval }
}

/** Starter workflow patterns users can drop onto the canvas and customize. */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'sequential',
    title: 'Sequential pipeline',
    description: 'Planner hands work to an executor in a straight line — classic one-after-another flow.',
    badge: 'Sequential',
    executionType: 'sequential',
    runtimeReady: true,
    plan: {
      workflowName: 'Sequential pipeline',
      description: 'Plan then execute in order.',
      executionType: 'sequential',
      agents: [
        agent(
          'planner',
          'Planner',
          'Breaks the request into clear steps.',
          'aw-planner',
          '## Role\nCreate a short actionable plan for the next agent.\n\n## Guidelines\n- List 3–6 concrete steps\n- Call out inputs and expected outputs',
          [],
          { x: 80, y: 160 },
        ),
        agent(
          'executor',
          'Executor',
          'Carries out the plan and returns the result.',
          'aw-agent',
          '## Role\nExecute the planner’s steps and produce the final answer.\n\n## Guidelines\n- Follow the plan in order\n- Return a polished result',
          [],
          { x: 380, y: 160 },
        ),
      ],
      edges: [edge('planner', 'executor')],
    },
  },
  {
    id: 'parallel',
    title: 'Parallel fan-out',
    description: 'Split work across specialists, then merge results into one answer.',
    badge: 'Parallel',
    executionType: 'parallel',
    runtimeReady: true,
    plan: {
      workflowName: 'Parallel fan-out',
      description: 'Research and analysis run together, then a writer merges.',
      executionType: 'parallel',
      agents: [
        agent(
          'dispatcher',
          'Dispatcher',
          'Splits the request into parallel workstreams.',
          'aw-planner',
          '## Role\nDefine two parallel briefs: research and analysis.\n\n## Guidelines\n- Keep briefs short and non-overlapping',
          [],
          { x: 80, y: 200 },
        ),
        agent(
          'researcher',
          'Researcher',
          'Gathers facts and sources.',
          'aw-specialist',
          '## Role\nCollect relevant facts for the brief.\n\n## Guidelines\n- Prefer verifiable points\n- Note gaps clearly',
          ['web_search'],
          { x: 380, y: 80 },
        ),
        agent(
          'analyst',
          'Analyst',
          'Interprets findings and risks.',
          'aw-llm-agent',
          '## Role\nAnalyze the request and highlight risks or trade-offs.\n\n## Guidelines\n- Be concise\n- Separate facts from opinions',
          [],
          { x: 380, y: 320 },
        ),
        agent(
          'writer',
          'Writer',
          'Merges parallel outputs into one response.',
          'aw-agent',
          '## Role\nCombine researcher and analyst outputs into a final answer.\n\n## Guidelines\n- Resolve conflicts\n- Keep the response user-ready',
          [],
          { x: 680, y: 200 },
        ),
      ],
      edges: [
        edge('dispatcher', 'researcher'),
        edge('dispatcher', 'analyst'),
        edge('researcher', 'writer'),
        edge('analyst', 'writer'),
      ],
    },
  },
  {
    id: 'handoff',
    title: 'Handoff / conditional',
    description: 'A router chooses the next specialist — maps to handoff-style workflows.',
    badge: 'Handoff',
    executionType: 'conditional',
    runtimeReady: true,
    plan: {
      workflowName: 'Handoff router',
      description: 'Route by intent to the right specialist, then finalize.',
      executionType: 'conditional',
      agents: [
        agent(
          'router',
          'Router',
          'Classifies intent and picks the next agent.',
          'aw-router',
          '## Role\nClassify the user request and choose a branch.\n\n## Guidelines\n- Prefer support for help/tickets\n- Prefer sales for pricing/demo requests\n- Output the chosen branch clearly',
          [],
          { x: 80, y: 200 },
        ),
        agent(
          'support',
          'Support specialist',
          'Handles help and troubleshooting.',
          'aw-specialist',
          '## Role\nResolve support-style requests.\n\n## Guidelines\n- Ask clarifying questions if needed\n- Give actionable steps',
          [],
          { x: 380, y: 80 },
        ),
        agent(
          'sales',
          'Sales specialist',
          'Handles pricing and product questions.',
          'aw-specialist',
          '## Role\nHandle commercial and product questions.\n\n## Guidelines\n- Stay accurate\n- Offer next steps',
          [],
          { x: 380, y: 320 },
        ),
        agent(
          'finalizer',
          'Finalizer',
          'Formats the specialist reply for the user.',
          'aw-agent',
          '## Role\nPolish the specialist output for delivery.\n\n## Guidelines\n- Keep tone consistent\n- Do not invent new facts',
          [],
          { x: 680, y: 200 },
        ),
      ],
      edges: [
        edge('router', 'support', 'Support'),
        edge('router', 'sales', 'Sales'),
        edge('support', 'finalizer'),
        edge('sales', 'finalizer'),
      ],
    },
  },
  {
    id: 'group-chat',
    title: 'Group chat',
    description: 'A facilitator leads specialists in a shared collaboration thread.',
    badge: 'Group chat',
    executionType: 'group-chat',
    runtimeReady: false,
    plan: {
      workflowName: 'Group chat team',
      description: 'Facilitator coordinates researcher and critic in a shared thread.',
      executionType: 'group-chat',
      agents: [
        agent(
          'facilitator',
          'Facilitator',
          'Runs the group conversation and keeps turn order.',
          'aw-planner',
          '## Role\nFacilitate a multi-agent discussion.\n\n## Guidelines\n- Invite each specialist once\n- Summarize consensus at the end',
          [],
          { x: 80, y: 200 },
        ),
        agent(
          'researcher',
          'Researcher',
          'Contributes evidence to the thread.',
          'aw-specialist',
          '## Role\nAdd research findings to the group chat.\n\n## Guidelines\n- Stay on topic\n- Cite assumptions',
          [],
          { x: 380, y: 80 },
        ),
        agent(
          'critic',
          'Critic',
          'Challenges weak points in the discussion.',
          'aw-reviewer',
          '## Role\nCritique the emerging answer.\n\n## Guidelines\n- Be constructive\n- Flag missing evidence',
          [],
          { x: 380, y: 320 },
        ),
        agent(
          'synthesizer',
          'Synthesizer',
          'Produces the shared final answer.',
          'aw-agent',
          '## Role\nSynthesize the group chat into one answer.\n\n## Guidelines\n- Reflect agreement and dissent\n- Keep it concise',
          [],
          { x: 680, y: 200 },
        ),
      ],
      edges: [
        edge('facilitator', 'researcher'),
        edge('facilitator', 'critic'),
        edge('researcher', 'synthesizer'),
        edge('critic', 'synthesizer'),
      ],
    },
  },
  {
    id: 'magentic',
    title: 'Magentic',
    description:
      'A manager plans the request, selects Research, Data, and Reviewer once, then returns the final answer.',
    badge: 'Magentic',
    executionType: 'dependency',
    runtimeReady: true,
    plan: {
      workflowName: 'Magentic',
      description: 'Magentic manager coordinates research, data, and review.',
      executionType: 'dependency',
      agents: [
        agent(
          'manager',
          'Magentic Manager',
          'Creates the plan, selects each agent once, and returns the final answer.',
          'aw-planner',
          '## Role\nYou are the Magentic manager for the user request.\n\n## Guidelines\n- Create a plan before any agent works\n- Select each agent at most once: Research, Data, then Reviewer\n- Track progress against the plan\n- Return the final answer after that single pass',
          [],
          { x: 380, y: 40 },
        ),
        agent(
          'research',
          'Research Agent',
          'Gathers facts and sources for the current plan step.',
          'aw-specialist',
          '## Role\nResearch the step assigned by the Magentic manager.\n\n## Guidelines\n- Prefer verifiable facts\n- Note gaps the manager should replan around',
          ['web_search'],
          { x: 80, y: 280 },
        ),
        agent(
          'data',
          'Data Agent',
          'Works with structured data for the current plan step.',
          'aw-llm-agent',
          '## Role\nAnalyze the data requested by the Magentic manager.\n\n## Guidelines\n- Show the figures you used\n- Flag missing data instead of guessing',
          [],
          { x: 380, y: 280 },
        ),
        agent(
          'reviewer',
          'Reviewer Agent',
          'Checks the working answer before the manager finishes.',
          'aw-agent',
          '## Role\nReview the current answer for the Magentic manager.\n\n## Guidelines\n- Check the answer against the plan\n- Return the review in this turn',
          [],
          { x: 680, y: 280 },
        ),
      ],
      edges: [
        edge('manager', 'research', 'selects'),
        edge('manager', 'data', 'selects'),
        edge('manager', 'reviewer', 'selects'),
      ],
    },
  },
  {
    id: 'human-in-the-loop',
    title: 'Human-in-the-loop',
    description: 'Draft → human approval gate → publish. Best for review-sensitive work.',
    badge: 'HITL',
    executionType: 'human-in-the-loop',
    runtimeReady: true,
    plan: {
      workflowName: 'Human review gate',
      description: 'Writer drafts, reviewer requires approval, then publisher ships.',
      executionType: 'human-in-the-loop',
      agents: [
        agent(
          'writer',
          'Writer',
          'Drafts the content for review.',
          'aw-agent',
          '## Role\nDraft the deliverable.\n\n## Guidelines\n- Mark uncertain claims\n- Keep a clear structure',
          [],
          { x: 80, y: 160 },
        ),
        agent(
          'reviewer',
          'Reviewer',
          'Checks quality before release.',
          'aw-reviewer',
          '## Role\nReview the draft and request changes if needed.\n\n## Guidelines\n- Approve only when ready to publish',
          [],
          { x: 380, y: 160 },
        ),
        agent(
          'publisher',
          'Publisher',
          'Ships the approved draft.',
          'aw-agent',
          '## Role\nPublish the approved content.\n\n## Guidelines\n- Do not publish without approval',
          [],
          { x: 680, y: 160 },
        ),
      ],
      edges: [
        edge('writer', 'reviewer'),
        edge('reviewer', 'publisher', 'Approved', true),
      ],
    },
  },
]

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id)
}
