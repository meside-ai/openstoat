/**
 * SQLite database connection and schema initialization
 * Storage location: ~/.openstoat/openstoat.db
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { homedir, tmpdir } from 'os';

let dbInstance: Database | null = null;
let dbPathOverride: string | null = null;
let resolvedDefaultDbPath: string | null = null;

/**
 * Get a writable directory for .openstoat. When HOME points to a path we cannot
 * write (e.g. /Users/chase when running as xlzj on remote), fall back to tmpdir.
 */
function getWritableOpenstoatDir(): string {
  const candidates = [
    process.env.OPENSTOAT_HOME,
    join(process.env.HOME || process.env.USERPROFILE || homedir(), '.openstoat'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err?.code === 'EACCES' || err?.code === 'EPERM') continue;
      throw e;
    }
  }
  const fallback = join(tmpdir(), 'openstoat');
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

function getDefaultDbPath(): string {
  if (resolvedDefaultDbPath) return resolvedDefaultDbPath;
  resolvedDefaultDbPath = join(getWritableOpenstoatDir(), 'openstoat.db');
  return resolvedDefaultDbPath;
}

function getDbPathInternal(): string {
  if (dbPathOverride !== null) return dbPathOverride;
  return process.env.OPENSTOAT_DB_PATH || getDefaultDbPath();
}

export function getDb(): Database {
  if (!dbInstance) {
    const path = getDbPathInternal();
    if (path !== ':memory:') {
      const dir = join(path, '..');
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true });
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          if (err?.code === 'EACCES' || err?.code === 'EPERM') {
            const fallback = join(tmpdir(), 'openstoat', 'openstoat.db');
            dbPathOverride = fallback;
            mkdirSync(join(fallback, '..'), { recursive: true });
          } else {
            throw e;
          }
        }
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
      status TEXT NOT NULL CHECK(status IN ('ready', 'in_progress', 'done', 'cancelled')),
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

  migrateTasksStatusConstraint(db);
}

function migrateTasksStatusConstraint(db: Database): void {
  const row = db.query("SELECT value FROM config WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  const version = row ? parseInt(row.value, 10) : 0;
  if (version >= 2) return;

  const tableInfo = db.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get() as
    | { sql: string }
    | undefined;
  if (tableInfo?.sql?.includes("'cancelled'")) {
    db.query("INSERT OR REPLACE INTO config (key, value) VALUES ('schema_version', '2')").run();
    return;
  }

  db.run(`CREATE TABLE tasks_new (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria TEXT NOT NULL,
    depends_on TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ready', 'in_progress', 'done', 'cancelled')),
    owner TEXT NOT NULL CHECK(owner IN ('agent_worker', 'human_worker')),
    task_type TEXT NOT NULL CHECK(task_type IN ('implementation', 'testing', 'review', 'credentials', 'deploy', 'docs', 'custom')),
    output TEXT,
    logs TEXT NOT NULL,
    created_by TEXT,
    claimed_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`INSERT INTO tasks_new SELECT * FROM tasks`);
  db.run(`DROP TABLE tasks`);
  db.run(`ALTER TABLE tasks_new RENAME TO tasks`);
  db.query("INSERT OR REPLACE INTO config (key, value) VALUES ('schema_version', '2')").run();
}
