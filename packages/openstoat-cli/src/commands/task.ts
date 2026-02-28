/**
 * Task commands: ls, create, claim, start, done, self-unblock, show
 */

import type { Argv } from 'yargs';
import {
  createTask,
  getTask,
  listTasks,
  claimTask,
  startTask,
  completeTask,
  selfUnblockTask,
  cancelTask,
} from 'openstoat-core';
import type { TaskStatus } from 'openstoat-types';

export const taskCommands = {
  command: 'task <action>',
  describe:
    'Manage tasks. Planner: ls before create, then create. Worker: claim → start → done. Self-unblock when blocked by human.',
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: 'ls',
        describe:
          'List tasks. PLANNER: run before create to avoid duplicates. Use --status ready,in_progress for unfinished.',
        builder: (y: Argv) =>
          y
            .option('project', {
              type: 'string',
              demandOption: true,
              describe: 'Project ID (from project ls)',
            })
            .option('status', {
              type: 'string',
              describe: 'Filter by status (comma-separated: ready,in_progress,done,cancelled)',
            })
            .option('owner', {
              type: 'string',
              describe: 'Filter by owner (agent_worker or human_worker)',
            })
            .option('json', {
              type: 'boolean',
              default: false,
              describe: 'Output as JSON',
            }),
        handler: (argv: Record<string, unknown>) => {
          const statusStr = argv.status as string | undefined;
          const statuses: TaskStatus[] | undefined = statusStr
            ? (statusStr.split(',').map((s) => s.trim()) as TaskStatus[])
            : undefined;

          const tasks = listTasks(argv.project as string, {
            status: statuses,
            owner: argv.owner as string | undefined,
          });

          if (argv.json) {
            console.log(JSON.stringify(tasks, null, 2));
          } else {
            if (tasks.length === 0) {
              console.log('No tasks found.');
              return;
            }
            for (const t of tasks) {
              console.log(`${t.id}\t${t.status}\t${t.owner}\t${t.title}`);
            }
          }
        },
      })
      .command({
        command: 'create',
        describe:
          'Create a task. All required: --project, --title, --description, --acceptance-criteria (×N), --status, --owner, --task-type. Use --depends-on for dependencies.',
        builder: (y: Argv) =>
          y
            .option('project', { type: 'string', demandOption: true })
            .option('title', { type: 'string', demandOption: true })
            .option('description', { type: 'string', demandOption: true })
            .option('acceptance-criteria', {
              type: 'array',
              demandOption: true,
              describe: 'Pass multiple times: --acceptance-criteria "A" --acceptance-criteria "B"',
            })
            .option('depends-on', {
              type: 'array',
              default: [],
              describe: 'Task IDs this task depends on; omit when no dependencies',
            })
            .option('status', {
              type: 'string',
              demandOption: true,
              choices: ['ready', 'in_progress', 'done', 'cancelled'],
            })
            .option('owner', {
              type: 'string',
              demandOption: true,
              choices: ['agent_worker', 'human_worker'],
            })
            .option('task-type', {
              type: 'string',
              demandOption: true,
              choices: ['implementation', 'testing', 'review', 'credentials', 'deploy', 'docs', 'custom'],
              describe:
                'implementation|testing|review|credentials|deploy|docs|custom. credentials/review/deploy often human_worker.',
            })
            .option('created-by', { type: 'string', describe: 'Creator role (e.g. agent_planner)' }),
        handler: (argv: Record<string, unknown>) => {
          const task = createTask({
            project: argv.project as string,
            title: argv.title as string,
            description: argv.description as string,
            acceptance_criteria: (argv['acceptance-criteria'] as string[]) || [],
            depends_on: (argv['depends-on'] as string[]) || [],
            status: argv.status as TaskStatus,
            owner: argv.owner as 'agent_worker' | 'human_worker',
            task_type: argv['task-type'] as any,
            created_by: argv['created-by'] as string | undefined,
          });
          console.log(task.id);
        },
      })
      .command({
        command: 'claim <task_id>',
        describe: 'WORKER: claim ready task. Moves ready→in_progress. Use --logs-append for audit.',
        builder: (y: Argv) =>
          y
            .positional('task_id', { type: 'string', demandOption: true })
            .option('as', {
              type: 'string',
              demandOption: true,
              choices: ['agent_worker', 'human_worker'],
            })
            .option('logs-append', { type: 'string', describe: 'Append to task logs (required for agents)' }),
        handler: (argv: Record<string, unknown>) => {
          const task = claimTask(
            argv.task_id as string,
            argv.as as 'agent_worker' | 'human_worker',
            argv['logs-append'] as string | undefined
          );
          console.log(`Claimed ${task.id}`);
        },
      })
      .command({
        command: 'start <task_id>',
        describe: 'WORKER: start/continue task. Use --logs-append to record progress.',
        builder: (y: Argv) =>
          y
            .positional('task_id', { type: 'string', demandOption: true })
            .option('as', {
              type: 'string',
              demandOption: true,
              choices: ['agent_worker', 'human_worker'],
            })
            .option('logs-append', { type: 'string' }),
        handler: (argv: Record<string, unknown>) => {
          const task = startTask(
            argv.task_id as string,
            argv.as as 'agent_worker' | 'human_worker',
            argv['logs-append'] as string | undefined
          );
          console.log(`Started ${task.id}`);
        },
      })
      .command({
        command: 'done <task_id>',
        describe: 'WORKER: complete task. Handoff mandatory (min 200 chars). Transfers context to downstream.',
        builder: (y: Argv) =>
          y
            .positional('task_id', { type: 'string', demandOption: true })
            .option('output', { type: 'string', demandOption: true, describe: 'What was delivered' })
            .option('handoff-summary', {
              type: 'string',
              demandOption: true,
              describe: 'Context for downstream tasks. Min 200 chars. No credentials in body.',
            })
            .option('logs-append', { type: 'string' })
            .option('as', {
              type: 'string',
              demandOption: true,
              choices: ['agent_worker', 'human_worker'],
            }),
        handler: (argv: Record<string, unknown>) => {
          const task = completeTask(
            argv.task_id as string,
            {
              output: argv.output as string,
              handoff_summary: argv['handoff-summary'] as string,
              logs_append: argv['logs-append'] as string | undefined,
            },
            argv.as as 'agent_worker' | 'human_worker'
          );
          console.log(`Done ${task.id}`);
        },
      })
      .command({
        command: 'self-unblock <task_id>',
        describe:
          'WORKER: rollback in_progress→ready when blocked. Must add --depends-on (human task). Create human task first.',
        builder: (y: Argv) =>
          y
            .positional('task_id', { type: 'string', demandOption: true })
            .option('depends-on', {
              type: 'array',
              demandOption: true,
              describe: 'New human task ID(s) - at least one required',
            })
            .option('logs-append', { type: 'string' })
            .option('as', {
              type: 'string',
              default: 'agent_worker',
              choices: ['agent_worker'],
            }),
        handler: (argv: Record<string, unknown>) => {
          const deps = argv['depends-on'] as string[];
          const task = selfUnblockTask(
            argv.task_id as string,
            {
              depends_on: deps,
              logs_append: argv['logs-append'] as string | undefined,
            },
            'agent_worker'
          );
          console.log(`Self-unblocked ${task.id}`);
        },
      })
      .command({
        command: 'show <task_id>',
        describe: 'Show task details. Use --json for machine-readable. Read handoff from dependent tasks.',
        builder: (y: Argv) =>
          y
            .positional('task_id', { type: 'string', demandOption: true })
            .option('json', { type: 'boolean', default: false }),
        handler: (argv: Record<string, unknown>) => {
          const task = getTask(argv.task_id as string);
          if (!task) {
            console.error(`Task '${argv.task_id}' not found.`);
            process.exit(1);
          }
          console.log(argv.json ? JSON.stringify(task, null, 2) : formatTask(task));
        },
      })
      .command({
        command: 'cancel <task_id>',
        describe: 'Cancel a task. Moves to cancelled status. Task is excluded from active workflow.',
        builder: (y: Argv) =>
          y
            .positional('task_id', { type: 'string', demandOption: true })
            .option('logs-append', { type: 'string', describe: 'Reason for cancellation' }),
        handler: (argv: Record<string, unknown>) => {
          const task = cancelTask(
            argv.task_id as string,
            argv['logs-append'] as string | undefined
          );
          if (!task) {
            console.error(`Task '${argv.task_id}' not found.`);
            process.exit(1);
          }
          console.log(`Cancelled ${task.id}`);
        },
      })
      .demandCommand(1, 'Specify ls, create, claim, start, done, self-unblock, show, or cancel'),
  handler: () => {},
};

function formatTask(t: { id: string; title: string; status: string; owner: string; logs: string[] }): string {
  let out = `ID: ${t.id}\nTitle: ${t.title}\nStatus: ${t.status}\nOwner: ${t.owner}\n`;
  if (t.logs.length > 0) {
    out += 'Logs:\n';
    for (const log of t.logs) out += `  - ${log}\n`;
  }
  return out;
}
