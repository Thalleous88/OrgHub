import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../services/dashboard';
import { queryKeys } from '../../lib/queryClient';

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: getDashboard,
    staleTime: 15_000,
  });
}
