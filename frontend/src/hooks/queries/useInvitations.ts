import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptInvitation } from '../../services/invitations';
import { useAuth } from '../../context/AuthContext';

export function useAcceptInvitation() {
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: async () => {
      await refreshUser();
      await qc.invalidateQueries();
    },
  });
}
