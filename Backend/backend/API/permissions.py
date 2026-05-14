from rest_framework import permissions

from .models import DivisionMembership, OrganizationMembership, ProjectMembership


def is_core_board(user, organization):
    return OrganizationMembership.objects.filter(
        user=user,
        organization=organization,
        role=OrganizationMembership.Role.CORE_BOARD,
        is_active=True,
    ).exists()


def is_division_head(user, division):
    return DivisionMembership.objects.filter(
        user=user,
        division=division,
        role=DivisionMembership.Role.DIVISION_HEAD,
        is_active=True,
    ).exists()


def is_project_member(user, project):
    return ProjectMembership.objects.filter(
        user=user,
        project=project,
        is_active=True,
    ).exists()


def can_manage_division(user, division):
    return is_core_board(user, division.organization) or is_division_head(user, division)


def can_manage_project_members(user, project):
    return can_manage_division(user, project.division)


class IsAuthenticated(permissions.IsAuthenticated):
    pass
