# @openstoat/openclaw-plugin

OpenClaw plugin for OpenStoat task orchestration. Routes development tasks from OpenClaw to OpenStoat, which can dispatch to other AI agents.

## Install

```bash
openclaw plugins install @openstoat/openclaw-plugin
```

Or from local path (development):

```bash
openclaw plugins install -l ./packages/openstoat-openclaw-plugin
```

## Configuration

Configure under `plugins.entries.openstoat-openclaw-plugin.config`:

- `connectionMode`: `"cli"` (default) or `"api"`
- `cliPath`: Path to `openstoat` binary
- `defaultProject`: Default project ID for new tasks
- `forceDevTasksToOpenstoat`: Force dev tasks through OpenStoat
- `allowFallback`: Allow local execution when OpenStoat fails
- `pollInterval`: Background poll interval (seconds; 0 to disable)

## Development Plan

See [PLAN.md](./PLAN.md) for functional blocks and implementation phases.
