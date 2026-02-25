import type { ArgumentsCamelCase } from 'yargs';
import { getDb, getDataDir } from '@openstoat/core';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export const initCmd = {
  command: 'init',
  describe: 'Initialize project config',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs.option('project', {
      alias: 'p',
      type: 'string',
      describe: 'Project name',
    }),
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
