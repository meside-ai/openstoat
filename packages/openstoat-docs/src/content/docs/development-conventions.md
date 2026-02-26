---
title: OpenStoat Development Conventions
---

# OpenStoat Development Conventions

Development customs and conventions for this project.

## Documentation & Comments

- **All documentation and code comments MUST be written in English.**

:::tip
Use `:::tip`, `:::note`, `:::warning`, `:::danger`, or `:::info` in markdown for GitBook-style callout blocks.
:::
- This is an open-source project; English ensures accessibility for international contributors.
- User-facing help text (CLI epilog, examples) should also be in English.

## Language for Communication

- When answering questions or discussing the project with the maintainer, responses may be in Chinese (Simplified) if preferred.

## Technical Stack

- **Runtime:** Node.js 22+
- **Language:** TypeScript
- **Package manager:** Bun (workspace)
- **Storage:** SQLite (native)

## Project Structure

- Monorepo with packages under `packages/`
- CLI-first, local-first architecture
- No LLM inside OpenStoat; external agents provide intelligence

## Code Style

- Use TypeScript strict mode
- Prefer explicit types over inference for public APIs
- Keep CLI help text comprehensive—"CLI is the manual" for agents
