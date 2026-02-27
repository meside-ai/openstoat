/**
 * OpenStoat Web - Simple HTTP server for viewing Projects, Tasks, Handoffs
 * Pixel-style UI, URL-persisted filters, task detail page, status transitions
 */

import {
  listProjects,
  listTasks,
  listHandoffs,
  getTask,
  claimTask,
  startTask,
  completeTask,
  selfUnblockTask,
  createTask,
} from 'openstoat-core';
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

function taskCardTooltip(t: Task): string {
  const parts: string[] = [];
  if (t.description) parts.push(escapeHtml(t.description));
  if (t.acceptance_criteria?.length) {
    parts.push('AC: ' + t.acceptance_criteria.map((ac) => escapeHtml(ac)).join('; '));
  }
  return parts.length ? parts.join('\n\n') : 'No description';
}

function renderTaskCard(t: Task): string {
  const tooltip = taskCardTooltip(t);
  const hasTooltip = tooltip !== 'No description';
  const tooltipAttr = hasTooltip ? ` title="${tooltip.replace(/"/g, '&quot;').replace(/\n/g, ' ')}"` : '';
  const backUrl = '/';
  return `<div class="task-card"${tooltipAttr}>
    <a href="/task/${escapeHtml(t.id)}" class="task-link"><span class="task-id">${escapeHtml(t.id)}</span> [${t.owner}] ${escapeHtml(t.title)}</a>
    ${hasTooltip ? '<div class="task-preview">' + escapeHtml(t.description || '') + '</div>' : ''}
  </div>`;
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
    .task-card { background: #0f3460; border: 1px solid #4a4a6a; padding: 8px; margin-bottom: 8px; font-size: 13px; cursor: pointer; }
    .task-card:last-child { margin-bottom: 0; }
    .task-card:hover { border-color: #6a6a8a; }
    .task-link { color: #eaeaea; text-decoration: none; }
    .task-link:hover { text-decoration: underline; }
    .task-id { color: #888; font-size: 12px; }
    .task-preview { font-size: 11px; color: #888; margin-top: 4px; max-height: 2.4em; overflow: hidden; }
    .project-card { background: #16213e; border: 1px solid #4a4a6a; padding: 12px; margin-bottom: 8px; }
    .template-context { margin-top: 8px; font-size: 12px; color: #888; }
    .handoff-card { background: #16213e; border: 1px solid #4a4a6a; padding: 12px; margin-bottom: 8px; font-size: 13px; }
    .handoff-card .summary { color: #b0b0b0; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border: 1px solid #4a4a6a; }
    th { background: #16213e; color: #a0a0ff; }
    .btn { padding: 6px 12px; border: 2px solid #4a4a6a; cursor: pointer; font-family: inherit; font-size: 12px; }
    .btn-primary { background: #0f3460; color: #eaeaea; }
    .btn-primary:hover { background: #1a4a7a; }
    .btn-success { background: #0a4a2a; color: #eaeaea; }
    .btn-success:hover { background: #0f5a3a; }
    .btn-warning { background: #4a3a0a; color: #eaeaea; }
    .btn-warning:hover { background: #5a4a1a; }
    .action-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
    .detail-section { margin: 16px 0; padding: 12px; background: #16213e; border: 1px solid #4a4a6a; }
    .detail-section h3 { margin: 0 0 8px; font-size: 14px; color: #a0a0ff; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; margin-bottom: 4px; color: #888; }
    .form-group textarea { width: 100%; min-height: 80px; padding: 8px; background: #0f3460; border: 1px solid #4a4a6a; color: #eaeaea; font-family: inherit; }
    .form-group input { width: 100%; padding: 8px; background: #0f3460; border: 1px solid #4a4a6a; color: #eaeaea; font-family: inherit; }
    .back-link { color: #a0a0ff; text-decoration: none; margin-bottom: 16px; display: inline-block; }
    .back-link:hover { text-decoration: underline; }
    .log-item { padding: 4px 0; border-bottom: 1px solid #2a2a4a; font-size: 12px; }
    .error { color: #ff6b6b; margin: 8px 0; }
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
      const workflowContent = tc.workflow_instructions
        ? escapeHtml(tc.workflow_instructions)
        : null;
      return `<div class="project-card">
        <strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.id)}) — ${p.status}
        <div class="template-context">Template v${escapeHtml(tc.version)}: ${escapeHtml(rulesDesc)}</div>
        ${workflowContent ? `<div class="workflow-instructions">Workflow: ${workflowContent}</div>` : ''}
      </div>`;
    }).join('')}
  </div>

  <h2>Kanban (Tasks)</h2>
  <div class="kanban">
    <div class="column">
      <h3>Ready</h3>
      ${tasksByStatus.ready.map(renderTaskCard).join('')}
    </div>
    <div class="column">
      <h3>In Progress</h3>
      ${tasksByStatus.in_progress.map(renderTaskCard).join('')}
    </div>
    <div class="column">
      <h3>Done</h3>
      ${tasksByStatus.done.map(renderTaskCard).join('')}
    </div>
  </div>

  <h2>Handoffs</h2>
  <div class="handoff-list">
    ${handoffs.length === 0 ? '<p>No handoffs.</p>' : handoffs.map((h) => `<div class="handoff-card"><span class="task-id">${escapeHtml(h.id)}</span> ${escapeHtml(h.from_task_id)} → ${h.to_task_id ? escapeHtml(h.to_task_id) : 'audit'}<div class="summary">${escapeHtml(h.summary)}</div></div>`).join('')}
  </div>
</body>
</html>`;
}

function renderTaskDetailPage(task: Task, projects: Project[], error?: string): string {
  const handoffsFrom = listHandoffs({ from_task_id: task.id });
  const backUrl = '/';

  let actionButtons = '';
  if (task.status === 'ready' && task.owner === 'agent_worker') {
    actionButtons = `
      <div class="action-row">
        <form method="post" action="/api/task/${task.id}/claim" style="display:inline">
          <button type="submit" class="btn btn-primary">Start</button>
        </form>
        <form method="post" action="/api/task/${task.id}/claim" style="display:inline">
          <button type="submit" class="btn btn-primary">Handoff to AI</button>
        </form>
      </div>`;
  } else if (task.status === 'in_progress' && task.owner === 'agent_worker') {
    actionButtons = `
      <div class="action-row">
        <a href="/task/${task.id}/complete" class="btn btn-success">Complete</a>
        <a href="/task/${task.id}/block" class="btn btn-warning">Block (Self-unblock)</a>
      </div>`;
  } else if (task.status === 'in_progress' && task.owner === 'human_worker') {
    actionButtons = `
      <div class="action-row">
        <a href="/task/${task.id}/complete" class="btn btn-success">Complete</a>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(task.title)} - OpenStoat</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; line-height: 1.5; margin: 0; padding: 16px; background: #1a1a2e; color: #eaeaea; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .back-link { color: #a0a0ff; text-decoration: none; margin-bottom: 16px; display: inline-block; }
    .back-link:hover { text-decoration: underline; }
    .detail-section { margin: 16px 0; padding: 12px; background: #16213e; border: 1px solid #4a4a6a; }
    .detail-section h3 { margin: 0 0 8px; font-size: 14px; color: #a0a0ff; }
    .action-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
    .btn { padding: 6px 12px; border: 2px solid #4a4a6a; cursor: pointer; font-family: inherit; font-size: 12px; text-decoration: none; display: inline-block; }
    .btn-primary { background: #0f3460; color: #eaeaea; }
    .btn-success { background: #0a4a2a; color: #eaeaea; }
    .btn-warning { background: #4a3a0a; color: #eaeaea; }
    .log-item { padding: 4px 0; border-bottom: 1px solid #2a2a4a; font-size: 12px; }
    .error { color: #ff6b6b; margin: 8px 0; }
    .meta { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <a href="${backUrl}" class="back-link">← Back to Kanban</a>
  <h1>${escapeHtml(task.title)}</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <div class="meta">${escapeHtml(task.id)} | ${task.status} | ${task.owner} | ${task.task_type}</div>
  ${actionButtons}

  <div class="detail-section">
    <h3>Description</h3>
    <p>${task.description ? escapeHtml(task.description) : '<em>No description</em>'}</p>
  </div>

  <div class="detail-section">
    <h3>Acceptance Criteria</h3>
    ${task.acceptance_criteria?.length ? '<ul>' + task.acceptance_criteria.map((ac) => `<li>${escapeHtml(ac)}</li>`).join('') + '</ul>' : '<p><em>None</em></p>'}
  </div>

  <div class="detail-section">
    <h3>Dependencies</h3>
    <p>${task.depends_on?.length ? task.depends_on.map((d) => `<a href="/task/${escapeHtml(d)}">${escapeHtml(d)}</a>`).join(', ') : 'None'}</p>
  </div>

  ${task.output ? `<div class="detail-section"><h3>Output</h3><pre>${escapeHtml(task.output)}</pre></div>` : ''}

  <div class="detail-section">
    <h3>Status History (Logs)</h3>
    ${task.logs?.length ? task.logs.map((l) => `<div class="log-item">${escapeHtml(l)}</div>`).join('') : '<p><em>No logs</em></p>'}
  </div>

  ${handoffsFrom.length ? `<div class="detail-section"><h3>Handoffs from this task</h3>${handoffsFrom.map((h) => `<div class="log-item">→ ${h.to_task_id || 'audit'}: ${escapeHtml(h.summary)}</div>`).join('')}</div>` : ''}
</body>
</html>`;
}

function renderCompleteForm(task: Task, error?: string): string {
  const backUrl = `/task/${task.id}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Complete ${escapeHtml(task.id)} - OpenStoat</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; line-height: 1.5; margin: 0; padding: 16px; background: #1a1a2e; color: #eaeaea; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .back-link { color: #a0a0ff; text-decoration: none; margin-bottom: 16px; display: inline-block; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; margin-bottom: 4px; color: #888; }
    .form-group textarea { width: 100%; min-height: 100px; padding: 8px; background: #0f3460; border: 1px solid #4a4a6a; color: #eaeaea; font-family: inherit; }
    .btn { padding: 8px 16px; border: 2px solid #4a4a6a; cursor: pointer; font-family: inherit; background: #0a4a2a; color: #eaeaea; }
    .error { color: #ff6b6b; margin: 8px 0; }
    .hint { color: #888; font-size: 11px; }
  </style>
</head>
<body>
  <a href="${backUrl}" class="back-link">← Back to task</a>
  <h1>Complete: ${escapeHtml(task.title)}</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <form method="post" action="/api/task/${task.id}/complete">
    <div class="form-group">
      <label>Output</label>
      <textarea name="output" placeholder="What was done..."></textarea>
    </div>
    <div class="form-group">
      <label>Handoff Summary (min 200 chars)</label>
      <textarea name="handoff_summary" placeholder="Summary for handoff..."></textarea>
      <div class="hint">Required for completion. Used when passing context to downstream tasks.</div>
    </div>
    <button type="submit" class="btn">Complete Task</button>
  </form>
</body>
</html>`;
}

function renderBlockForm(task: Task, projects: Project[], error?: string): string {
  const backUrl = `/task/${task.id}`;
  const projectOptions = projects.map(
    (p) => `<option value="${escapeHtml(p.id)}" ${p.id === task.project ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Block ${escapeHtml(task.id)} - OpenStoat</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; line-height: 1.5; margin: 0; padding: 16px; background: #1a1a2e; color: #eaeaea; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .back-link { color: #a0a0ff; text-decoration: none; margin-bottom: 16px; display: inline-block; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; margin-bottom: 4px; color: #888; }
    .form-group input, .form-group select { padding: 8px; background: #0f3460; border: 1px solid #4a4a6a; color: #eaeaea; font-family: inherit; width: 100%; }
    .btn { padding: 8px 16px; border: 2px solid #4a4a6a; cursor: pointer; font-family: inherit; background: #4a3a0a; color: #eaeaea; }
    .error { color: #ff6b6b; margin: 8px 0; }
    .hint { color: #888; font-size: 11px; margin-top: 4px; }
  </style>
</head>
<body>
  <a href="${backUrl}" class="back-link">← Back to task</a>
  <h1>Block (Self-unblock): ${escapeHtml(task.title)}</h1>
  <p>Create a human task first (e.g. credentials), then add it as dependency. The agent task will move to Ready until the human task is done.</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <form method="post" action="/api/task/${task.id}/block">
    <div class="form-group">
      <label>Option A: Create new human task</label>
      <input type="text" name="new_task_title" placeholder="Title for human task (e.g. Provide API key)">
      <input type="text" name="new_task_description" placeholder="Description">
      <select name="project">${projectOptions}</select>
      <div class="hint">Leave blank to use Option B.</div>
    </div>
    <div class="form-group">
      <label>Option B: Existing human task ID</label>
      <input type="text" name="depends_on" placeholder="task_002">
      <div class="hint">ID of an existing human_worker task to depend on.</div>
    </div>
    <button type="submit" class="btn">Block & Self-unblock</button>
  </form>
</body>
</html>`;
}

async function parseFormBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text));
  }
  return {};
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API: claim
    if (req.method === 'POST' && path.match(/^\/api\/task\/([^/]+)\/claim$/)) {
      const taskId = path.match(/^\/api\/task\/([^/]+)\/claim$/)![1];
      try {
        claimTask(taskId, 'agent_worker', 'Claimed via Web');
        startTask(taskId, 'agent_worker', 'Started via Web');
        return Response.redirect(`/task/${taskId}`);
      } catch (e) {
        const task = getTask(taskId);
        const projects = listProjects();
        return new Response(renderTaskDetailPage(task!, projects, (e as Error).message), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 400,
        });
      }
    }

    // API: complete
    if (req.method === 'POST' && path.match(/^\/api\/task\/([^/]+)\/complete$/)) {
      const taskId = path.match(/^\/api\/task\/([^/]+)\/complete$/)![1];
      const body = await parseFormBody(req);
      const output = (body.output || '').trim();
      const handoffSummary = (body.handoff_summary || '').trim();
      if (!handoffSummary || handoffSummary.length < 200) {
        const task = getTask(taskId);
        return new Response(renderCompleteForm(task!, `Handoff summary must be at least 200 characters (got ${handoffSummary.length})`), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 400,
        });
      }
      const task = getTask(taskId);
      if (!task) return new Response('Task not found', { status: 404 });
      try {
        completeTask(taskId, { output, handoff_summary: handoffSummary, logs_append: 'Completed via Web' }, task.owner);
      } catch (e) {
        return new Response(renderCompleteForm(task, (e as Error).message), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 400,
        });
      }
      return Response.redirect(`/task/${taskId}`);
    }

    // API: block (self-unblock)
    if (req.method === 'POST' && path.match(/^\/api\/task\/([^/]+)\/block$/)) {
      const taskId = path.match(/^\/api\/task\/([^/]+)\/block$/)![1];
      const body = await parseFormBody(req);
      const projects = listProjects();
      let dependsOn: string[] = [];
      if (body.new_task_title) {
        const currentTask = getTask(taskId);
        const projectId = body.project || currentTask?.project || projects[0]?.id;
        if (!projectId) {
          return new Response(renderBlockForm(getTask(taskId)!, projects, 'No project available'), { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 });
        }
        const newTask = createTask({
          project: projectId,
          title: body.new_task_title,
          description: body.new_task_description || '',
          acceptance_criteria: [],
          status: 'ready',
          owner: 'human_worker',
          task_type: 'credentials',
        });
        dependsOn = [newTask.id];
      } else if (body.depends_on) {
        dependsOn = body.depends_on.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (dependsOn.length === 0) {
        return new Response(renderBlockForm(getTask(taskId)!, projects, 'Provide new task title or existing task ID'), { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 });
      }
      try {
        selfUnblockTask(taskId, { depends_on: dependsOn, logs_append: 'Blocked via Web (self-unblock)' }, 'agent_worker');
        return Response.redirect(`/task/${taskId}`);
      } catch (e) {
        return new Response(renderBlockForm(getTask(taskId)!, projects, (e as Error).message), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 400,
        });
      }
    }

    // Task detail
    if (path.match(/^\/task\/([^/]+)$/)) {
      const taskId = path.match(/^\/task\/([^/]+)$/)![1];
      const task = getTask(taskId);
      if (!task) return new Response('Task not found', { status: 404 });
      const projects = listProjects();
      return new Response(renderTaskDetailPage(task, projects), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Complete form
    if (path.match(/^\/task\/([^/]+)\/complete$/)) {
      const taskId = path.match(/^\/task\/([^/]+)\/complete$/)![1];
      const task = getTask(taskId);
      if (!task) return new Response('Task not found', { status: 404 });
      return new Response(renderCompleteForm(task), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Block form
    if (path.match(/^\/task\/([^/]+)\/block$/)) {
      const taskId = path.match(/^\/task\/([^/]+)\/block$/)![1];
      const task = getTask(taskId);
      if (!task) return new Response('Task not found', { status: 404 });
      const projects = listProjects();
      return new Response(renderBlockForm(task, projects), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Home
    if (path === '/') {
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
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`OpenStoat Web: http://localhost:${PORT} (set PORT env to change)`);
