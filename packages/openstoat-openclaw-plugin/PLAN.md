# OpenStoat OpenClaw Plugin — Development Plan

> **Goal**: When OpenClaw encounters "development tasks", create them in OpenStoat first; OpenStoat dispatches to other AI agents (including OpenClaw); OpenClaw can query status, receive callbacks, and fallback when needed.

This plan splits the Plugin + Skill integration into functional blocks, aligned with OpenClaw's plugin API.

---

## Architecture Overview

```
User → OpenClaw → Plugin (bridge) → OpenStoat → Other Agents → OpenStoat → Plugin → OpenClaw → User
```

- **Plugin**: Capability layer — tools, commands, services, hooks, config
- **Skill**: Decision layer — when to route to OpenStoat, fallback rules

---

## Functional Blocks

### Block 1: Agent Tools (Core)

**Purpose**: Let the Agent call OpenStoat in a structured way instead of raw CLI.

**OpenClaw API**: `api.registerTool` (see [Plugin agent tools](https://docs.openclaw.ai/plugins/agent-tools))

**Tools to implement**:

| Tool ID | Description | OpenStoat equivalent |
|---------|-------------|----------------------|
| `openstoat_create_task` | Create a task | `openstoat task create` |
| `openstoat_list_tasks` | List tasks (with filters) | `openstoat task ls` |
| `openstoat_show_task` | Get task details | `openstoat task show` |
| `openstoat_claim_task` | Claim a ready task | `openstoat task claim` |
| `openstoat_complete_task` | Complete with handoff | `openstoat task done` |
| `openstoat_self_unblock` | Rollback when blocked | `openstoat task self-unblock` |
| `openstoat_cancel_task` | (Optional) Cancel task | TBD |
| `openstoat_retry_task` | (Optional) Retry task | TBD |

**Design notes**:
- Use JSON Schema for tool parameters
- Normalize errors and return structured output
- Support both CLI mode (spawn) and future API mode via config

---

### Block 2: Slash Commands (Auto-reply)

**Purpose**: Direct, non-LLM commands for reliability and automation.

**OpenClaw API**: `api.registerCommand`

**Commands to implement**:

| Command | Description | Handler |
|---------|-------------|---------|
| `/stoat` | Create task (args: project, title, description, …) | Parse args → create task |
| `/stoat-status` | Query task status | Show task by ID |
| `/stoat-accept` | Accept/receive task result | Show handoff/output |
| `/stoat-list` | List tasks | List with filters |
| `/stoat-cancel` | Cancel task | Cancel by ID |

**Design notes**:
- `acceptsArgs: true` for commands that need parameters
- `requireAuth: true` for safety
- Return `{ text: string }` for channel display

---

### Block 3: Background Service

**Purpose**: Keep OpenClaw in sync with OpenStoat without manual queries.

**OpenClaw API**: `api.registerService`

**Responsibilities**:
- Poll OpenStoat task status (configurable interval)
- Optionally: listen for webhook / websocket (when OpenStoat supports it)
- On task completion: notify OpenClaw (e.g. via channel or internal event)
- Sync state for in-memory cache

**Design notes**:
- `start` / `stop` lifecycle
- Config: `pollInterval`, `enabled`, `webhookUrl` (future)
- Use `api.logger` for diagnostics

---

### Block 4: Hooks (Event-driven)

**Purpose**: Automate routing and event handling.

**OpenClaw API**: `api.registerHook`

**Hooks to consider**:
- `command:new` — intercept `/new` or similar, optionally forward to OpenStoat
- Custom events (if OpenClaw exposes them) for task creation, completion
- Pre/post command hooks for audit or routing

**Design notes**:
- Hooks are plugin-managed; enable/disable via plugin config
- Document hook names and when they run

---

### Block 5: Config & Manifest

**Purpose**: Make behavior configurable without code changes.

**OpenClaw API**: `openclaw.plugin.json` with `configSchema`, `uiHints`

**Config schema**:

| Key | Type | Description |
|-----|------|--------------|
| `connectionMode` | `"cli"` \| `"api"` | How to call OpenStoat |
| `cliPath` | string | Path to `openstoat` binary |
| `apiBaseUrl` | string | (Future) OpenStoat API URL |
| `apiToken` | string | (Future) API token |
| `defaultProject` | string | Default project ID |
| `defaultPriority` | string | Default priority |
| `forceDevTasksToOpenstoat` | boolean | Force all dev tasks through OpenStoat |
| `allowFallback` | boolean | Allow local execution when OpenStoat fails |
| `pollInterval` | number | Background poll interval (seconds) |
| `enableWebhook` | boolean | (Future) Enable webhook receiver |

**Manifest**:
- `id`: `openstoat-openclaw-plugin`
- `configSchema`: JSON Schema for above
- `uiHints`: Labels, placeholders, `sensitive: true` for secrets
- `skills`: `["skills/openstoat-skill"]` (Skill directory)

---

### Block 6: Skill (Decision Layer)

**Purpose**: Decide when OpenClaw must use OpenStoat.

**Location**: `skills/openstoat-skill/SKILL.md` (referenced in manifest)

**Skill content** (summary):

1. **What counts as a development task**
   - Modify code, add features, refactor, fix bugs
   - Write tests, multi-file changes, architecture design
   - Auto-generate project structure, cross-module changes

2. **Default behavior**
   - Must call `openstoat_create_task` for dev tasks
   - Do not modify code directly
   - Wait for task completion
   - Let OpenStoat decide execution agent

3. **Exceptions (direct execution allowed)**
   - User explicitly says "don't use openstoat"
   - Pure analysis / read-only explanation
   - OpenStoat unavailable or returns error (if fallback enabled)

4. **Fallback policy**
   - Retry count, local execution, user prompt, manual confirmation

---

## Implementation Order

| Phase | Blocks | Notes |
|-------|--------|-------|
| 1 | 5 (Config), 1 (Agent Tools) | Foundation: manifest + core tools |
| 2 | 2 (Slash Commands) | Reliable manual/scripted control |
| 3 | 6 (Skill) | Routing and behavior rules |
| 4 | 3 (Background Service) | Polling and sync |
| 5 | 4 (Hooks) | Event automation |

---

## OpenStoat Integration Modes

| Mode | How | When |
|------|-----|------|
| CLI | Spawn `openstoat task create ...` | Current; works everywhere |
| API | HTTP to OpenStoat API | Future; when API exists |
| Core | Import `openstoat-core` | Same process, same DB path; Bun-only |

Phase 1 uses **CLI mode** for maximum compatibility.

---

## Maturity Enhancements (Later)

- Task ID mapping (OpenClaw ↔ OpenStoat)
- Task state cache
- Retry and timeout
- Logging and tracing
- Priority control
- Batch task support
- Multi-project support
- Failure alerts

---

## References

- [OpenClaw Plugins](https://docs.openclaw.ai/plugin)
- [OpenClaw Plugin Manifest](https://docs.openclaw.ai/plugins/manifest)
- [OpenClaw Plugin API](https://open-claw.bot/docs/plugins/api)
- OpenStoat CLI: `packages/openstoat-cli`
- OpenStoat Core: `packages/openstoat-core`
