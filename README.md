# Palmlist

> AI ↔ Human task queue system

A decoupled task queue that coordinates AI agents and humans. AI handles tasks that don't require human input; when humans complete their tasks, downstream AI tasks are triggered automatically.

## Overview

- **Local-first & CLI-first** — No cloud, no API keys
- **No LLM** — Palmlist doesn't call any LLM; planning is done by external agents
- **1 human + N AI agents** — Humans are the bottleneck; AI fills all idle time
- **Transparent** — Clear task states and ownership

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Plan** | A project goal with multiple tasks |
| **Task** | Smallest unit of work, owned by AI or Human |
| **Template** | Workflow template defining which task types need human input |
| **Handoff** | Context passed between tasks when one completes |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (Node.js 22+ also works)

### Install

```bash
git clone https://github.com/meside-ai/palmlist.git
cd palmlist
bun install
bun run link:global   # Build + link CLI globally
```

### Usage

```bash
palmlist init
palmlist plan add "Integrate Paddle payment
1. Add Paddle to enum
2. Provide API Key
3. Implement PaddlePaymentService
4. Code review
5. Deploy to staging"

palmlist task ls
palmlist task done <task_id>
palmlist daemon start   # Optional: auto-schedule AI tasks
```

## CLI Commands

```bash
palmlist init                    # Initialize
palmlist config show/set         # Config
palmlist plan add/ls/show/rm     # Plans
palmlist task add/ls/done/...    # Tasks
palmlist template ls/add/...     # Templates
palmlist daemon start/stop       # Daemon
palmlist handoff ls              # Handoffs
```

Run `palmlist --help` for full usage.

## Docs Deployment (Cloudflare Pages)

The docs site (`packages/palmlist-docs`) deploys to Cloudflare Pages on push to `main`. Setup:

1. Create a [Cloudflare Pages project](https://dash.cloudflare.com/?to=/:account/pages) named `palmlist-docs`
2. Add GitHub secrets: `CLOUDFLARE_API_TOKEN` (Pages Edit permission), `CLOUDFLARE_ACCOUNT_ID`
3. Push to `main` or trigger the "Deploy Docs to Cloudflare Pages" workflow manually

## Project Status

**Today is Day 1.** Palmlist is in active development. The core MVP is implemented:

- [x] Plan parsing and task splitting
- [x] Template-based task type matching
- [x] Task state machine and dependencies
- [x] CLI commands
- [x] Daemon scheduler
- [x] Integration tests

More features and polish are coming. Contributions welcome.

## Local test

```
bun install
bun run packages/palmlist-cli/src/index.ts --help
bun run packages/palmlist-cli/src/index.ts init
bun run packages/palmlist-cli/src/index.ts task ls
```

## License

MIT
