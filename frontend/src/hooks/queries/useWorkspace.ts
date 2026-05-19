import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
  createOrganization,
  inviteToOrganization,
  listOrganizations,
} from '../../services/organizations';
import {
  createDivision,
  inviteToDivision,
  listDivisions,
} from '../../services/divisions';
import {
  createProject,
  inviteToProject,
  listProjects,
} from '../../services/projects';

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations,
    queryFn: listOrganizations,
  });
}

export function useDivisions() {
  return useQuery({
    queryKey: queryKeys.divisions,
    queryFn: listDivisions,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: listProjects,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations });
      qc.invalidateQueries({ queryKey: queryKeys.currentUser });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useCreateDivision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDivision,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.divisions });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useInviteToOrganization(organizationId: number) {
  return useMutation({
    mutationFn: (input: Parameters<typeof inviteToOrganization>[1]) =>
      inviteToOrganization(organizationId, input),
  });
}

export function useInviteToDivision(divisionId: number) {
  return useMutation({
    mutationFn: (input: Parameters<typeof inviteToDivision>[1]) =>
      inviteToDivision(divisionId, input),
  });
}

export function useInviteToProject(projectId: number) {
  return useMutation({
    mutationFn: (input: Parameters<typeof inviteToProject>[1]) =>
      inviteToProject(projectId, input),
  });
}
