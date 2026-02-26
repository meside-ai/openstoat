/**
 * Daemon commands: start, stop, status, logs
 * Worker daemon polls for ready agent_worker tasks and invokes external agents.
 */

import type { Argv } from 'yargs';
import { startDaemon } from 'openstoat-daemon';

export const daemonCommands = {
  command: 'daemon <action>',
  describe: 'Worker daemon. Polls for ready agent_worker tasks and invokes external agents.',
  builder: (yargs: Argv) =>
    yargs
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
      .demandCommand(1, 'Specify start, stop, status, or logs'),
  handler: () => {},
};
