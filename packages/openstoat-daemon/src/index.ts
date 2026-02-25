import { runSchedulerCycle } from './scheduler';
import { getConfig, getDataDir } from '@openstoat/core';
import { appendFileSync } from 'fs';
import { join } from 'path';

const LOG_FILE = join(getDataDir(), 'daemon.log');

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    appendFileSync(LOG_FILE, line);
  } catch {
    console.error(line);
  }
}

async function main(): Promise<void> {
  const pollInterval = parseInt(getConfig('poll-interval') ?? '60', 10) * 1000;

  log('Daemon started');
  log(`Poll interval: ${pollInterval / 1000}s`);

  let running = true;
  process.on('SIGTERM', () => {
    log('Daemon received SIGTERM, exiting');
    running = false;
  });

  const checkInterval = 500;
  let lastRun = 0;

  while (running) {
    const now = Date.now();
    if (now - lastRun >= pollInterval) {
      try {
        await runSchedulerCycle();
        lastRun = now;
      } catch (e) {
        log(`Scheduler error: ${e}`);
      }
    }
    await new Promise((r) => setTimeout(r, checkInterval));
  }
}

main();
