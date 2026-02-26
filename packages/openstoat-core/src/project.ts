/**
 * Project model (template-bound)
 */

import { getDb } from './db.js';
import type { Project, TemplateContext } from 'openstoat-types';

export function createProject(
  id: string,
  name: string,
  template: string
): Project {
  const templateContext: TemplateContext = {
    version: '1.0',
    rules: getTemplateRules(template),
  };

  const db = getDb();
  const now = new Date().toISOString();

  db.query(
    `INSERT INTO projects (id, name, template_context, status, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?)`
  ).run(id, name, JSON.stringify(templateContext), now, now);

  return {
    id,
    name,
    template_context: templateContext,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}

function getTemplateRules(template: string): TemplateContext['rules'] {
  // Default template rules; can be extended for named templates
  const rules: TemplateContext['rules'] = [
    { task_type: 'credentials', default_owner: 'human_worker' },
    { task_type: 'implementation', default_owner: 'agent_worker' },
    { task_type: 'testing', default_owner: 'agent_worker' },
    { task_type: 'review', default_owner: 'human_worker' },
    { task_type: 'deploy', default_owner: 'human_worker' },
    { task_type: 'docs', default_owner: 'agent_worker' },
    { task_type: 'custom', default_owner: 'agent_worker' },
  ];
  return rules;
}

export function getProject(id: string): Project | null {
  const db = getDb();
  const row = db.query('SELECT * FROM projects WHERE id = ?').get(id) as {
    id: string;
    name: string;
    template_context: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    template_context: JSON.parse(row.template_context) as TemplateContext,
    status: row.status as Project['status'],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listProjects(): Project[] {
  const db = getDb();
  const rows = db.query('SELECT * FROM projects ORDER BY created_at DESC').all() as {
    id: string;
    name: string;
    template_context: string;
    status: string;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    template_context: JSON.parse(row.template_context) as TemplateContext,
    status: row.status as Project['status'],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
