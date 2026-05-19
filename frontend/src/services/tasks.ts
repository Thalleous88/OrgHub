import { request } from '../lib/fetcher';
import type { Task, TaskStatus } from '../types/api';

export interface TaskCreateInput {
  division?: number;
  project?: number;
  title: string;
  description?: string;
  status?: TaskStatus;
  due_at?: string | null;
  assigned_to: number;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  due_at?: string | null;
  assigned_to?: number;
  division?: number;
  project?: number;
}

export async function listTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks/');
}

export async function getTask(id: number): Promise<Task> {
  return request<Task>(`/tasks/${id}/`);
}

export async function createTask(input: TaskCreateInput): Promise<Task> {
  return request<Task>('/tasks/', {
    method: 'POST',
    body: input,
  });
}

export async function updateTask(id: number, input: TaskUpdateInput): Promise<Task> {
  return request<Task>(`/tasks/${id}/`, {
    method: 'PATCH',
    body: input,
  });
}

export async function deleteTask(id: number): Promise<void> {
  await request<null>(`/tasks/${id}/`, {
    method: 'DELETE',
    expectNoContent: true,
  });
}
