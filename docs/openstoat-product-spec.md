# OpenStoat Product Specification (v3)

> Agent-first AI and Human collaborative task system

---

## 1. Positioning

**One-line description**: OpenStoat is a local-first, CLI-first task orchestration system where AI Agents are the default execution engine and humans join only when needed.

**Product characteristics**:
- Open-source project
- Team model target: 1+ Humans and N Agents
- Architecture: Local-first + CLI-first
- No built-in LLM calls inside OpenStoat
- CLI is the operational manual for Agents and Humans

**Core value**:
- Agent-first throughput: maximize parallel AI execution
- Explicit ownership and status on every task
- Minimal management overhead for human participants

---

## 2. Design Principles

1. **Agent-first**: Agent roles are first-class in planning and execution.
2. **Task-only workflow**: there is no `plan -> task` hierarchy. The primary unit is a first-level task.
3. **Project is mandatory context**: every task belongs to one project.
4. **Project and template are bound**: one project owns one template context; they are treated as one operational concept.
5. **OpenStoat stores and orchestrates**: external agents provide intelligence and execution logic.
6. **CLI is the agent super-manual**: CLI help and examples must be written in an agent-skill style that tells agents exactly how to operate OpenStoat step by step.

---

## 3. Roles and Permissions

OpenStoat defines four roles:

- **Agent Planner**
- **Agent Worker**
- **Human Planner**
- **Human Worker**

### 3.1 Planner capabilities

Default insertion authority belongs to planners: `Agent Planner` and `Human Planner` can insert tasks into the OpenStoat Kanban.

Exception:
- `Agent Worker` may insert a task only in self-unblock flow, and only to create a `human_worker` task required to unblock the current task.

When creating a task, the following fields are all required:

- `project`
- `title`
- `description`
- `acceptance_criteria`
- `depends_on`
- `status`
- `owner`
- `task_type`

### 3.2 Worker capabilities

`Agent Worker` and `Human Worker` claim tasks from Kanban and execute them.

Workers can:
- claim available tasks
- update task status during execution
- submit completion output and handoff context
- when blocked by human input: create a human task, set dependency so the blocked task depends on it, and set own task status to `ready`

Workers cannot:
- bypass required task fields
- execute tasks whose dependencies are unresolved

---

## 4. Core Concepts

| Concept | Definition |
|---|---|
| **Project (Template-bound)** | The top-level execution scope. A project includes and binds its template context. |
| **Task** | The first-level, minimal execution unit in Kanban. No parent plan entity exists. |
| **Kanban** | The operational board where planners insert tasks and workers claim/execute tasks. |
| **Handoff** | Structured context transfer between completed and downstream tasks. |

> OpenStoat does not run LLM inference. It manages storage, state transitions, and coordination APIs/CLI.

---

## 5. System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    External Agents / Humans                │
│                                                            │
│  Agent Worker / Human Worker:                              │
│  - claim and execute tasks                                  │
│  - submit output and handoff                                 │
│  - when blocked: create human task, set dependency, ready    │
│                                                            │
│  Agent Planner (on-demand):                                 │
│  - invoked externally when planning is needed                │
│  - creates tasks via CLI                                    │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                          OpenStoat                         │
│                                                            │
│  SQLite storage:                                           │
│  - Project (template-bound)                                │
│  - Task (with logs)                                         │
│  - Handoff                                                 │
│                                                            │
│  Daemons:                                                  │
│  - worker-daemon                                           │
│                                                            │
│  CLI + state machine + dependency checks                   │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Data Model

### 6.1 Project (template-bound)

```json
{
  "id": "project_checkout_rebuild",
  "name": "Checkout Rebuild",
  "template_context": {
    "version": "1.0",
    "rules": [
      {
        "task_type": "credentials",
        "default_owner": "human_worker"
      },
      {
        "task_type": "implementation",
        "default_owner": "agent_worker"
      }
    ]
  },
  "status": "active | archived",
  "created_at": "2026-02-26T10:00:00Z",
  "updated_at": "2026-02-26T10:00:00Z"
}
```

### 6.2 Task (first-level only)

`logs` is a required field for agents: agents must append to `logs` on every execution step command (`claim`, `start`, `self-unblock`, `done`). Logs record the full execution process and serve as context for other agents reading dependent tasks.

```json
{
  "id": "task_001",
  "project": "project_checkout_rebuild",
  "title": "Add provider mapping for Paddle",
  "description": "Implement provider mapping in payment module and update integration tests.",
  "acceptance_criteria": [
    "Mapping supports Paddle in all checkout paths",
    "Unit tests and integration tests pass"
  ],
  "depends_on": [],
  "status": "ready | in_progress | done",
  "owner": "agent_worker | human_worker",
  "task_type": "implementation | testing | review | credentials | deploy | docs | custom",
  "output": null,
  "logs": [],
  "created_by": "agent_planner",
  "claimed_by": null,
  "created_at": "2026-02-26T10:10:00Z",
  "updated_at": "2026-02-26T10:10:00Z"
}
```

### 6.3 Handoff

Handoff is required for all task completions. Handoff is a text summary only. When a task has no downstream tasks, `to_task_id` is `null` (audit-only handoff).

```json
{
  "id": "handoff_001",
  "from_task_id": "task_001",
  "to_task_id": "task_002",
  "summary": "Provider mapping is complete. Reuse src/payments/provider-map.ts. Main changes are in payment module and integration tests.",
  "created_at": "2026-02-26T11:00:00Z"
}
```

---

## 7. Kanban Operating Rules

### 7.1 Task insertion

`Agent Planner`, `Human Planner`, and `Agent Worker` (when self-unblocking) can insert tasks.

Validation rules:
- reject insert if any required field is missing
- reject insert if `project` does not exist
- reject insert if `depends_on` references unknown task IDs
- reject insert if `owner`, `task_type`, or `status` is outside allowed enums

### 7.2 Task claiming and execution

Only `Agent Worker` and `Human Worker` can claim tasks.

Claim rules:
- task must be in state `ready` (ready = in queue; claimable only when dependencies are satisfied)
- task dependencies must be satisfied
- owner compatibility must match claimer role (`agent_worker` or `human_worker`)
- agent must append to `logs` when claiming and on every subsequent step command

### 7.3 Completion and triggering

When a worker marks a task `done`:
- handoff is required for all tasks, including `human_worker` tasks (when no downstream tasks exist, `to_task_id` is `null`)
- output and handoff must be attached together
- agent must append to `logs` on completion
- downstream tasks are re-evaluated
- tasks with all dependencies satisfied can move to `ready`

Handoff quality requirement:
- `handoff.summary` must be at least 200 characters
- handoff should include complete execution context and decisions whenever available

### 7.4 Worker self-unblock (when blocked by human)

When an `agent_worker` task gets stuck due to missing human input, the worker may self-unblock:

1. create a `human_worker` task (via `openstoat task create` with `owner=human_worker`)
2. set dependency so the blocked task `depends_on` the new human task
3. run dedicated rollback command to move blocked task from `in_progress` to `ready`
4. append to `logs` (e.g. "Blocked: need X. Created task H for human.")

The agent keeps task status as `ready` (no new status). The task becomes claimable again after the human task is done.

Guard rule for self-unblock rollback:
- `in_progress -> ready` is allowed only for self-unblock
- rollback must be executed through dedicated CLI command `openstoat task self-unblock`
- no generic status-transition command (such as `task update --status ...`) exists in this model
- the self-unblock command must include at least one newly added `depends_on` task ID
- rollback without a new dependency must be rejected

### 7.5 Duplicate-planning prevention (current-scope policy)

For this release, duplicate prevention is enforced as a planner workflow rule, not a database key constraint.

Required behavior for `agent_planner` before creating a task:
1. list unfinished tasks in the same project (`ready`, `in_progress`)
2. compare candidate task intent with existing unfinished tasks
3. if an equivalent unfinished task exists, do not create a new task
4. reuse the existing task ID in planner output

Policy notes:
- this policy is mandatory for planner behavior in the local version
- no online LLM duplicate-judgment service is included in current scope
- no database-level deduplication key is required in current scope

---

## 8. State Machine

```
[ready] -> [in_progress] -> [done]
               | 
               +-> [ready]  (self-unblock only, requires newly added depends_on)
```

State intent:
- `ready`: task is in the queue; claimable by workers only when dependencies are satisfied
- `in_progress`: currently being executed
- `done`: accepted as complete

Status policy:
- `waiting_human` is not a valid status in this model
- `todo`, `ai_ready`, `blocked`, and `review` are not valid status values
- human involvement is represented by creating a dedicated human-owned task with explicit dependency links
- `in_progress -> ready` is a valid rollback only in self-unblock flow and only when a new dependency is added in the same update

---

## 9. Example Workflow

```
1) Agent Planner creates Task A (owner=agent_worker, status=ready)
2) Agent Worker claims Task A and completes it
3) Human Planner creates Task B (depends_on=A, owner=human_worker)
4) Human Worker claims Task B when A is done
5) Task B done -> Task C becomes ready automatically
```

No plan object is created in any step. All orchestration happens at task level inside one project scope.

Worker self-unblock variant:
```
1) Agent Worker runs Task X and gets stuck on missing human input
2) Agent Worker creates Human Task H (owner=human_worker)
3) Agent Worker runs self-unblock command for Task X with newly added depends_on H
4) Human Worker completes H with mandatory handoff
5) Task X becomes claimable again; Agent Worker resumes
```

---

## 10. CLI Direction (Draft)

CLI format conventions (agent-friendly):
- `--acceptance-criteria`: pass multiple times for array; each occurrence maps to one element
- `--depends-on`: pass multiple times for array; omit when task has no dependencies
- `--logs-append`: agent must append to task logs on every step command; logs serve as context for other agents
- `--id` on project init: required; use this exact value as `--project` when creating tasks
- `--template` on project init: required; project-template binding is explicit in CLI (there is no `--template-file`)
- explicit step commands are required for status transitions; there is no generic `openstoat task update --status ...` command
- `openstoat task self-unblock`: dedicated rollback command for `in_progress -> ready`; must include at least one new `--depends-on`

```bash
# initialize a project with bound template context
# agent must specify --id and --template explicitly; use this id when creating tasks
openstoat project init --id project_checkout_rebuild --name "Checkout Rebuild" --template checkout-default-v1

# planner inserts a task (all required fields provided)
# planner must read unfinished tasks first to avoid duplicates
openstoat task ls --project project_checkout_rebuild --status ready,in_progress

# create only when no equivalent unfinished task exists
# use repeated --acceptance-criteria for multiple criteria; repeated --depends-on for dependencies
# omit --depends-on when task has no dependencies
openstoat task create \
  --project project_checkout_rebuild \
  --title "Add provider mapping for Paddle" \
  --description "Implement mapping in payment module" \
  --acceptance-criteria "Mapping works in checkout paths" \
  --acceptance-criteria "Unit tests pass" \
  --status ready \
  --owner agent_worker \
  --task-type implementation

# task with dependencies: add --depends-on for each dependency
# openstoat task create ... --depends-on task_001 --depends-on task_002 ...

# worker claims and starts a task (agent must append to logs on each step command)
openstoat task claim task_001 --as agent_worker --logs-append "Claimed, starting work"
openstoat task start task_001 --as agent_worker --logs-append "Started implementation work"

# if AI gets stuck: create human task, set dependency, set own task to ready
openstoat task create --project project_checkout_rebuild --title "Provide Paddle API key" \
  --description "Unblock payment integration" --acceptance-criteria "Key delivered securely" \
  --status ready --owner human_worker --task-type credentials

# rollback must use dedicated self-unblock command
openstoat task self-unblock task_001 \
  --depends-on task_002 \
  --logs-append "Blocked: need API key. Created task_002 for human."

# worker completes task
# handoff is mandatory; agent must append to logs
openstoat task done task_001 \
  --output "Implemented and tested" \
  --handoff-summary "Implemented provider mapping for Paddle in checkout and recurring billing paths, added integration coverage, and validated compatibility with existing provider selection logic. Main changes are in src/payments/provider-map.ts and tests/integration/provider-map.spec.ts. No migration needed." \
  --logs-append "Completed implementation and tests"
```

---

## 11. Milestones

### Phase 1: MVP

- [ ] Project model (template-bound)
- [ ] Task model with required fields (including logs)
- [ ] Kanban insertion and claim flows by role
- [ ] Dependency validation and status machine
- [ ] Basic handoff support
- [ ] Worker self-unblock (create human task, set dependency, ready)
- [ ] Worker-daemon baseline loop
- [ ] On-demand planning (external LLM trigger)

### Phase 2: Scale

- [ ] Parallel worker coordination
- [ ] Better task filtering and prioritization
- [ ] Audit trail for role actions
- [ ] Web UI on top of CLI and storage

### Phase 3: Advanced

- [ ] Policy-driven automation for planners/workers
- [ ] Notification and webhook integration
- [ ] Advanced project template evolution

---

*Updated: 2026-02-26*