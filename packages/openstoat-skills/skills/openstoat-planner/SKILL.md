---
name: openstoat-planner
description: Plans and creates tasks in OpenStoat via CLI. Use when acting as Agent Planner, breaking down work into tasks, inserting tasks into OpenStoat Kanban, or when the user asks to plan tasks for OpenStoat.
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

### 4. Project Context

Ensure the project exists. List projects: `openstoat project ls`. Use the project `id` as `--project` when creating tasks.

---

## What NOT to Do

- **Do not create** without listing `ready,in_progress` tasks first
- **Do not create** a duplicate when an equivalent unfinished task exists
- **Do not omit** any required field
- **Do not use** invalid statuses: `todo`, `ai_ready`, `waiting_human`, `blocked`, `review`, `human_done` — only `ready`, `in_progress`, `done` are valid
- **Do not create** tasks for execution — that is the Worker's job; Planner only inserts

---

## Quick Reference

| Action | Command |
|--------|---------|
| List projects | `openstoat project ls` |
| List unfinished tasks | `openstoat task ls --project X --status ready,in_progress` |
| Create task | `openstoat task create --project X --title "..." --description "..." --acceptance-criteria "..." --status ready --owner agent_worker --task-type implementation` |
| Create with deps | Add `--depends-on task_001 --depends-on task_002` |
