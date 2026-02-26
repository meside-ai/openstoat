---
name: openstoat-worker
description: Claims and executes tasks in OpenStoat via CLI. Runs openstoat task claim, start, done, and self-unblock. Use when acting as Agent Worker, when the user mentions execute task, claim task, complete task, handoff, self-unblock, blocked, openstoat worker, or task execution.
metadata: {"openclaw":{"requires":{"bins":["openstoat"]},"emoji":"🔧"}}
---

# OpenStoat Worker

Agent Worker claims and executes tasks from OpenStoat Kanban. Use the CLI as the operational manual.

## What to Do

### 1. Claim and Execute Flow

```bash
# Step 1: Claim (ready → in_progress)
openstoat task claim <task_id> --as agent_worker --logs-append "Claimed, starting work"

# Step 2: Start (record progress)
openstoat task start <task_id> --as agent_worker --logs-append "Started implementation"

# Step 3: Complete (handoff mandatory)
openstoat task done <task_id> \
  --output "What was delivered" \
  --handoff-summary "Context for downstream tasks. Min 200 chars. Include execution context, key decisions, file locations. No credentials in body." \
  --logs-append "Completed implementation and tests"
```

### 2. Append to Logs on Every Step

**Required**: Use `--logs-append "..."` on `claim`, `start`, `done`, and `self-unblock`. Logs serve as context for dependent tasks.

### 3. Handoff Rules

- **Mandatory** for every task completion
- `handoff-summary` must be **at least 200 characters**
- Include: execution context, key decisions, file locations, what downstream needs to know
- **Never** put credentials in handoff body; describe where/how they were delivered

### 4. Self-Unblock When Blocked by Human

When stuck (e.g. need API key, approval):

```bash
# 1. Create human task first
openstoat task create --project <project_id> \
  --title "Provide Paddle API key" \
  --description "Unblock payment integration" \
  --acceptance-criteria "Key delivered securely" \
  --status ready --owner human_worker --task-type credentials

# 2. Self-unblock with new dependency (dedicated command only)
openstoat task self-unblock <task_id> --depends-on <human_task_id> \
  --logs-append "Blocked: need API key. Created task_H for human."
```

Task moves `in_progress` → `ready`. After human completes the new task, your task becomes claimable again.

### 5. Read Context Before Executing

For tasks with dependencies, read upstream handoffs and logs:

```bash
openstoat task show <task_id> [--json]
```

---

## What NOT to Do

- **Do not** claim a task whose dependencies are unresolved (check `depends_on` first)
- **Do not** skip `--logs-append` on any step command
- **Do not** complete without `--handoff-summary` (min 200 chars)
- **Do not** put credentials in handoff body
- **Do not** use generic status update — there is no `openstoat task update --status ...`; use explicit `claim`, `start`, `done`, `self-unblock`
- **Do not** self-unblock without creating at least one new `--depends-on` human task
- **Do not** create tasks except in self-unblock flow (creating human_worker task to unblock)
- **Do not** claim `human_worker` tasks as agent — owner must match your role

---

## Quick Reference

| Action | Command |
|--------|---------|
| Claim task | `openstoat task claim <id> --as agent_worker --logs-append "..."` |
| Start task | `openstoat task start <id> --as agent_worker --logs-append "..."` |
| Complete task | `openstoat task done <id> --output "..." --handoff-summary "..." --logs-append "..."` |
| Self-unblock | `openstoat task self-unblock <id> --depends-on <human_task_id> --logs-append "..."` |
| Show task | `openstoat task show <id>` |
