import type { ReactNode } from 'react'
import { newTab, site } from '@/config'

/**
 * The documentation, as data: groups of sections, each with an id (its anchor), a title and its body.
 * Keep it true to the product; when the workspace changes, change this.
 */

export type DocSection = { id: string; title: string; summary: string; body: ReactNode }
export type DocGroup = { title: string; sections: DocSection[] }

function Steps({ children }: { children: ReactNode }) {
  return <ol className="doc-steps">{children}</ol>
}

function Note({ tone = 'info', children }: { tone?: 'info' | 'tip' | 'warn'; children: ReactNode }) {
  const label = { info: 'Note', tip: 'Tip', warn: 'Heads up' }[tone]
  return (
    <aside className={`doc-note doc-note-${tone}`}>
      <p className="doc-note-label">{label}</p>
      <div>{children}</div>
    </aside>
  )
}

function Legend() {
  return (
    <div className="not-doc my-6 grid gap-2 sm:grid-cols-3">
      {[
        ['New', 'border-added bg-added/[0.06]', 'Added by the draft'],
        ['Edited', 'border-edited bg-edited/[0.06]', 'Changed by the draft'],
        ['Removed', 'border-dashed border-removed bg-removed/[0.05]', 'Gone once you accept'],
      ].map(([label, style, hint]) => (
        <div key={label} className={`rounded-xl border-2 px-4 py-3 ${style}`}>
          <p className="text-[14px] font-semibold text-bone">{label}</p>
          <p className="mt-0.5 text-[13px] text-bone-muted">{hint}</p>
        </div>
      ))}
    </div>
  )
}

export const DOCS: DocGroup[] = [
  {
    title: 'Getting started',
    sections: [
      {
        id: 'introduction',
        title: 'Introduction',
        summary: 'What Eleven Nodes is and the ideas behind it.',
        body: (
          <>
            <p>
              Eleven Nodes is a workspace for building and running AI agent workflows. A workflow is a set of steps (agents,
              tools, decisions and human approvals) joined on a visual canvas. You can build it yourself, or describe it to
              the AI assistant and let it build the workflow for you.
            </p>
            <p>Three ideas shape everything in the product:</p>
            <ul>
              <li>
                <strong>You can see the reasoning.</strong> The assistant explains each step it takes in a sentence: what it
                understood, what it read and what it changed.
              </li>
              <li>
                <strong>Nothing changes without you.</strong> The assistant's edits land in a draft. You review them on the
                canvas, with every change marked, and only accepting puts them in your workflow.
              </li>
              <li>
                <strong>Every run is traced.</strong> Each step, decision, approval and token is recorded, so you can see what
                a run did and why.
              </li>
            </ul>
            <p>Workflows run on Microsoft Agent Framework, with checkpoints, so a run paused for an approval resumes exactly where it stopped.</p>
          </>
        ),
      },
      {
        id: 'quickstart',
        title: 'Quickstart',
        summary: 'From a sentence to a finished run in a few minutes.',
        body: (
          <>
            <Steps>
              <li>
                <h4>Open the workspace</h4>
                <p>
                  Choose <a href={site.tryNow} {...newTab(site.tryNow)}>Try now</a> and sign in. The workspace opens on an empty canvas.
                </p>
              </li>
              <li>
                <h4>Describe what you need</h4>
                <p>
                  Open the AI assistant and write what the workflow should do, for example:{' '}
                  <em>“Draft a follow-up email for every new lead, and have a manager approve it before it goes out.”</em>
                </p>
              </li>
              <li>
                <h4>Approve the plan</h4>
                <p>
                  For a new workflow the assistant proposes a short plan first. Choose <strong>Build it</strong>, or say what
                  to change and it plans again.
                </p>
              </li>
              <li>
                <h4>Review the draft on the canvas</h4>
                <p>
                  The draft opens on the canvas with its changes marked. Choose <strong>Accept</strong> to make it your
                  workflow, or <strong>Discard</strong> to leave everything as it was.
                </p>
              </li>
              <li>
                <h4>Pick a model and run it</h4>
                <p>
                  In the run chat, choose the model the workflow runs on, type an input and run it. Approvals pause the run
                  and ask in the chat; each step reports as it finishes.
                </p>
              </li>
            </Steps>
            <Note tone="tip">Ask the assistant to explain or review the workflow at any time. It answers from the workflow itself, so its answers stay specific.</Note>
          </>
        ),
      },
    ],
  },
  {
    title: 'Concepts',
    sections: [
      {
        id: 'workflows',
        title: 'Workflows',
        summary: 'Steps, connections, branches and limits.',
        body: (
          <>
            <p>A workflow is a graph: steps joined by connections, from a single <strong>Start</strong> to an <strong>End</strong>. The steps you will use most:</p>
            <ul>
              <li><strong>Agent</strong>: a model with instructions, and optionally tools and memory, that does one job.</li>
              <li><strong>Tool</strong>: calls a function or service directly, without a model.</li>
              <li><strong>Condition</strong>: sends the run one way or another, based on what earlier steps produced.</li>
              <li><strong>Approval</strong>: pauses the run until a person approves or rejects.</li>
              <li><strong>Ask user</strong>: pauses to ask a question and continues with the answer.</li>
              <li><strong>Wait for event</strong>: holds until an outside system sends an event, or times out.</li>
              <li><strong>Loop</strong>: runs a set of steps for each item in a list, one after another or in parallel.</li>
              <li><strong>Subworkflow</strong>: runs another saved workflow as one step.</li>
              <li><strong>Transform</strong> and <strong>Delay</strong>: reshape data without a model, or wait a set time.</li>
            </ul>
            <p>
              Connections can fan out into parallel branches and join again, and a connection may loop back, always with a
              limit on how many times. Each workflow also has limits on time, steps, tokens and cost, so a run never gets away
              from you.
            </p>
            <p>The canvas and the assistant edit the same workflow document, so whatever you see on the canvas is exactly what runs.</p>
          </>
        ),
      },
      {
        id: 'agents',
        title: 'Agents',
        summary: 'Instructions, models, tools and memory.',
        body: (
          <>
            <p>Select an agent on the canvas to open its settings:</p>
            <ul>
              <li><strong>Instructions</strong>: what the agent does, in plain language. Short and specific works best.</li>
              <li><strong>Model</strong>: by default the workflow's model; see <a href="#models">Models and model clients</a>.</li>
              <li><strong>Tools</strong>: the tools the agent may call while it works.</li>
              <li><strong>Memory</strong>: whether it sees the conversation so far, and any context providers you attach.</li>
              <li><strong>Output</strong>: an optional response schema, when later steps need structured fields to read.</li>
            </ul>
            <Note>Prefer several focused agents connected one after another over one agent doing everything. Each step is then easier to read, test and trace.</Note>
          </>
        ),
      },
      {
        id: 'models',
        title: 'Models and model clients',
        summary: 'Which model each agent runs on.',
        body: (
          <>
            <p>
              A <strong>model client</strong> is a saved connection to a model provider. Admins add model clients for everyone in
              the Admin Center, and you can add your own. Only real model clients are ever offered; there are no made-up model names.
            </p>
            <p>Built-in providers: OpenAI, Azure OpenAI, Anthropic, Google Gemini, Mistral, Groq and Ollama. Anything with an OpenAI-compatible API can be added as well.</p>
            <h3>The workflow's model</h3>
            <p>
              Each workflow has a model, chosen with the model picker in the run chat. Every agent without a model of its own
              uses it, and changing it updates those agents on the canvas straight away.
            </p>
            <h3>An agent's own model</h3>
            <p>
              To pin a different model on one agent, open its <strong>Model</strong> tab and pick a model client. That agent
              keeps it whatever the run chat says. Choose <strong>Workflow model (default)</strong> to make it follow the workflow again.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'The AI assistant',
    sections: [
      {
        id: 'assistant',
        title: 'Working with the assistant',
        summary: 'What it can do, and how it shows its work.',
        body: (
          <>
            <p>The assistant can:</p>
            <ul>
              <li><strong>Build</strong> a new workflow from a description, after you approve its plan.</li>
              <li><strong>Change</strong> the open workflow: add, remove or rewire steps, and edit instructions or settings.</li>
              <li><strong>Explain</strong> the workflow, or what a run did and why.</li>
              <li><strong>Review</strong> the workflow for problems: vague instructions, missing approvals, missing error paths.</li>
              <li><strong>Test-run</strong> the draft, after you confirm.</li>
            </ul>
            <p>
              While it works, each step appears with a one-line reason, for example <em>Read the workflow: checking what Lead
              Intake already returns</em>. When it finishes, the turn shows how long it took and the tokens it used. Greetings
              and small talk are answered instantly, without a model call.
            </p>
            <p>The assistant builds plain, node-to-node workflows. It picks models and tools only from your catalog, and by default leaves an agent's model to follow the workflow.</p>
          </>
        ),
      },
      {
        id: 'drafts',
        title: 'Reviewing drafts',
        summary: 'Every change marked on the canvas before it lands.',
        body: (
          <>
            <p>
              The assistant never edits your workflow directly. It works on a draft, and when it is done the draft opens on the
              canvas, read only, with every block and connection marked:
            </p>
            <Legend />
            <p>
              The chat shows a card with a small map of the draft and a count of the changes. Choose <strong>Accept</strong> to make
              the draft your workflow, <strong>Discard</strong> to drop it, or <strong>Back to workflow</strong> to look at your
              current version before deciding.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Running workflows',
    sections: [
      {
        id: 'approvals',
        title: 'Human approvals',
        summary: 'Pause for a person before anything risky.',
        body: (
          <>
            <p>
              An <strong>Approval</strong> step pauses the run and asks for a decision. It has two routes out: where the run
              goes when it is <strong>approved</strong>, and where it goes when it is <strong>rejected</strong>.
            </p>
            <p>
              Turn on <strong>feedback revisions</strong> and a rejection sends the work back to the step before the approval for
              another try, up to the number of times you set. Without it, a rejection ends the run.
            </p>
            <Note tone="tip">Put an approval in front of anything that sends, pays or deletes. The assistant suggests this when it reviews a workflow.</Note>
          </>
        ),
      },
      {
        id: 'runs',
        title: 'Runs and traces',
        summary: 'Run, watch and inspect.',
        body: (
          <>
            <p>
              Run a workflow from the run chat. Pick the model first if you want something other than the workflow's current one,
              then type an input. The run reports each step as it finishes and stops to ask whenever an approval or question needs you.
            </p>
            <p>A run is <strong>running</strong>, <strong>waiting</strong> (for a person), <strong>succeeded</strong>, <strong>failed</strong> or <strong>cancelled</strong>. Its trace keeps:</p>
            <ul>
              <li>the path it took through the workflow, and each step's input and output;</li>
              <li>how long each step ran;</li>
              <li>the tokens each agent used, and the total;</li>
              <li>every approval, with who decided and when.</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: 'Administration',
    sections: [
      {
        id: 'admin-center',
        title: 'Admin Center',
        summary: 'Models, tools and the assistant, for everyone.',
        body: (
          <>
            <p>Admins manage, in one place:</p>
            <ul>
              <li><strong>Model clients</strong> offered to every workflow and to the assistant.</li>
              <li><strong>Tools</strong> in the catalog that agents may use.</li>
              <li>
                <strong>The assistant itself.</strong> It is a workflow too: admins can open it, edit its steps and instructions,
                try it, and publish it. The chat always runs the published version.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'security',
        title: 'Security',
        summary: 'How keys and actions are protected.',
        body: (
          <>
            <ul>
              <li><strong>Secrets by reference.</strong> Keys live in model clients and variables. Workflows refer to them by id, so a key never appears in a workflow, a log or a response.</li>
              <li><strong>A guarded assistant.</strong> What tools return is treated as data, never as instructions, and the assistant says so if content tries to steer it.</li>
              <li><strong>Confirmation first.</strong> The assistant asks before a test run, because runs use real models and tools.</li>
              <li><strong>An audit trail.</strong> Every run keeps its events, approvals and token usage.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        summary: 'Common problems and their fixes.',
        body: (
          <>
            <h3>“Needs edges for approved and rejected”</h3>
            <p>
              An approval must say where each decision goes. Connect the next step after it, or ask the assistant to wire both routes.
              A final approval is completed automatically: approved goes to the end, and rejected loops back when feedback revisions are on.
            </p>
            <h3>A run is slow</h3>
            <p>
              Open its trace and look for the longest step. Use a faster model for simple steps by pinning it on that agent, keep
              instructions short, and keep steps connected one after another rather than in a single large agent.
            </p>
            <h3>A model is missing from the list</h3>
            <p>Lists only show model clients that exist. Ask your admin to add it in the Admin Center, or add your own.</p>
          </>
        ),
      },
    ],
  },
]
