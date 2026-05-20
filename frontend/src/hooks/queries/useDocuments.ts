import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
  deleteDocument,
  listScopeDocuments,
  uploadScopeDocument,
} from '../../services/documents';
import type { Scope } from '../../types/api';

export function useScopeDocuments(scope: Scope, scopeId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.documents(scope, scopeId ?? -1),
    queryFn: () => listScopeDocuments(scope, scopeId as number),
    enabled: Boolean(scopeId),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      scope: Scope;
      scopeId: number;
      input: { title: string; description?: string; file: File };
    }) => uploadScopeDocument(vars.scope, vars.scopeId, vars.input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.documents(vars.scope, vars.scopeId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
