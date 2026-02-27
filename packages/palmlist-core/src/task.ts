/**
 * Task model and Kanban operations
 */

import { getDb } from './db.js';
import type {
  Task,
  CreateTaskInput,
  CompleteTaskInput,
  SelfUnblockInput,
  TaskStatus,
} from 'palmlist-types';
import { getProject } from './project.js';
import { createHandoff, getDownstreamTaskIds } from './handoff.js';

const MIN_HANDOFF_LENGTH = 200;

function generateTaskId(project: string): string {
  const db = getDb();
  const count = db.query('SELECT COUNT(*) as c FROM tasks WHERE project = ?').get(project) as {
    c: number;
  };
  return `task_${String((count?.c ?? 0) + 1).padStart(3, '0')}`;
}

export function createTask(input: CreateTaskInput): Task {
  const project = getProject(input.project);
  if (!project) {
    throw new Error(`Project '${input.project}' does not exist`);
  }

  const db = getDb();
  const id = generateTaskId(input.project);
  const now = new Date().toISOString();

  const dependsOn = input.depends_on ?? [];
  for (const depId of dependsOn) {
    const dep = db.query('SELECT id FROM tasks WHERE id = ?').get(depId) as { id: string } | null;
    if (!dep) {
      throw new Error(`Dependency task '${depId}' does not exist`);
    }
  }

  db.query(
    `INSERT INTO tasks (id, project, title, description, acceptance_criteria, depends_on, status, owner, task_type, output, logs, created_by, claimed_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '[]', ?, NULL, ?, ?)`
  ).run(
    id,
    input.project,
    input.title,
    input.description,
    JSON.stringify(input.acceptance_criteria),
    JSON.stringify(dependsOn),
    input.status,
    input.owner,
    input.task_type,
    input.created_by ?? null,
    now,
    now
  );

  return getTask(id)!;
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const row = db.query('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | null;
  if (!row) return null;
  return rowToTask(row);
}

export function listTasks(
  project: string | undefined,
  options?: { status?: TaskStatus[]; owner?: string; task_type?: string }
): Task[] {
  const db = getDb();
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];

  if (project) {
    sql += ' AND project = ?';
    params.push(project);
  }
  if (options?.status?.length) {
    sql += ` AND status IN (${options.status.map(() => '?').join(',')})`;
    params.push(...options.status);
  }
  if (options?.owner) {
    sql += ' AND owner = ?';
    params.push(options.owner);
  }
  if (options?.task_type) {
    sql += ' AND task_type = ?';
    params.push(options.task_type);
  }

  sql += ' ORDER BY project ASC, created_at ASC';
  const rows = db.query(sql).all(...(params as any)) as Record<string, unknown>[];
  return rows.map(rowToTask);
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    project: row.project as string,
    title: row.title as string,
    description: row.description as string,
    acceptance_criteria: JSON.parse((row.acceptance_criteria as string) || '[]') as string[],
    depends_on: JSON.parse((row.depends_on as string) || '[]') as string[],
    status: row.status as TaskStatus,
    owner: row.owner as Task['owner'],
    task_type: row.task_type as Task['task_type'],
    output: (row.output as string) || null,
    logs: JSON.parse((row.logs as string) || '[]') as string[],
    created_by: (row.created_by as string) || null,
    claimed_by: (row.claimed_by as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function updateTask(
  id: string,
  updates: Partial<{
    status: TaskStatus;
    output: string;
    logs: string[];
    claimed_by: string | null;
  }>
): void {
  const db = getDb();
  const now = new Date().toISOString();

  const setClauses: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  if (updates.output !== undefined) {
    setClauses.push('output = ?');
    params.push(updates.output);
  }
  if (updates.logs !== undefined) {
    setClauses.push('logs = ?');
    params.push(JSON.stringify(updates.logs));
  }
  if (updates.claimed_by !== undefined) {
    setClauses.push('claimed_by = ?');
    params.push(updates.claimed_by);
  }

  params.push(id);
  db.query(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...(params as any));
}

function appendLogs(id: string, log: string): void {
  const task = getTask(id);
  if (!task) throw new Error(`Task '${id}' not found`);
  const logs = [...task.logs, log];
  updateTask(id, { logs });
}

export function areDependenciesSatisfied(task: Task): boolean {
  if (task.depends_on.length === 0) return true;
  const db = getDb();
  for (const depId of task.depends_on) {
    const dep = db.query('SELECT status FROM tasks WHERE id = ?').get(depId) as {
      status: string;
    } | null;
    if (!dep || dep.status !== 'done') return false;
  }
  return true;
}

export function claimTask(
  taskId: string,
  as: 'agent_worker' | 'human_worker',
  logsAppend?: string
): Task {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task '${taskId}' not found`);
  if (task.status !== 'ready') {
    throw new Error(`Task '${taskId}' is not ready to claim (status: ${task.status})`);
  }
  if (task.owner !== as) {
    throw new Error(`Owner mismatch: task owner is ${task.owner}, claimer is ${as}`);
  }
  if (!areDependenciesSatisfied(task)) {
    throw new Error(`Task '${taskId}' has unsatisfied dependencies`);
  }

  const logs = [...task.logs];
  if (logsAppend) logs.push(logsAppend);

  updateTask(taskId, {
    status: 'in_progress',
    claimed_by: as,
    logs,
  });

  return getTask(taskId)!;
}

export function startTask(
  taskId: string,
  as: 'agent_worker' | 'human_worker',
  logsAppend?: string
): Task {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task '${taskId}' not found`);
  if (task.status !== 'in_progress') {
    throw new Error(`Task '${taskId}' is not in progress (status: ${task.status})`);
  }
  if (task.claimed_by !== as) {
    throw new Error(`Task '${taskId}' was claimed by ${task.claimed_by}, not ${as}`);
  }

  if (logsAppend) appendLogs(taskId, logsAppend);
  return getTask(taskId)!;
}

export function completeTask(
  taskId: string,
  input: CompleteTaskInput,
  as: 'agent_worker' | 'human_worker'
): Task {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task '${taskId}' not found`);
  if (task.status !== 'in_progress') {
    throw new Error(`Task '${taskId}' is not in progress (status: ${task.status})`);
  }
  if (task.claimed_by !== as) {
    throw new Error(`Task '${taskId}' was claimed by ${task.claimed_by}, not ${as}`);
  }

  if (input.handoff_summary.length < MIN_HANDOFF_LENGTH) {
    throw new Error(
      `Handoff summary must be at least ${MIN_HANDOFF_LENGTH} characters (got ${input.handoff_summary.length})`
    );
  }

  const downstreamIds = getDownstreamTaskIds(taskId);
  if (downstreamIds.length > 0) {
    for (const toTaskId of downstreamIds) {
      createHandoff({
        from_task_id: taskId,
        to_task_id: toTaskId,
        summary: input.handoff_summary,
      });
    }
  } else {
    createHandoff({
      from_task_id: taskId,
      to_task_id: null,
      summary: input.handoff_summary,
    });
  }

  const logs = [...task.logs];
  if (input.logs_append) logs.push(input.logs_append);

  updateTask(taskId, {
    status: 'done',
    output: input.output,
    logs,
  });

  // Re-evaluate downstream tasks - they may become ready
  for (const downstreamId of downstreamIds) {
    const downstream = getTask(downstreamId);
    if (downstream && downstream.status !== 'done' && areDependenciesSatisfied(downstream)) {
      updateTask(downstreamId, { status: 'ready' });
    }
  }

  return getTask(taskId)!;
}

export function selfUnblockTask(
  taskId: string,
  input: SelfUnblockInput,
  as: 'agent_worker'
): Task {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task '${taskId}' not found`);
  if (task.status !== 'in_progress') {
    throw new Error(`Task '${taskId}' is not in progress (status: ${task.status})`);
  }
  if (task.owner !== 'agent_worker' || as !== 'agent_worker') {
    throw new Error('Self-unblock is only for agent_worker tasks');
  }
  if (!input.depends_on || input.depends_on.length === 0) {
    throw new Error('Self-unblock requires at least one --depends-on (new human task)');
  }

  const db = getDb();
  for (const depId of input.depends_on) {
    const dep = db.query('SELECT id, owner FROM tasks WHERE id = ?').get(depId) as {
      id: string;
      owner: string;
    } | null;
    if (!dep) throw new Error(`Dependency task '${depId}' does not exist`);
    if (dep.owner !== 'human_worker') {
      throw new Error(`Self-unblock depends_on must reference human_worker tasks; '${depId}' is ${dep.owner}`);
    }
  }

  const newDeps = input.depends_on.filter((d) => !task.depends_on.includes(d));
  if (newDeps.length === 0) {
    throw new Error('Self-unblock must add at least one new dependency (human task)');
  }

  const mergedDependsOn = [...new Set([...task.depends_on, ...input.depends_on])];
  db.query(
    `UPDATE tasks SET depends_on = ?, status = 'ready', claimed_by = NULL, updated_at = ? WHERE id = ?`
  ).run(JSON.stringify(mergedDependsOn), new Date().toISOString(), taskId);

  if (input.logs_append) appendLogs(taskId, input.logs_append);

  return getTask(taskId)!;
}
