import { getDb } from './db';

export function getConfig(key: string): string | null {
  const db = getDb();
  const row = db.query('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  const db = getDb();
  db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
}

export function getAllConfig(): Record<string, string> {
  const db = getDb();
  const rows = db.query('SELECT key, value FROM config').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
