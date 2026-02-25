// Plan
export type PlanStatus = 'planned' | 'in_progress' | 'completed';

export interface Plan {
  id: string;
  title: string;
  description: string | null;
  status: PlanStatus;
  created_at: string;
  updated_at: string | null;
}

// Task
export type TaskOwner = 'ai' | 'human';
export type TaskStatus =
  | 'pending'
  | 'ai_ready'
  | 'in_progress'
  | 'waiting_human'
  | 'human_done'
  | 'done';

export interface Task {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  owner: TaskOwner;
  status: TaskStatus;
  depends_on: string[];
  output: unknown;
  created_at: string;
  updated_at: string | null;
}

// Template
export interface TemplateRule {
  task_type: string;
  requires_human: boolean;
  human_action?: string;
  prompt?: string;
}

export interface Template {
  id: string;
  name: string;
  version: string;
  rules: TemplateRule[];
  keywords: Record<string, string[]>;
  is_default: number;
}

// Handoff
export interface HandoffArtifact {
  type: string;
  [key: string]: unknown;
}

export interface Handoff {
  id: string;
  from_task_id: string;
  to_task_id: string;
  summary: string;
  artifacts: HandoffArtifact[];
  created_at: string;
}
