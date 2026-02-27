---
title: Palmlist Refactor
---

# Palmlist Refactor

**Status:** In progress. All previous packages have been deprecated and removed.

## What Was Removed

The following packages were deleted as part of this refactor:

- `palmlist-cli` — CLI interface
- `palmlist-core` — Core logic (db, plan, task, template, handoff)
- `palmlist-daemon` — Daemon scheduler
- `palmlist-types` — Shared TypeScript types
- `palmlist-web` — Web UI server

## Why

The old design is being deprecated. A new design will be developed from scratch on this branch.

## Next Steps

- Design the new architecture
- Implement new packages as needed
- Preserve useful concepts from the old design where appropriate
