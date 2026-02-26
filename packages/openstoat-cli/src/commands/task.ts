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

const TASK_EPILOG = `
Task is the smallest work unit. Each task has an owner (ai or human) and a status.
Completing a task triggers downstream dependent tasks to become ai_ready.

## Executor Agent Workflow (daemon invokes you to work on a task)

  1. Get task details and upstream context:
     openstoat task show <task_id>
     openstoat handoff ls --task <task_id>

  2. Execute the task.

  3. Mark complete (triggers downstream, daemon handles the rest):
     openstoat task done <task_id>

  If blocked, escalate to human:
     openstoat task need-human <task_id> --reason "explain what you need"

  If review was rejected, add a fix sub-task:
     openstoat task add --plan <plan_id> --title "Fix review comments" --owner ai
     openstoat task depend <new_task_id> --on <original_task_id>

## Subcommands

  add              Add task; requires --plan, --title, --owner (ai|human)
  ls               List tasks; filters: --status, --owner, --plan; use --json for parsing
  show <task_id>   Show task details (title, owner, status, dependencies, description)
  done <task_id>   Mark done and trigger downstream tasks
  update <task_id> Update status manually; requires --status
  need-human <id>  Escalate to human; optional --reason
  depend <id>      Add dependency; requires --on <dep_task_id>

## Status Flow

  pending         → ai_ready (when all dependencies are done AND owner=ai)
  ai_ready        → in_progress (you start working)
  in_progress     → done (complete) or waiting_human (need human input)
  waiting_human   → human_done (human completed their part)
  human_done      → done (confirmed complete)

## Key Flags

  --json           Output JSON (use this when you need to parse output)
  --status <s>     Filter by status (ls) or set status (update)
  --owner ai|human Filter by owner (ls) or set owner (add)
  --plan <id>      Filter by plan (ls) or assign to plan (add)
`;

export const taskCmd = {
  command: 'task <action> [taskId..]',
  describe: 'Your main interface: find ai_ready work, execute, mark done, escalate to human',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['add', 'ls', 'show', 'done', 'update', 'need-human', 'depend'],
        describe: 'add/ls/show/done/update/need-human/depend',
      })
      .option('plan', { type: 'string', describe: 'Plan ID; required for add; filter for ls' })
      .option('title', { type: 'string', describe: 'Task title; required for add' })
      .option('owner', { type: 'string', choices: ['ai', 'human'], describe: 'Task owner; required for add; filter for ls' })
      .option('status', { type: 'string', describe: 'Task status; required for update; filter for ls' })
      .option('reason', { type: 'string', describe: 'Optional for need-human; why human is needed' })
      .option('on', { type: 'string', describe: 'Required for depend; ID of task to depend on' })
      .option('json', { type: 'boolean', describe: 'Output JSON for ls' })
      .example('$0 task ls', 'List all tasks')
      .example('$0 task ls --status ai_ready', 'List executable AI tasks')
      .example('$0 task ls --json', 'JSON output')
      .example('$0 task done task_xxx', 'Complete task, trigger downstream')
      .example('$0 task add --plan plan_xxx --title "Implement feature" --owner ai', 'Manually add task')
      .example('$0 task need-human task_xxx --reason "needs code review"', 'Escalate to human')
      .example('$0 task depend task_a --on task_b', 'task_a depends on task_b')
      .epilog(TASK_EPILOG),
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
