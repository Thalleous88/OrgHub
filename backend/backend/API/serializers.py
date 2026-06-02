from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
    Announcement,
    CalendarEvent,
    Division,
    DivisionMembership,
    Invitation,
    Notification,
    Organization,
    OrganizationMembership,
    Profile,
    Project,
    ProjectMembership,
    ResourceDocument,
    Task,
)
from .permissions import (
    can_assign_task,
    can_create_task,
    can_manage_calendar_scope,
    can_manage_division,
    can_manage_project_members,
    can_update_task,
    can_upload_resource_document,
    is_core_board,
)


User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["full_name", "major", "campus_location"]


class MembershipSummarySerializer(serializers.Serializer):
    organizations = serializers.SerializerMethodField()
    divisions = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()

    def get_organizations(self, user):
        return [
            {
                "id": membership.organization_id,
                "name": membership.organization.name,
                "role": membership.role,
            }
            for membership in user.organization_memberships.filter(is_active=True)
            .select_related("organization")
            .order_by("organization__name")
        ]

    def get_divisions(self, user):
        return [
            {
                "id": membership.division_id,
                "name": membership.division.name,
                "organization_id": membership.division.organization_id,
                "role": membership.role,
            }
            for membership in user.division_memberships.filter(is_active=True)
            .select_related("division")
            .order_by("division__name")
        ]

    def get_projects(self, user):
        return [
            {
                "id": membership.project_id,
                "name": membership.project.name,
                "division_id": membership.project.division_id,
                "role": membership.role,
            }
            for membership in user.project_memberships.filter(is_active=True)
            .select_related("project")
            .order_by("project__name")
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "profile", "memberships"]
        read_only_fields = ["id", "email"]

    def get_memberships(self, obj):
        return MembershipSummarySerializer(obj).data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "password"]
        read_only_fields = ["id"]

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def create(self, validated_data):
        email = validated_data["email"]
        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=validated_data["password"],
            )
            Profile.objects.create(user=user)
            pending_invitations = Invitation.objects.filter(
                email__iexact=email,
                status=Invitation.Status.PENDING,
            ).select_related("organization", "division__organization", "project__division__organization")
            for invitation in pending_invitations:
                try:
                    invitation.accept(user)
                except Exception:
                    pass
        return user


class EmailTokenObtainPairSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Unable to log in with provided credentials.")
        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")
        attrs["user"] = user
        return attrs


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "description", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        organization = Organization.objects.create(created_by=user, **validated_data)
        OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        return organization


class DivisionSerializer(serializers.ModelSerializer):
    organization_id = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.all(),
        source="organization",
        write_only=True,
    )

    class Meta:
        model = Division
        fields = [
            "id",
            "organization_id",
            "organization",
            "name",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]

    def validate(self, attrs):
        organization = attrs["organization"]
        if not is_core_board(self.context["request"].user, organization):
            raise serializers.ValidationError("Only Core Board can create divisions.")
        return attrs


class ProjectSerializer(serializers.ModelSerializer):
    division_id = serializers.PrimaryKeyRelatedField(
        queryset=Division.objects.all(),
        source="division",
        write_only=True,
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "division_id",
            "division",
            "name",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "division", "created_at", "updated_at"]

    def validate(self, attrs):
        division = attrs["division"]
        if not can_manage_division(self.context["request"].user, division):
            raise serializers.ValidationError(
                "Only Core Board or Division Heads can create projects."
            )
        return attrs


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = [
            "id",
            "email",
            "organization",
            "division",
            "project",
            "role",
            "token",
            "status",
            "invited_by",
            "accepted_by",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "division",
            "project",
            "token",
            "status",
            "invited_by",
            "accepted_by",
            "created_at",
            "updated_at",
        ]


class InvitationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ["email", "role", "expires_at"]

    def validate(self, attrs):
        scope = self.context["scope"]
        user = self.context["request"].user
        role = attrs["role"]

        if isinstance(scope, Organization):
            if not is_core_board(user, scope):
                raise serializers.ValidationError("Only Core Board can invite org members.")
            if role not in {
                Invitation.Role.CORE_BOARD,
                Invitation.Role.MEMBER,
            }:
                raise serializers.ValidationError("Invalid organization role.")

        if isinstance(scope, Division):
            if role == Invitation.Role.DIVISION_HEAD:
                if not is_core_board(user, scope.organization):
                    raise serializers.ValidationError(
                        "Only Core Board can assign Division Heads."
                    )
            elif role == Invitation.Role.MEMBER:
                if not can_manage_division(user, scope):
                    raise serializers.ValidationError(
                        "Only Core Board or Division Heads can invite division members."
                    )
            else:
                raise serializers.ValidationError("Invalid division role.")

        if isinstance(scope, Project):
            if role not in {Invitation.Role.PROJECT_LEAD, Invitation.Role.MEMBER}:
                raise serializers.ValidationError("Invalid project role.")
            if not can_manage_project_members(user, scope):
                raise serializers.ValidationError(
                    "Only Core Board, Division Heads, or Project Leads can invite project members."
                )
            invited_user = User.objects.filter(
                email__iexact=attrs["email"].strip().lower()
            ).first()
            if not invited_user or not OrganizationMembership.objects.filter(
                user=invited_user,
                organization=scope.division.organization,
                is_active=True,
            ).exists():
                raise serializers.ValidationError(
                    "Project invitees must already be members of the organization."
                )

        return attrs

    def create(self, validated_data):
        scope = self.context["scope"]
        kwargs = {"invited_by": self.context["request"].user, **validated_data}
        if isinstance(scope, Organization):
            kwargs["organization"] = scope
        elif isinstance(scope, Division):
            kwargs["division"] = scope
        else:
            kwargs["project"] = scope
        return Invitation.objects.create(**kwargs)


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.UUIDField()

    def validate_token(self, value):
        try:
            return Invitation.objects.get(token=value)
        except Invitation.DoesNotExist as exc:
            raise serializers.ValidationError("Invitation was not found.") from exc

    def save(self, **kwargs):
        invitation = self.validated_data["token"]
        invitation.accept(self.context["request"].user)
        return invitation


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.profile.full_name", read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = ["id", "user_id", "email", "full_name", "role", "is_active", "joined_at"]

    def get_full_name(self, obj):
        return getattr(getattr(obj.user, "profile", None), "full_name", "")


class DivisionMembershipSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.profile.full_name", read_only=True)

    class Meta:
        model = DivisionMembership
        fields = ["id", "user_id", "email", "full_name", "role", "is_active", "joined_at"]


class ProjectMembershipSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.profile.full_name", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["id", "user_id", "email", "full_name", "role", "is_active", "joined_at"]


class ResourceDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    repository_scope = serializers.CharField(read_only=True)
    repository_id = serializers.IntegerField(read_only=True)
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True)

    class Meta:
        model = ResourceDocument
        fields = [
            "id",
            "title",
            "description",
            "file",
            "file_url",
            "repository_scope",
            "repository_id",
            "organization",
            "division",
            "project",
            "uploaded_by",
            "uploaded_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "file_url",
            "repository_scope",
            "repository_id",
            "organization",
            "division",
            "project",
            "uploaded_by",
            "uploaded_by_email",
            "created_at",
            "updated_at",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return None
        if request is None:
            return obj.file.url
        return request.build_absolute_uri(obj.file.url)

    def validate(self, attrs):
        scope = self.context.get("scope")
        if scope and not can_upload_resource_document(self.context["request"].user, scope):
            raise serializers.ValidationError(
                "You do not have permission to upload to this repository."
            )
        return attrs

    def create(self, validated_data):
        scope = self.context["scope"]
        kwargs = {"uploaded_by": self.context["request"].user, **validated_data}
        if isinstance(scope, Organization):
            kwargs["organization"] = scope
        elif isinstance(scope, Division):
            kwargs["division"] = scope
        else:
            kwargs["project"] = scope
        return ResourceDocument.objects.create(**kwargs)


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id",
            "organization",
            "title",
            "content",
            "priority",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        organization = self.context.get("organization")
        if organization and not is_core_board(self.context["request"].user, organization):
            raise serializers.ValidationError(
                "Only Core Board can broadcast announcements."
            )
        return attrs

    def create(self, validated_data):
        return Announcement.objects.create(
            organization=self.context["organization"],
            created_by=self.context["request"].user,
            **validated_data,
        )


class CalendarEventSerializer(serializers.ModelSerializer):
    calendar_scope = serializers.CharField(read_only=True)
    calendar_scope_id = serializers.IntegerField(read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    assigned_to_emails = serializers.SerializerMethodField()
    assigned_emails = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        required=False,
    )
    assigned_divisions = serializers.PrimaryKeyRelatedField(
        queryset=Division.objects.all(),
        many=True,
        write_only=True,
        required=False,
    )
    assigned_division_ids = serializers.SerializerMethodField()
    assigned_division_names = serializers.SerializerMethodField()

    class Meta:
        model = CalendarEvent
        fields = [
            "id",
            "organization",
            "division",
            "project",
            "calendar_scope",
            "calendar_scope_id",
            "title",
            "description",
            "event_type",
            "location",
            "starts_at",
            "ends_at",
            "created_by",
            "created_by_email",
            "assigned_to",
            "assigned_to_emails",
            "assigned_emails",
            "assigned_divisions",
            "assigned_division_ids",
            "assigned_division_names",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "division",
            "project",
            "calendar_scope",
            "calendar_scope_id",
            "created_by",
            "created_by_email",
            "assigned_to_emails",
            "assigned_division_ids",
            "assigned_division_names",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "assigned_to": {"read_only": True},
        }

    def get_assigned_to_emails(self, obj):
        return list(obj.assigned_to.values_list("email", flat=True))

    def get_assigned_division_ids(self, obj):
        return list(obj.assigned_divisions.values_list("id", flat=True))

    def get_assigned_division_names(self, obj):
        return list(obj.assigned_divisions.values_list("name", flat=True))

    def validate_assigned_emails(self, value):
        users = []
        for email in value:
            user = User.objects.filter(email__iexact=email.strip().lower()).first()
            if user is None:
                raise serializers.ValidationError(f"No user found with email: {email}")
            users.append(user)
        return users

    def validate(self, attrs):
        scope = self.context.get("scope")
        instance = self.instance
        starts_at = attrs.get("starts_at", getattr(instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(instance, "ends_at", None))

        if ends_at is not None and starts_at is not None and ends_at < starts_at:
            raise serializers.ValidationError("Event end time cannot be before start time.")
        if scope and not can_manage_calendar_scope(self.context["request"].user, scope):
            raise serializers.ValidationError(
                "You do not have permission to manage this calendar."
            )

        assigned_divisions = attrs.get("assigned_divisions", [])
        is_org_scoped = False
        if instance:
            is_org_scoped = instance.organization_id is not None and instance.division_id is None and instance.project_id is None
        elif scope:
            is_org_scoped = hasattr(scope, "divisions")

        if assigned_divisions and not is_org_scoped:
            raise serializers.ValidationError(
                "Assigned divisions can only be set on organization-scoped events."
            )
        org_id = None
        if instance:
            org_id = instance.organization_id
        elif scope:
            if hasattr(scope, "organization_id"):
                org_id = scope.organization_id
            elif hasattr(scope, "divisions"):
                org_id = scope.id
        for div in assigned_divisions:
            if div.organization_id != org_id:
                raise serializers.ValidationError(
                    f"Division '{div.name}' does not belong to this organization."
                )

        return attrs

    def create(self, validated_data):
        assigned_users = validated_data.pop("assigned_emails", [])
        assigned_divisions = validated_data.pop("assigned_divisions", [])
        scope = self.context["scope"]
        kwargs = {"created_by": self.context["request"].user, **validated_data}
        if isinstance(scope, Organization):
            kwargs["organization"] = scope
        elif isinstance(scope, Division):
            kwargs["division"] = scope
        else:
            kwargs["project"] = scope
        event = CalendarEvent.objects.create(**kwargs)
        if assigned_users:
            event.assigned_to.set(assigned_users)
        if assigned_divisions:
            event.assigned_divisions.set(assigned_divisions)
        return event

    def update(self, instance, validated_data):
        assigned_users = validated_data.pop("assigned_emails", None)
        assigned_divisions = validated_data.pop("assigned_divisions", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if assigned_users is not None:
            instance.assigned_to.set(assigned_users)
        if assigned_divisions is not None:
            instance.assigned_divisions.set(assigned_divisions)
        return instance


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "task",
            "calendar_event",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "task",
            "calendar_event",
            "read_at",
            "created_at",
            "updated_at",
        ]

    def update(self, instance, validated_data):
        if validated_data.get("is_read"):
            instance.mark_read()
            return instance
        return instance


class TaskSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    assigned_to_emails = serializers.SerializerMethodField()
    assigned_emails = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Task
        fields = [
            "id",
            "division",
            "project",
            "title",
            "description",
            "status",
            "due_at",
            "created_by",
            "created_by_email",
            "assigned_to",
            "assigned_to_emails",
            "assigned_emails",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_by_email",
            "assigned_to_emails",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "assigned_to": {"read_only": True},
        }

    def get_assigned_to_emails(self, obj):
        return list(
            obj.assigned_to.values_list("email", flat=True)
        )

    def validate_assigned_emails(self, value):
        users = []
        for email in value:
            user = User.objects.filter(email__iexact=email.strip().lower()).first()
            if user is None:
                raise serializers.ValidationError(f"No user found with email: {email}")
            users.append(user)
        return users

    def validate(self, attrs):
        request = self.context["request"]
        instance = self.instance
        division = attrs.get("division", getattr(instance, "division", None))
        project = attrs.get("project", getattr(instance, "project", None))
        assigned_users = attrs.get("assigned_emails", [])

        if division and project:
            raise serializers.ValidationError(
                "Task cannot belong to both a division and a project."
            )

        if instance is None:
            if not can_create_task(request.user, division=division, project=project):
                raise serializers.ValidationError(
                    "You do not have permission to create tasks in this scope."
                )
            for user in assigned_users:
                if not can_assign_task(request.user, user, division=division, project=project):
                    raise serializers.ValidationError(
                        f"You do not have permission to assign {user.email}."
                    )
            if not assigned_users:
                if not can_assign_task(request.user, request.user, division=division, project=project):
                    raise serializers.ValidationError(
                        "You do not have permission to self-assign in this scope."
                    )
                attrs["assigned_emails"] = [request.user]
            return attrs

        changed_fields = set(attrs.keys())
        if not can_update_task(request.user, instance, changed_fields):
            raise serializers.ValidationError("You do not have permission to update this task.")

        reassignment_fields = {"division", "project", "assigned_emails"}
        if changed_fields & reassignment_fields:
            for user in assigned_users:
                if not can_assign_task(request.user, user, division=division, project=project):
                    raise serializers.ValidationError(
                        f"You do not have permission to reassign to {user.email}."
                    )

        return attrs

    def create(self, validated_data):
        assigned_users = validated_data.pop("assigned_emails", [])
        task = Task.objects.create(created_by=self.context["request"].user, **validated_data)
        if assigned_users:
            task.assigned_to.set(assigned_users)
        return task

    def update(self, instance, validated_data):
        assigned_users = validated_data.pop("assigned_emails", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if assigned_users is not None:
            instance.assigned_to.set(assigned_users)
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "New passwords do not match."}
            )
        return attrs
