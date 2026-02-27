/**
 * Slash commands for OpenStoat.
 * Direct, non-LLM commands for reliability and automation.
 */

import type { CliConfig } from './lib/cli.js';
import { runOpenstoat, runOpenstoatJson } from './lib/cli.js';

type CommandContext = {
  config?: Record<string, unknown>;
  args?: string;
  channel?: string;
};

function getConfig(ctx: CommandContext): CliConfig {
  const c = ctx.config ?? {};
  return {
    cliPath: (c.cliPath as string) ?? 'openstoat',
    dbPath: (c.dbPath as string) ?? process.env.OPENSTOAT_DB_PATH,
  };
}

export function registerCommands(api: {
  registerCommand?: (cmd: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: CommandContext) => Promise<{ text: string }> | { text: string };
  }) => void;
  config?: Record<string, unknown>;
}) {
  const cfg = () => getConfig({ config: api.config });

  api.registerCommand?.({
    name: 'stoat',
    description: 'Create a task. Args: project title [description]. Example: /stoat my-proj "Add feature" "Implement X"',
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const args = ctx.args?.trim().split(/\s+/) ?? [];
      const defaultProject = api.config?.defaultProject as string | undefined;
      let project = defaultProject;
      let title = '';
      let description = '';

      if (args.length >= 2) {
        project = args[0];
        title = args[1];
        description = args.slice(2).join(' ') || 'No description';
      } else if (args.length === 1 && defaultProject) {
        title = args[0];
        description = 'No description';
      } else {
        return { text: 'Usage: /stoat [project] title [description]. Set defaultProject in config or pass project.' };
      }

      if (!project) return { text: 'Missing project. Set defaultProject in plugin config or pass as first arg.' };

      const cliArgs = [
        'task', 'create',
        '--project', project,
        '--title', title,
        '--description', description,
        '--acceptance-criteria', 'Task completed',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ];
      const r = runOpenstoat(cliArgs, cfg());
      if (r.exitCode !== 0) return { text: `Error: ${r.stderr || r.stdout}` };
      return { text: `Created task: ${r.stdout.trim()}` };
    },
  });

  api.registerCommand?.({
    name: 'stoat-status',
    description: 'Query task status by ID. Example: /stoat-status task_001',
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const taskId = ctx.args?.trim();
      if (!taskId) return { text: 'Usage: /stoat-status <task_id>' };
      const { data, error } = runOpenstoatJson<Record<string, unknown>>(['task', 'show', taskId], cfg());
      if (error) return { text: `Error: ${error}` };
      const t = data!;
      return { text: `Task ${t.id}: ${t.status} | ${t.owner} | ${t.title}` };
    },
  });

  api.registerCommand?.({
    name: 'stoat-accept',
    description: 'Accept/receive task result. Shows task handoff by ID. Example: /stoat-accept task_001',
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const taskId = ctx.args?.trim();
      if (!taskId) return { text: 'Usage: /stoat-accept <task_id>' };
      const { data, error } = runOpenstoatJson<Record<string, unknown>>(['task', 'show', taskId], cfg());
      if (error) return { text: `Error: ${error}` };
      const t = data!;
      return { text: `Task ${t.id} (${t.status}): ${JSON.stringify(t, null, 2)}` };
    },
  });

  api.registerCommand?.({
    name: 'stoat-list',
    description: 'List tasks. Args: project [status]. Example: /stoat-list my-proj ready,in_progress',
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const defaultProject = api.config?.defaultProject as string | undefined;
      const parts = (ctx.args?.trim() ?? '').split(/\s+/).filter(Boolean);
      const project = parts[0] ?? defaultProject;
      const status = parts[1];

      if (!project) return { text: 'Usage: /stoat-list [project] [status]. Set defaultProject or pass project.' };

      const args = ['task', 'ls', '--project', project, '--json'];
      if (status) args.push('--status', status);
      const { data, error } = runOpenstoatJson<unknown[]>(args, cfg());
      if (error) return { text: `Error: ${error}` };
      const tasks = (data ?? []) as Array<{ id: string; status: string; owner: string; title: string }>;
      if (tasks.length === 0) return { text: 'No tasks found.' };
      return { text: tasks.map((t) => `${t.id}\t${t.status}\t${t.owner}\t${t.title}`).join('\n') };
    },
  });

  api.registerCommand?.({
    name: 'stoat-cancel',
    description: 'Cancel task (not implemented in OpenStoat CLI yet). Example: /stoat-cancel task_001',
    acceptsArgs: true,
    requireAuth: true,
    handler: async (ctx) => {
      const taskId = ctx.args?.trim();
      if (!taskId) return { text: 'Usage: /stoat-cancel <task_id>' };
      return { text: `openstoat-cancel not implemented. Task ${taskId} cannot be cancelled via CLI.` };
    },
  });
}
