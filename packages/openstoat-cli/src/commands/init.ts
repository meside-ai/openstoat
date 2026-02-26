import type { ArgumentsCamelCase } from 'yargs';
import { getDb, getDataDir } from '@openstoat/core';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const INIT_EPILOG = `
INIT is the first step when using OpenStoat. Run it once before any other command.

## What it does

1. Creates the data directory
   Default: ~/.openstoat (override with OPENSTOAT_DATA_DIR env var)

2. Initializes SQLite database
   Creates plans, tasks, templates, handoffs, config tables

3. Inserts default workflow template
   Default Workflow distinguishes AI vs human tasks (credentials, code_review, deploy, etc.)

4. Optional: Create project config
   With --project, writes .openstoat.json in current directory with project name

## When to use

- First time using OpenStoat
- After changing data directory (OPENSTOAT_DATA_DIR)
- When binding a project name to current directory (--project)

## Environment variables

OPENSTOAT_DATA_DIR  Override default data directory path (default: ~/.openstoat)
`;

export const initCmd = {
  command: 'init',
  describe: 'Initialize OpenStoat: create data dir, database, default template; optionally create project config',
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
