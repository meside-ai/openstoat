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

const MAIN_EPILOG = `
═══════════════════════════════════════════════════════════════════════════════
OpenStoat Usage (CLI is the manual)
═══════════════════════════════════════════════════════════════════════════════

## Overview

OpenStoat is an AI ↔ Human task queue. AI handles tasks that don't need human input;
when humans complete tasks, downstream AI tasks become executable automatically.

- Local-first, CLI-first; no cloud, no API keys
- No LLM calls; planning done by external agents
- 1 human + N AI agents; humans are the bottleneck, AI fills idle time

## Core concepts

  Plan      Project goal with multiple Tasks
  Task      Smallest unit of work, owned by ai or human
  Template  Defines which task types need human input
  Handoff   Context passed to downstream when a task completes

## Quick start

  1. openstoat init                    # Required first time
  2. openstoat plan add "Goal\\n1. Task 1\\n2. Task 2"   # Create plan
  3. openstoat task ls                 # List tasks
  4. openstoat task done <task_id>     # Complete task, trigger downstream
  5. openstoat daemon start            # Optional: auto-schedule AI tasks

## Command reference

  init      Initialize environment
  config    View/set config
  plan      Plans: add/ls/show/rm/status
  task      Tasks: add/ls/show/done/update/need-human/depend
  template  Templates: ls/show/add/rm/set-default
  daemon    Daemon: start/stop/status/logs
  handoff   Handoffs: ls/show

## Detailed help

  Each subcommand supports --help, e.g.:
    openstoat init --help
    openstoat plan --help
    openstoat task --help
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
  .demandCommand(1, 'Please specify a command. Use --help for usage.')
  .help()
  .alias('h', 'help')
  .alias('v', 'version')
  .version('0.1.0')
  .epilog(MAIN_EPILOG);

cli.parse();
