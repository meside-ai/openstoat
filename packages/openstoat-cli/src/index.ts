#!/usr/bin/env bun
/**
 * OpenStoat CLI - Agent super-manual for task orchestration
 * CLI is the operational guide for both agents and humans.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { projectCommands } from './commands/project.js';
import { taskCommands } from './commands/task.js';
import { daemonCommands } from './commands/daemon.js';
import { installCommands } from './commands/install.js';
import { AGENT_MANUAL } from './agent-manual.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('openstoat')
  .usage(
    'Usage: $0 <command> [options]\n\n' +
      'OpenStoat orchestrates tasks between AI agents and humans. Local-first, CLI-first.\n' +
      'Storage: ~/.openstoat/ (SQLite). No account/API Key required.\n\n' +
      'WHEN TO USE: Planning work, creating tasks, claiming/executing tasks, handing off to humans,\n' +
      'self-unblocking when blocked. Run \'openstoat manual\' for full agent operational manual.\n\n' +
      'Commands:\n' +
      '  project init       Initialize project (--id, --name, --template required)\n' +
      '  project ls         List projects (get --project IDs for task commands)\n' +
      '  project show <id>  Show project details\n' +
      '  task ls            List tasks (PLANNER: run before create to avoid duplicates)\n' +
      '  task create        Create task (all required: --project, --title, --description,\n' +
      '                     --acceptance-criteria, --status, --owner, --task-type)\n' +
      '  task claim <id>    WORKER: claim ready task (--as agent_worker|human_worker)\n' +
      '  task start <id>    WORKER: start working (append to logs)\n' +
      '  task done <id>     WORKER: complete (--output, --handoff-summary min 200 chars)\n' +
      '  task self-unblock  WORKER: rollback when blocked (--depends-on human_task required)\n' +
      '  task show <id>     Show task details\n' +
      '  daemon start       Start worker daemon (polls for ready agent_worker tasks)\n' +
      '  install skill      Install planner and worker skills (--here for current dir)\n' +
      '  manual             Print full agent operational manual (SKILL-style)'
  )
  .command({
    command: 'manual',
    describe: 'Print full agent operational manual. Use when agent needs detailed workflow, rules, and examples.',
    handler: () => {
      console.log(AGENT_MANUAL.trim());
    },
  })
  .command(projectCommands)
  .command(taskCommands)
  .command(daemonCommands)
  .command(installCommands)
  .demandCommand(1, 'Specify a command. Run openstoat --help or openstoat manual for details.')
  .strict()
  .help()
  .alias('h', 'help')
  .version('0.1.0')
  .alias('v', 'version')
  .epilog(
    'RULES: (1) Planner must run task ls before create. (2) Handoff required on every done (min 200 chars). ' +
      '(3) No generic status update; use claim/start/done/self-unblock only. (4) Self-unblock requires --depends-on.'
  );

cli.parse();
