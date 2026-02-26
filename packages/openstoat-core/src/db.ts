/**
 * SQLite database connection and schema initialization
 * Storage location: ~/.openstoat/openstoat.db
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const OPENSTOAT_DIR = join(process.env.HOME || process.env.USERPROFILE || '.', '.openstoat');
const DEFAULT_DB_PATH = join(OPENSTOAT_DIR, 'openstoat.db');

let dbInstance: Database | null = null;
let dbPathOverride: string | null = null;

function ensureDir(): void {
  if (!existsSync(OPENSTOAT_DIR)) {
    mkdirSync(OPENSTOAT_DIR, { recursive: true });
  }
}

function getDbPathInternal(): string {
  if (dbPathOverride !== null) return dbPathOverride;
  return process.env.OPENSTOAT_DB_PATH || DEFAULT_DB_PATH;
}

export function getDb(): Database {
  if (!dbInstance) {
    const path = getDbPathInternal();
    if (path !== ':memory:') {
      const dir = join(path, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    dbInstance = new Database(path, { create: true });
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function getDbPath(): string {
  return getDbPathInternal();
}

export function setDbPath(path: string): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbPathOverride = path;
  // Re-initialize with new path when setDbPath is called (e.g. in tests)
  getDb();
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template_context TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      depends_on TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ready', 'in_progress', 'done')),
      owner TEXT NOT NULL CHECK(owner IN ('agent_worker', 'human_worker')),
      task_type TEXT NOT NULL CHECK(task_type IN ('implementation', 'testing', 'review', 'credentials', 'deploy', 'docs', 'custom')),
      output TEXT,
      logs TEXT NOT NULL,
      created_by TEXT,
      claimed_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      from_task_id TEXT NOT NULL REFERENCES tasks(id),
      to_task_id TEXT,
      summary TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}
