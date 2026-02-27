# npm Publish Failure Analysis

## Root Cause (Resolved)

**Version conflict**: The workflow was trying to publish versions that already existed on npm.
When pushing tag v0.2.7, package.json still had version 0.2.5. npm rejects "Cannot publish over
previously published version" (EPUBLISHCONFLICT).

## Fix Applied

1. **Set version from tag** — Before publish, extract version from git tag (e.g. v0.2.8 → 0.2.8)
   and update all package.json files. Ensures each tag publishes unique versions.

2. **Add palmlist-web to publish workflow** — palmlist (CLI) depends on it; web must be published first.

3. **Publish order**: types → core → daemon → skills → web → cli

## Current Status

| Package | On npm? |
|---------|---------|
| palmlist-types | ✅ |
| palmlist-core | ✅ |
| palmlist-daemon | ✅ |
| palmlist-skills | ✅ |
| palmlist-web | After fix |
| palmlist (CLI) | After fix |

## Secondary Issue: workspace:* Not Converted

Published packages may show `"palmlist-core": "workspace:*"` instead of semver.
Bun/npm does not auto-convert during publish (unlike pnpm). May cause install issues.
