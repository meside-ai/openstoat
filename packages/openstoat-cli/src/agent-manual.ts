/**
 * OpenStoat Agent Manual - Full SKILL-style documentation for AI agents.
 * This is the single source of truth. Agent skills (openstoat-planner, openstoat-worker) are deprecated.
 * Use when: plan tasks, break down work, create tasks, claim task, execute task, handoff, self-unblock,
 * blocked, openstoat, kanban, task planning, work decomposition, task execution.
 * Requires: openstoat CLI (bins: ["openstoat"]).
 */

export const AGENT_MANUAL = `
# OpenStoat CLI - Agent Operational Manual

## When to Use

Use OpenStoat when: planning work, breaking down work into tasks, creating tasks, claiming/executing tasks,
handing off to humans, self-unblocking when blocked. Triggers: plan tasks, break down work, create tasks,
openstoat, kanban, task planning, work decomposition, execute task, claim task, complete task, handoff,
self-unblock, blocked, openstoat worker, task execution.

Storage: ~/.openstoat/ (SQLite). No account/API key required. Config: .openstoat.json in current directory.

---

## Agent Planner

### 1. List Before Create (Mandatory)

Always list unfinished tasks before creating new ones to avoid duplicates:

\`\`\`bash
openstoat task ls --project <project_id> --status ready,in_progress
\`\`\`

Compare your candidate task intent with existing tasks. If an equivalent unfinished task exists, **do not create**; reuse the existing task ID in your output.

### 2. Create Tasks with All Required Fields

Workflow instructions (prerequisites, finish steps) from the project are **automatically injected** into task description and acceptance criteria — no manual injection needed.

\`\`\`bash
openstoat task create \\
  --project <project_id> \\
  --title "Task title" \\
  --description "Detailed description" \\
  --acceptance-criteria "Criterion 1" \\
  --acceptance-criteria "Criterion 2" \\
  --status ready \\
  --owner agent_worker \\
  --task-type implementation
\`\`\`

**Required fields**: project, title, description, acceptance-criteria (pass multiple times), status, owner, task-type.

**Optional**: --depends-on task_001 --depends-on task_002 for dependencies. Omit when no dependencies.

### 3. Owner and Task Type

- owner: agent_worker or human_worker
- task_type: implementation, testing, review, credentials, deploy, docs, custom
- Template defaults: credentials, review, deploy often → human_worker

### 4. Credential and Certificate Dependencies (Mandatory)

**When decomposing work, you MUST identify any credential or certificate dependencies.** If an agent task requires secrets, tokens, or keys that only humans can provide or configure, you MUST:

1. Create a **human_worker** task with --task-type credentials (or deploy if deployment secrets)
2. Add that human task as --depends-on for the agent task that needs the credential

**Examples of credential dependencies requiring a human task:**

- **GitHub Secrets / NPM_TOKEN**: CI/CD or GitHub Actions that need NPM_TOKEN, GITHUB_TOKEN, or other secrets — human must add them in GitHub repo Settings → Secrets
- **API Keys**: Paddle, Stripe, OpenAI, or third-party API keys — human must obtain and configure
- **Deployment credentials**: SSH keys, cloud provider credentials, container registry tokens — human must provision
- **Certificates**: TLS certs, code signing certs — human must obtain and install

**Do NOT** create an agent task that assumes credentials exist without a preceding human task. The agent worker will self-unblock if it hits a missing credential, but planning correctly avoids wasted work.

### 5. Project Context

Project ID comes from .openstoat.json in the current directory:

\`\`\`json
{ "project": "<project_id>" }
\`\`\`

Use this project value as --project in all task commands. Ensure the project exists: openstoat project ls.

### Planner: What NOT to Do

- Do not create without listing ready,in_progress tasks first
- Do not create agent tasks that depend on credentials (NPM_TOKEN, API keys, GitHub Secrets, etc.) without first creating a human_worker credentials task and adding it as --depends-on
- Do not create a duplicate when an equivalent unfinished task exists
- Do not omit any required field
- Do not use invalid statuses: todo, ai_ready, waiting_human, blocked, review, human_done — only ready, in_progress, done are valid
- Do not create tasks for execution — that is the Worker's job; Planner only inserts

---

## Agent Worker

### 1. Claim and Execute Flow

\`\`\`bash
# Step 1: Claim (ready → in_progress)
openstoat task claim <task_id> --as agent_worker --logs-append "Claimed, starting work"

# Step 2: Start (record progress)
openstoat task start <task_id> --as agent_worker --logs-append "Started implementation"

# Step 3: Complete (handoff mandatory)
openstoat task done <task_id> \\
  --output "What was delivered" \\
  --handoff-summary "Context for downstream tasks. Min 200 chars. Include execution context, key decisions, file locations. No credentials in body." \\
  --logs-append "Completed implementation and tests"
\`\`\`

### 2. Append to Logs on Every Step

**Required**: Use --logs-append "..." on claim, start, done, and self-unblock. Logs serve as context for dependent tasks.

### 3. Handoff Rules

- **Mandatory** for every task completion
- handoff-summary must be **at least 200 characters**
- Include: execution context, key decisions, file locations, what downstream needs to know
- **Never** put credentials in handoff body; describe where/how they were delivered

### 4. Project Context

Project ID comes from .openstoat.json in the current directory. Use it as --project when creating human tasks (e.g. in self-unblock flow).

### 5. Self-Unblock When Blocked by Human (Including Credentials)

**You MUST self-unblock** when execution requires credentials, certificates, or secrets that only a human can provide or configure. Do NOT mark the task as done and assume someone will add them later.

**Common credential scenarios requiring self-unblock:**

- **GitHub Secrets / NPM_TOKEN**: GitHub Actions or CI needs NPM_TOKEN, GITHUB_TOKEN — human must add in repo Settings → Secrets
- **API Keys**: Stripe, Paddle, OpenAI, third-party APIs — human must obtain and configure
- **Deployment credentials**: SSH keys, cloud credentials, container registry tokens — human must provision
- **Certificates**: TLS certs, code signing — human must obtain and install

When stuck (e.g. need API key, GitHub Secret, approval):

\`\`\`bash
# 1. Create human task first (use project from .openstoat.json or OPENSTOAT_PROJECT_ID)
openstoat task create --project <project> \\
  --title "Add NPM_TOKEN to GitHub Secrets" \\
  --description "Unblock publish workflow. Add NPM_TOKEN in repo Settings → Secrets." \\
  --acceptance-criteria "NPM_TOKEN added; workflow can access it" \\
  --status ready --owner human_worker --task-type credentials

# 2. Self-unblock with new dependency (dedicated command only)
openstoat task self-unblock <task_id> --depends-on <human_task_id> \\
  --logs-append "Blocked: need NPM_TOKEN in GitHub Secrets. Created task_H for human."
\`\`\`

Task moves in_progress → ready. After human completes the new task, your task becomes claimable again.

### 6. Read Context Before Executing

For tasks with dependencies, read upstream handoffs and logs:

\`\`\`bash
openstoat task show <task_id> [--json]
\`\`\`

### 7. When Invoked by Daemon

When openstoat daemon start invokes you, the daemon sets:

- OPENSTOAT_TASK_ID: The task ID to work on (use this as <task_id> in all commands)
- OPENSTOAT_PROJECT_ID: The project ID (use as --project when creating human tasks)

Use OPENSTOAT_TASK_ID as the task to claim, start, and complete. Do not ask the user for a task ID when this env is set.

### Worker: What NOT to Do

- Do not claim a task whose dependencies are unresolved (check depends_on first)
- Do not skip --logs-append on any step command
- Do not complete without --handoff-summary (min 200 chars)
- Do not put credentials in handoff body
- Do not mark a task as done when it requires credentials (NPM_TOKEN, GitHub Secrets, API keys, etc.) that are missing — you MUST self-unblock and create a human_worker credentials task instead
- Do not use generic status update — there is no openstoat task update --status ...; use explicit claim, start, done, self-unblock
- Do not self-unblock without creating at least one new --depends-on human task
- Do not create tasks except in self-unblock flow (creating human_worker task to unblock)
- Do not claim human_worker tasks as agent — owner must match your role

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
Show project details (JSON). Check template_context.workflow_instructions before creating tasks.

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
  --logs-append (required for agents): Append to task logs.

### task start <task_id>
Worker starts working. Use after claim or to append progress.
  --as (required): agent_worker | human_worker
  --logs-append (required for agents): Append to task logs.

### task done <task_id>
Worker completes task. Moves in_progress → done. Handoff mandatory.
  --output (required): What was delivered.
  --handoff-summary (required, min 200 chars): Context for downstream tasks.
  --logs-append (required for agents)
  --as (required): agent_worker | human_worker

### task self-unblock <task_id>
Rollback in_progress → ready when blocked by human. Must add new --depends-on.
  --depends-on (required, pass multiple): New human task ID(s). At least one.
  --logs-append (required for agents)
  --as: agent_worker only (default)

### task show <task_id>
Show task details. Use --json for machine-readable output.

---

## Human Commands (Do Not Run)

daemon, install, web — human operations. Agents must not run these.

---

## Rules (Do Not Violate)

1. **No generic status update**: There is no task update --status. Use claim, start, done, self-unblock only.
2. **Planner duplicate check**: Always run task ls before task create to avoid duplicates.
3. **Handoff required**: Every task done must include --handoff-summary (min 200 chars).
4. **Self-unblock guard**: in_progress → ready only via self-unblock, and only with new --depends-on.
5. **Logs for agents**: Agent workers must use --logs-append on claim, start, done for audit trail.
6. **Project required**: Every task has --project. Get project IDs from project ls.
7. **Credential dependencies**: Planner must create human_worker credentials task before agent task that needs it. Worker must self-unblock when blocked by missing credentials.
8. **Human commands only**: Do not run daemon, install, or web — these are human operations.

---

## Quick Reference

| Role | Action | Command |
|------|--------|---------|
| Planner | List projects | openstoat project ls |
| Planner | List unfinished tasks | openstoat task ls --project <project> --status ready,in_progress |
| Planner | Create task | openstoat task create --project <project> --title "..." --description "..." --acceptance-criteria "..." --status ready --owner agent_worker --task-type implementation |
| Planner | Create with deps | Add --depends-on task_001 --depends-on task_002 |
| Worker | Claim task | openstoat task claim <id> --as agent_worker --logs-append "..." |
| Worker | Start task | openstoat task start <id> --as agent_worker --logs-append "..." |
| Worker | Complete task | openstoat task done <id> --output "..." --handoff-summary "..." --logs-append "..." |
| Worker | Self-unblock | openstoat task self-unblock <id> --depends-on <human_task_id> --logs-append "..." |
| Both | Show task | openstoat task show <id> |

Note: <project> is the project value from .openstoat.json. Read it before running commands.

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
