# OpenStoat Refactor

**Status:** In progress. All previous packages have been deprecated and removed.

## What Was Removed

The following packages were deleted as part of this refactor:

- `openstoat-cli` — CLI interface
- `openstoat-core` — Core logic (db, plan, task, template, handoff)
- `openstoat-daemon` — Daemon scheduler
- `openstoat-types` — Shared TypeScript types
- `openstoat-web` — Web UI server

## Why

The old design is being deprecated. A new design will be developed from scratch on this branch.

## Next Steps

- Design the new architecture
- Implement new packages as needed
- Preserve useful concepts from the old design where appropriate
