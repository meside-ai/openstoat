/**
 * Daemon commands: start, stop, status, logs, init
 * Worker daemon polls for ready agent_worker tasks and invokes external agents.
 */

import type { Argv } from 'yargs';
import { startDaemon } from 'palmlist-daemon';
import { listProjects } from 'palmlist-core';
import { loadProjectConfig, saveProjectConfig } from 'palmlist-core';
import { installSkills } from '../lib/installSkills.js';
import { prompt } from '../lib/prompt.js';

export const daemonCommands = {
  command: 'daemon <action>',
  describe: 'Worker daemon. Polls for ready agent_worker tasks and invokes external agents.',
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: 'init',
        describe: 'Interactively create .palmlist.json (project, agent) in current directory.',
        handler: async () => {
          const existing = loadProjectConfig();
          const projects = listProjects();

          console.log('Initialize Palmlist daemon config (.palmlist.json)\n');

          let project = existing?.project ?? '';
          if (projects.length > 0) {
            console.log('Existing projects:');
            for (const p of projects) {
              console.log(`  ${p.id}\t${p.name}`);
            }
            project = await prompt('Project ID', project);
          } else {
            console.log('No projects yet. Run `palmlist project init` first, or enter a project ID to use later.');
            project = await prompt('Project ID', project);
          }

          const agent = await prompt('Agent executable path (for daemon to invoke)', existing?.agent ?? '');
          const agentArgsTemplate = await prompt(
            'Agent args template (use {{prompt}} as placeholder; default: {{prompt}})',
            (existing as { agent_args_template?: string })?.agent_args_template ?? '{{prompt}}'
          );

          const config: Record<string, string> = {};
          if (project) config.project = project;
          if (agent) config.agent = agent;
          if (agentArgsTemplate) config.agent_args_template = agentArgsTemplate;

          saveProjectConfig(config);
          console.log('\nCreated .palmlist.json');
          console.log(JSON.stringify(config, null, 2));
        },
      })
      .command({
        command: 'start',
        describe: 'Start daemon. Polls for ready agent_worker tasks, invokes configured external agent.',
        builder: (y: Argv) =>
          y.option('poll-interval', {
            type: 'number',
            default: 5000,
            describe: 'Poll interval in ms (default 5000)',
          }),
        handler: (argv: { 'poll-interval'?: number }) => {
          console.log('Daemon starting...');
          installSkills(process.cwd());
          const pollInterval = (argv['poll-interval'] as number) || 5000;
          startDaemon(pollInterval);
        },
      })
      .command({
        command: 'stop',
        describe: 'Stop daemon',
        handler: () => {
          console.log('Daemon stop: run daemon in foreground and use Ctrl+C. PID file not implemented in MVP.');
        },
      })
      .command({
        command: 'status',
        describe: 'Check daemon status',
        handler: () => {
          console.log('Daemon status: not running (PID file not implemented in MVP.');
        },
      })
      .command({
        command: 'logs',
        describe: 'View daemon logs',
        handler: () => {
          console.log('Daemon logs: stdout/stderr when running.');
        },
      })
      .demandCommand(1, 'Specify init, start, stop, status, or logs'),
  handler: () => {},
};
