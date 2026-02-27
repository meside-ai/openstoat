# npm Publish Analysis

## Single-Package Publish (Current)

Palmlist is published as a **single package** `palmlist` on npm. All internal packages
(palmlist-types, palmlist-core, palmlist-daemon, palmlist-skills, palmlist-web) are
bundled into the CLI via esbuild. Users install only `palmlist`.

### Build Process

1. Build types → core → daemon → web (tsc)
2. Bundle CLI with esbuild (includes all palmlist-* code)
3. Copy palmlist-skills/skills to package/skills
4. Publish packages/palmlist-cli as `palmlist`

### Publish Workflow

- Trigger: git tag push `v*`
- Sets version from tag on palmlist-cli
- Publishes only `palmlist` to npm

### Requirements

- **Bun**: The CLI uses `bun:sqlite`; bin runs with `#!/usr/bin/env bun`
- **npm naming**: Unscoped `palmlist` may be rejected as similar to `yallist`. If so, contact
  npm support (naming dispute) to request an exception.
