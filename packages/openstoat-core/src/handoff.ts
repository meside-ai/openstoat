/**
 * Handoff model - context transfer between completed and downstream tasks
 */

import { getDb } from './db.js';
import type { Handoff } from 'openstoat-types';

function generateHandoffId(): string {
  const db = getDb();
  const count = db.query('SELECT COUNT(*) as c FROM handoffs').get() as { c: number };
  return `handoff_${String((count?.c ?? 0) + 1).padStart(3, '0')}`;
}

export interface CreateHandoffInput {
  from_task_id: string;
  to_task_id: string | null;
  summary: string;
}

export function createHandoff(input: CreateHandoffInput): void {
  const db = getDb();
  const id = generateHandoffId();
  db.query(
    `INSERT INTO handoffs (id, from_task_id, to_task_id, summary) VALUES (?, ?, ?, ?)`
  ).run(id, input.from_task_id, input.to_task_id, input.summary);
}

export function listHandoffs(options?: {
  from_task_id?: string;
  to_task_id?: string;
}): Handoff[] {
  const db = getDb();
  let sql = 'SELECT * FROM handoffs WHERE 1=1';
  const params: (string | null)[] = [];

  if (options?.from_task_id) {
    sql += ' AND from_task_id = ?';
    params.push(options.from_task_id);
  }
  if (options?.to_task_id !== undefined) {
    if (options.to_task_id === null) {
      sql += ' AND to_task_id IS NULL';
    } else {
      sql += ' AND to_task_id = ?';
      params.push(options.to_task_id);
    }
  }

  sql += ' ORDER BY created_at DESC';
  const rows = db.query(sql).all(...params) as {
    id: string;
    from_task_id: string;
    to_task_id: string | null;
    summary: string;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    from_task_id: row.from_task_id,
    to_task_id: row.to_task_id,
    summary: row.summary,
    created_at: row.created_at,
  }));
}

export function getDownstreamTaskIds(fromTaskId: string): string[] {
  const db = getDb();
  const rows = db
    .query('SELECT id FROM tasks WHERE depends_on LIKE ?')
    .all(`%"${fromTaskId}"%`) as { id: string }[];

  return rows
    .map((r) => r.id)
    .filter((id) => {
      const task = db.query('SELECT depends_on FROM tasks WHERE id = ?').get(id) as {
        depends_on: string;
      } | null;
      if (!task) return false;
      const deps = JSON.parse(task.depends_on || '[]') as string[];
      return deps.includes(fromTaskId);
    });
}
