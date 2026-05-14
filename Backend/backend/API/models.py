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
