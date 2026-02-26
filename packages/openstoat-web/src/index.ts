/**
 * OpenStoat Web - Simple HTTP server for viewing Projects, Tasks, Handoffs
 * Pixel-style UI, URL-persisted filters
 */

import { listProjects, listTasks, listHandoffs } from 'openstoat-core';
import type { Project, Task, Handoff, TaskStatus } from 'openstoat-types';
import { TASK_STATUSES } from 'openstoat-types';

const PORT = Number(process.env.PORT) || 3080;

interface FilterParams {
  project?: string;
  status?: TaskStatus[];
  owner?: string;
  task_type?: string;
}

function parseQuery(url: URL): FilterParams {
  const params: FilterParams = {};
  const project = url.searchParams.get('project');
  if (project) params.project = project;
  const status = url.searchParams.get('status');
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    params.status = statuses.filter((s): s is TaskStatus => TASK_STATUSES.includes(s as TaskStatus));
  }
  const owner = url.searchParams.get('owner');
  if (owner) params.owner = owner;
  const taskType = url.searchParams.get('task_type');
  if (taskType) params.task_type = taskType;
  return params;
}

function buildFilterUrl(base: string, overrides: Partial<FilterParams>): string {
  const params = new URLSearchParams();
  if (overrides.project) params.set('project', overrides.project);
  if (overrides.status?.length) params.set('status', overrides.status.join(','));
  if (overrides.owner) params.set('owner', overrides.owner);
  if (overrides.task_type) params.set('task_type', overrides.task_type);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(filters: FilterParams, projects: Project[], tasks: Task[], handoffs: Handoff[]): string {
  const base = '/';
  const projectLinks = projects.map(
    (p) =>
      `<a href="${buildFilterUrl(base, { ...filters, project: p.id })}" class="filter-link ${filters.project === p.id ? 'active' : ''}">${escapeHtml(p.name)}</a>`
  );
  const statusOpts: { v: TaskStatus[] | undefined; l: string }[] = [
    { v: undefined, l: 'all' },
    { v: ['ready'], l: 'ready' },
    { v: ['in_progress'], l: 'in_progress' },
    { v: ['done'], l: 'done' },
    { v: ['ready', 'in_progress'], l: 'unfinished' },
  ];
  const statusLinks = statusOpts.map(
    (s) =>
      `<a href="${buildFilterUrl(base, { ...filters, status: s.v })}" class="filter-link ${JSON.stringify(filters.status || []) === JSON.stringify(s.v || []) ? 'active' : ''}">${s.l}</a>`
  );
  const ownerLinks = [
    { v: undefined, l: 'all' },
    { v: 'agent_worker', l: 'agent' },
    { v: 'human_worker', l: 'human' },
  ].map(
    (o) =>
      `<a href="${buildFilterUrl(base, { ...filters, owner: o.v })}" class="filter-link ${filters.owner === o.v ? 'active' : ''}">${o.l}</a>`
  );
  const taskTypeLinks = [
    undefined,
    'implementation',
    'testing',
    'review',
    'credentials',
    'deploy',
    'docs',
    'custom',
  ].map(
    (t) =>
      `<a href="${buildFilterUrl(base, { ...filters, task_type: t })}" class="filter-link ${(filters.task_type || '') === (t || '') ? 'active' : ''}">${t || 'all'}</a>`
  );

  const tasksByStatus = {
    ready: tasks.filter((t) => t.status === 'ready'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenStoat</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: "JetBrains Mono", ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 13px; line-height: 1.5; margin: 0; padding: 16px; background: #1a1a2e; color: #eaeaea; -webkit-font-smoothing: antialiased; }
    h1 { font-size: 20px; margin: 0 0 16px; border-bottom: 2px solid #4a4a6a; padding-bottom: 8px; }
    h2 { font-size: 16px; margin: 24px 0 12px; color: #a0a0ff; }
    .filters { margin-bottom: 16px; padding: 12px; background: #16213e; border: 1px solid #4a4a6a; }
    .filters label { display: block; font-size: 13px; color: #888; margin-bottom: 4px; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
    .filter-row:last-child { margin-bottom: 0; }
    .filter-link { padding: 6px 10px; background: #0f3460; color: #eaeaea; text-decoration: none; border: 2px solid #4a4a6a; }
    .filter-link:hover { background: #1a4a7a; }
    .filter-link.active { background: #4a4a6a; border-color: #a0a0ff; }
    .kanban { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .column { background: #16213e; border: 1px solid #4a4a6a; padding: 12px; min-height: 120px; }
    .column h3 { font-size: 14px; margin: 0 0 12px; color: #a0a0ff; }
    .task-card { background: #0f3460; border: 1px solid #4a4a6a; padding: 8px; margin-bottom: 8px; font-size: 13px; }
    .task-card:last-child { margin-bottom: 0; }
    .task-id { color: #888; font-size: 12px; }
    .project-card { background: #16213e; border: 1px solid #4a4a6a; padding: 12px; margin-bottom: 8px; }
    .template-context { margin-top: 8px; font-size: 12px; color: #888; }
    .handoff-card { background: #16213e; border: 1px solid #4a4a6a; padding: 12px; margin-bottom: 8px; font-size: 13px; }
    .handoff-card .summary { color: #b0b0b0; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border: 1px solid #4a4a6a; }
    th { background: #16213e; color: #a0a0ff; }
  </style>
</head>
<body>
  <h1>OpenStoat</h1>

  <div class="filters">
    <label>Project</label>
    <div class="filter-row">
      <a href="${buildFilterUrl(base, { ...filters, project: undefined })}" class="filter-link ${!filters.project ? 'active' : ''}">all</a>
      ${projectLinks.join(' ')}
    </div>
    <label>Status</label>
    <div class="filter-row">${statusLinks.join(' ')}</div>
    <label>Owner</label>
    <div class="filter-row">${ownerLinks.join(' ')}</div>
    <label>Task type</label>
    <div class="filter-row">${taskTypeLinks.join(' ')}</div>
  </div>

  <h2>Projects</h2>
  <div class="project-list">
    ${projects.length === 0 ? '<p>No projects.</p>' : projects.map((p) => {
      const tc = p.template_context;
      const rulesDesc = tc.rules.map((r) => `${r.task_type}→${r.default_owner}`).join(', ');
      return `<div class="project-card">
        <strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.id)}) — ${p.status}
        <div class="template-context">Template v${escapeHtml(tc.version)}: ${escapeHtml(rulesDesc)}</div>
      </div>`;
    }).join('')}
  </div>

  <h2>Kanban (Tasks)</h2>
  <div class="kanban">
    <div class="column">
      <h3>Ready</h3>
      ${tasksByStatus.ready.map((t) => `<div class="task-card"><span class="task-id">${escapeHtml(t.id)}</span> [${t.owner}] ${escapeHtml(t.title)}</div>`).join('')}
    </div>
    <div class="column">
      <h3>In Progress</h3>
      ${tasksByStatus.in_progress.map((t) => `<div class="task-card"><span class="task-id">${escapeHtml(t.id)}</span> [${t.owner}] ${escapeHtml(t.title)}</div>`).join('')}
    </div>
    <div class="column">
      <h3>Done</h3>
      ${tasksByStatus.done.map((t) => `<div class="task-card"><span class="task-id">${escapeHtml(t.id)}</span> [${t.owner}] ${escapeHtml(t.title)}</div>`).join('')}
    </div>
  </div>

  <h2>Handoffs</h2>
  <div class="handoff-list">
    ${handoffs.length === 0 ? '<p>No handoffs.</p>' : handoffs.map((h) => `<div class="handoff-card"><span class="task-id">${escapeHtml(h.id)}</span> ${escapeHtml(h.from_task_id)} → ${h.to_task_id ? escapeHtml(h.to_task_id) : 'audit'}<div class="summary">${escapeHtml(h.summary.slice(0, 200))}${h.summary.length > 200 ? '...' : ''}</div></div>`).join('')}
  </div>
</body>
</html>`;
}

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== '/') {
      return new Response('Not found', { status: 404 });
    }
    const filters = parseQuery(url);
    const projects = listProjects();
    const tasks = listTasks(filters.project, {
      status: filters.status,
      owner: filters.owner,
      task_type: filters.task_type,
    });
    const handoffs = listHandoffs();
    const html = renderHtml(filters, projects, tasks, handoffs);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
});

console.log(`OpenStoat Web: http://localhost:${PORT} (set PORT env to change)`);
