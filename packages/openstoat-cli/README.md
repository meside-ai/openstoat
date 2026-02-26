# OpenStoat

> AI ↔ Human task queue — orchestrate work between AI agents and humans with a local-first CLI.

[![npm version](https://img.shields.io/npm/v/openstoat.svg)](https://www.npmjs.com/package/openstoat)

OpenStoat is a **decoupled task queue** that coordinates AI agents and humans. AI handles tasks that don't require human input; when humans complete their tasks, downstream AI tasks are triggered automatically. No cloud, no API keys, no built-in LLM — just a local SQLite store and a CLI that both agents and humans use.

---

## Features

| Feature | Description |
|---------|-------------|
| **Local-first** | All data in `~/.openstoat/` (SQLite). No account or API key required. |
| **CLI-first** | Every operation via `openstoat` commands. Same CLI for agents and humans. |
| **No LLM** | OpenStoat orchestrates only. Planning and execution are done by external agents (Cursor, Claude, etc.). |
| **1 human + N agents** | Humans are the bottleneck; AI fills idle time. Explicit ownership per task. |
| **Transparent** | Clear task states, dependencies, and handoffs. |

---

## Quick Start

### Install

```bash
npm install -g openstoat
# or
bun add -g openstoat
# or
npx openstoat --help
```

### 1. Initialize a project

```bash
openstoat project init --id my_project --name "My Project" --template checkout-default-v1
```

### 2. Create tasks

```bash
openstoat task create \
  --project my_project \
  --title "Implement payment provider mapping" \
  --description "Add Paddle to provider enum and implement mapping" \
  --acceptance-criteria "Checkout works with Paddle" \
  --acceptance-criteria "Unit tests pass" \
  --status ready \
  --owner agent_worker \
  --task-type implementation
```

### 3. Claim and execute (as agent or human)

```bash
openstoat task claim task_001 --as agent_worker --logs-append "Claimed"
openstoat task start task_001 --as agent_worker --logs-append "Started"
openstoat task done task_001 \
  --output "Implemented and tested" \
  --handoff-summary "Added Paddle provider mapping in src/payments/provider-map.ts. No migration needed. Tests pass." \
  --logs-append "Completed"
```

### 4. Optional: Web UI

```bash
openstoat web
# Opens http://localhost:3080
```

### 5. Optional: Daemon for auto-scheduling AI tasks

```bash
openstoat daemon init   # Configure .openstoat.json
openstoat daemon start # Poll for ready agent_worker tasks and invoke your agent
```

---

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Project** | Template-bound workspace. Every task belongs to one project. |
| **Task** | Smallest unit of work. Status: `ready` → `in_progress` → `done`. Owner: `agent_worker` or `human_worker`. |
| **Template** | Workflow template defining which task types need human input (e.g. credentials, review, deploy). |
| **Handoff** | Context passed when a task completes. Required on every `done` (min 200 chars). |
| **Self-unblock** | When an agent is blocked by human input: create a human task, then run `task self-unblock` with `--depends-on`. |

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `openstoat project init` | Initialize project (requires `--id`, `--name`, `--template`) |
| `openstoat project ls` | List projects |
| `openstoat project show <id>` | Show project details |
| `openstoat task ls` | List tasks (filter by `--project`, `--status`, `--owner`) |
| `openstoat task create` | Create task (all required fields) |
| `openstoat task claim <id>` | Claim ready task (`--as agent_worker` or `human_worker`) |
| `openstoat task start <id>` | Start working on task |
| `openstoat task done <id>` | Complete task (`--output`, `--handoff-summary` required) |
| `openstoat task self-unblock <id>` | Rollback when blocked (`--depends-on` human task required) |
| `openstoat task show <id>` | Show task details |
| `openstoat daemon init` | Interactively create `.openstoat.json` |
| `openstoat daemon start` | Start worker daemon (polls for ready agent tasks) |
| `openstoat install skill` | Install planner and worker skills for agents |
| `openstoat web` | Start Web UI server |
| `openstoat manual` | Print full agent operational manual |

Run `openstoat --help` for full usage.

---

## Daemon Configuration

The daemon polls for `ready` tasks owned by `agent_worker` and invokes your configured agent. Create `.openstoat.json` in your project root:

```json
{
  "project": "my_project",
  "agent": "/path/to/agent-executable",
  "agent_args_template": "{{prompt}}"
}
```

| Field | Description |
|-------|-------------|
| `project` | Project ID for task commands. |
| `agent` | Path to your agent executable (e.g. Cursor CLI, Claude CLI). |
| `agent_args_template` | Optional. How to pass the prompt. Use `{{prompt}}` as placeholder. Default: `{{prompt}}` (positional). Examples: `--prompt {{prompt}}`, `-m {{prompt}}` for agents that expect different CLI flags. |

---

## Agent Workflows

### Agent Planner

1. **Before creating tasks**: List existing tasks to avoid duplicates.
   ```bash
   openstoat task ls --project <project_id> --status ready,in_progress
   ```
2. **Create tasks**: Use `task create` with `owner=agent_worker` or `owner=human_worker` and `--depends-on` for dependencies.

### Agent Worker

1. **Claim**: `openstoat task claim <id> --as agent_worker --logs-append "Claimed"`
2. **Start**: `openstoat task start <id> --as agent_worker --logs-append "Started"`
3. **Done**: `openstoat task done <id> --output "..." --handoff-summary "..." --logs-append "..."` (handoff min 200 chars)

### Agent Blocked by Human

1. Create human task: `openstoat task create --project X --owner human_worker --task-type credentials ...`
2. Self-unblock: `openstoat task self-unblock <my_task_id> --depends-on <human_task_id> --logs-append "Blocked: ..."`
3. Resume after human completes the dependency.

---

## Install Skills for AI Agents

OpenStoat provides skills for planner and worker roles. Install them so your AI agent (Cursor, Claude, etc.) can use them:

```bash
openstoat install skill
# Installs to .agent/skills and .claude/skills
```

Use `--here` to install to the current directory instead.

---

## Recommended Setup

### Agent Planner

Use **OpenClaw** as your Agent Planner — it has memory and timer features, which help with planning and decomposing work over time.

### Daemon & Worker Agent

Run `openstoat daemon init` in your project source root to create `.openstoat.json`. For the agent executable, you can use:

- **Claude Code** or **Cursor CLI** (recommended) — both offer membership plans and excel at coding
- OpenCode
- OpenClaw

### Running Multiple Agents in Parallel

If you need several agents working at once, create separate project directories. For example, if your project is `x`, create `x1`, `x2`, `x3` — each agent runs in its own environment with its own daemon config, so they work in parallel without interfering.

### Human Workflow

- Use `openstoat web` to view the Kanban board and monitor progress.
- **Tip**: Create a dedicated project (e.g. `x0`) for human tasks — your window for manually directing agents. When you finish your work, simply tell the agent in `x0` that you're done and ask it to run `openstoat task done <task_id>` for your task.

---

## Requirements

- **Node.js 22+** or **Bun**
- No account or API key required

---

## Links

- [GitHub](https://github.com/meside-ai/openstoat)
- [npm](https://www.npmjs.com/package/openstoat)

---

## License

MIT
