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
  .version('0.1.0');

cli.parse();
