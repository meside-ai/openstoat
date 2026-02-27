# OpenStoat Skill — Route Development Tasks

Use this skill when OpenClaw must route development work to OpenStoat instead of executing it directly.

## What Is a Development Task?

- Modify code, add features, refactor, fix bugs
- Write tests, multi-file changes, architecture design
- Auto-generate project structure, cross-module changes

## Default Behavior

When a development task is identified:

1. Call `openstoat_create_task` (or use `/stoat` command)
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
