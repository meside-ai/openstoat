# OpenStoat Skill — Route Development Tasks

Use this skill when OpenClaw must route development work to OpenStoat instead of executing it directly.

## What Is a Development Task?

- Modify code, add features, refactor, fix bugs
- Write tests, multi-file changes, architecture design
- Auto-generate project structure, cross-module changes

## Mandatory Workflow for Task Creation

**You MUST follow ALL steps in order. Skipping steps creates duplicate or incomplete tasks.**

### Step 1: List Existing Tasks (Mandatory)

Before creating any task, call `openstoat_list_tasks` with `status: "ready,in_progress"`:

```
openstoat_list_tasks({ project: "<project_id>", status: "ready,in_progress" })
```

Compare your candidate task with existing tasks. If an equivalent unfinished task exists, **do not create** — reuse the existing task ID.

### Step 2: Read Project Workflow (Mandatory)

Call `openstoat_show_project` to fetch `template_context.workflow_instructions`:

```
openstoat_show_project({ project: "<project_id>" })
```

If `workflow_instructions` exists, treat it as a super prompt for writing task descriptions and acceptance criteria.

### Step 3: Inject Workflow into Task (Mandatory when workflow_instructions exist)

When `workflow_instructions` contains:
- **Prerequisites** (e.g. verify base branch, create git worktree, create branch) → inject into the task **description** as prerequisite steps
- **Finish steps** (e.g. run tests locally, push branch, create PR, add reviewers) → inject into the task **acceptance_criteria** as completion requirements

### Step 4: Create the Task

Only after completing Steps 1-3, call `openstoat_create_task` with the enriched description and acceptance criteria.

## Default Behavior

When a development task is identified:

1. Follow the Mandatory Workflow above (Steps 1-4)
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
