import type { Template } from '@openstoat/types';
import { createPlan } from './plan';
import { createTask } from './task';
import { getDefaultTemplate } from './template';
import { matchTaskType, getOwnerForTaskType } from './template';

export interface ParsedTask {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  order: number;
}

function parseAcceptanceCriteria(desc: string): { description: string; acceptanceCriteria: string } {
  const acPatterns = [/^Acceptance:\s*(.+)$/im, /^AC:\s*(.+)$/im, /^验收[：:]\s*(.+)$/im];
  const lines = desc.split('\n');
  let descriptionLines: string[] = [];
  let acceptanceCriteria = '';
  for (const line of lines) {
    let matched = false;
    for (const re of acPatterns) {
      const m = re.exec(line.trim());
      if (m) {
        acceptanceCriteria = m[1].trim();
        matched = true;
        break;
      }
    }
    if (!matched) {
      descriptionLines.push(line);
    }
  }
  return {
    description: descriptionLines.join('\n').trim() || desc,
    acceptanceCriteria: acceptanceCriteria || desc,
  };
}

export function parsePlanText(text: string): ParsedTask[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const tasks: ParsedTask[] = [];
  let currentTitle = '';
  let currentDesc: string[] = [];
  let order = 0;
  let seenFirstNumbered = false;

  for (const line of lines) {
    const numbered = /^(\d+)[\.\)]\s*(.+)$/.exec(line);
    const dash = /^[-*]\s*(.+)$/.exec(line);
    if (numbered) {
      if (seenFirstNumbered && currentTitle) {
        const rawDesc = currentDesc.join('\n').trim();
        const { description, acceptanceCriteria } = rawDesc ? parseAcceptanceCriteria(rawDesc) : { description: '', acceptanceCriteria: '' };
        tasks.push({
          title: currentTitle,
          description: description || undefined,
          acceptanceCriteria: acceptanceCriteria || undefined,
          order: order++,
        });
      }
      seenFirstNumbered = true;
      currentTitle = numbered[2];
      currentDesc = [];
    } else if (dash) {
      if (currentTitle) {
        currentDesc.push(dash[1]);
      } else if (seenFirstNumbered) {
        currentDesc.push(dash[1]);
      } else {
        currentTitle = dash[1];
        currentDesc = [];
      }
    } else if (line) {
      if (currentTitle) {
        currentDesc.push(line);
      } else if (!seenFirstNumbered) {
        currentTitle = line;
        currentDesc = [];
      }
    }
  }
  if (currentTitle) {
    const rawDesc = currentDesc.join('\n').trim();
    const { description, acceptanceCriteria } = rawDesc ? parseAcceptanceCriteria(rawDesc) : { description: '', acceptanceCriteria: '' };
    tasks.push({
      title: currentTitle,
      description: description || undefined,
      acceptanceCriteria: acceptanceCriteria || undefined,
      order: order++,
    });
  }
  return tasks;
}

export function splitPlanToTasks(planText: string, template?: Template | null): { planId: string; taskIds: string[] } {
  const templateToUse = template ?? getDefaultTemplate();
  const firstLine = planText.split('\n')[0]?.trim() ?? 'Untitled Plan';
  const plan = createPlan(firstLine, planText);
  const parsed = parsePlanText(planText);
  const taskIds: string[] = [];
  const taskIdByOrder: string[] = [];

  for (const pt of parsed) {
    const taskType = templateToUse ? matchTaskType(templateToUse, pt.title, pt.description) : 'implementation';
    const owner = templateToUse ? getOwnerForTaskType(templateToUse, taskType) : 'ai';
    const dependsOn: string[] = [];
    const prevId = taskIdByOrder[taskIdByOrder.length - 1];
    if (prevId) dependsOn.push(prevId);
    const task = createTask({
      planId: plan.id,
      title: pt.title,
      description: pt.description ?? pt.title,
      acceptanceCriteria: pt.acceptanceCriteria ?? pt.description ?? pt.title,
      owner,
      dependsOn: dependsOn.length ? dependsOn : undefined,
      taskType,
      priority: -pt.order,
    });
    taskIds.push(task.id);
    taskIdByOrder.push(task.id);
  }

  return { planId: plan.id, taskIds };
}
