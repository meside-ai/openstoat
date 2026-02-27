/**
 * Event-driven hooks for OpenStoat routing.
 * Enables optional forwarding of /new or similar to OpenStoat.
 */

export function registerHooks(api: {
  registerHook?: (event: string, handler: () => Promise<void>, opts?: { name?: string; description?: string }) => void;
  config?: Record<string, unknown>;
  logger?: { info: (msg: string) => void };
}) {
  const forceDev = (api.config?.forceDevTasksToOpenstoat as boolean) ?? true;
  if (!forceDev) {
    api.logger?.info('openstoat-openclaw-plugin: forceDevTasksToOpenstoat disabled; hooks not registered');
    return;
  }

  api.registerHook?.(
    'command:new',
    async () => {
      api.logger?.info('openstoat-openclaw-plugin: command:new triggered');

      // Note: OpenClaw may not expose full context to pre-command hooks.
      // This hook logs the event; actual routing logic lives in the Skill.
      // When OpenStoat supports webhooks, we could forward creation here.
    },
    {
      name: 'openstoat-openclaw-plugin.command-new',
      description: 'Runs when /new is invoked; logs for audit/routing',
    }
  );
}
