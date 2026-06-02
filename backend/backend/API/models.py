import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


ALLOWED_RESOURCE_EXTENSIONS = {".docx", ".xlsx", ".pptx", ".pdf"}
MAX_RESOURCE_FILE_SIZE = 100 * 1024 * 1024


def resource_document_upload_path(instance, filename):
    scope = instance.repository_scope
    return f"resources/{scope}/{instance.repository_id}/{filename}"


def validate_resource_file(file):
    extension = Path(file.name).suffix.lower()
    if extension not in ALLOWED_RESOURCE_EXTENSIONS:
        raise ValidationError("Resource files must be .docx, .xlsx, .pptx, or .pdf.")
    if file.size > MAX_RESOURCE_FILE_SIZE:
        raise ValidationError("Resource files must be 100MB or smaller.")


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    full_name = models.CharField(max_length=255, blank=True)
    major = models.CharField(max_length=255, blank=True)
    campus_location = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.email


class Organization(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_organizations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Division(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="divisions",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_division_name_per_organization",
            )
        ]

    def __str__(self):
        return f"{self.organization.name} / {self.name}"


class Project(models.Model):
    division = models.ForeignKey(
        Division,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["division", "name"],
                name="unique_project_name_per_division",
            )
        ]

    def __str__(self):
        return f"{self.division} / {self.name}"


class OrganizationMembership(models.Model):
    class Role(models.TextChoices):
        CORE_BOARD = "CORE_BOARD", "Core Board"
        MEMBER = "MEMBER", "Member"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="unique_organization_membership",
            )
        ]

    def __str__(self):
        return f"{self.user.email} - {self.organization.name} ({self.role})"


class DivisionMembership(models.Model):
    class Role(models.TextChoices):
        DIVISION_HEAD = "DIVISION_HEAD", "Division Head"
        MEMBER = "MEMBER", "Member"

    division = models.ForeignKey(
        Division,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="division_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["division", "user"],
                name="unique_division_membership",
            )
        ]

    def clean(self):
        if not OrganizationMembership.objects.filter(
            organization=self.division.organization,
            user=self.user,
            is_active=True,
        ).exists():
            raise ValidationError("Division members must belong to the organization.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} - {self.division} ({self.role})"


class ProjectMembership(models.Model):
    class Role(models.TextChoices):
        PROJECT_LEAD = "PROJECT_LEAD", "Project Lead"
        MEMBER = "MEMBER", "Member"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "user"],
                name="unique_project_membership",
            )
        ]

    def clean(self):
        if not DivisionMembership.objects.filter(
            division=self.project.division,
            user=self.user,
            is_active=True,
        ).exists():
            raise ValidationError("Project members must belong to the parent division.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} - {self.project} ({self.role})"


class Invitation(models.Model):
    class Role(models.TextChoices):
        CORE_BOARD = "CORE_BOARD", "Core Board"
        DIVISION_HEAD = "DIVISION_HEAD", "Division Head"
        PROJECT_LEAD = "PROJECT_LEAD", "Project Lead"
        MEMBER = "MEMBER", "Member"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REVOKED = "REVOKED", "Revoked"
        EXPIRED = "EXPIRED", "Expired"

    email = models.EmailField()
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="invitations",
        null=True,
        blank=True,
    )
    division = models.ForeignKey(
        Division,
        on_delete=models.CASCADE,
        related_name="invitations",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="invitations",
        null=True,
        blank=True,
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_invitations",
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="accepted_invitations",
        null=True,
        blank=True,
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        scopes = [self.organization_id, self.division_id, self.project_id]
        if sum(scope is not None for scope in scopes) != 1:
            raise ValidationError("Invitation must target exactly one scope.")

        if self.organization_id and self.role not in {
            self.Role.CORE_BOARD,
            self.Role.MEMBER,
        }:
            raise ValidationError("Organization invitations support CORE_BOARD or MEMBER.")
        if self.division_id and self.role not in {
            self.Role.DIVISION_HEAD,
            self.Role.MEMBER,
        }:
            raise ValidationError("Division invitations support DIVISION_HEAD or MEMBER.")
        if self.project_id and self.role not in {
            self.Role.PROJECT_LEAD,
            self.Role.MEMBER,
        }:
            raise ValidationError("Project invitations support PROJECT_LEAD or MEMBER.")

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return self.expires_at is not None and self.expires_at <= timezone.now()

    def accept(self, user):
        if self.status != self.Status.PENDING:
            raise ValidationError("Invitation is not pending.")
        if self.is_expired:
            self.status = self.Status.EXPIRED
            self.save(update_fields=["status", "updated_at"])
            raise ValidationError("Invitation has expired.")
        if user.email.lower() != self.email.lower():
            raise ValidationError("Invitation email does not match the current user.")

        if self.organization_id:
            OrganizationMembership.objects.update_or_create(
                organization=self.organization,
                user=user,
                defaults={"role": self.role, "is_active": True},
            )
        elif self.division_id:
            OrganizationMembership.objects.update_or_create(
                organization=self.division.organization,
                user=user,
                defaults={"role": OrganizationMembership.Role.MEMBER, "is_active": True},
            )
            DivisionMembership.objects.update_or_create(
                division=self.division,
                user=user,
                defaults={"role": self.role, "is_active": True},
            )
        else:
            OrganizationMembership.objects.update_or_create(
                organization=self.project.division.organization,
                user=user,
                defaults={"role": OrganizationMembership.Role.MEMBER, "is_active": True},
            )
            DivisionMembership.objects.update_or_create(
                division=self.project.division,
                user=user,
                defaults={"role": DivisionMembership.Role.MEMBER, "is_active": True},
            )
            ProjectMembership.objects.update_or_create(
                project=self.project,
                user=user,
                defaults={"role": self.role, "is_active": True},
            )

        self.status = self.Status.ACCEPTED
        self.accepted_by = user
        self.save(update_fields=["status", "accepted_by", "updated_at"])

    def __str__(self):
        return f"{self.email} - {self.role} ({self.status})"


class ResourceDocument(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="resource_documents",
        null=True,
        blank=True,
    )
    division = models.ForeignKey(
        Division,
        on_delete=models.CASCADE,
        related_name="resource_documents",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="resource_documents",
        null=True,
        blank=True,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_resource_documents",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(
        upload_to=resource_document_upload_path,
        validators=[validate_resource_file],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def repository_scope(self):
        if self.organization_id:
            return "organizations"
        if self.division_id:
            return "divisions"
        return "projects"

    @property
    def repository_id(self):
        return self.organization_id or self.division_id or self.project_id

    def clean(self):
        scopes = [self.organization_id, self.division_id, self.project_id]
        if sum(scope is not None for scope in scopes) != 1:
            raise ValidationError("Resource document must belong to exactly one repository.")

        if self.file:
            validate_resource_file(self.file)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Announcement(models.Model):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="announcements",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_announcements",
    )
    title = models.CharField(max_length=255)
    content = models.TextField()
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class CalendarEvent(models.Model):
    class EventType(models.TextChoices):
        EVENT = "EVENT", "Event"
        MEETING = "MEETING", "Meeting"
        MILESTONE = "MILESTONE", "Milestone"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="calendar_events",
        null=True,
        blank=True,
    )
    division = models.ForeignKey(
        Division,
        on_delete=models.CASCADE,
        related_name="calendar_events",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="calendar_events",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_calendar_events",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.EVENT,
    )
    location = models.CharField(max_length=255, blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    assigned_to = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assigned_calendar_events",
        blank=True,
    )
    assigned_divisions = models.ManyToManyField(
        Division,
        related_name="assigned_calendar_events",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at", "-created_at"]

    @property
    def calendar_scope(self):
        if self.organization_id:
            return "organizations"
        if self.division_id:
            return "divisions"
        return "projects"

    @property
    def calendar_scope_id(self):
        return self.organization_id or self.division_id or self.project_id

    def clean(self):
        scopes = [self.organization_id, self.division_id, self.project_id]
        if sum(scope is not None for scope in scopes) != 1:
            raise ValidationError("Calendar event must belong to exactly one scope.")
        if self.ends_at is not None and self.ends_at < self.starts_at:
            raise ValidationError("Event end time cannot be before start time.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        TASK_REMINDER = "TASK_REMINDER", "Task Reminder"
        EVENT_REMINDER = "EVENT_REMINDER", "Event Reminder"
        ANNOUNCEMENT = "ANNOUNCEMENT", "Announcement"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    task = models.ForeignKey(
        "Task",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    calendar_event = models.ForeignKey(
        CalendarEvent,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "task", "notification_type"],
                condition=models.Q(task__isnull=False),
                name="unique_task_reminder_notification",
            ),
            models.UniqueConstraint(
                fields=["recipient", "calendar_event", "notification_type"],
                condition=models.Q(calendar_event__isnull=False),
                name="unique_event_reminder_notification",
            ),
        ]

    def clean(self):
        references = [self.task_id, self.calendar_event_id]
        if sum(reference is not None for reference in references) > 1:
            raise ValidationError("Notification can reference at most one source object.")
        if self.notification_type == self.NotificationType.TASK_REMINDER and not self.task_id:
            raise ValidationError("Task reminders must reference a task.")
        if (
            self.notification_type == self.NotificationType.EVENT_REMINDER
            and not self.calendar_event_id
        ):
            raise ValidationError("Event reminders must reference a calendar event.")

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at", "updated_at"])

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.recipient.email} - {self.title}"


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "ToDo", "To Do"
        IN_PROGRESS = "InProgress", "In Progress"
        DONE = "Done", "Done"

    division = models.ForeignKey(
        Division,
        on_delete=models.CASCADE,
        related_name="tasks",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="tasks",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO,
    )
    due_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_tasks",
    )
    assigned_to = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assigned_tasks",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "due_at", "-created_at"]

    @property
    def scope_organization(self):
        if self.division_id:
            return self.division.organization
        return self.project.division.organization

    @property
    def scope_division(self):
        return self.division or self.project.division

    def clean(self):
        if bool(self.division_id) == bool(self.project_id):
            raise ValidationError("Task must belong to exactly one division or project.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.title
