/**
 * OpenStoat Worker Daemon
 * Polls for ready agent_worker tasks and invokes external agents.
 * OpenStoat does not run LLM inference; daemon invokes external agents.
 * Agent path is read from .openstoat.json in current directory.
 *
 * Agent receives OPENSTOAT_TASK_ID and OPENSTOAT_PROJECT_ID env vars.
 * Agent stdout/stderr is streamed to the terminal (stdio: inherit).
 */

import { getDb, loadProjectConfig } from 'openstoat-core';
import { listTasks, areDependenciesSatisfied } from 'openstoat-core';

const PREFIX = '[daemon]';

export function startDaemon(pollIntervalMs = 5000): void {
  const config = loadProjectConfig();
  const agentCmd = config?.agent ?? null;
  const agentArgsTemplate = config?.agent_args_template ?? '{{prompt}}';
  if (!agentCmd) {
    console.log(
      `${PREFIX} No agent configured. Add "agent" to .openstoat.json in current directory. Daemon will poll but not execute tasks.`
    );
  }

  const run = async () => {
    try {
      const projects = getDb().query('SELECT id FROM projects').all() as { id: string }[];
      let invoked = false;
      for (const { id: projectId } of projects) {
        const tasks = listTasks(projectId, {
          status: ['ready'],
          owner: 'agent_worker',
        });
        for (const task of tasks) {
          if (areDependenciesSatisfied(task)) {
            if (agentCmd) {
              invoked = true;
              console.log(`${PREFIX} Invoking agent for task ${task.id} (project ${projectId})`);
              const prompt = `Execute OpenStoat task ${task.id}. OPENSTOAT_TASK_ID=${task.id} OPENSTOAT_PROJECT_ID=${projectId}. Run: openstoat task claim ${task.id} --as agent_worker --logs-append "Claimed"; implement the task; then openstoat task done with --output and --handoff-summary (min 200 chars).`;
              const args = agentArgsTemplate.replace(/\{\{prompt\}\}/g, JSON.stringify(prompt));
              const fullCmd = `${agentCmd} ${args}`;
              const proc = Bun.spawn({
                cmd: ['sh', '-c', fullCmd],
                env: {
                  ...process.env,
                  OPENSTOAT_TASK_ID: task.id,
                  OPENSTOAT_PROJECT_ID: projectId,
                },
                stdio: ['inherit', 'inherit', 'inherit'],
                cwd: process.cwd(),
              });
              const exitCode = await proc.exited;
              console.log(`${PREFIX} Agent exited with code ${exitCode} for task ${task.id}`);
              break; // Process one task per poll; next poll will pick up more
            } else {
              console.log(`${PREFIX} Ready: ${task.id} (no agent configured)`);
            }
          }
        }
        if (invoked) break;
      }
      if (!invoked) {
        console.log(`${PREFIX} Poll: no ready agent_worker tasks`);
      }
    } catch (err) {
      console.error(`${PREFIX} Poll error:`, err);
    }
    setTimeout(run, pollIntervalMs);
  };
  run();
}
