import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptInvitation } from '../../services/invitations';

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
