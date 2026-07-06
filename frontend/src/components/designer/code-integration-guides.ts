import type { CodeLanguage } from './diagram-codegen'

export interface IntegrationGuideContent {
  /** One-line overview of what the generated sample represents. */
  summary: string
  /** Shell command to run the sample standalone (when applicable). */
  runCommand?: string
  /** Step-by-step instructions for wiring into an existing project. */
  steps: string[]
  /** Tips for replacing stubs with real logic. */
  tips: string[]
}

export const CODE_INTEGRATION_GUIDES: Record<CodeLanguage, IntegrationGuideContent> = {
  javascript: {
    summary:
      'Each diagram shape becomes an async step function. Decisions map to if/else branches using connector labels.',
    runCommand: 'node workflow.js',
    steps: [
      'Save the sample as workflow.js (or merge into your project).',
      'Run it standalone with Node.js to verify the flow order.',
      'Import runWorkflow() from your API route, queue worker, or CLI entry point.',
      'Call await runWorkflow() where the process should start.',
    ],
    tips: [
      'Replace console.log stubs inside each step with your API calls or DB writes.',
      'Use connector labels on decision shapes as real condition checks.',
      'Export individual step functions if other modules need to invoke them.',
    ],
  },
  typescript: {
    summary:
      'Typed async workflow scaffold. Steps return Promise<void> and can share a WorkflowContext object.',
    runCommand: 'npx tsx workflow.ts',
    steps: [
      'Save as workflow.ts and add tsx or compile with tsc.',
      'Extend WorkflowContext with fields your steps read and write.',
      'Import runWorkflow() into Express, NestJS, or a serverless handler.',
      'Await the workflow and return its result to the caller.',
    ],
    tips: [
      'Pass a context object through each step instead of using globals.',
      'Narrow decision branches with typed enums matching connector labels.',
      'Wire palette IDs to shared constants so diagram and code stay in sync.',
    ],
  },
  python: {
    summary:
      'Plain functions in run order. Decision nodes become if/else blocks guided by edge labels.',
    runCommand: 'python workflow.py',
    steps: [
      'Save as workflow.py in your app or scripts folder.',
      'Run directly to confirm step order and branching.',
      'Import run_workflow from a Flask/FastAPI route, Celery task, or CLI.',
      'Call run_workflow() when the business process should execute.',
    ],
    tips: [
      'Swap print() calls for service layer functions or ORM operations.',
      'Return values from steps if later nodes depend on earlier results.',
      'Use a dataclass or dict as shared state passed between steps.',
    ],
  },
  java: {
    summary:
      'A single class with one method per process step and a runWorkflow() orchestrator.',
    runCommand: 'javac Workflow.java && java Workflow',
    steps: [
      'Save as Workflow.java (rename the class to match your module).',
      'Compile and run from the terminal to validate the flow.',
      'Move the class into your package and inject dependencies via constructor.',
      'Invoke runWorkflow() from a Spring @Service, servlet, or scheduled job.',
    ],
    tips: [
      'Replace System.out.println with repository or HTTP client calls.',
      'Extract interfaces for steps you want to mock in unit tests.',
      'Map decision diamonds to strategy objects or switch on edge labels.',
    ],
  },
  csharp: {
    summary:
      'A public class with PascalCase step methods orchestrated by RunWorkflow().',
    runCommand: 'dotnet run',
    steps: [
      'Add the class to your .NET project (e.g. Services/Workflow.cs).',
      'Register it in DI: services.AddTransient<Workflow>().',
      'Inject Workflow into controllers, minimal APIs, or background workers.',
      'Call await RunWorkflow() or wrap it in a hosted service.',
    ],
    tips: [
      'Replace Console.WriteLine with ILogger and your domain services.',
      'Use IAsyncEnumerable or MediatR commands for larger workflows.',
      'Keep palette IDs as constants shared with documentation or config.',
    ],
  },
  go: {
    summary:
      'Exported functions per step with runWorkflow() as the entry point in package main.',
    runCommand: 'go run workflow.go',
    steps: [
      'Save as workflow.go or split steps into a internal/workflow package.',
      'Run with go run to verify ordering before integrating.',
      'Move runWorkflow into an internal package and call from HTTP handlers.',
      'Trigger it from chi/gin/echo routes or a Kafka consumer.',
    ],
    tips: [
      'Pass context.Context into each step for cancellation and tracing.',
      'Replace fmt.Println with structured logging (slog, zap).',
      'Return errors from steps and short-circuit the workflow on failure.',
    ],
  },
  pseudocode: {
    summary:
      'Language-neutral process outline. Use it as a spec when implementing in any stack.',
    steps: [
      'Share this outline with your team as the source of truth for the flow.',
      'Translate each STEP into a function, activity, or microservice call.',
      'Map IF branches to business rules using the connector labels from the diagram.',
      'Implement in your target language, then link back to palette IDs for traceability.',
    ],
    tips: [
      'Not executable — treat START/END and STEP blocks as checklist items.',
      'Decision arrows (-> Yes / -> No) should become explicit conditions in code.',
      'Full code generation from Clovai API will replace this preview later.',
    ],
  },
}
