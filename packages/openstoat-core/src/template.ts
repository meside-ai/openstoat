import type { Template, TemplateRule } from '@openstoat/types';
import { getDb } from './db';
import { randomUUID } from 'crypto';

export function listTemplates(): Template[] {
  const db = getDb();
  const rows = db.query('SELECT * FROM templates ORDER BY is_default DESC, name ASC').all() as TemplateRow[];
  return rows.map(rowToTemplate);
}

export function getTemplate(id: string): Template | null {
  const db = getDb();
  const row = db.query('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow | null;
  return row ? rowToTemplate(row) : null;
}

export function getDefaultTemplate(): Template | null {
  const db = getDb();
  const row = db.query('SELECT * FROM templates WHERE is_default = 1 LIMIT 1').get() as TemplateRow | null;
  return row ? rowToTemplate(row) : null;
}

export function createTemplate(params: {
  name: string;
  version?: string;
  rules: TemplateRule[];
  keywords?: Record<string, string[]>;
  isDefault?: boolean;
}): Template {
  const id = `template_${randomUUID().slice(0, 8)}`;
  const db = getDb();
  if (params.isDefault) {
    db.run('UPDATE templates SET is_default = 0');
  }
  db.run(
    `INSERT INTO templates (id, name, version, rules, keywords, is_default)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.name,
      params.version ?? '1.0',
      JSON.stringify(params.rules),
      params.keywords ? JSON.stringify(params.keywords) : '{}',
      params.isDefault ? 1 : 0,
    ]
  );
  return {
    id,
    name: params.name,
    version: params.version ?? '1.0',
    rules: params.rules,
    keywords: params.keywords ?? {},
    is_default: params.isDefault ? 1 : 0,
  };
}

export function deleteTemplate(id: string): boolean {
  const db = getDb();
  const result = db.run('DELETE FROM templates WHERE id = ?', [id]);
  return result.changes > 0;
}

export function setDefaultTemplate(id: string): boolean {
  const db = getDb();
  db.run('UPDATE templates SET is_default = 0');
  const result = db.run('UPDATE templates SET is_default = 1 WHERE id = ?', [id]);
  return result.changes > 0;
}

export function matchTaskType(template: Template, taskTitle: string, taskDescription?: string): string {
  const text = `${taskTitle} ${taskDescription ?? ''}`.toLowerCase();
  for (const [taskType, keywords] of Object.entries(template.keywords)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return taskType;
    }
  }
  return 'implementation';
}

export function getOwnerForTaskType(template: Template, taskType: string): 'ai' | 'human' {
  const rule = template.rules.find((r) => r.task_type === taskType);
  return rule?.requires_human ? 'human' : 'ai';
}

interface TemplateRow {
  id: string;
  name: string;
  version: string;
  rules: string;
  keywords: string;
  is_default: number;
}

function rowToTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    rules: JSON.parse(row.rules) as TemplateRule[],
    keywords: row.keywords ? JSON.parse(row.keywords) : {},
    is_default: row.is_default,
  };
}
