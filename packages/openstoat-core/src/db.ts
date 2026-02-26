import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';

const DATA_DIR = process.env.OPENSTOAT_DATA_DIR ?? join(homedir(), '.openstoat');
const DB_PATH = join(DATA_DIR, 'openstoat.db');

let db: Database | null = null;

export function getDataDir(): string {
  return DATA_DIR;
}

export function getDbPath(): string {
  return DB_PATH;
}

export function getDb(dbPath?: string): Database {
  if (db) return db;
  const path = dbPath ?? DB_PATH;
  if (!existsSync(path)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  db = new Database(path);
  initSchema(db);
  migrateSchema(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function useTestDb(dbPath: string): Database {
  closeDb();
  db = new Database(dbPath);
  initSchema(db);
  migrateSchema(db);
  return db;
}

function columnExists(database: Database, table: string, column: string): boolean {
  const rows = database.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function migrateSchema(database: Database): void {
  const taskCols = [
    { name: 'waiting_reason', def: 'TEXT' },
    { name: 'task_type', def: "TEXT DEFAULT 'implementation'" },
    { name: 'acceptance_criteria', def: 'TEXT' },
    { name: 'priority', def: 'INTEGER DEFAULT 0' },
  ];
  for (const col of taskCols) {
    if (!columnExists(database, 'tasks', col.name)) {
      database.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      from_status TEXT,
      to_status TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function initSchema(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planned',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      plan_id TEXT REFERENCES plans(id),
      title TEXT NOT NULL,
      description TEXT,
      owner TEXT CHECK(owner IN ('ai', 'human')),
      status TEXT DEFAULT 'pending',
      depends_on TEXT,
      output TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT,
      rules TEXT NOT NULL,
      keywords TEXT,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      from_task_id TEXT REFERENCES tasks(id),
      to_task_id TEXT REFERENCES tasks(id),
      summary TEXT,
      artifacts TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO templates (id, name, version, rules, keywords, is_default) VALUES
    ('template_default', 'Default Workflow', '1.0',
     '[{"task_type":"credentials","requires_human":true,"human_action":"provide_input","prompt":"请提供 {field} 的值"},{"task_type":"code_review","requires_human":true,"human_action":"approve","prompt":"请审核以下代码变更"},{"task_type":"deploy","requires_human":true,"human_action":"confirm","prompt":"确认部署到 {environment}？"},{"task_type":"implementation","requires_human":false},{"task_type":"testing","requires_human":false}]',
     '{"credentials":["api_key","secret","key","凭证","密钥","password","API Key","provide"],"code_review":["review","审核","pr","code review"],"deploy":["deploy","部署","release","发布"]}',
     1);
  `);
}
