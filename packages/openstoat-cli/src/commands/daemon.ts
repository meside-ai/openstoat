import type { ArgumentsCamelCase } from 'yargs';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { getDataDir } from '@openstoat/core';

const PID_FILE = join(getDataDir(), 'daemon.pid');
const LOG_FILE = join(getDataDir(), 'daemon.log');

function getDaemonPath(): string {
  try {
    const pkgPath = require.resolve('@openstoat/daemon/package.json');
    const { dirname } = require('path');
    return join(dirname(pkgPath), 'src/index.ts');
  } catch {
    return join(process.cwd(), 'packages/openstoat-daemon/src/index.ts');
  }
}

const DAEMON_EPILOG = `
Daemon is a background process that auto-schedules ai_ready AI tasks. Runs in background, polling and executing.

## Subcommands

start   Start daemon in background
stop    Stop daemon
status  Check if daemon is running
logs    View daemon logs (written to daemon.log in data dir)

## How it works

- Daemon polls for ai_ready tasks periodically
- Configure external agent via config set agent <path>
- PID stored in daemon.pid in data dir

## Notes

- start skips if already running
- stop sends SIGTERM for graceful shutdown
`;

export const daemonCmd = {
  command: 'daemon <action>',
  describe: 'Background daemon: auto-schedule ai_ready AI tasks for unattended execution',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['start', 'stop', 'status', 'logs'],
        describe: 'start/stop/status/logs',
      })
      .example('$0 daemon start', 'Start background daemon')
      .example('$0 daemon status', 'Check running status')
      .example('$0 daemon logs', 'View logs')
      .example('$0 daemon stop', 'Stop daemon')
      .epilog(DAEMON_EPILOG),
  handler: (argv: ArgumentsCamelCase<{ action: string }>) => {
    switch (argv.action) {
      case 'start': {
        if (existsSync(PID_FILE)) {
          const pid = parseInt(readFileSync(PID_FILE, 'utf-8'), 10);
          try {
            process.kill(pid, 0);
            console.log(`Daemon already running (PID: ${pid})`);
            return;
          } catch {
            // process doesn't exist
          }
        }
        mkdirSync(join(getDataDir()), { recursive: true });
        const child = spawn(process.execPath, ['run', getDaemonPath()], {
          detached: true,
          stdio: ['ignore', 'ignore', 'ignore'],
          cwd: process.cwd(),
          env: { ...process.env, OPENSTOAT_DAEMON: '1' },
        });
        writeFileSync(PID_FILE, String(child.pid));
        child.unref();
        console.log(`Daemon started (PID: ${child.pid})`);
        break;
      }
      case 'stop': {
        if (!existsSync(PID_FILE)) {
          console.log('Daemon not running');
          return;
        }
        const pid = parseInt(readFileSync(PID_FILE, 'utf-8'), 10);
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`Daemon stopped (PID: ${pid})`);
        } catch (e) {
          console.log('Daemon may have already stopped');
        }
        try {
          const { unlinkSync } = require('fs');
          unlinkSync(PID_FILE);
        } catch {
          /* ignore */
        }
        break;
      }
      case 'status': {
        if (!existsSync(PID_FILE)) {
          console.log('Daemon not running');
          return;
        }
        const pid = parseInt(readFileSync(PID_FILE, 'utf-8'), 10);
        try {
          process.kill(pid, 0);
          console.log(`Daemon running (PID: ${pid})`);
        } catch {
          console.log('Daemon not running (PID file exists but process exited)');
        }
        break;
      }
      case 'logs': {
        if (!existsSync(LOG_FILE)) {
          console.log('No logs');
          return;
        }
        const logs = readFileSync(LOG_FILE, 'utf-8');
        console.log(logs);
        break;
      }
      default:
        console.error('Unknown action');
        process.exit(1);
    }
  },
};
