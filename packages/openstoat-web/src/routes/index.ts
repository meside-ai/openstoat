/**
 * Route handlers for each view.
 * Fetches data from core and renders HTML.
 */

import {
  listPlans,
  getPlan,
  getTask,
  listTasks,
  listTemplates,
  listHandoffs,
  listHandoffsByTask,
  getAllConfig,
  getTaskEvents,
} from '@openstoat/core';
import type { FilterParams } from './filters';
import { parseParams, buildUrl } from './filters';
import { page, escapeHtml, link } from '../html';

const BASE = '/';

export function handleRequest(url: URL): Response {
  const params = parseParams(url);

  switch (params.view) {
    case 'plans':
      return new Response(renderPlans(params), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    case 'tasks':
      return new Response(renderTasks(params), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    case 'templates':
      return new Response(renderTemplates(params), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    case 'handoffs':
      return new Response(renderHandoffs(params), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    case 'config':
      return new Response(renderConfig(params), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    default:
      return new Response(renderPlans(params), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
  }
}

function renderPlans(params: FilterParams): string {
  const plans = listPlans();
  const planId = params.plan;
  const selectedPlan = planId ? getPlan(planId) : null;

  let body = '';

  if (selectedPlan) {
    const tasks = listTasks({ planId: selectedPlan.id });
    body += `
      <div class="detail-section">
        <h2>Plan: ${escapeHtml(selectedPlan.title)}</h2>
        <p><strong>ID:</strong> ${escapeHtml(selectedPlan.id)}</p>
        <p><strong>Status:</strong> ${escapeHtml(selectedPlan.status)}</p>
        <p><strong>Description:</strong> ${escapeHtml(selectedPlan.description ?? '-')}</p>
      </div>
      <div class="detail-section">
        <h2>Tasks (${tasks.length})</h2>
        <table>
          <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Owner</th><th>Status</th><th>Priority</th></tr></thead>
          <tbody>
            ${tasks
              .map(
                (t) =>
                  `<tr>
                <td>${link(t.id, buildUrl(BASE, { ...params, view: 'tasks', plan: t.plan_id, task: t.id }))}</td>
                <td>${escapeHtml(t.title)}</td>
                <td>${escapeHtml(t.task_type)}</td>
                <td>${escapeHtml(t.owner)}</td>
                <td>${escapeHtml(t.status)}</td>
                <td>${t.priority}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  body += `
    <div class="detail-section">
      <h2>All Plans</h2>
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          ${plans
            .map(
              (p) =>
                `<tr>
              <td>${link(p.id, buildUrl(BASE, { ...params, view: 'plans', plan: p.id }))}</td>
              <td>${escapeHtml(p.title)}</td>
              <td>${escapeHtml(p.status)}</td>
              <td>${escapeHtml(p.created_at)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  return page('Plans', body, params, BASE);
}

function renderTasks(params: FilterParams): string {
  const tasks = listTasks({
    status: params.status,
    owner: params.owner,
    planId: params.plan,
  });
  const plans = listPlans();
  const selectedTask = params.task ? getTask(params.task) : null;

  const statusOptions = [
    '',
    'pending',
    'ai_ready',
    'in_progress',
    'waiting_human',
    'human_done',
    'done',
  ];
  const ownerOptions = ['', 'ai', 'human'];

  const filterForm = `
    <form class="filter-form" method="get" action="${BASE}">
      <input type="hidden" name="view" value="tasks">
      <label>Status: <select name="status" onchange="this.form.submit()">
        ${statusOptions.map((s) => `<option value="${s}"${params.status === s ? ' selected' : ''}>${s || '(all)'}</option>`).join('')}
      </select></label>
      <label>Owner: <select name="owner" onchange="this.form.submit()">
        ${ownerOptions.map((o) => `<option value="${o}"${params.owner === o ? ' selected' : ''}>${o || '(all)'}</option>`).join('')}
      </select></label>
      <label>Plan: <select name="plan" onchange="this.form.submit()">
        <option value="">(all)</option>
        ${plans.map((p) => `<option value="${p.id}"${params.plan === p.id ? ' selected' : ''}>${p.id}</option>`).join('')}
      </select></label>
    </form>
  `;

  let body = '';

  if (selectedTask) {
    const events = getTaskEvents(selectedTask.id);
    body += `
      <div class="detail-section">
        <h2>Task: ${escapeHtml(selectedTask.title)}</h2>
        <p><strong>ID:</strong> ${escapeHtml(selectedTask.id)}</p>
        <p><strong>Plan:</strong> ${link(selectedTask.plan_id, buildUrl(BASE, { ...params, view: 'plans', plan: selectedTask.plan_id }))}</p>
        <p><strong>Owner:</strong> ${escapeHtml(selectedTask.owner)}</p>
        <p><strong>Status:</strong> ${escapeHtml(selectedTask.status)}</p>
        <p><strong>Type:</strong> ${escapeHtml(selectedTask.task_type)}</p>
        <p><strong>Priority:</strong> ${selectedTask.priority}</p>
        <p><strong>Description:</strong> ${escapeHtml(selectedTask.description ?? '-')}</p>
        <p><strong>Acceptance criteria:</strong> ${escapeHtml(selectedTask.acceptance_criteria ?? '-')}</p>
        ${selectedTask.waiting_reason ? `<p><strong>Waiting reason:</strong> <span style="color:#c00">${escapeHtml(selectedTask.waiting_reason)}</span></p>` : ''}
        <p><strong>Depends on:</strong> ${selectedTask.depends_on.length ? selectedTask.depends_on.map((d) => link(d, buildUrl(BASE, { ...params, task: d }))).join(', ') : 'none'}</p>
        <p><a href="${escapeHtml(buildUrl(BASE, { ...params, view: 'handoffs', task: selectedTask.id }))}">View handoffs for this task</a></p>
        ${events.length > 0 ? `
        <h3>Status history</h3>
        <table>
          <thead><tr><th>Time</th><th>From</th><th>To</th><th>Reason</th></tr></thead>
          <tbody>
            ${events.map((e) => `<tr><td>${escapeHtml(e.created_at)}</td><td>${escapeHtml(e.from_status ?? '-')}</td><td>${escapeHtml(e.to_status)}</td><td>${escapeHtml(e.reason ?? '-')}</td></tr>`).join('')}
          </tbody>
        </table>
        ` : ''}
      </div>
    `;
  }

  body += `
    <div class="detail-section">
      <h2>Tasks (${tasks.length})</h2>
      <table>
        <thead><tr><th>ID</th><th>Plan</th><th>Title</th><th>Type</th><th>Owner</th><th>Status</th><th>Priority</th><th>Created</th></tr></thead>
        <tbody>
          ${tasks
            .map(
              (t) =>
                `<tr>
              <td>${link(t.id, buildUrl(BASE, { ...params, task: t.id }))}</td>
              <td>${link(t.plan_id, buildUrl(BASE, { ...params, view: 'plans', plan: t.plan_id }))}</td>
              <td>${escapeHtml(t.title)}</td>
              <td>${escapeHtml(t.task_type)}</td>
              <td>${escapeHtml(t.owner)}</td>
              <td>${escapeHtml(t.status)}</td>
              <td>${t.priority}</td>
              <td>${escapeHtml(t.created_at)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  return page('Tasks', filterForm + body, params, BASE);
}

function renderTemplates(params: FilterParams): string {
  const templates = listTemplates();

  const table = `
    <table>
      <thead><tr><th>ID</th><th>Name</th><th>Version</th><th>Default</th></tr></thead>
      <tbody>
        ${templates
          .map(
            (t) =>
              `<tr>
            <td>${escapeHtml(t.id)}</td>
            <td>${escapeHtml(t.name)}</td>
            <td>${escapeHtml(t.version)}</td>
            <td>${t.is_default ? 'yes' : ''}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    ${templates
      .map(
        (t) => `
    <div class="detail-section">
      <h2>${escapeHtml(t.name)} (${escapeHtml(t.id)})</h2>
      <p><strong>Rules:</strong></p>
      <pre>${escapeHtml(JSON.stringify(t.rules, null, 2))}</pre>
      <p><strong>Keywords:</strong></p>
      <pre>${escapeHtml(JSON.stringify(t.keywords, null, 2))}</pre>
    </div>
    `
      )
      .join('')}
  `;

  return page('Templates', table, params, BASE);
}

function renderHandoffs(params: FilterParams): string {
  const handoffs = params.task
    ? listHandoffsByTask(params.task)
    : listHandoffs();
  const tasks = listTasks();

  const taskOptions = tasks.map((t) => t.id);
  const filterForm = `
    <form class="filter-form" method="get" action="${BASE}">
      <input type="hidden" name="view" value="handoffs">
      <label>Task: <select name="task" onchange="this.form.submit()">
        <option value="">(all)</option>
        ${taskOptions.map((tid) => `<option value="${tid}"${params.task === tid ? ' selected' : ''}>${tid}</option>`).join('')}
      </select></label>
    </form>
  `;

  const table = `
    <table>
      <thead><tr><th>ID</th><th>From Task</th><th>To Task</th><th>Summary</th><th>Created</th></tr></thead>
      <tbody>
        ${handoffs
          .map((h) => {
            const fromPlan = getTask(h.from_task_id)?.plan_id;
            const toPlan = getTask(h.to_task_id)?.plan_id;
            const fromLink = fromPlan
              ? link(h.from_task_id, buildUrl(BASE, { ...params, view: 'plans', plan: fromPlan }))
              : escapeHtml(h.from_task_id);
            const toLink = toPlan
              ? link(h.to_task_id, buildUrl(BASE, { ...params, view: 'plans', plan: toPlan }))
              : escapeHtml(h.to_task_id);
            return `<tr>
            <td>${escapeHtml(h.id)}</td>
            <td>${fromLink}</td>
            <td>${toLink}</td>
            <td>${escapeHtml(h.summary)}</td>
            <td>${escapeHtml(h.created_at)}</td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  `;

  return page('Handoffs', filterForm + table, params, BASE);
}

function renderConfig(params: FilterParams): string {
  const config = getAllConfig();
  const entries = Object.entries(config);

  const table =
    entries.length > 0
      ? `
    <table>
      <thead><tr><th>Key</th><th>Value</th></tr></thead>
      <tbody>
        ${entries.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}
      </tbody>
    </table>
  `
      : '<p>No config entries.</p>';

  return page('Config', table, params, BASE);
}
