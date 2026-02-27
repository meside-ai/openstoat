/**
 * Palmlist Worker Daemon
 * Polls for ready agent_worker tasks and invokes external agents.
 * Palmlist does not run LLM inference; daemon invokes external agents.
 * Agent path is read from .palmlist.json in current directory.
 *
 * Agent receives PALMLIST_TASK_ID and PALMLIST_PROJECT_ID env vars.
 * Agent stdout/stderr is streamed to the terminal (stdio: inherit).
 */

import { getDb, loadProjectConfig } from 'palmlist-core';
import { listTasks, areDependenciesSatisfied } from 'palmlist-core';

const PREFIX = '[daemon]';

export function startDaemon(pollIntervalMs = 5000): void {
  const config = loadProjectConfig();
  const agentCmd = config?.agent ?? null;
  const agentArgsTemplate = config?.agent_args_template ?? '{{prompt}}';
  if (!agentCmd) {
    console.log(
      `${PREFIX} No agent configured. Add "agent" to .palmlist.json in current directory. Daemon will poll but not execute tasks.`
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
              const prompt = `Execute Palmlist task ${task.id}. PALMLIST_TASK_ID=${task.id} PALMLIST_PROJECT_ID=${projectId}. Run: palmlist task claim ${task.id} --as agent_worker --logs-append "Claimed"; implement the task; then palmlist task done with --output and --handoff-summary (min 200 chars).`;
              const args = agentArgsTemplate.replace(/\{\{prompt\}\}/g, JSON.stringify(prompt));
              const fullCmd = `${agentCmd} ${args}`;
              const proc = Bun.spawn({
                cmd: ['sh', '-c', fullCmd],
                env: {
                  ...process.env,
                  PALMLIST_TASK_ID: task.id,
                  PALMLIST_PROJECT_ID: projectId,
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
