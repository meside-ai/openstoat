# npm Publish Failure Analysis

## Current Status

| Package | On npm? | Version |
|---------|---------|---------|
| palmlist-types | ✅ Yes | 0.2.4, 0.2.5 |
| palmlist-core | ✅ Yes | 0.2.4, 0.2.5 |
| palmlist-daemon | ✅ Yes | 0.2.4, 0.2.5 |
| palmlist-skills | ✅ Yes | 0.2.4, 0.2.5 |
| palmlist-web | ❌ No | (private) |
| **palmlist** (CLI) | ❌ No | - |

## Root Cause

**palmlist** (CLI) depends on **palmlist-web**, but palmlist-web is:
1. Marked `"private": true` — cannot be published
2. Not in the publish workflow

When the workflow tries to publish palmlist (the 5th package), it fails because:
- Either npm validates that dependencies exist on the registry (palmlist-web doesn't)
- Or the publish succeeds but would create a broken package (users couldn't `npm install palmlist`)

## Secondary Issue: workspace:* Not Converted

Published packages on npm show `"palmlist-core": "workspace:*"` instead of `"^0.2.5"`.
Bun/npm does not auto-convert workspace protocol during publish (unlike pnpm).
This may cause install issues for consumers.

## Fix

1. **Add palmlist-web to publish workflow** — remove `private: true`, publish it
2. **Publish order**: types → core → daemon → skills → **web** → cli
3. **Optional**: Add a prepublish script to convert workspace:* to actual versions (or use pnpm for publish)
