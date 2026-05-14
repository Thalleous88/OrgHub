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


def is_project_lead(user, project):
    return ProjectMembership.objects.filter(
        user=user,
        project=project,
        role=ProjectMembership.Role.PROJECT_LEAD,
        is_active=True,
    ).exists()


def is_organization_member(user, organization):
    return OrganizationMembership.objects.filter(
        user=user,
        organization=organization,
        is_active=True,
    ).exists()


def is_division_member(user, division):
    return DivisionMembership.objects.filter(
        user=user,
        division=division,
        is_active=True,
    ).exists()


def can_manage_division(user, division):
    return is_core_board(user, division.organization) or is_division_head(user, division)


def can_manage_project_members(user, project):
    return can_manage_division(user, project.division)


def can_access_resource_document(user, document):
    if document.organization_id:
        return is_organization_member(user, document.organization)
    if document.division_id:
        return is_core_board(user, document.division.organization) or is_division_member(
            user,
            document.division,
        )
    return (
        is_core_board(user, document.project.division.organization)
        or is_division_head(user, document.project.division)
        or is_project_member(user, document.project)
    )


def can_access_repository(user, scope):
    if hasattr(scope, "divisions"):
        return is_organization_member(user, scope)
    if hasattr(scope, "projects"):
        return is_core_board(user, scope.organization) or is_division_member(user, scope)
    return (
        is_core_board(user, scope.division.organization)
        or is_division_head(user, scope.division)
        or is_project_member(user, scope)
    )


def can_upload_resource_document(user, scope):
    if hasattr(scope, "divisions"):
        return is_core_board(user, scope)
    if hasattr(scope, "projects"):
        return can_manage_division(user, scope)
    return (
        is_core_board(user, scope.division.organization)
        or is_division_head(user, scope.division)
        or is_project_lead(user, scope)
    )


def can_delete_resource_document(user, document):
    if document.organization_id:
        return is_core_board(user, document.organization)
    if document.division_id:
        return can_manage_division(user, document.division)
    return (
        is_core_board(user, document.project.division.organization)
        or is_division_head(user, document.project.division)
        or is_project_lead(user, document.project)
    )


class IsAuthenticated(permissions.IsAuthenticated):
    pass
