from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from .models import (
    CalendarEvent,
    DivisionMembership,
    Notification,
    OrganizationMembership,
    Task,
)


User = get_user_model()


def generate_due_reminders(now=None, window=None):
    now = now or timezone.now()
    window = window or timedelta(hours=24)
    until = now + window
    created_count = 0

    for task in Task.objects.filter(
        due_at__gte=now,
        due_at__lte=until,
    ).exclude(status=Task.Status.DONE).select_related("assigned_to"):
        _, created = Notification.objects.get_or_create(
            recipient=task.assigned_to,
            task=task,
            notification_type=Notification.NotificationType.TASK_REMINDER,
            defaults={
                "title": f"Task due soon: {task.title}",
                "message": f"{task.title} is due at {task.due_at.isoformat()}.",
            },
        )
        created_count += int(created)

    for event in CalendarEvent.objects.filter(
        starts_at__gte=now,
        starts_at__lte=until,
    ).select_related(
        "organization",
        "division__organization",
        "project__division__organization",
    ):
        for recipient in _event_recipients(event):
            _, created = Notification.objects.get_or_create(
                recipient=recipient,
                calendar_event=event,
                notification_type=Notification.NotificationType.EVENT_REMINDER,
                defaults={
                    "title": f"Upcoming {event.get_event_type_display().lower()}: {event.title}",
                    "message": f"{event.title} starts at {event.starts_at.isoformat()}.",
                },
            )
            created_count += int(created)

    return created_count


def _event_recipients(event):
    if event.organization_id:
        return User.objects.filter(
            organization_memberships__organization=event.organization,
            organization_memberships__is_active=True,
        ).distinct()

    if event.division_id:
        return User.objects.filter(
            Q(
                organization_memberships__organization=event.division.organization,
                organization_memberships__role=OrganizationMembership.Role.CORE_BOARD,
                organization_memberships__is_active=True,
            )
            | Q(
                division_memberships__division=event.division,
                division_memberships__is_active=True,
            )
        ).distinct()

    return User.objects.filter(
        Q(
            organization_memberships__organization=event.project.division.organization,
            organization_memberships__role=OrganizationMembership.Role.CORE_BOARD,
            organization_memberships__is_active=True,
        )
        | Q(
            division_memberships__division=event.project.division,
            division_memberships__role=DivisionMembership.Role.DIVISION_HEAD,
            division_memberships__is_active=True,
        )
        | Q(
            project_memberships__project=event.project,
            project_memberships__is_active=True,
        )
    ).distinct()
