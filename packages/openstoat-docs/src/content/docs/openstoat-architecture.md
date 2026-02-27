---
title: OpenStoat Architecture (v3)
---

# OpenStoat Architecture (v3)

> Agent-first AI and Human collaborative task orchestration system

---

## 1. Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 22+ |
| Language | TypeScript |
| Package manager | Bun (workspace) |
| Storage | SQLite (native) |
| CLI | Ink / yargs |

---

## 2. Project Structure (Monorepo)

```
openstoat/
├── packages/
│   ├── openstoat-cli/          # Main CLI entry
│   │   ├── bin/
│   │   │   └── openstoat       # CLI executable
│   │   ├── src/
│   │   │   ├── index.ts        # CLI entry
│   │   │   ├── commands/       # Subcommands (project, task, daemon)
│   │   │   └── lib/            # Utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── openstoat-core/         # Core logic (storage, state machine)
│   │   ├── src/
│   │   │   ├── db.ts           # SQLite connection
│   │   │   ├── project.ts      # Project model (template-bound)
│   │   │   ├── task.ts         # Task model
│   │   │   ├── handoff.ts      # Handoff model
│   │   │   └── index.ts        # Exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── openstoat-daemon/       # Worker daemon
│   │   ├── src/
│   │   │   ├── index.ts        # Daemon entry
│   │   │   ├── scheduler.ts    # Poll and dispatch logic
│   │   │   └── worker.ts       # Worker coordination
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── openstoat-types/       # Shared types
│       ├── src/
│       │   └── index.ts        # TypeScript type definitions
│       ├── package.json
│       └── tsconfig.json
│
├── bun.lockb
├── package.json
└── tsconfig.json               # Root tsconfig
```

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Agents / Humans                      │
│                                                                  │
│  Agent Planner (on-demand):                                      │
│  - openstoat task ls --project X --status ready,in_progress      │
│  - openstoat task create --project X ...                         │
│                                                                  │
│  Agent Worker / Human Worker:                                    │
│  - openstoat task claim <id> --as agent_worker --logs-append "..." │
│  - openstoat task start <id> --as agent_worker --logs-append "..." │
│  - openstoat task done <id> --output "..." --handoff-summary "..." │
│  - openstoat task self-unblock <id> --depends-on <human_task>    │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        openstoat CLI                             │
│                    (Agent super-manual)                          │
│                                                                  │
│   $ openstoat --help                                             │
│   $ openstoat project init --id X --name "..." --template Y      │
│   $ openstoat task ls --project X --status ready,in_progress     │
│   $ openstoat task create --project X --title "..." ...          │
│   $ openstoat task claim <id> --as agent_worker --logs-append "..." │
│   $ openstoat task start <id> --as agent_worker --logs-append "..." │
│   $ openstoat task done <id> --output "..." --handoff-summary "..." │
│   $ openstoat task self-unblock <id> --depends-on <id> --logs-append "..." │
│   $ openstoat daemon start                                       │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       openstoat-core                             │
│                                                                  │
│   ┌───────────────────────────────────────────────────────────┐  │
│   │                    SQLite Database                         │  │
│   │                                                            │  │
│   │   ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│   │   │ projects │  │  tasks   │  │ handoffs │               │  │
│   │   └──────────┘  └──────────┘  └──────────┘               │  │
│   │                                                            │  │
│   │   Project = template-bound; no standalone plans/templates │  │
│   └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│   Data: ~/.openstoat/openstoat.db                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. CLI Command Reference

### 4.1 Global

```bash
# Help (agent super-manual)
$ openstoat --help
```

### 4.2 Project Commands

```bash
# Initialize project with bound template (required: --id, --name, --template)
$ openstoat project init --id project_checkout_rebuild --name "Checkout Rebuild" --template checkout-default-v1

# List projects
$ openstoat project ls

# Show project details
$ openstoat project show <project_id>
```

### 4.3 Task Commands

```bash
# List tasks (planner must run this before create to avoid duplicates)
$ openstoat task ls --project project_checkout_rebuild --status ready,in_progress

# Create task (all required fields; planner or worker in self-unblock)
$ openstoat task create \
  --project project_checkout_rebuild \
  --title "Add provider mapping for Paddle" \
  --description "Implement mapping in payment module" \
  --acceptance-criteria "Mapping works in checkout paths" \
  --acceptance-criteria "Unit tests pass" \
  --status ready \
  --owner agent_worker \
  --task-type implementation
# With dependencies: --depends-on task_001 --depends-on task_002
# Omit --depends-on when task has no dependencies

# Worker: claim task (agent must append to logs)
$ openstoat task claim task_001 --as agent_worker --logs-append "Claimed, starting work"

# Worker: start task (agent must append to logs)
$ openstoat task start task_001 --as agent_worker --logs-append "Started implementation"

# Worker: complete task (handoff mandatory; agent must append to logs)
$ openstoat task done task_001 \
  --output "Implemented and tested" \
  --handoff-summary "Implemented provider mapping for Paddle in checkout and recurring billing paths, added integration coverage. Main changes in src/payments/provider-map.ts. No migration needed." \
  --logs-append "Completed implementation and tests"

# Worker: self-unblock when blocked by human (dedicated command; requires new --depends-on)
$ openstoat task self-unblock task_001 --depends-on task_002 \
  --logs-append "Blocked: need API key. Created task_002 for human."

# Show task details
$ openstoat task show <task_id> [--json]
```

**Note**: There is no generic `openstoat task update --status ...`. Status transitions use explicit step commands: `claim`, `start`, `done`, `self-unblock`.

### 4.4 Daemon Commands

```bash
$ openstoat daemon init        # Interactively create .openstoat.json
$ openstoat daemon start       # Start worker-daemon
$ openstoat daemon stop        # Stop daemon
$ openstoat daemon status      # Check status
$ openstoat daemon logs        # View logs
```

Daemon and skills read config from `.openstoat.json` in the current directory:

```json
{
  "project": "<project_id>",
  "agent": "/path/to/agent-executable",
  "agent_args_template": "{{prompt}}"
}
```

- `project`: Project ID used as `--project` in task commands. Skills read this.
- `agent`: Path to external agent. Daemon invokes this for ready agent_worker tasks.
- `agent_args_template`: Optional. How to pass the prompt to the agent. Use `{{prompt}}` as placeholder. Default: `{{prompt}}` (positional). Examples: `--prompt {{prompt}}`, `-m {{prompt}}`.

Run `openstoat daemon start` from the project root where `.openstoat.json` lives.

---

## 5. Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    External Agents / Humans                        │
│                                                                    │
│  Agent Planner:                                                    │
│  - openstoat task ls --project X --status ready,in_progress        │
│  - openstoat task create --project X ... (when no duplicate)       │
│                                                                    │
│  Agent Worker / Human Worker:                                      │
│  - openstoat task claim <id> --as <role> --logs-append "..."        │
│  - openstoat task start <id> --as <role> --logs-append "..."        │
│  - openstoat task done <id> --output "..." --handoff-summary "..."  │
│  - openstoat task self-unblock <id> --depends-on <human_task>       │
└────────────────────────────────────┬─────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      openstoat CLI                                 │
│                                                                    │
│   project init | project ls | project show                         │
│   task ls | task create | task claim | task start | task done      │
│   task self-unblock | task show                                    │
│   daemon start | daemon stop | daemon status | daemon logs         │
└────────────────────────────────────┬─────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      openstoat-core                                │
│                                                                    │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐                  │
│   │  Project   │  │   Task     │  │  Handoff   │                  │
│   │  Service   │  │  Service  │  │  Service   │                  │
│   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                  │
│         │                │                │                         │
│         └────────────────┴────────────────┘                         │
│                          │                                          │
│                          ▼                                          │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                      SQLite                                    │ │
│   │               (~/.openstoat/openstoat.db)                     │ │
│   └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Worker Daemon Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     openstoat worker-daemon                      │
│                                                                  │
│   ┌───────────────────────────────────────────────────────────┐  │
│   │                      Scheduler                             │  │
│   │                                                            │  │
│   │   while true:                                              │  │
│   │     tasks = exec("openstoat task ls --status ready         │  │
│   │                   --owner agent_worker --json")             │  │
│   │     # Filter: dependencies must be satisfied                │  │
│   │     for task in tasks:                                     │  │
│   │       agent = .openstoat.json in cwd         │  │
│   │       exec(f"{agent} do-task --task-id {task.id}")         │  │
│   │     sleep(poll_interval)                                    │  │
│   └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│   OpenStoat does not run LLM inference. Daemon invokes external  │
│   agents to execute tasks.                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. State Machine

```
Task status flow:

[ready] ──claim──> [in_progress] ──done──> [done]
                       │
                       └──self-unblock──> [ready]
                            (only when --depends-on adds new human task)
```

**Status semantics**:
- `ready`: Task is in queue; claimable only when all `depends_on` are done
- `in_progress`: Currently being executed
- `done`: Accepted as complete

**Invalid statuses** (not in this model): `todo`, `ai_ready`, `waiting_human`, `blocked`, `review`, `human_done`

**Self-unblock guard**:
- `in_progress -> ready` allowed only via `openstoat task self-unblock`
- Must include at least one new `--depends-on` (human task)
- No generic `task update --status ready`

---

## 8. Storage Schema

```sql
-- Project table (template-bound)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_context TEXT NOT NULL,  -- JSON: { version, rules: [{ task_type, default_owner }], workflow_instructions?: string }
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Task table (first-level only; no plan_id)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL,  -- JSON array
  depends_on TEXT NOT NULL,           -- JSON array of task IDs
  status TEXT NOT NULL CHECK(status IN ('ready', 'in_progress', 'done')),
  owner TEXT NOT NULL CHECK(owner IN ('agent_worker', 'human_worker')),
  task_type TEXT NOT NULL CHECK(task_type IN ('implementation', 'testing', 'review', 'credentials', 'deploy', 'docs', 'custom')),
  output TEXT,
  logs TEXT NOT NULL,                 -- JSON array; agents append on every step
  created_by TEXT,
  claimed_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Handoff table (summary only; no artifacts)
CREATE TABLE handoffs (
  id TEXT PRIMARY KEY,
  from_task_id TEXT NOT NULL REFERENCES tasks(id),
  to_task_id TEXT,                   -- NULL when no downstream (audit-only)
  summary TEXT NOT NULL,             -- min 200 chars
  created_at TEXT DEFAULT (datetime('now'))
);

-- Config table (daemon, agent path, etc.)
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## 9. Core Concepts Mapping

| Concept | Architecture Component |
|---------|------------------------|
| **Project (template-bound)** | `projects` table; `template_context` JSON |
| **Task** | `tasks` table; first-level only, no plan parent |
| **Kanban** | Operational view: tasks by project, status, owner |
| **Handoff** | `handoffs` table; summary only, required for all completions |

---

## 10. Install and Run

```bash
# Development
$ bun install
$ bun --cwd packages/openstoat-cli run build

# Global install
$ npm install -g openstoat

# Usage
$ openstoat --help
$ openstoat project init --id my_project --name "My Project" --template default-v1 [--workflow-instructions "text"]
$ openstoat project update my_project --workflow-instructions "text"
$ openstoat task ls --project my_project --status ready,in_progress
$ openstoat daemon start
```

---

*Architecture v3.0 - 2026-02-26*
