import type { ArgumentsCamelCase } from 'yargs';
import { getDb, getDataDir } from '@openstoat/core';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const INIT_EPILOG = `
Run this ONCE before using any other OpenStoat command. It is safe to run again.

## What it does

  1. Creates data directory:   ~/.openstoat (or OPENSTOAT_DATA_DIR)
  2. Initializes SQLite database with tables: plans, tasks, templates, handoffs, config
  3. Inserts default workflow template (credentials/code_review/deploy → human, rest → ai)
  4. Optional: --project writes .openstoat.json in current directory

## Agent Quick Start

  openstoat init                     # First-time setup
  openstoat template ls              # Verify default template exists
  openstoat plan add "Your goal..."  # Start working

## When to run

  • First time using OpenStoat on this machine
  • After changing OPENSTOAT_DATA_DIR environment variable
  • When binding a project name to a directory (--project <name>)

## Environment

  OPENSTOAT_DATA_DIR   Override data directory (default: ~/.openstoat)
`;

export const initCmd = {
  command: 'init',
  describe: 'First-time setup: create database and default template (run once before other commands)',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .option('project', {
        alias: 'p',
        type: 'string',
        describe: 'Project name; writes .openstoat.json in current directory',
      })
      .example('$0 init', 'Basic init, create ~/.openstoat and database')
      .example('$0 init -p my-app', 'Init and bind project name my-app, create .openstoat.json')
      .epilog(INIT_EPILOG),
  handler: (argv: ArgumentsCamelCase<{ project?: string }>) => {
    const dataDir = getDataDir();
    mkdirSync(dataDir, { recursive: true });
    getDb();
    if (argv.project) {
      const configPath = join(process.cwd(), '.openstoat.json');
      writeFileSync(configPath, JSON.stringify({ project: argv.project }, null, 2));
      console.log(`Project initialized: ${argv.project}`);
      console.log(`Config written to: ${configPath}`);
    } else {
      console.log(`OpenStoat initialized`);
      console.log(`Data directory: ${dataDir}`);
    }
  },
};
