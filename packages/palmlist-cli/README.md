# Palmlist

> AI ↔ Human task queue — orchestrate work between AI agents and humans with a local-first CLI.

[![npm version](https://img.shields.io/npm/v/palmlist.svg)](https://www.npmjs.com/package/palmlist)

---

## Who should read what

**This README is written for humans.** If you're a human and want to quickly understand what Palmlist is and how to use it, read this.

**`palmlist --help` is written for AI agents.** If you're an AI agent, use `palmlist --help` (and `palmlist manual`) for the full operational guide — task commands, workflows, and rules.

---

## What is Palmlist?

Palmlist is a **decoupled task queue** that coordinates AI agents and humans. AI handles tasks that don't require human input; when humans complete their tasks, downstream AI tasks are triggered automatically. No cloud, no API keys, no built-in LLM — just a local SQLite store and a CLI.

- **Local-first**: All data in `~/.palmlist/` (SQLite)
- **1 human + N agents**: Humans are the bottleneck; AI fills idle time
- **Transparent**: Clear task states, dependencies, and handoffs

---

## Install

```bash
npm install -g palmlist
```

---

## 1. Initialize a project

**How:**

```bash
palmlist project init --id my_project --name "My Project" --template checkout-default-v1
```

**Why:** Every task belongs to a project. You must create a project before agents can create or work on tasks. The project ID (`my_project`) is used in all task commands.

---

## 2. Install skills in your OpenClaw project

**How:** In your OpenClaw project directory (where you run OpenClaw as Agent Planner):

```bash
palmlist install skill --here
```

This installs planner and worker skills to the current directory (`./palmlist-planner`, `./palmlist-worker`).

**Why:** OpenClaw (or other agents) need these skills to know how to use Palmlist — creating tasks, claiming, executing, handing off. Without them, the agent won't know the CLI workflow. Use OpenClaw as your Agent Planner because it has memory and timer features that help with planning over time.

---

## 3. Start the daemon

**How:**

```bash
palmlist daemon init   # First time: interactively create .palmlist.json
palmlist daemon start  # Start the daemon
```

Run these from your **project source root** (where your code lives and where `.palmlist.json` will be created).

**What it does:** The daemon polls for `ready` tasks owned by `agent_worker`. When it finds one, it invokes your configured agent (e.g. Cursor CLI, Claude Code) with the task prompt. The agent then claims the task, implements it, and marks it done. One task per poll; the daemon keeps running.

**Why:** So your coding agents can pick up work automatically without you manually triggering them. Configure the agent path in `.palmlist.json` — recommend Claude Code or Cursor CLI for coding tasks.

---

## 4. Start the Web UI

**How:**

```bash
palmlist web
# Opens http://localhost:18008
```

**Why:** To view the Kanban board and monitor task progress.

**Recommendation:** For interacting with Palmlist (e.g. marking your human tasks done), use an **agent in project x0** instead of the web UI. Create a dedicated project `x0` for human tasks. When you finish your work, tell the agent in x0 that you're done and ask it to run `palmlist task done <task_id>` for your task. The agent handles the CLI; you just talk to it.

---

## Requirements

- **Node.js 22+** or **Bun**
- No account or API key required

---

## Links

- [GitHub](https://github.com/meside-ai/palmlist)
- [npm](https://www.npmjs.com/package/palmlist)

---

## License

MIT
