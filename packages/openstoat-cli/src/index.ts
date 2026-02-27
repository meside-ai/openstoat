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
  .wrap(null) // Disable yargs word-wrap; ESM has a bug that breaks words mid-character (yargs/yargs#2112)
  .usage(AGENT_MANUAL.trim())
  .command({
    command: 'web',
    describe: 'Start Web UI server. Opens http://localhost:3080 (set PORT env to change).',
    handler: async () => {
      await import('openstoat-web');
    },
  })
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
  .epilog('');

cli.parse();
