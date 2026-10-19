import { api } from '@/lib/os/client';
import { today, type Task } from '@/lib/os/model';

export type TaskDraft = Omit<Task, 'id' | 'stage_on' | 'closed_on' | 'reason'>;

export function blankTask(patch: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: '',
    kind: 'task',
    repeat: 'once',
    owner: '',
    stage: 'Queued',
    started_on: today(),
    deadline: null,
    hours: null,
    cost_aed: null,
    note: '',
    priority: 'Medium',
    blocker: '',
    link_type: null,
    link_id: null,
    ...patch,
  };
}

export function draftOf(task: Task): TaskDraft {
  return blankTask({
    title: task.title,
    kind: task.kind || 'task',
    repeat: task.repeat || 'once',
    owner: task.owner || '',
    stage: task.stage,
    started_on: task.started_on || today(),
    deadline: task.deadline,
    hours: task.hours,
    cost_aed: task.cost_aed,
    note: task.note || '',
    priority: task.priority || 'Medium',
    blocker: task.blocker || '',
    link_type: task.link_type,
    link_id: task.link_id,
  });
}

/** The work API replaces the whole task, so every write sends every field. */
export function saveTask(id: string | null, draft: TaskDraft): Promise<Task> {
  const body = { ...draft, today: today() };
  return id ? api<Task>(`work/${id}`, { method: 'PUT', json: body }) : api<Task>('work', { method: 'POST', json: body });
}

export function closeTask(id: string, how: 'archive' | 'round'): Promise<Task> {
  return api<Task>(`work/${id}/${how}`, { method: 'POST', json: { today: today() } });
}

export function restoreTask(id: string): Promise<Task> {
  return api<Task>(`work/${id}/restore`, { method: 'POST', json: {} });
}
