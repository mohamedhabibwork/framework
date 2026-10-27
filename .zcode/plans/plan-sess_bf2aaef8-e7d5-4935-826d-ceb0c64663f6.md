# Workflow Engine: Workflow → Pipeline → Stage → Action

## 1. Execution model (revised per your feedback)

Four composed primitives, all defined with identity helpers in `packages/workflow`:

```ts
// Atomic unit — the smallest dispatchable piece of work.
const chargeCard = defineAction({
  name: 'charge-card',
  input: z.object({ amount: z.number() }), // optional typed input slice from state
  via: 'queue', // 'inline' (default) | 'queue' → runs as its own BullMQ job
  attempts: 3,
  backoffMs: 500,
  timeoutMs: 30_000,
  precheck: (state, ctx) => {
    // gate before run; throw → action fails PRECHECK_FAILED
    if (!state.order.reserved) throw new Error('stock not reserved');
  },
  run: (input, ctx) => ({ chargeId }), // returns output merged into state
  compensate: (state, ctx) => refund(state), // saga rollback (reverse order on failure)
});

// Checkpoint boundary — persists after completion; gate + actions (or default run).
const payments = defineStage({
  name: 'payments',
  precheck: (state) => state.order.status === 'reserved', // stage-level gate
  actions: parallel([chargeCard, createShipment]), // sequential by default; parallel() joins
  // —or— convenience default: run: (state, ctx) => ...   (single implicit action)
});

// Ordered stages — a durable pipeline; standalone-runnable.
const orderPipeline = definePipeline({ name: 'order-processing', stages: [reserve, payments, notify] });

// Versioned durable workflow over one or more pipelines.
const orderWorkflow = defineWorkflow({
  name: 'order-fulfillment',
  version: 1,
  input: z.object({ orderId: z.string() }), // zod-validated, like defineJob
  pipelines: [orderPipeline], // shorthand: stages: [...] = single implicit pipeline
  onFailure: 'compensate' | 'halt',
});
```

**Execution placement**: every level (workflow/pipeline/stage/action) can run `inline` (inside the worker's current scope) or `via: 'queue'` (dispatched as its own BullMQ job through `QueueManager`). Queued actions/parallel branches are joined via persisted node counters — the parent stage resumes only when all children are terminal. Workers horizontal-scale for free since queued actions are ordinary BullMQ jobs.

**Precheck**: supported at both stage and action level. Runs before any work; failure marks the node `PRECHECK_FAILED` (skipped-with-reason for skippable gates, failed otherwise).

**Other engine features**: versioned definitions with payload-compat enforcement (version mismatch → unrecoverable, like jobs); idempotent dispatch keys; retry/cancel/resume **from any node**; reverse-order compensation with `compensated` terminal state; wait-for-event stages (`waitFor: { event: 'payment.succeeded', timeoutMs }` — run parks as `waiting`, an events-bus bridge in the worker resumes it); per-run progress; retention cleanup (`workflow:prune`); graceful shutdown drains in-flight nodes.

## 2. Persistence → Postgres (audit_logs pattern)

- `workflow_runs`: id, workflow, version, input jsonb, state jsonb, status (pending/running/waiting/completed/failed/cancelled/compensating/compensated), current node, error, actor jsonb, correlation_id, timestamps; indexed for listing.
- `workflow_nodes`: uniform execution tree — id, run_id FK, parent_id, kind ('pipeline'|'stage'|'action'), key, index, status, attempts, output jsonb, error, started/finished. Index (run_id, parent_id, index). One table covers all three nested levels; queries, resume, and compensation walk the tree.
- `WorkflowStore` (Drizzle): transitions as conditional `UPDATE ... WHERE status = expected` — idempotent claims, no double-run.

## 3. Runtime (`packages/workflow`; deps: core, queue, database, events)

- `WorkflowManager` (`WORKFLOW_MANAGER` token): `dispatch(workflow|pipeline, input, opts)` → zod-validates, inserts run + node tree in one transaction, dispatches first queued unit (idempotency `wf:{runId}:{nodePath}`); `status`, `list` (bounded pagination like AuditReader), `cancel`, `retry({ fromNode? })`, `resume`, `prune(retentionDays)`; duplicate name/version → `DUPLICATE_WORKFLOW`.
- `WorkflowWorker`: tree-walking runner composed over `JobWorker`; claims nodes in DB, executes inline units in a fresh `'workflow'` scope carrying the dispatcher's actor/correlationId (ExecutionContext reuse), checkpoints output per node; queued units dispatch internal `__workflow.action` jobs; wait-for-event bridge subscribes via `EVENT_BUS`.
- **Events**: `workflow.started|stage.completed|action.failed|completed|failed|compensating|waiting` on channel `workflow.runs.{runId}` → feeds WebSocket `/ws` via existing gateway (authorize hook gates `workflow.runs.*`).
- **HTTP**: `workflowRoutes()` Hono sub-app — paginated run list, run detail incl. node tree, retry/cancel, dispatch (OpenAPI-annotated; documented as unprotected until Phase 3 auth).
- **Tests** (real PG + Redis per docs/testing.md): happy path, action/queued-action failure→retry, precheck gates, compensation order incl. queued actions, parallel join, wait-for-event timeout, cancel/resume from node, version mismatch.

## 4. In-process pipeline primitive → `packages/core` (kept)

`pipeline(input).through(pipes).then(destination)` — tiny typed in-process composition helper for services/HTTP; distinct from the durable `definePipeline`.

## 5. Queue batching → `packages/queue`

Needed as the join primitive for parallel/queued fan-out: optional `batchId` on `JobEnvelope`, `dispatchBatch` + Redis batch counters, `batchStatus/batchFailures/cancelBatch`, terminal-batch completion callback + event.

## 6. Data pipelines

Expressed with the same `definePipeline` concept: source→chunk-transform→sink stages composing repository `batches()` keyset iteration; each committed chunk is a node checkpoint (resume from last chunk), partial-success reporting like import/export.

## 7. Cron scheduler → new `packages/scheduler` (deps: core, queue)

`defineSchedule({ name, cron, timezone?, overlap: 'skip'|'replace', dispatch: job|workflow|pipeline })`; BullMQ `upsertJobScheduler` + Redis overlap lock; idempotency `schedule:{name}:{scheduledAt}`. Playground: `app/schedules/` + `bin/scheduler.ts`.

## 8. CLI, wiring, docs

- CLI: new `'workflow'` group — `workflow:list|status|retry|cancel|prune` (+ `dispatch` for testing); `schedule:list|run|work|test` move from `planned.ts` to implemented `commands/scheduler.ts`.
- Playground: `app/workflows/` + `app/schedules/` examples; `workflowProvider` in `bootstrap/providers.ts`; `bin/worker.ts` runs WorkflowWorker; `workflowRoutes` at `/api/v1/admin/workflows`; config: `workflow.retentionDays`, `scheduler.timezone`.
- Docs: framwork.md spec section for the Workflow→Pipeline→Stage→Action model; folder.md (`workflow`, `scheduler` packages, `app/workflows|schedules/`, `bin/scheduler.ts`); status.md, platform.md, cli-reference.md, deployment.md.

## Build order

1. core pipeline primitive → 2. queue batching → 3. workflow package (schema/store → definitions → manager → runner/worker → events/routes) → 4. scheduler → 5. CLI/playground wiring → 6. docs.

Verify each step with `bun test` (real PG+Redis via compose), `bun run lint`, typecheck. Success: playground demo workflow dispatches via HTTP, executes stages/actions (inline + queued + parallel), survives a simulated crash and resumes from the last node, compensates in reverse on failure, wait-for-event works, live updates visible on `/ws`; CLI + HTTP surfaces exit 0; docs updated.
