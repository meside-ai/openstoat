---
title: OpenStoat Use Cases (v3)
---

# OpenStoat Use Cases (v3)

> Scenario → Flow → Outcome

---

## Product Context

- **Storage**: `~/.openstoat/` (SQLite)
- **No account/API Key** required
- **Project is mandatory**: every task belongs to one project; project and template are bound
- **No built-in LLM**: OpenStoat orchestrates; external agents provide intelligence
- **CLI is the agent manual**: `openstoat --help` is the operational guide for both agents and humans

---

## Core Team Model

```
1+ Humans + N Agents
Roles: Agent Planner | Agent Worker | Human Planner | Human Worker
```

---

## Use Case 1: Agent Planner Creates Tasks, Agent Worker Executes

### Scenario

An external Agent Planner is invoked when planning is needed. It creates tasks via CLI. Agent Workers claim and execute them in parallel.

### Flow

```
1) Agent Planner lists unfinished tasks to avoid duplicates
   openstoat task ls --project project_checkout_rebuild --status ready,in_progress

2) Agent Planner creates Task A (owner=agent_worker, status=ready)
   openstoat task create --project project_checkout_rebuild \
     --title "Add provider mapping for Paddle" \
     --description "Implement mapping in payment module" \
     --acceptance-criteria "Mapping works in checkout paths" \
     --acceptance-criteria "Unit tests pass" \
     --status ready --owner agent_worker --task-type implementation

3) Agent Worker claims and executes Task A
   openstoat task claim task_001 --as agent_worker --logs-append "Claimed, starting work"
   openstoat task start task_001 --as agent_worker --logs-append "Started implementation"
   openstoat task done task_001 --output "Implemented and tested" \
     --handoff-summary "Implemented provider mapping for Paddle in checkout and recurring billing paths..." \
     --logs-append "Completed implementation and tests"

4) Downstream tasks (if any) become ready when dependencies are satisfied
```

### Outcome

- Tasks flow from planner to workers without a plan object
- Agent Worker appends to `logs` on every step; logs serve as context for dependent tasks
- Handoff (min 200 chars) transfers execution context to downstream tasks

---

## Use Case 2: Human Planner Inserts Human-Owned Tasks

### Scenario

A Human Planner creates a task that requires human execution (e.g. credentials, review, deploy). The task is inserted with `owner=human_worker` and appropriate dependencies.

### Flow

```
1) Agent Planner creates Task A (owner=agent_worker) and Task C (owner=agent_worker, depends_on=A)
2) Human Planner creates Task B (owner=human_worker, depends_on=A)
   - Task B: "Provide Paddle API key" (task_type=credentials)
   - Task B blocks Task C until human delivers the key

3) Agent Worker completes Task A
4) Task B becomes claimable (dependencies satisfied)
5) Human Worker claims Task B, provides API key, marks done with handoff
6) Task C becomes claimable; Agent Worker resumes
```

### Outcome

- Human involvement is explicit: dedicated tasks with `owner=human_worker`
- No `waiting_human` status; human tasks sit in Kanban until claimed
- Dependency chain enforces order: C waits for B, B waits for A

---

## Use Case 3: Worker Self-Unblock (Agent Blocked by Human Input)

### Scenario

An Agent Worker is executing Task X and gets stuck because it needs human input (e.g. API key, approval). The agent self-unblocks by creating a human task and rolling back.

### Flow

```
1) Agent Worker claims Task X and starts work
2) Agent Worker discovers: "Need Paddle API key to proceed"
3) Agent Worker creates Human Task H (owner=human_worker, task_type=credentials)
   openstoat task create --project project_checkout_rebuild \
     --title "Provide Paddle API key" \
     --description "Unblock payment integration" \
     --acceptance-criteria "Key delivered securely" \
     --status ready --owner human_worker --task-type credentials

4) Agent Worker runs self-unblock (dedicated command, not generic status update)
   openstoat task self-unblock task_X --depends-on task_H \
     --logs-append "Blocked: need API key. Created task_H for human."

5) Task X moves from in_progress → ready; Task X now depends_on H
6) Human Worker completes H with mandatory handoff
7) Task X becomes claimable again; Agent Worker can resume
```

### Outcome

- Agent does not stay stuck; it explicitly hands off to human
- Rollback is allowed only via `openstoat task self-unblock` with at least one new `--depends-on`
- No generic `task update --status ready`; self-unblock is the only in_progress→ready path

---

## Use Case 4: Parallel Execution with Dependencies

### Scenario

Multiple Agent Workers run in parallel. Tasks with satisfied dependencies are claimable; the system enforces dependency order.

### Flow

```
Project: Checkout Rebuild

Task A (implementation)     → no deps, ready
Task B (implementation)    → no deps, ready
Task C (testing)           → depends_on A, B
Task D (review)            → depends_on C, owner=human_worker
Task E (deploy)            → depends_on D, owner=human_worker

Timeline:
- AI-1 claims A, AI-2 claims B → both in_progress
- A done, B done → C becomes ready
- AI-3 claims C → in_progress
- C done → D becomes ready
- Human claims D (review) → done
- Human claims E (deploy) → done
```

### Outcome

- Parallelism is maximized where dependencies allow
- `ready` means "in queue"; claimable only when all `depends_on` are done
- Template rules (e.g. default_owner per task_type) guide who claims what

---

## Use Case 5: Handoff and Context Transfer

### Scenario

Task C depends on Task B. When B is done, its handoff provides context for C. Handoff is required for all completions.

### Flow

```
Task B (Human Worker): "Provide Paddle API key"
- Human completes B with handoff:
  "API key delivered via secure channel. Use sandbox environment (pdl_sandbox_xxx).
   Key is configured in .env as PADDLE_API_KEY. Integration tests expect sandbox mode."

Task C (Agent Worker): "Implement PaddlePaymentService"
- Agent claims C, reads B's handoff and B's logs
- Handoff + logs = full execution context for C
```

### Handoff Rules

- Required for every task completion (including human_worker tasks)
- When no downstream tasks exist, `to_task_id` is `null` (audit-only handoff)
- `handoff.summary` must be at least 200 characters
- Summary is text only; no structured artifacts in handoff

### Outcome

- Downstream agents get execution context via handoff and logs
- No credentials in handoff body; human describes where/how they were delivered

---

## Use Case 6: Project and Template Binding

### Scenario

A project is initialized with a bound template. The template defines default owners and rules per task type. All tasks in the project use this context.

### Flow

```
1) Initialize project with template
   openstoat project init --id project_checkout_rebuild \
     --name "Checkout Rebuild" \
     --template checkout-default-v1

2) Template context (e.g. checkout-default-v1):
   - task_type=credentials → default_owner=human_worker
   - task_type=implementation → default_owner=agent_worker
   - task_type=review → default_owner=human_worker

3) Planner creates tasks; owner can follow template defaults or override
4) Workers claim tasks; owner compatibility must match claimer role
```

### Outcome

- Project and template are one operational concept
- Template guides who does what; planner can override when needed
- Every task has `project`; every project has one template

---

## Use Case 7: Duplicate Prevention (Planner Workflow)

### Scenario

Before creating a task, Agent Planner must check for equivalent unfinished tasks in the same project to avoid duplicates.

### Flow

```
1) Agent Planner intends to create: "Add provider mapping for Paddle"
2) Planner lists unfinished tasks first
   openstoat task ls --project project_checkout_rebuild --status ready,in_progress

3) Planner compares candidate intent with existing tasks
4) If equivalent unfinished task exists → do not create; reuse existing task ID in output
5) If no equivalent → create new task
```

### Outcome

- Duplicate prevention is a planner workflow rule, not a DB constraint
- No online LLM duplicate-judgment service in current scope
- Mandatory for planner behavior in local version

---

## Summary

| Value | Description |
|-------|-------------|
| **Agent-first** | Agents are first-class; planners insert, workers execute |
| **Task-only** | No plan hierarchy; tasks are the primary unit |
| **Explicit ownership** | Every task has owner (agent_worker or human_worker) and status |
| **Self-unblock** | Agent creates human task when blocked; dedicated rollback command |
| **Handoff** | Required for all completions; context transfer via summary + logs |
| **Project-bound** | Every task belongs to one project; project binds template |
| **CLI as manual** | Agent-friendly CLI; step commands, no generic status override |

---

*Updated: 2026-02-26*
