import type { Handoff, HandoffArtifact } from '@openstoat/types';
import { getDb } from './db';
import { randomUUID } from 'crypto';

export function createHandoff(params: {
  fromTaskId: string;
  toTaskId: string;
  summary: string;
  artifacts?: HandoffArtifact[];
}): Handoff {
  const id = `handoff_${randomUUID().slice(0, 8)}`;
  const db = getDb();
  db.run(
    `INSERT INTO handoffs (id, from_task_id, to_task_id, summary, artifacts)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      params.fromTaskId,
      params.toTaskId,
      params.summary,
      params.artifacts ? JSON.stringify(params.artifacts) : '[]',
    ]
  );
  const row = db.query('SELECT * FROM handoffs WHERE id = ?').get(id) as HandoffRow;
  return rowToHandoff(row);
}

export function listHandoffs(): Handoff[] {
  const db = getDb();
  const rows = db.query('SELECT * FROM handoffs ORDER BY created_at DESC').all() as HandoffRow[];
  return rows.map(rowToHandoff);
}

export function listHandoffsByTask(taskId: string): Handoff[] {
  const db = getDb();
  const rows = db
    .query('SELECT * FROM handoffs WHERE from_task_id = ? OR to_task_id = ? ORDER BY created_at DESC')
    .all(taskId, taskId) as HandoffRow[];
  return rows.map(rowToHandoff);
}

export function getHandoff(id: string): Handoff | null {
  const db = getDb();
  const row = db.query('SELECT * FROM handoffs WHERE id = ?').get(id) as HandoffRow | null;
  return row ? rowToHandoff(row) : null;
}

interface HandoffRow {
  id: string;
  from_task_id: string;
  to_task_id: string;
  summary: string;
  artifacts: string;
  created_at: string;
}

function rowToHandoff(row: HandoffRow): Handoff {
  return {
    id: row.id,
    from_task_id: row.from_task_id,
    to_task_id: row.to_task_id,
    summary: row.summary,
    artifacts: row.artifacts ? JSON.parse(row.artifacts) : [],
    created_at: row.created_at,
  };
}
