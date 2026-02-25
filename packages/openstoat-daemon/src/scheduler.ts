import { listTasks, updateTaskStatus, getConfig, areDependenciesSatisfied } from '@openstoat/core';
import { spawn } from 'child_process';

export async function runSchedulerCycle(): Promise<void> {
  const tasks = listTasks({ status: 'ai_ready' });
  const agent = getConfig('agent') ?? 'echo';

  for (const task of tasks) {
    if (!areDependenciesSatisfied(task)) continue;

    updateTaskStatus(task.id, 'in_progress');

    try {
      await runAgent(agent, task.id);
    } catch (e) {
      console.error(`Agent execution failed: ${e}`);
    }
  }
}

function runAgent(agentCmd: string, taskId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = agentCmd.split(/\s+/);
    const child = spawn(cmd, [...args, 'do-task', '--task-id', taskId], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Agent exit code ${code}: ${stderr || stdout}`));
      } else {
        resolve();
      }
    });

    child.on('error', reject);
  });
}
