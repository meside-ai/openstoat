#!/usr/bin/env bun
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { initCmd } from './commands/init';
import { configCmd } from './commands/config';
import { planCmd } from './commands/plan';
import { taskCmd } from './commands/task';
import { templateCmd } from './commands/template';
import { daemonCmd } from './commands/daemon';
import { handoffCmd } from './commands/handoff';
import { webCmd } from './commands/web';

const MAIN_EPILOG = `
═══════════════════════════════════════════════════════════════════════════════
OpenStoat — AI Agent Instruction Manual
═══════════════════════════════════════════════════════════════════════════════

## What is OpenStoat?

A task queue that decouples AI and Human work. You (the AI agent) use this CLI
to coordinate with humans. There is no LLM inside OpenStoat — YOU provide the
intelligence. OpenStoat only stores plans, tasks, and context (handoffs).

Storage: local SQLite at ~/.openstoat/   No cloud, no API keys required.

## Two Agent Roles

  Planner Agent — receives a goal from human, creates a Plan (breaks it into tasks).
                  Does NOT execute tasks. Your job ends after plan add.

  Executor Agent — invoked by the daemon to execute a single ai_ready task.
                   Reads context, does the work, marks task done.

  These are different AI agents. The daemon schedules Executor work.

## Core Concepts

  Plan      A goal broken into multiple Tasks
  Task      Smallest work unit; owner is ai or human; has a status
  Template  Rules that decide which task types need human (matched by keywords)
  Handoff   Context (summary + artifacts) passed from completed task to downstream
  Daemon    Background scheduler that discovers ai_ready tasks and invokes Executor

## First-time Setup

  openstoat init                          # Creates ~/.openstoat and database
  openstoat template ls                   # Verify default template exists

═══════════════════════════════════════════════════════════════════════════════
SCENARIO WORKFLOWS
═══════════════════════════════════════════════════════════════════════════════

## Scenario 1: Create a Plan (Planner Agent)

  Human gives you a goal. Your job: break it into tasks and write the plan.
  You do NOT execute tasks — the daemon will schedule them to Executor Agents.

  1. Read the template to understand which tasks need humans:
     openstoat template show <template_id>

  2. Break the goal into numbered steps. Include requirements and acceptance criteria:
     openstoat plan add "Integrate Paddle payment
     1. Add Paddle to PaymentProvider enum
        - Add enum value, update types
        - Acceptance: Compiles, enum includes Paddle
     2. Provide Paddle API Key
        - Human provides sandbox key
        - Acceptance: Key stored in config
     3. Implement PaddlePaymentService
        - Use REST API, handle webhooks
        - Acceptance: Unit tests pass, integration works
     4. Write unit tests
     5. Code review
     6. Deploy to staging"
     → Use "Acceptance:" or "AC:" or "验收:" for per-task completion criteria.
     → System auto-assigns owner via template keywords (API Key→human, Code review→human).

  3. Verify the result:
     openstoat plan show <plan_id>
     → Confirm tasks are correctly split and owners properly assigned.

  4. Done. The daemon will pick up ai_ready tasks and invoke Executor Agents.

## Scenario 2: Execute a task (Executor Agent — most common)

  The daemon invokes you to work on a specific ai_ready task.

  1. Get full details and upstream context:
     openstoat task show <task_id>
     openstoat handoff ls --task <task_id>
     → Handoffs contain summaries and artifacts from completed upstream tasks.
       Use this context to inform your work.

  2. Execute the task.

  3. Mark complete:
     openstoat task done <task_id>
     → This triggers downstream tasks automatically. The daemon handles the rest.

## Scenario 3: You are blocked — need human input (Executor Agent)

  When you cannot proceed (missing credentials, unclear requirements, etc.):

  openstoat task need-human <task_id> --reason "API signature differs from docs, need confirmation"
  → Status changes to waiting_human. Human is notified.
  → After human resolves it, downstream tasks become ai_ready and the daemon resumes.

## Scenario 4: Check progress (Planner or Executor Agent)

  openstoat plan status <plan_id>           # Progress: done/total
  openstoat task ls --status waiting_human   # Tasks blocked on humans
  openstoat task ls --owner human            # All human-owned tasks

## Scenario 5: Add sub-tasks after review rejection (Executor Agent)

  openstoat task add --plan <plan_id> --title "Fix review comments" --owner ai \\
    --description "Address reviewer feedback on PR" --acceptance-criteria "All comments resolved, re-approved"
  openstoat task depend <new_task_id> --on <review_task_id>
  → --description and --acceptance-criteria are REQUIRED. Executor needs them.

═══════════════════════════════════════════════════════════════════════════════
RULES & REFERENCE
═══════════════════════════════════════════════════════════════════════════════

## Important Rules

  • ALWAYS use --json when you need to parse output programmatically.
  • ALWAYS check handoffs before starting a task (they carry upstream context).
  • ALWAYS mark tasks done when complete (this triggers the next tasks).
  • If creating sub-tasks after review, add proper dependencies with depend.

## Task Status Reference

  pending         Task created but dependencies not yet satisfied
  ai_ready        All dependencies done AND owner=ai → YOU can start this
  in_progress     Currently being worked on
  waiting_human   Blocked on human input
  human_done      Human finished their part
  done            Completed; downstream tasks may now be triggered

## Command Reference

  init       Initialize environment (run once)
  config     View/set config (e.g. agent name for daemon)
  plan       add / ls / show / rm / status
  task       add / ls / show / done / update / reset / need-human / depend / events
  template   ls / show / add / rm / set-default
  daemon     start / stop / status / logs
  handoff    add / ls / show
  web        Start web UI server

  Every subcommand supports --help for detailed usage.
`;

const cli = yargs(hideBin(process.argv))
  .scriptName('openstoat')
  .usage('$0 <cmd> [args]')
  .command(initCmd)
  .command(configCmd)
  .command(planCmd)
  .command(taskCmd)
  .command(templateCmd)
  .command(daemonCmd)
  .command(handoffCmd)
  .command(webCmd)
  .demandCommand(1, 'Please specify a command. Use --help for usage.')
  .help()
  .alias('h', 'help')
  .alias('v', 'version')
  .version('0.1.0')
  .epilog(MAIN_EPILOG);

cli.parse();
