import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, getProfile, updateProfile } from '../../services/auth';
import { queryKeys } from '../../lib/queryClient';
import type { Profile } from '../../types/api';

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: getProfile,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<Profile>) => updateProfile(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profile });
      qc.invalidateQueries({ queryKey: queryKeys.currentUser });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
