---
name: openstoat-planner
description: Plans and creates tasks in OpenStoat via CLI. Decomposes work into tasks, inserts tasks into OpenStoat Kanban, and manages task dependencies. Use when acting as Agent Planner, when the user mentions plan tasks, break down work, create tasks, openstoat, kanban, task planning, or work decomposition.
metadata: {"openclaw":{"requires":{"bins":["openstoat"]},"emoji":"📋"}}
---

# OpenStoat Planner

Agent Planner inserts tasks into OpenStoat Kanban. Use the CLI as the operational manual.

## What to Do

### 1. List Before Create (Mandatory)

Always list unfinished tasks before creating new ones to avoid duplicates:

```bash
openstoat task ls --project <project_id> --status ready,in_progress
```

Compare your candidate task intent with existing tasks. If an equivalent unfinished task exists, **do not create**; reuse the existing task ID in your output.

### 2. Create Tasks with All Required Fields

```bash
openstoat task create \
  --project <project_id> \
  --title "Task title" \
  --description "Detailed description" \
  --acceptance-criteria "Criterion 1" \
  --acceptance-criteria "Criterion 2" \
  --status ready \
  --owner agent_worker \
  --task-type implementation
```

**Required fields**: `project`, `title`, `description`, `acceptance-criteria` (pass multiple times), `status`, `owner`, `task-type`.

**Optional**: `--depends-on task_001 --depends-on task_002` for dependencies. Omit when no dependencies.

### 3. Owner and Task Type

- `owner`: `agent_worker` or `human_worker`
- `task_type`: `implementation`, `testing`, `review`, `credentials`, `deploy`, `docs`, `custom`
- Template defaults: `credentials`, `review`, `deploy` often → `human_worker`

### 4. Credential and Certificate Dependencies (Mandatory)

**When decomposing work, you MUST identify any credential or certificate dependencies.** If an agent task requires secrets, tokens, or keys that only humans can provide or configure, you MUST:

1. Create a **human_worker** task with `--task-type credentials` (or `deploy` if deployment secrets)
2. Add that human task as `--depends-on` for the agent task that needs the credential

**Examples of credential dependencies requiring a human task:**

- **GitHub Secrets / NPM_TOKEN**: CI/CD or GitHub Actions that need `NPM_TOKEN`, `GITHUB_TOKEN`, or other secrets — human must add them in GitHub repo Settings → Secrets
- **API Keys**: Paddle, Stripe, OpenAI, or third-party API keys — human must obtain and configure
- **Deployment credentials**: SSH keys, cloud provider credentials, container registry tokens — human must provision
- **Certificates**: TLS certs, code signing certs — human must obtain and install

**Do NOT** create an agent task that assumes credentials exist without a preceding human task. The agent worker will self-unblock if it hits a missing credential, but planning correctly avoids wasted work.

### 5. Project Context

Project ID comes from `.openstoat.json` in the current directory:

```json
{
  "project": "<project_id>"
}
```

Use this `project` value as `--project` in all task commands. Ensure the project exists: `openstoat project ls`.

---

## What NOT to Do

- **Do not create** without listing `ready,in_progress` tasks first
- **Do not create** agent tasks that depend on credentials (NPM_TOKEN, API keys, GitHub Secrets, etc.) without first creating a human_worker credentials task and adding it as `--depends-on`
- **Do not create** a duplicate when an equivalent unfinished task exists
- **Do not omit** any required field
- **Do not use** invalid statuses: `todo`, `ai_ready`, `waiting_human`, `blocked`, `review`, `human_done` — only `ready`, `in_progress`, `done` are valid
- **Do not create** tasks for execution — that is the Worker's job; Planner only inserts

---

## Quick Reference

| Action | Command |
|--------|---------|
| List projects | `openstoat project ls` |
| List unfinished tasks | `openstoat task ls --project <project> --status ready,in_progress` |
| Create task | `openstoat task create --project <project> --title "..." --description "..." --acceptance-criteria "..." --status ready --owner agent_worker --task-type implementation` |
| Create with deps | Add `--depends-on task_001 --depends-on task_002` |

**Note**: `<project>` is the `project` value from `.openstoat.json`. Read it before running commands.
