/**
 * OpenStoat OpenClaw Plugin
 *
 * Bridges OpenClaw with OpenStoat task orchestration.
 * See PLAN.md for implementation phases.
 */

export default function register(api: {
  registerTool?: (tool: unknown) => void;
  registerCommand?: (cmd: unknown) => void;
  registerService?: (svc: unknown) => void;
  registerHook?: (event: string, handler: () => Promise<void>, opts?: unknown) => void;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  config?: Record<string, unknown>;
}) {
  api.logger?.info('openstoat-openclaw-plugin: loaded (skeleton)');

  // Phase 1: Agent Tools (Block 1)
  // Phase 2: Slash Commands (Block 2)
  // Phase 3: Skill (Block 6) - shipped in skills/
  // Phase 4: Background Service (Block 3)
  // Phase 5: Hooks (Block 4)
}
