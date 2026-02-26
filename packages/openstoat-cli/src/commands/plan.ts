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
A Plan is a goal broken into Tasks. When you create a plan with "plan add", the system
parses your text into tasks and auto-assigns owner (ai/human) using the default template's
keyword matching rules.

## Agent Workflow: Creating a Plan (Planner Agent)

  Your job: break a goal into tasks. You do NOT execute tasks afterward —
  the daemon will schedule ai_ready tasks to Executor Agents.

  1. FIRST, read the template to know which keywords trigger human tasks:
     openstoat template show <template_id>
     → e.g. "api_key", "review", "deploy" → human; everything else → ai

  2. Write a clear plan. Include requirements and acceptance criteria per task:
     openstoat plan add "Integrate Paddle payment
     1. Add Paddle to PaymentProvider enum
        - Add enum value, update types
        - Acceptance: Compiles, enum includes Paddle
     2. Provide Paddle API Key
        - Human provides sandbox key
        - Acceptance: Key stored in config
     3. Implement PaddlePaymentService
        - Use REST API, handle webhooks
        - Acceptance: Unit tests pass
     4. Write unit tests
     5. Code review
     6. Deploy to staging"
     → First line = plan title. Bullets under each number = task description.
     → Use "Acceptance:" or "AC:" or "验收:" for completion criteria (Executor needs this).
     → Keywords in titles → template owner (API Key→human, review→human).

  3. Verify the result:
     openstoat plan show <plan_id>
     → Confirm tasks are correctly split and owners properly assigned.

  4. Done. The daemon picks up ai_ready tasks automatically.

## Plan Content Format

  First line = plan title. Numbered items = tasks. Bullets under each = description.
  Use "Acceptance:" or "AC:" or "验收:" for per-task completion criteria.
  Example:
    1. Task title
       - Requirement detail
       - Acceptance: Done when X works

## Subcommands

  add <content>      Create plan, auto-split into tasks, assign owners via template
  ls                 List all plans (id, title, status)
  show <plan_id>     Show plan details and all its tasks
  rm <plan_id>       Delete plan and all its tasks
  status <plan_id>   Show progress (done/total tasks)

## Template Keyword Matching Example

  "Provide Paddle API Key"  → matches "API Key" keyword → owner=human (credentials)
  "Code review"             → matches "review" keyword  → owner=human (code_review)
  "Deploy to staging"       → matches "deploy" keyword  → owner=human (deploy)
  "Add Paddle to enum"      → no keyword match          → owner=ai (implementation)
`;

export const planCmd = {
  command: 'plan <action> [idOrContent..]',
  describe: 'Create goals and auto-split into AI/human tasks via template matching',
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
