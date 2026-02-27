---
title: Palmlist Architecture (v3)
---

# Palmlist Architecture (v3)

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
palmlist/
├── packages/
│   ├── palmlist-cli/          # Main CLI entry
│   │   ├── bin/
│   │   │   └── palmlist       # CLI executable
│   │   ├── src/
│   │   │   ├── index.ts        # CLI entry
│   │   │   ├── commands/       # Subcommands (project, task, daemon)
│   │   │   └── lib/            # Utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── palmlist-core/         # Core logic (storage, state machine)
│   │   ├── src/
│   │   │   ├── db.ts           # SQLite connection
│   │   │   ├── project.ts      # Project model (template-bound)
│   │   │   ├── task.ts         # Task model
│   │   │   ├── handoff.ts      # Handoff model
│   │   │   └── index.ts        # Exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── palmlist-daemon/       # Worker daemon
│   │   ├── src/
│   │   │   ├── index.ts        # Daemon entry
│   │   │   ├── scheduler.ts    # Poll and dispatch logic
│   │   │   └── worker.ts       # Worker coordination
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── palmlist-types/       # Shared types
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
│  - palmlist task ls --project X --status ready,in_progress      │
│  - palmlist task create --project X ...                         │
│                                                                  │
│  Agent Worker / Human Worker:                                    │
│  - palmlist task claim <id> --as agent_worker --logs-append "..." │
│  - palmlist task start <id> --as agent_worker --logs-append "..." │
│  - palmlist task done <id> --output "..." --handoff-summary "..." │
│  - palmlist task self-unblock <id> --depends-on <human_task>    │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        palmlist CLI                             │
│                    (Agent super-manual)                          │
│                                                                  │
│   $ palmlist --help                                             │
│   $ palmlist project init --id X --name "..." --template Y      │
│   $ palmlist task ls --project X --status ready,in_progress     │
│   $ palmlist task create --project X --title "..." ...          │
│   $ palmlist task claim <id> --as agent_worker --logs-append "..." │
│   $ palmlist task start <id> --as agent_worker --logs-append "..." │
│   $ palmlist task done <id> --output "..." --handoff-summary "..." │
│   $ palmlist task self-unblock <id> --depends-on <id> --logs-append "..." │
│   $ palmlist daemon start                                       │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       palmlist-core                             │
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
│   Data: ~/.palmlist/palmlist.db                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. CLI Command Reference

### 4.1 Global

```bash
# Help (agent super-manual)
$ palmlist --help
```

### 4.2 Project Commands

```bash
# Initialize project with bound template (required: --id, --name, --template)
$ palmlist project init --id project_checkout_rebuild --name "Checkout Rebuild" --template checkout-default-v1

# List projects
$ palmlist project ls

# Show project details
$ palmlist project show <project_id>
```

### 4.3 Task Commands

```bash
# List tasks (planner must run this before create to avoid duplicates)
$ palmlist task ls --project project_checkout_rebuild --status ready,in_progress

# Create task (all required fields; planner or worker in self-unblock)
$ palmlist task create \
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
$ palmlist task claim task_001 --as agent_worker --logs-append "Claimed, starting work"

# Worker: start task (agent must append to logs)
$ palmlist task start task_001 --as agent_worker --logs-append "Started implementation"

# Worker: complete task (handoff mandatory; agent must append to logs)
$ palmlist task done task_001 \
  --output "Implemented and tested" \
  --handoff-summary "Implemented provider mapping for Paddle in checkout and recurring billing paths, added integration coverage. Main changes in src/payments/provider-map.ts. No migration needed." \
  --logs-append "Completed implementation and tests"

# Worker: self-unblock when blocked by human (dedicated command; requires new --depends-on)
$ palmlist task self-unblock task_001 --depends-on task_002 \
  --logs-append "Blocked: need API key. Created task_002 for human."

# Show task details
$ palmlist task show <task_id> [--json]
```

**Note**: There is no generic `palmlist task update --status ...`. Status transitions use explicit step commands: `claim`, `start`, `done`, `self-unblock`.

### 4.4 Daemon Commands

```bash
$ palmlist daemon init        # Interactively create .palmlist.json
$ palmlist daemon start       # Start worker-daemon
$ palmlist daemon stop        # Stop daemon
$ palmlist daemon status      # Check status
$ palmlist daemon logs        # View logs
```

Daemon and skills read config from `.palmlist.json` in the current directory:

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

Run `palmlist daemon start` from the project root where `.palmlist.json` lives.

---

## 5. Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    External Agents / Humans                        │
│                                                                    │
│  Agent Planner:                                                    │
│  - palmlist task ls --project X --status ready,in_progress        │
│  - palmlist task create --project X ... (when no duplicate)       │
│                                                                    │
│  Agent Worker / Human Worker:                                      │
│  - palmlist task claim <id> --as <role> --logs-append "..."        │
│  - palmlist task start <id> --as <role> --logs-append "..."        │
│  - palmlist task done <id> --output "..." --handoff-summary "..."  │
│  - palmlist task self-unblock <id> --depends-on <human_task>       │
└────────────────────────────────────┬─────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      palmlist CLI                                 │
│                                                                    │
│   project init | project ls | project show                         │
│   task ls | task create | task claim | task start | task done      │
│   task self-unblock | task show                                    │
│   daemon start | daemon stop | daemon status | daemon logs         │
└────────────────────────────────────┬─────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      palmlist-core                                │
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
│   │               (~/.palmlist/palmlist.db)                     │ │
│   └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Worker Daemon Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     palmlist worker-daemon                      │
│                                                                  │
│   ┌───────────────────────────────────────────────────────────┐  │
│   │                      Scheduler                             │  │
│   │                                                            │  │
│   │   while true:                                              │  │
│   │     tasks = exec("palmlist task ls --status ready         │  │
│   │                   --owner agent_worker --json")             │  │
│   │     # Filter: dependencies must be satisfied                │  │
│   │     for task in tasks:                                     │  │
│   │       agent = .palmlist.json in cwd         │  │
│   │       exec(f"{agent} do-task --task-id {task.id}")         │  │
│   │     sleep(poll_interval)                                    │  │
│   └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│   Palmlist does not run LLM inference. Daemon invokes external  │
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
- `in_progress -> ready` allowed only via `palmlist task self-unblock`
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
$ bun --cwd packages/palmlist-cli run build

# Global install
$ npm install -g palmlist

# Usage
$ palmlist --help
$ palmlist project init --id my_project --name "My Project" --template default-v1 [--workflow-instructions "text"]
$ palmlist project update my_project --workflow-instructions "text"
$ palmlist task ls --project my_project --status ready,in_progress
$ palmlist daemon start
```

---

*Architecture v3.0 - 2026-02-26*
