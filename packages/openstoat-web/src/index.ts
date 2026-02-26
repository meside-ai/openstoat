#!/usr/bin/env bun
/**
 * OpenStoat Web UI - Start the web server to view plans, tasks, templates, handoffs, and config.
 */

export { startServer } from './server';

import { startServer } from './server';

// Only run when executed directly (e.g. bun run src/index.ts), not when imported by CLI
if (import.meta.main) {
  const port = process.argv.includes('--port')
    ? parseInt(process.argv[process.argv.indexOf('--port') + 1], 10)
    : undefined;
  startServer({ port });
}
