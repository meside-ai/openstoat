import type { ArgumentsCamelCase } from 'yargs';
import {
  createPlan,
  listPlans,
  getPlan,
  deletePlan,
  listTasks,
  splitPlanToTasks,
  getDefaultTemplate,
} from '@openstoat/core';

const PLAN_EPILOG = `
Plan is a project goal container with multiple Tasks. plan add parses text into tasks and
assigns owner (ai/human) via the default template.

## Subcommands

add <content>    Create plan and parse tasks
                 First line = title; supports:
                 - Numbered: 1. Task one  2. Task two
                 - Bullets: - Task one  * Task two
                 Template matches keywords (review, deploy, API Key) to identify human tasks

ls               List all plans (id, title, status)

show <plan_id>   Show plan details and tasks

rm <plan_id>     Delete plan (and all its tasks)

status <plan_id> Show plan progress (done/total)

## Plan format example

  Integrate Paddle payment
  1. Add Paddle to enum
  2. Provide Paddle API Key
  3. Implement PaddlePaymentService
  4. Code review
  5. Deploy to staging

  Steps 2, 4, 5 match keywords → human tasks; others → ai tasks.
`;

export const planCmd = {
  command: 'plan <action> [idOrContent..]',
  describe: 'Plan management: create, list, view, delete plans; add parses content and assigns AI/human',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['add', 'ls', 'show', 'rm', 'status'],
        describe: 'add/ls/show/rm/status',
      })
      .positional('idOrContent', { type: 'string', describe: 'plan_id or full text content for plan add' })
      .example('$0 plan add "Integrate payment\\n1. Add enum\\n2. Provide API Key\\n3. Implement service"', 'Create plan with 3 tasks')
      .example('$0 plan ls', 'List all plans')
      .example('$0 plan show plan_xxx', 'Show plan details')
      .example('$0 plan status plan_xxx', 'Show plan progress')
      .example('$0 plan rm plan_xxx', 'Delete plan')
      .epilog(PLAN_EPILOG),
  handler: async (argv: ArgumentsCamelCase<{ action: string; idOrContent?: string[] }>) => {
    const args = argv.idOrContent ?? [];
    switch (argv.action) {
      case 'add': {
        const content = args.join(' ').trim();
        if (!content) {
          console.error('Please provide plan content');
          process.exit(1);
        }
        const { planId, taskIds } = splitPlanToTasks(content, getDefaultTemplate());
        const plan = getPlan(planId)!;
        console.log(`Plan created: ${plan.id}`);
        console.log(`  Title: ${plan.title}`);
        console.log(`  Tasks: ${taskIds.length}`);
        break;
      }
      case 'ls': {
        const plans = listPlans();
        if (plans.length === 0) {
          console.log('No plans');
          return;
        }
        for (const p of plans) {
          console.log(`${p.id}\t${p.title}\t${p.status}`);
        }
        break;
      }
      case 'show': {
        const id = args[0];
        if (!id) {
          console.error('Please provide plan_id');
          process.exit(1);
        }
        const plan = getPlan(id);
        if (!plan) {
          console.error(`Plan not found: ${id}`);
          process.exit(1);
        }
        const tasks = listTasks({ planId: id });
        console.log(`Plan: ${plan.title}`);
        console.log(`ID: ${plan.id}`);
        console.log(`Status: ${plan.status}`);
        console.log(`Description: ${plan.description ?? '-'}`);
        console.log(`\nTasks (${tasks.length}):`);
        for (const t of tasks) {
          console.log(`  ${t.id}\t${t.title}\t${t.owner}\t${t.status}`);
        }
        break;
      }
      case 'rm': {
        const id = args[0];
        if (!id) {
          console.error('Please provide plan_id');
          process.exit(1);
        }
        const ok = deletePlan(id);
        if (!ok) {
          console.error(`Plan not found: ${id}`);
          process.exit(1);
        }
        console.log(`Plan deleted: ${id}`);
        break;
      }
      case 'status': {
        const id = args[0];
        if (!id) {
          console.error('Please provide plan_id');
          process.exit(1);
        }
        const plan = getPlan(id);
        if (!plan) {
          console.error(`Plan not found: ${id}`);
          process.exit(1);
        }
        const tasks = listTasks({ planId: id });
        const done = tasks.filter((t) => t.status === 'done').length;
        const total = tasks.length;
        console.log(`Plan: ${plan.title} (${plan.status})`);
        console.log(`Progress: ${done}/${total} tasks done`);
        for (const t of tasks) {
          console.log(`  ${t.id}\t${t.title}\t${t.status}`);
        }
        break;
      }
      default:
        console.error('Unknown action');
        process.exit(1);
    }
  },
};
