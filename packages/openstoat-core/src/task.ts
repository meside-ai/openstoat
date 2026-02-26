import type { Task, TaskOwner, TaskStatus } from '@openstoat/types';
import { getDb } from './db';
import { randomUUID } from 'crypto';
import { createHandoff } from './handoff';

export function createTask(params: {
  planId: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  owner: TaskOwner;
  dependsOn?: string[];
  taskType?: string;
  priority?: number;
}): Task {
  const id = `task_${randomUUID().slice(0, 8)}`;
  const status: TaskStatus = params.owner === 'ai' ? 'ai_ready' : 'pending';
  const db = getDb();
  const now = new Date().toISOString();
  const dependsOn = params.dependsOn ?? [];
  const taskType = params.taskType ?? 'implementation';
  const priority = params.priority ?? 0;
  db.run(
    `INSERT INTO tasks (id, plan_id, title, description, acceptance_criteria, owner, status, depends_on, output, task_type, priority, waiting_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.planId,
      params.title,
      params.description ?? null,
      params.acceptanceCriteria ?? null,
      params.owner,
      status,
      JSON.stringify(dependsOn),
      null,
      taskType,
      priority,
      null,
      now,
      now,
    ]
  );
  return {
    id,
    plan_id: params.planId,
    title: params.title,
    description: params.description ?? null,
    acceptance_criteria: params.acceptanceCriteria ?? null,
    owner: params.owner,
    status,
    depends_on: dependsOn,
    output: null,
    task_type: taskType,
    priority,
    waiting_reason: null,
    created_at: now,
    updated_at: now,
  };
}

export function listTasks(filters?: { status?: TaskStatus; owner?: TaskOwner; planId?: string }): Task[] {
  const db = getDb();
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const args: (string | number | null)[] = [];
  if (filters?.status) {
    query += ' AND status = ?';
    args.push(filters.status);
  }
  if (filters?.owner) {
    query += ' AND owner = ?';
    args.push(filters.owner);
  }
  if (filters?.planId) {
    query += ' AND plan_id = ?';
    args.push(filters.planId);
  }
  query += ' ORDER BY priority DESC, created_at ASC';
  const rows = (args.length ? db.query(query).all(...args) : db.query(query).all()) as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const row = db.query('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | null;
  return row ? rowToTask(row) : null;
}

function recordTaskEvent(taskId: string, fromStatus: string | null, toStatus: string, reason?: string | null): void {
  const db = getDb();
  db.run(
    'INSERT INTO task_events (task_id, from_status, to_status, reason) VALUES (?, ?, ?, ?)',
    [taskId, fromStatus, toStatus, reason ?? null]
  );
}

export function updateTaskStatus(id: string, status: TaskStatus): boolean {
  const task = getTask(id);
  if (!task) return false;
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  if (result.changes > 0) {
    recordTaskEvent(id, task.status, status);
  }
  return result.changes > 0;
}

export function markTaskDone(id: string, output?: unknown): boolean {
  const task = getTask(id);
  if (!task) return false;
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run(
    'UPDATE tasks SET status = ?, output = ?, updated_at = ? WHERE id = ?',
    ['done', output ? JSON.stringify(output) : null, now, id]
  );
  if (result.changes > 0) {
    recordTaskEvent(id, task.status, 'done');
    triggerDownstreamTasks(id);
    if (output) {
      createHandoffsToDownstream(id, output);
    }
  }
  return result.changes > 0;
}

function createHandoffsToDownstream(completedTaskId: string, output: unknown): void {
  const downstream = getTasksByDependency(completedTaskId);
  const summary = typeof output === 'object' && output !== null && 'summary' in output
    ? String((output as { summary?: string }).summary ?? 'Task completed')
    : 'Task completed';
  const artifacts = typeof output === 'object' && output !== null && 'artifacts' in output
    ? ((output as { artifacts?: unknown[] }).artifacts ?? [])
    : [{ type: 'output', data: output }];
  for (const task of downstream) {
    createHandoff({
      fromTaskId: completedTaskId,
      toTaskId: task.id,
      summary,
      artifacts: artifacts as { type: string; [key: string]: unknown }[],
    });
  }
}

function triggerDownstreamTasks(completedTaskId: string): void {
  const downstream = getTasksByDependency(completedTaskId);
  for (const task of downstream) {
    if (task.status !== 'pending') continue;
    if (!areDependenciesSatisfied(task)) continue;
    const newStatus: TaskStatus = task.owner === 'ai' ? 'ai_ready' : 'waiting_human';
    updateTaskStatus(task.id, newStatus);
  }
}

export function needHuman(id: string, reason?: string): boolean {
  const task = getTask(id);
  if (!task) return false;
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run(
    'UPDATE tasks SET status = ?, waiting_reason = ?, updated_at = ? WHERE id = ?',
    ['waiting_human', reason ?? null, now, id]
  );
  if (result.changes > 0) {
    recordTaskEvent(id, task.status, 'waiting_human', reason);
  }
  return result.changes > 0;
}

function wouldCreateCycle(taskId: string, depTaskId: string): boolean {
  if (taskId === depTaskId) return true;
  const visited = new Set<string>();
  function reachesTarget(id: string, target: string): boolean {
    if (id === target) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const t = getTask(id);
    if (!t) return false;
    for (const d of t.depends_on) {
      if (reachesTarget(d, target)) return true;
    }
    return false;
  }
  return reachesTarget(depTaskId, taskId);
}

export function addTaskDependency(taskId: string, depTaskId: string): boolean {
  const task = getTask(taskId);
  if (!task) return false;
  if (task.depends_on.includes(depTaskId)) return true;
  if (taskId === depTaskId) return false;
  if (wouldCreateCycle(taskId, depTaskId)) return false;
  const dependsOn = [...task.depends_on, depTaskId];
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run('UPDATE tasks SET depends_on = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(dependsOn),
    now,
    taskId,
  ]);
  return result.changes > 0;
}

export function getTasksByDependency(depTaskId: string): Task[] {
  const db = getDb();
  const rows = db.query('SELECT * FROM tasks').all() as TaskRow[];
  return rows.filter((r) => {
    const deps = r.depends_on ? JSON.parse(r.depends_on as string) : [];
    return deps.includes(depTaskId);
  }).map(rowToTask);
}

export function areDependenciesSatisfied(task: Task): boolean {
  if (task.depends_on.length === 0) return true;
  const db = getDb();
  for (const depId of task.depends_on) {
    const dep = db.query('SELECT status FROM tasks WHERE id = ?').get(depId) as { status: string } | null;
    if (!dep || dep.status !== 'done') return false;
  }
  return true;
}

export function updateTask(
  id: string,
  updates: { title?: string; description?: string; acceptanceCriteria?: string; priority?: number }
): boolean {
  const task = getTask(id);
  if (!task) return false;
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const args: (string | number | null)[] = [now];
  if (updates.title !== undefined) {
    sets.push('title = ?');
    args.push(updates.title);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    args.push(updates.description);
  }
  if (updates.acceptanceCriteria !== undefined) {
    sets.push('acceptance_criteria = ?');
    args.push(updates.acceptanceCriteria);
  }
  if (updates.priority !== undefined) {
    sets.push('priority = ?');
    args.push(updates.priority);
  }
  if (sets.length <= 1) return true;
  args.push(id);
  const result = db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, args);
  return result.changes > 0;
}

export function resetTask(id: string, reason?: string): boolean {
  const task = getTask(id);
  if (!task) return false;
  if (task.status !== 'in_progress' && task.status !== 'waiting_human') return false;
  const newStatus: TaskStatus = task.owner === 'ai' ? 'ai_ready' : 'pending';
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run(
    'UPDATE tasks SET status = ?, waiting_reason = ?, updated_at = ? WHERE id = ?',
    [newStatus, null, now, id]
  );
  if (result.changes > 0) {
    recordTaskEvent(id, task.status, newStatus, reason ?? 'Reset by user');
  }
  return result.changes > 0;
}

export function getTaskEvents(taskId: string): { id: number; task_id: string; from_status: string | null; to_status: string; reason: string | null; created_at: string }[] {
  const db = getDb();
  const rows = db.query('SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC').all(taskId) as {
    id: number;
    task_id: string;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
  }[];
  return rows;
}

interface TaskRow {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  acceptance_criteria?: string | null;
  owner: string;
  status: string;
  depends_on: string;
  output: string | null;
  task_type?: string;
  priority?: number;
  waiting_reason?: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    plan_id: row.plan_id,
    title: row.title,
    description: row.description,
    acceptance_criteria: row.acceptance_criteria ?? null,
    owner: row.owner as TaskOwner,
    status: row.status as TaskStatus,
    depends_on: row.depends_on ? JSON.parse(row.depends_on) : [],
    output: row.output ? JSON.parse(row.output) : null,
    task_type: row.task_type ?? 'implementation',
    priority: row.priority ?? 0,
    waiting_reason: row.waiting_reason ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
