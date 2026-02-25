import type { ArgumentsCamelCase } from 'yargs';
import {
  createTask,
  listTasks,
  getTask,
  updateTaskStatus,
  markTaskDone,
  needHuman,
  addTaskDependency,
} from '@openstoat/core';
import type { TaskStatus, TaskOwner } from '@openstoat/types';

export const taskCmd = {
  command: 'task <action> [taskId..]',
  describe: 'Task management',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['add', 'ls', 'show', 'done', 'update', 'need-human', 'depend'],
      })
      .option('plan', { type: 'string', describe: 'Plan ID' })
      .option('title', { type: 'string', describe: 'Task title' })
      .option('owner', { type: 'string', choices: ['ai', 'human'], describe: 'Owner' })
      .option('status', { type: 'string', describe: 'Task status' })
      .option('reason', { type: 'string', describe: 'Reason for needing human' })
      .option('on', { type: 'string', describe: 'Dependency task ID' })
      .option('json', { type: 'boolean', describe: 'JSON output' }),
  handler: (argv: ArgumentsCamelCase<{
    action: string;
    taskId?: string[];
    plan?: string;
    title?: string;
    owner?: string;
    status?: string;
    reason?: string;
    on?: string;
    json?: boolean;
  }>) => {
    const ids = argv.taskId ?? [];
    const taskId = ids[0];

    const filters: { status?: TaskStatus; owner?: TaskOwner; planId?: string } = {};
    if (argv.status) filters.status = argv.status as TaskStatus;
    if (argv.owner) filters.owner = argv.owner as TaskOwner;
    if (argv.plan) filters.planId = argv.plan;

    switch (argv.action) {
      case 'add': {
        if (!argv.plan || !argv.title || !argv.owner) {
          console.error('task add requires --plan, --title, --owner');
          process.exit(1);
        }
        const task = createTask({
          planId: argv.plan,
          title: argv.title,
          owner: argv.owner as TaskOwner,
        });
        console.log(`Task created: ${task.id}`);
        break;
      }
      case 'ls': {
        const tasks = listTasks(filters);
        if (argv.json) {
          console.log(JSON.stringify(tasks, null, 2));
          return;
        }
        if (tasks.length === 0) {
          console.log('No tasks');
          return;
        }
        for (const t of tasks) {
          console.log(`${t.id}\t${t.title}\t${t.owner}\t${t.status}`);
        }
        break;
      }
      case 'show': {
        if (!taskId) {
          console.error('Please provide task_id');
          process.exit(1);
        }
        const task = getTask(taskId);
        if (!task) {
          console.error(`Task not found: ${taskId}`);
          process.exit(1);
        }
        console.log(`Task: ${task.title}`);
        console.log(`ID: ${task.id}`);
        console.log(`Plan: ${task.plan_id}`);
        console.log(`Owner: ${task.owner}`);
        console.log(`Status: ${task.status}`);
        console.log(`Depends on: ${task.depends_on.join(', ') || 'none'}`);
        console.log(`Description: ${task.description ?? '-'}`);
        break;
      }
      case 'done': {
        if (!taskId) {
          console.error('Please provide task_id');
          process.exit(1);
        }
        const ok = markTaskDone(taskId);
        if (!ok) {
          console.error(`Task not found: ${taskId}`);
          process.exit(1);
        }
        console.log(`Task done: ${taskId}`);
        break;
      }
      case 'update': {
        if (!taskId || !argv.status) {
          console.error('task update requires task_id and --status');
          process.exit(1);
        }
        const ok = updateTaskStatus(taskId, argv.status as TaskStatus);
        if (!ok) {
          console.error(`Task not found: ${taskId}`);
          process.exit(1);
        }
        console.log(`Task status updated: ${taskId} -> ${argv.status}`);
        break;
      }
      case 'need-human': {
        if (!taskId) {
          console.error('Please provide task_id');
          process.exit(1);
        }
        const ok = needHuman(taskId, argv.reason);
        if (!ok) {
          console.error(`Task not found: ${taskId}`);
          process.exit(1);
        }
        console.log(`Task escalated to human: ${taskId}`);
        if (argv.reason) console.log(`Reason: ${argv.reason}`);
        break;
      }
      case 'depend': {
        if (!taskId || !argv.on) {
          console.error('task depend requires task_id and --on <dep_task_id>');
          process.exit(1);
        }
        const ok = addTaskDependency(taskId, argv.on);
        if (!ok) {
          console.error(`Failed to add dependency`);
          process.exit(1);
        }
        console.log(`Dependency added: ${taskId} depends on ${argv.on}`);
        break;
      }
      default:
        console.error('Unknown action');
        process.exit(1);
    }
  },
};
