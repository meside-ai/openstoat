/**
 * Install commands: skill
 * Installs Palmlist skills to .agent/skills and .claude/skills.
 */

import type { Argv } from 'yargs';
import { installSkills } from '../lib/installSkills.js';

export const installCommands = {
  command: 'install <target>',
  describe: 'Install Palmlist assets. Use "skill" to install planner and worker skills.',
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: 'skill',
        describe:
          'Install planner and worker skills. Use --here to install to current directory (no skills/, .agent, or .claude).',
        builder: (y: Argv) =>
          y
            .option('cwd', {
              type: 'string',
              default: process.cwd(),
              describe: 'Target directory (default: current working directory)',
            })
            .option('here', {
              type: 'boolean',
              default: false,
              describe: 'Install to current directory (./palmlist-planner, ./palmlist-worker)',
            }),
        handler: (argv: { cwd?: string; here?: boolean }) => {
          const targetRoot = (argv.cwd as string) || process.cwd();
          const installed = installSkills(targetRoot, { here: argv.here });
          if (installed.length > 0) {
            console.log('Installed skills to:');
            for (const p of installed) {
              console.log(`  ${p}`);
            }
          } else {
            console.log('No skills installed.');
          }
        },
      })
      .demandCommand(1, 'Specify skill'),
  handler: () => {},
};
