/**
 * Install commands: skill
 * Installs OpenStoat skills to .agent/skills and .claude/skills.
 */

import type { Argv } from 'yargs';
import { installSkills } from '../lib/installSkills.js';

export const installCommands = {
  command: 'install <target>',
  describe: 'Install OpenStoat assets. Use "skill" to install planner and worker skills.',
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: 'skill',
        describe:
          'Install planner and worker skills to .agent/skills and .claude/skills in current directory.',
        builder: (y: Argv) =>
          y.option('cwd', {
            type: 'string',
            default: process.cwd(),
            describe: 'Target directory (default: current working directory)',
          }),
        handler: (argv: { cwd?: string }) => {
          const targetRoot = (argv.cwd as string) || process.cwd();
          const installed = installSkills(targetRoot);
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
