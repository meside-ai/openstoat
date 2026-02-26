/**
 * Parse and serialize URL query params for view state.
 * All filter conditions are persisted in the URL.
 */

export type ViewType = 'plans' | 'tasks' | 'templates' | 'handoffs' | 'config';

export type TaskStatus =
  | 'pending'
  | 'ai_ready'
  | 'in_progress'
  | 'waiting_human'
  | 'human_done'
  | 'done';

export type TaskOwner = 'ai' | 'human';

export interface FilterParams {
  view: ViewType;
  plan?: string;
  status?: TaskStatus;
  owner?: TaskOwner;
  task?: string;
}

const VALID_STATUSES: TaskStatus[] = [
  'pending',
  'ai_ready',
  'in_progress',
  'waiting_human',
  'human_done',
  'done',
];

const VALID_OWNERS: TaskOwner[] = ['ai', 'human'];

const VALID_VIEWS: ViewType[] = ['plans', 'tasks', 'templates', 'handoffs', 'config'];

export function parseParams(url: URL): FilterParams {
  const view = url.searchParams.get('view');
  const plan = url.searchParams.get('plan') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const owner = url.searchParams.get('owner') ?? undefined;
  const task = url.searchParams.get('task') ?? undefined;

  return {
    view: (VALID_VIEWS.includes(view as ViewType) ? view : 'plans') as ViewType,
    plan: plan || undefined,
    status: status && VALID_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : undefined,
    owner: owner && VALID_OWNERS.includes(owner as TaskOwner) ? (owner as TaskOwner) : undefined,
    task: task || undefined,
  };
}

export function buildUrl(basePath: string, params: Partial<FilterParams>): string {
  const search = new URLSearchParams();
  if (params.view) search.set('view', params.view);
  if (params.plan) search.set('plan', params.plan);
  if (params.status) search.set('status', params.status);
  if (params.owner) search.set('owner', params.owner);
  if (params.task) search.set('task', params.task);
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function mergeParams(current: FilterParams, overrides: Partial<FilterParams>): FilterParams {
  return { ...current, ...overrides };
}
