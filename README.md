# OpenStoat

> AI ↔ Human task queue system

A decoupled task queue that coordinates AI agents and humans. AI handles tasks that don't require human input; when humans complete their tasks, downstream AI tasks are triggered automatically.

## Overview

- **Local-first & CLI-first** — No cloud, no API keys
- **No LLM** — OpenStoat doesn't call any LLM; planning is done by external agents
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
git clone https://github.com/meside-ai/openstoat.git
cd openstoat
bun install
bun run link:global   # Build + link CLI globally
```

### Usage

```bash
openstoat init
openstoat plan add "Integrate Paddle payment
1. Add Paddle to enum
2. Provide API Key
3. Implement PaddlePaymentService
4. Code review
5. Deploy to staging"

openstoat task ls
openstoat task done <task_id>
openstoat daemon start   # Optional: auto-schedule AI tasks
```

## CLI Commands

```bash
openstoat init                    # Initialize
openstoat config show/set         # Config
openstoat plan add/ls/show/rm     # Plans
openstoat task add/ls/done/...    # Tasks
openstoat template ls/add/...     # Templates
openstoat daemon start/stop       # Daemon
openstoat handoff ls              # Handoffs
```

Run `openstoat --help` for full usage.

## Project Status

**Today is Day 1.** OpenStoat is in active development. The core MVP is implemented:

- [x] Plan parsing and task splitting
- [x] Template-based task type matching
- [x] Task state machine and dependencies
- [x] CLI commands
- [x] Daemon scheduler
- [x] Integration tests

More features and polish are coming. Contributions welcome.

## License

MIT
