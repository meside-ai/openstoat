/**
 * OpenStoat Agent Manual - SKILL-style documentation for AI agents
 * Use when: orchestrating tasks, planning work, executing tasks, or handing off to humans.
 */

export const AGENT_MANUAL = `
# OpenStoat CLI - Agent Operational Manual

## When to Use

Use OpenStoat when:
- Planning and breaking down work into executable tasks
- Creating tasks for agents or humans to execute
- Claiming and executing tasks as an agent worker
- Handing off work to humans (credentials, review, deploy)
- Self-unblocking when blocked by human input
- Querying task status, dependencies, or project context

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Project** | Template-bound workspace. Every task belongs to one project. Get project ID via \`project ls\`. |
| **Task** | Atomic work unit. Status: ready → in_progress → done. Owner: agent_worker | human_worker. |
| **Handoff** | Required on every completion. Min 200 chars. Transfers context to downstream tasks. |
| **Self-unblock** | When agent is blocked by human: create human task, then run self-unblock with --depends-on. |

## Role-Based Workflows

### Agent Planner

1. **Before creating tasks** (mandatory): List existing tasks to avoid duplicates.
   \`openstoat task ls --project <project_id> --status ready,in_progress\`

2. **Create tasks**: Use \`task create\` with all required fields. Set owner=agent_worker for agent tasks, owner=human_worker for human tasks (credentials, review, deploy).

3. **Dependencies**: Use --depends-on when task B waits for task A. Omit when no dependencies.

### Agent Worker

1. **Claim**: \`openstoat task claim <task_id> --as agent_worker --logs-append "..."\`
2. **Start**: \`openstoat task start <task_id> --as agent_worker --logs-append "..."\`
3. **Done**: \`openstoat task done <task_id> --output "..." --handoff-summary "..." --logs-append "..."\`
   - handoff-summary: min 200 chars. Describe what was done and context for downstream.

### Agent Worker (Blocked by Human)

1. Create human task: \`openstoat task create --project X --owner human_worker --task-type credentials ...\`
2. Self-unblock: \`openstoat task self-unblock <my_task_id> --depends-on <human_task_id> --logs-append "Blocked: ..."\`
3. Task moves in_progress → ready. Resume after human completes the dependency.

### Human Worker

Same flow as Agent Worker but use --as human_worker when claiming/starting/done.

---

## Command Reference

### project init
Initialize a project with bound template. Required before creating tasks.
  --id (required): Project ID. Use this as --project in task commands.
  --name (required): Display name.
  --template (required): Template name (e.g. checkout-default-v1).

### project ls
List all projects. Output: id, name, status.

### project show <project_id>
Show project details (JSON).

### task ls
List tasks. **Planner must run before create to avoid duplicates.**
  --project (required): Project ID.
  --status: Filter. Comma-separated: ready,in_progress,done.
  --owner: Filter: agent_worker | human_worker.
  --json: Output as JSON.

### task create
Create a task. All fields required except --depends-on, --created-by.
  --project (required)
  --title (required)
  --description (required)
  --acceptance-criteria (required, pass multiple): e.g. --acceptance-criteria "A" --acceptance-criteria "B"
  --depends-on (optional, pass multiple): Task IDs this task depends on.
  --status (required): ready | in_progress | done. New tasks typically ready.
  --owner (required): agent_worker | human_worker
  --task-type (required): implementation | testing | review | credentials | deploy | docs | custom
  --created-by (optional): e.g. agent_planner

### task claim <task_id>
Worker claims a ready task. Moves ready → in_progress.
  --as (required): agent_worker | human_worker
  --logs-append (recommended for agents): Append to task logs.

### task start <task_id>
Worker starts working. Use after claim or to append progress.
  --as (required): agent_worker | human_worker
  --logs-append (optional): Append to task logs.

### task done <task_id>
Worker completes task. Moves in_progress → done. Handoff mandatory.
  --output (required): What was delivered.
  --handoff-summary (required, min 200 chars): Context for downstream tasks.
  --logs-append (optional)
  --as (required): agent_worker | human_worker

### task self-unblock <task_id>
Rollback in_progress → ready when blocked by human. Must add new --depends-on.
  --depends-on (required, pass multiple): New human task ID(s). At least one.
  --logs-append (optional)
  --as: agent_worker only (default)

### task show <task_id>
Show task details. Use --json for machine-readable output.

### daemon start
Start worker daemon. Polls for ready agent_worker tasks and invokes external agents.
  --poll-interval (default 5000): Poll interval in ms.

### daemon stop | status | logs
Stop, check status, or view daemon logs.

---

## Rules (Do Not Violate)

1. **No generic status update**: There is no \`task update --status\`. Use claim, start, done, self-unblock only.
2. **Planner duplicate check**: Always run \`task ls\` before \`task create\` to avoid duplicates.
3. **Handoff required**: Every \`task done\` must include --handoff-summary (min 200 chars).
4. **Self-unblock guard**: in_progress → ready only via self-unblock, and only with new --depends-on.
5. **Logs for agents**: Agent workers should use --logs-append on claim, start, done for audit trail.
6. **Project required**: Every task has --project. Get project IDs from \`project ls\`.

---

## Examples

# Planner: list then create
openstoat task ls --project proj_1 --status ready,in_progress
openstoat task create --project proj_1 --title "Add Paddle mapping" --description "..." \\
  --acceptance-criteria "Mapping works" --acceptance-criteria "Tests pass" \\
  --status ready --owner agent_worker --task-type implementation

# Worker: full lifecycle
openstoat task claim task_001 --as agent_worker --logs-append "Claimed"
openstoat task start task_001 --as agent_worker --logs-append "Started"
openstoat task done task_001 --output "Implemented" \\
  --handoff-summary "Implemented Paddle mapping in src/payments/provider-map.ts. No migration. Integration tests pass. Downstream can use PaddleProvider class." \\
  --as agent_worker --logs-append "Done"

# Self-unblock (agent blocked, needs human)
openstoat task create --project proj_1 --title "Provide API key" --description "..." \\
  --acceptance-criteria "Key delivered" --status ready --owner human_worker --task-type credentials
openstoat task self-unblock task_X --depends-on task_H --logs-append "Blocked: need API key"
`;
