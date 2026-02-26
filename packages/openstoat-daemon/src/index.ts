/**
 * OpenStoat Worker Daemon
 * Polls for ready agent_worker tasks and invokes external agents.
 * OpenStoat does not run LLM inference; daemon invokes external agents.
 * Agent path is read from .openstoat.json in current directory.
 */

import { getDb, loadProjectConfig } from 'openstoat-core';
import { listTasks, areDependenciesSatisfied } from 'openstoat-core';

export function startDaemon(pollIntervalMs = 5000): void {
  const config = loadProjectConfig();
  const agentPath = config?.agent ?? null;
  if (!agentPath) {
    console.log(
      'No agent configured. Add "agent" to .openstoat.json in current directory. Daemon will poll but not execute tasks.'
    );
  }

  const run = () => {
    try {
      const projects = getDb().query('SELECT id FROM projects').all() as { id: string }[];
      for (const { id: projectId } of projects) {
        const tasks = listTasks(projectId, {
          status: ['ready'],
          owner: 'agent_worker',
        });
        for (const task of tasks) {
          if (areDependenciesSatisfied(task)) {
            if (agentPath) {
              console.log(`Would invoke ${agentPath} for task ${task.id}`);
            } else {
              console.log(`Ready: ${task.id}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Daemon poll error:', err);
    }
    setTimeout(run, pollIntervalMs);
  };
  run();
}
