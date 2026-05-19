import { request } from '../lib/fetcher';
import type { DashboardData } from '../types/api';

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/dashboard/');
}
