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
    return (
        is_core_board(user, project.division.organization)
        or is_division_head(user, project.division)
        or is_project_lead(user, project)
    )


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


def can_assign_task(user, assigned_to, division=None, project=None):
    if division is not None:
        if is_core_board(user, division.organization):
            return is_division_member(assigned_to, division)
        if is_division_head(user, division):
            return is_division_member(assigned_to, division)
        if user.id == assigned_to.id:
            return is_division_member(user, division)
        return False

    if project is not None:
        if is_core_board(user, project.division.organization):
            return is_project_member(assigned_to, project)
        if is_division_head(user, project.division):
            return is_project_member(assigned_to, project)
        if is_project_lead(user, project):
            return is_project_member(assigned_to, project)
        if user.id == assigned_to.id:
            return is_project_member(user, project)
        return False

    return user == assigned_to


def can_create_task(user, division=None, project=None):
    if division is not None:
        return is_core_board(user, division.organization) or is_division_member(user, division)
    if project is not None:
        return (
            is_core_board(user, project.division.organization)
            or is_division_member(user, project.division)
            or is_project_member(user, project)
        )
    return True


def can_access_task(user, task):
    if task.created_by_id == user.id:
        return True
    if task.assigned_to.filter(id=user.id).exists():
        return True
    if task.division_id:
        return can_manage_division(user, task.division)
    if task.project_id:
        return (
            is_core_board(user, task.project.division.organization)
            or is_division_head(user, task.project.division)
            or is_project_lead(user, task.project)
        )
    return False


def can_update_task(user, task, changed_fields):
    if task.created_by_id == user.id:
        return True
    org = task.scope_organization
    if is_core_board(user, org):
        return True
    if changed_fields <= {"status"}:
        return task.assigned_to.filter(id=user.id).exists()
    if not task.division_id and not task.project_id:
        return False
    return False


def can_delete_task(user, task):
    if task.created_by_id == user.id:
        return True
    org = task.scope_organization
    if org is None:
        return False
    return is_core_board(user, org)


def can_access_announcement(user, announcement):
    return is_organization_member(user, announcement.organization)


def can_manage_announcement(user, announcement):
    return is_core_board(user, announcement.organization)


def can_access_calendar_event(user, event):
    if event.organization_id:
        return is_organization_member(user, event.organization)
    if event.division_id:
        return is_core_board(user, event.division.organization) or is_division_member(
            user,
            event.division,
        )
    return (
        is_core_board(user, event.project.division.organization)
        or is_division_head(user, event.project.division)
        or is_project_member(user, event.project)
    )


def can_manage_calendar_scope(user, scope):
    if hasattr(scope, "divisions"):
        return is_core_board(user, scope)
    if hasattr(scope, "projects"):
        return can_manage_division(user, scope)
    return (
        is_core_board(user, scope.division.organization)
        or is_division_head(user, scope.division)
        or is_project_lead(user, scope)
    )


def can_manage_calendar_event(user, event):
    if event.organization_id:
        return can_manage_calendar_scope(user, event.organization)
    if event.division_id:
        return can_manage_calendar_scope(user, event.division)
    return can_manage_calendar_scope(user, event.project)


class IsAuthenticated(permissions.IsAuthenticated):
    pass
