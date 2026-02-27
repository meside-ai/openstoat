/**
 * OpenStoat OpenClaw Plugin
 *
 * Bridges OpenClaw with OpenStoat task orchestration.
 * See PLAN.md for implementation phases.
 */

import { registerTools } from './tools.js';
import { registerCommands } from './commands.js';
import { registerService } from './service.js';
import { registerHooks } from './hooks.js';

export default function register(api: {
  registerTool?: (tool: unknown, opts?: { optional?: boolean }) => void;
  registerCommand?: (cmd: unknown) => void;
  registerService?: (svc: unknown) => void;
  registerHook?: (event: string, handler: () => Promise<void>, opts?: unknown) => void;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  config?: Record<string, unknown>;
}) {
  api.logger?.info('openstoat-openclaw-plugin: loaded');

  // Block 1: Agent Tools
  registerTools(api);

  // Block 2: Slash Commands
  registerCommands(api);

  // Block 3: Skill (Block 6) - shipped in skills/openstoat-skill/SKILL.md

  // Block 4: Background Service
  registerService(api);

  // Block 5: Hooks
  registerHooks(api);
}
