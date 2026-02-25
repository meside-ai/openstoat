import type { Plan, PlanStatus } from '@openstoat/types';
import { getDb } from './db';
import { randomUUID } from 'crypto';

export function createPlan(title: string, description?: string): Plan {
  const id = `plan_${randomUUID().slice(0, 8)}`;
  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO plans (id, title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, 'planned', ?, ?)`,
    [id, title, description ?? null, now, now]
  );
  return { id, title, description: description ?? null, status: 'planned', created_at: now, updated_at: now };
}

export function listPlans(): Plan[] {
  const db = getDb();
  const rows = db.query('SELECT * FROM plans ORDER BY created_at DESC').all() as PlanRow[];
  return rows.map(rowToPlan);
}

export function getPlan(id: string): Plan | null {
  const db = getDb();
  const row = db.query('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow | null;
  return row ? rowToPlan(row) : null;
}

export function deletePlan(id: string): boolean {
  const db = getDb();
  db.run('DELETE FROM tasks WHERE plan_id = ?', [id]);
  const result = db.run('DELETE FROM plans WHERE id = ?', [id]);
  return result.changes > 0;
}

export function updatePlanStatus(id: string, status: PlanStatus): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.run('UPDATE plans SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  return result.changes > 0;
}

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

function rowToPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as PlanStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
