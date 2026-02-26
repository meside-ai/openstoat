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

### 4. Project Context

Project ID comes from `.openstoat.json` in the current directory. Use it as `--project` when creating human tasks (e.g. in self-unblock flow).

### 5. Self-Unblock When Blocked by Human (Including Credentials)

**You MUST self-unblock** when execution requires credentials, certificates, or secrets that only a human can provide or configure. Do NOT mark the task as done and assume someone will add them later.

**Common credential scenarios requiring self-unblock:**

- **GitHub Secrets / NPM_TOKEN**: GitHub Actions or CI needs `NPM_TOKEN`, `GITHUB_TOKEN` — human must add in repo Settings → Secrets
- **API Keys**: Stripe, Paddle, OpenAI, third-party APIs — human must obtain and configure
- **Deployment credentials**: SSH keys, cloud credentials, container registry tokens — human must provision
- **Certificates**: TLS certs, code signing — human must obtain and install

When stuck (e.g. need API key, GitHub Secret, approval):

```bash
# 1. Create human task first (use project from .openstoat.json or OPENSTOAT_PROJECT_ID)
openstoat task create --project <project> \
  --title "Add NPM_TOKEN to GitHub Secrets" \
  --description "Unblock publish workflow. Add NPM_TOKEN in repo Settings → Secrets." \
  --acceptance-criteria "NPM_TOKEN added; workflow can access it" \
  --status ready --owner human_worker --task-type credentials

# 2. Self-unblock with new dependency (dedicated command only)
openstoat task self-unblock <task_id> --depends-on <human_task_id> \
  --logs-append "Blocked: need NPM_TOKEN in GitHub Secrets. Created task_H for human."
```

Task moves `in_progress` → `ready`. After human completes the new task, your task becomes claimable again.

### 6. Read Context Before Executing

For tasks with dependencies, read upstream handoffs and logs:

```bash
openstoat task show <task_id> [--json]
```

### 7. When Invoked by Daemon

When `openstoat daemon start` invokes you, the daemon sets:

- `OPENSTOAT_TASK_ID`: The task ID to work on (use this as `<task_id>` in all commands)
- `OPENSTOAT_PROJECT_ID`: The project ID (use as `--project` when creating human tasks)

Use `OPENSTOAT_TASK_ID` as the task to claim, start, and complete. Do not ask the user for a task ID when this env is set.

---

## What NOT to Do

- **Do not** claim a task whose dependencies are unresolved (check `depends_on` first)
- **Do not** skip `--logs-append` on any step command
- **Do not** complete without `--handoff-summary` (min 200 chars)
- **Do not** put credentials in handoff body
- **Do not** mark a task as done when it requires credentials (NPM_TOKEN, GitHub Secrets, API keys, etc.) that are missing — you MUST self-unblock and create a human_worker credentials task instead
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

**Note**: `<project>` is the `project` value from `.openstoat.json`. Use it when creating human tasks in self-unblock flow.
