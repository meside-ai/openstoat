import type { Task, TaskOwner, TaskStatus } from '@openstoat/types';
import { getDb } from './db';
import { randomUUID } from 'crypto';

export function createTask(params: {
  planId: string;
  title: string;
  description?: string;
  owner: TaskOwner;
  dependsOn?: string[];
}): Task {
  const id = `task_${randomUUID().slice(0, 8)}`;
  const status: TaskStatus = params.owner === 'ai' ? 'ai_ready' : 'pending';
  const db = getDb();
  const now = new Date().toISOString();
  const dependsOn = params.dependsOn ?? [];
  db.run(
    `INSERT INTO tasks (id, plan_id, title, description, owner, status, depends_on, output, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.planId, params.title, params.description ?? null, params.owner, status, JSON.stringify(dependsOn), null, now, now]
  );
  return {
    id,
    plan_id: params.planId,
    title: params.title,
    description: params.description ?? null,
    owner: params.owner,
    status,
    depends_on: dependsOn,
    output: null,
    created_at: now,
    updated_at: now,
  };
}

export function listTasks(filters?: { status?: TaskStatus; owner?: TaskOwner; planId?: string }): Task[] {
  const db = getDb();
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const args: unknown[] = [];
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
  query += ' ORDER BY created_at ASC';
  const rows = (args.length ? db.query(query).all(...args) : db.query(query).all()) as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const row = db.query('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | null;
  return row ? rowToTask(row) : null;
}

export function updateTaskStatus(id: string, status: TaskStatus): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  return result.changes > 0;
}

export function markTaskDone(id: string, output?: unknown): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run(
    'UPDATE tasks SET status = ?, output = ?, updated_at = ? WHERE id = ?',
    ['done', output ? JSON.stringify(output) : null, now, id]
  );
  if (result.changes > 0) {
    triggerDownstreamTasks(id);
  }
  return result.changes > 0;
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
  return updateTaskStatus(id, 'waiting_human');
}

export function addTaskDependency(taskId: string, depTaskId: string): boolean {
  const task = getTask(taskId);
  if (!task) return false;
  if (task.depends_on.includes(depTaskId)) return true;
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

interface TaskRow {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  owner: string;
  status: string;
  depends_on: string;
  output: string | null;
  created_at: string;
  updated_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    plan_id: row.plan_id,
    title: row.title,
    description: row.description,
    owner: row.owner as TaskOwner,
    status: row.status as TaskStatus,
    depends_on: row.depends_on ? JSON.parse(row.depends_on) : [],
    output: row.output ? JSON.parse(row.output) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
