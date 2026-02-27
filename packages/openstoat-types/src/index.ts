/**
 * OpenStoat shared type definitions
 */

export const TASK_STATUSES = ['ready', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_OWNERS = ['agent_worker', 'human_worker'] as const;
export type TaskOwner = (typeof TASK_OWNERS)[number];

export const TASK_TYPES = [
  'implementation',
  'testing',
  'review',
  'credentials',
  'deploy',
  'docs',
  'custom',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const PROJECT_STATUSES = ['active', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface TemplateRule {
  task_type: TaskType;
  default_owner: TaskOwner;
}

export interface TemplateContext {
  version: string;
  rules: TemplateRule[];
  /** Optional super prompt guiding task splitting, prerequisites, and finish steps. */
  workflow_instructions?: string;
}

export interface Project {
  id: string;
  name: string;
  template_context: TemplateContext;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  depends_on: string[];
  status: TaskStatus;
  owner: TaskOwner;
  task_type: TaskType;
  output: string | null;
  logs: string[];
  created_by: string | null;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Handoff {
  id: string;
  from_task_id: string;
  to_task_id: string | null;
  summary: string;
  created_at: string;
}

export interface CreateTaskInput {
  project: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  depends_on?: string[];
  status: TaskStatus;
  owner: TaskOwner;
  task_type: TaskType;
  created_by?: string;
}

export interface CompleteTaskInput {
  output: string;
  handoff_summary: string;
  logs_append?: string;
}

export interface SelfUnblockInput {
  depends_on: string[];
  logs_append?: string;
}
