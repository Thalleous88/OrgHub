import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
  createOrganization,
  inviteToOrganization,
  leaveOrganization,
  listOrgMembers,
  listOrganizations,
} from '../../services/organizations';
import {
  createDivision,
  inviteToDivision,
  listDivisionMembers,
  listDivisions,
} from '../../services/divisions';
import {
  createProject,
  inviteToProject,
  listProjectMembers,
  listProjects,
} from '../../services/projects';
import { useAuth } from '../../context/AuthContext';

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
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: async () => {
      await refreshUser();
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.organizations }),
        qc.invalidateQueries({ queryKey: queryKeys.currentUser }),
        qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
    },
  });
}

export function useLeaveOrganization() {
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: leaveOrganization,
    onSuccess: async () => {
      await refreshUser();
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.organizations }),
        qc.invalidateQueries({ queryKey: queryKeys.divisions }),
        qc.invalidateQueries({ queryKey: queryKeys.projects }),
        qc.invalidateQueries({ queryKey: queryKeys.currentUser }),
        qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
        qc.invalidateQueries({ queryKey: queryKeys.announcementsFeed }),
      ]);
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

export function useOrganizationMembers(orgId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.orgMembers(orgId ?? -1),
    queryFn: () => listOrgMembers(orgId as number),
    enabled: Boolean(orgId),
  });
}

export function useDivisionMembers(divisionId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.divMembers(divisionId ?? -1),
    queryFn: () => listDivisionMembers(divisionId as number),
    enabled: Boolean(divisionId),
  });
}

export function useProjectMembers(projectId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.projMembers(projectId ?? -1),
    queryFn: () => listProjectMembers(projectId as number),
    enabled: Boolean(projectId),
  });
}
