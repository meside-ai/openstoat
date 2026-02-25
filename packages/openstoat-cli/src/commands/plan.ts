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

export const planCmd = {
  command: 'plan <action> [idOrContent..]',
  describe: 'Plan management',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['add', 'ls', 'show', 'rm', 'status'],
      })
      .positional('idOrContent', { type: 'string', describe: 'ID or content' }),
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
