/**
 * Agent tools for OpenStoat task orchestration.
 * Maps to openstoat task create, ls, show, claim, done, self-unblock.
 */

import type { CliConfig } from './lib/cli.js';
import { runOpenstoat, runOpenstoatJson } from './lib/cli.js';

function getConfig(api: { config?: Record<string, unknown> }): CliConfig {
  const c = api.config ?? {};
  return {
    cliPath: (c.cliPath as string) ?? 'openstoat',
    dbPath: (c.dbPath as string) ?? process.env.OPENSTOAT_DB_PATH,
  };
}

function toolResult(success: boolean, message: string, data?: unknown) {
  const payload: Record<string, unknown> = { success, message };
  if (data != null) payload.data = data;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}

export function registerTools(api: {
  registerTool?: (tool: unknown, opts?: { optional?: boolean }) => void;
  config?: Record<string, unknown>;
}) {
  const cfg = () => getConfig(api);

  api.registerTool?.({
    name: 'openstoat_show_project',
    description: 'Show project details including template_context and workflow_instructions. Call this BEFORE creating tasks to read workflow prerequisites and finish steps that must be injected into task descriptions.',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project ID' },
      },
      required: ['project'],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const project = (params.project as string) ?? (api.config?.defaultProject as string);
      if (!project) return toolResult(false, 'Missing project; set defaultProject in config or pass project');
      const { data, error } = runOpenstoatJson<unknown>(['project', 'show', project], cfg());
      if (error) return toolResult(false, error);
      return toolResult(true, 'Project details', { project: data });
    },
  });

  api.registerTool?.({
    name: 'openstoat_create_task',
    description:
      'Create a task in OpenStoat. IMPORTANT WORKFLOW — before calling this tool you MUST:\n' +
      '1. Call openstoat_list_tasks with status "ready,in_progress" to check for duplicates.\n' +
      '2. Call openstoat_show_project to read workflow_instructions from template_context.\n' +
      '3. If workflow_instructions exist, inject prerequisites into the description and finish steps into acceptance_criteria.\n' +
      'Skipping these steps creates incomplete or duplicate tasks.',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project ID' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        acceptance_criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Acceptance criteria (at least one)',
        },
        depends_on: { type: 'array', items: { type: 'string' }, description: 'Task IDs this depends on' },
        status: { type: 'string', enum: ['ready', 'in_progress', 'done'], default: 'ready' },
        owner: { type: 'string', enum: ['agent_worker', 'human_worker'], default: 'agent_worker' },
        task_type: {
          type: 'string',
          enum: ['implementation', 'testing', 'review', 'credentials', 'deploy', 'docs', 'custom'],
          default: 'implementation',
        },
      },
      required: ['project', 'title', 'description', 'acceptance_criteria'],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const project = (params.project as string) ?? (api.config?.defaultProject as string);
      if (!project) return toolResult(false, 'Missing project; set defaultProject in config or pass project');
      const ac = (params.acceptance_criteria as string[]) ?? [];
      if (ac.length === 0) return toolResult(false, 'At least one acceptance_criteria required');
      const args = [
        'task', 'create',
        '--project', project,
        '--title', String(params.title),
        '--description', String(params.description),
        ...ac.flatMap((c) => ['--acceptance-criteria', c]),
        '--status', (params.status as string) ?? 'ready',
        '--owner', (params.owner as string) ?? 'agent_worker',
        '--task-type', (params.task_type as string) ?? 'implementation',
      ];
      const deps = (params.depends_on as string[]) ?? [];
      for (const d of deps) args.push('--depends-on', d);
      const r = runOpenstoat(args, cfg());
      if (r.exitCode !== 0) return toolResult(false, r.stderr || r.stdout);
      const taskId = r.stdout.trim();
      return toolResult(true, `Created task ${taskId}`, { taskId });
    },
  });

  api.registerTool?.({
    name: 'openstoat_list_tasks',
    description: 'List tasks in OpenStoat with optional filters. MUST be called with status "ready,in_progress" before creating tasks to avoid duplicates.',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project ID' },
        status: { type: 'string', description: 'Comma-separated: ready,in_progress,done' },
        owner: { type: 'string', enum: ['agent_worker', 'human_worker'] },
      },
      required: ['project'],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const project = params.project as string;
      const args = ['task', 'ls', '--project', project, '--json'];
      if (params.status) args.push('--status', String(params.status));
      if (params.owner) args.push('--owner', String(params.owner));
      const { data, error } = runOpenstoatJson<unknown[]>(args, cfg());
      if (error) return toolResult(false, error);
      return toolResult(true, `Found ${(data ?? []).length} tasks`, { tasks: data });
    },
  });

  api.registerTool?.({
    name: 'openstoat_show_task',
    description: 'Get task details by ID.',
    parameters: {
      type: 'object',
      properties: { task_id: { type: 'string', description: 'Task ID' } },
      required: ['task_id'],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const taskId = params.task_id as string;
      const { data, error } = runOpenstoatJson<unknown>(['task', 'show', taskId], cfg());
      if (error) return toolResult(false, error);
      return toolResult(true, 'Task details', { task: data });
    },
  });

  api.registerTool?.({
    name: 'openstoat_claim_task',
    description: 'Claim a ready task. Moves ready→in_progress.',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        as: { type: 'string', enum: ['agent_worker', 'human_worker'], default: 'agent_worker' },
        logs_append: { type: 'string', description: 'Log message' },
      },
      required: ['task_id'],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const taskId = params.task_id as string;
      const args = ['task', 'claim', taskId, '--as', (params.as as string) ?? 'agent_worker'];
      if (params.logs_append) args.push('--logs-append', String(params.logs_append));
      const r = runOpenstoat(args, cfg());
      if (r.exitCode !== 0) return toolResult(false, r.stderr || r.stdout);
      return toolResult(true, `Claimed ${taskId}`);
    },
  });

  api.registerTool?.({
    name: 'openstoat_complete_task',
    description: 'Complete a task with handoff. Requires output and handoff_summary (min 200 chars).',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        output: { type: 'string', description: 'What was delivered' },
        handoff_summary: { type: 'string', description: 'Context for downstream (min 200 chars)' },
        logs_append: { type: 'string' },
        as: { type: 'string', enum: ['agent_worker', 'human_worker'], default: 'agent_worker' },
      },
      required: ['task_id', 'output', 'handoff_summary'],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const taskId = params.task_id as string;
      const args = [
        'task', 'done', taskId,
        '--output', String(params.output),
        '--handoff-summary', String(params.handoff_summary),
        '--as', (params.as as string) ?? 'agent_worker',
      ];
      if (params.logs_append) args.push('--logs-append', String(params.logs_append));
      const r = runOpenstoat(args, cfg());
      if (r.exitCode !== 0) return toolResult(false, r.stderr || r.stdout);
      return toolResult(true, `Done ${taskId}`);
    },
  });

  api.registerTool?.({
    name: 'openstoat_self_unblock',
    description: 'Rollback in_progress→ready when blocked. Must add depends_on (human task ID).',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        depends_on: { type: 'array', items: { type: 'string' }, description: 'Human task ID(s) - at least one' },
        logs_append: { type: 'string' },
      },
      required: ['task_id', 'depends_on'],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const taskId = params.task_id as string;
      const deps = params.depends_on as string[];
      if (!deps?.length) return toolResult(false, 'depends_on required (at least one human task ID)');
      const args = ['task', 'self-unblock', taskId, '--depends-on', ...deps];
      if (params.logs_append) args.push('--logs-append', String(params.logs_append));
      const r = runOpenstoat(args, cfg());
      if (r.exitCode !== 0) return toolResult(false, r.stderr || r.stdout);
      return toolResult(true, `Self-unblocked ${taskId}`);
    },
  });

  api.registerTool?.(
    {
      name: 'openstoat_cancel_task',
      description: '(Optional) Cancel a task. Not yet implemented in OpenStoat CLI.',
      parameters: {
        type: 'object',
        properties: { task_id: { type: 'string' } },
        required: ['task_id'],
      },
      async execute(_id: string, params: Record<string, unknown>) {
        return toolResult(false, `openstoat_cancel_task not implemented. Task ${params.task_id} cannot be cancelled via CLI.`);
      },
    },
    { optional: true }
  );

  api.registerTool?.(
    {
      name: 'openstoat_retry_task',
      description: '(Optional) Retry a task. Not yet implemented in OpenStoat CLI.',
      parameters: {
        type: 'object',
        properties: { task_id: { type: 'string' } },
        required: ['task_id'],
      },
      async execute(_id: string, params: Record<string, unknown>) {
        return toolResult(false, `openstoat_retry_task not implemented. Task ${params.task_id} retry not supported via CLI.`);
      },
    },
    { optional: true }
  );
}
