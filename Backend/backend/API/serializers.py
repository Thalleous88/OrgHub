from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers

from .models import (
    Division,
    DivisionMembership,
    Invitation,
    Organization,
    OrganizationMembership,
    Profile,
    Project,
    ProjectMembership,
    ResourceDocument,
)
from .permissions import (
    can_manage_division,
    can_manage_project_members,
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
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data["password"],
        )
        Profile.objects.create(user=user)
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
                    "Only Core Board or Division Heads can invite project members."
                )
            invited_user = User.objects.filter(
                email__iexact=attrs["email"].strip().lower()
            ).first()
            if not invited_user or not DivisionMembership.objects.filter(
                user=invited_user,
                division=scope.division,
                is_active=True,
            ).exists():
                raise serializers.ValidationError(
                    "Project invitees must already belong to the parent division."
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
