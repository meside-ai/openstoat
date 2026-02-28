# OpenStoat Skill — Route Development Tasks

Use this skill when OpenClaw must route development work to OpenStoat instead of executing it directly.

## What Is a Development Task?

- Modify code, add features, refactor, fix bugs
- Write tests, multi-file changes, architecture design
- Auto-generate project structure, cross-module changes

## Mandatory Workflow for Task Creation

**You MUST follow ALL steps in order. Skipping steps creates duplicate tasks.**

### Step 1: List Existing Tasks (Mandatory)

Before creating any task, call `openstoat_list_tasks` with `status: "ready,in_progress"`:

```
openstoat_list_tasks({ project: "<project_id>", status: "ready,in_progress" })
```

Compare your candidate task with existing tasks. If an equivalent unfinished task exists, **do not create** — reuse the existing task ID.

### Step 2: Create the Task

Call `openstoat_create_task` with the task title, description, and acceptance criteria. Workflow instructions (prerequisites, finish steps) from the project are **automatically injected** into the task description and acceptance criteria — no manual injection needed.

## Default Behavior

When a development task is identified:

1. Follow the Mandatory Workflow above (Steps 1-2)
2. Do not modify code directly
3. Wait for task completion
4. Let OpenStoat decide which agent executes

## Exceptions (Direct Execution Allowed)

- User explicitly says "don't use openstoat" or "do it locally"
- Pure analysis or read-only explanation
- OpenStoat unavailable or returns error (if fallback enabled in config)

## Fallback Policy

When OpenStoat fails:

- Retry according to plugin config
- If fallback enabled: prompt user before local execution
- Otherwise: report error and wait for user decision
