/**
 * Background service for OpenStoat task sync.
 * Polls task status at configurable interval; logs completion events.
 */

import type { CliConfig } from './lib/cli.js';
import { runOpenstoatJson } from './lib/cli.js';

export interface ServiceConfig {
  pollInterval?: number;
  defaultProject?: string;
  cliPath?: string;
  dbPath?: string;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
const seenDone = new Set<string>();

function getCliConfig(cfg: ServiceConfig): CliConfig {
  return {
    cliPath: cfg.cliPath ?? 'openstoat',
    dbPath: cfg.dbPath ?? process.env.OPENSTOAT_DB_PATH,
  };
}

export function registerService(api: {
  registerService?: (svc: { id: string; start: () => void; stop: () => void }) => void;
  config?: Record<string, unknown>;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}) {
  api.registerService?.({
    id: 'openstoat-sync',
    start: () => {
      const c = (api.config ?? {}) as unknown as ServiceConfig;
      const interval = c.pollInterval ?? 30;
      if (interval <= 0) {
        api.logger?.info('openstoat-openclaw-plugin: background service disabled (pollInterval <= 0)');
        return;
      }
      const project = c.defaultProject;
      if (!project) {
        api.logger?.warn('openstoat-openclaw-plugin: background service needs defaultProject; skipping poll');
        return;
      }
      api.logger?.info(`openstoat-openclaw-plugin: background service started (poll every ${interval}s)`);
      pollTimer = setInterval(() => {
        const { data } = runOpenstoatJson<Array<{ id: string; status: string }>>(
          ['task', 'ls', '--project', project, '--status', 'done', '--json'],
          getCliConfig(c)
        );
        if (data) {
          for (const t of data) {
            if (t.status === 'done' && !seenDone.has(t.id)) {
              seenDone.add(t.id);
              api.logger?.info(`openstoat-openclaw-plugin: task ${t.id} completed`);
            }
          }
        }
      }, interval * 1000);
    },
    stop: () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      api.logger?.info('openstoat-openclaw-plugin: background service stopped');
    },
  });
}
