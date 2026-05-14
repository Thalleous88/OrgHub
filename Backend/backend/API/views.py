from django.http import FileResponse
from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Announcement,
    Division,
    DivisionMembership,
    Invitation,
    Organization,
    OrganizationMembership,
    Project,
    ProjectMembership,
    ResourceDocument,
    Task,
)
from .permissions import (
    can_access_announcement,
    can_access_repository,
    can_access_resource_document,
    can_access_task,
    can_manage_announcement,
    can_delete_resource_document,
    can_delete_task,
)
from .serializers import (
    AnnouncementSerializer,
    DivisionSerializer,
    EmailTokenObtainPairSerializer,
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    OrganizationSerializer,
    ProjectSerializer,
    RegisterSerializer,
    ResourceDocumentSerializer,
    TaskSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        user = self.get_queryset().get(pk=response.data["id"])
        refresh = RefreshToken.for_user(user)
        response.data.update(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
        )
        return response

    def get_queryset(self):
        return self.serializer_class.Meta.model.objects.all()


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EmailTokenObtainPairSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        refresh = RefreshToken.for_user(serializer.validated_data["user"])
        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
        )


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class DashboardView(APIView):
    def get(self, request):
        user = request.user
        profile = getattr(user, "profile", None)
        memberships = UserSerializer(user, context={"request": request}).data["memberships"]

        task_queryset = Task.objects.select_related(
            "division__organization",
            "project__division__organization",
            "created_by",
            "assigned_to",
        )
        managed_task_filter = (
            Q(
                division__memberships__user=user,
                division__memberships__role=DivisionMembership.Role.DIVISION_HEAD,
                division__memberships__is_active=True,
            )
            | Q(
                division__organization__memberships__user=user,
                division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                division__organization__memberships__is_active=True,
            )
            | Q(
                project__memberships__user=user,
                project__memberships__role=ProjectMembership.Role.PROJECT_LEAD,
                project__memberships__is_active=True,
            )
            | Q(
                project__division__memberships__user=user,
                project__division__memberships__role=DivisionMembership.Role.DIVISION_HEAD,
                project__division__memberships__is_active=True,
            )
            | Q(
                project__division__organization__memberships__user=user,
                project__division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                project__division__organization__memberships__is_active=True,
            )
        )

        visible_document_filter = (
            Q(
                organization__memberships__user=user,
                organization__memberships__is_active=True,
            )
            | Q(
                division__organization__memberships__user=user,
                division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                division__organization__memberships__is_active=True,
            )
            | Q(
                division__memberships__user=user,
                division__memberships__is_active=True,
            )
            | Q(
                project__division__organization__memberships__user=user,
                project__division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                project__division__organization__memberships__is_active=True,
            )
            | Q(
                project__division__memberships__user=user,
                project__division__memberships__role=DivisionMembership.Role.DIVISION_HEAD,
                project__division__memberships__is_active=True,
            )
            | Q(
                project__memberships__user=user,
                project__memberships__is_active=True,
            )
        )

        core_organization_memberships = OrganizationMembership.objects.filter(
            user=user,
            role=OrganizationMembership.Role.CORE_BOARD,
            is_active=True,
        ).select_related("organization")
        division_head_memberships = DivisionMembership.objects.filter(
            user=user,
            role=DivisionMembership.Role.DIVISION_HEAD,
            is_active=True,
        ).select_related("division__organization")
        project_lead_memberships = ProjectMembership.objects.filter(
            user=user,
            role=ProjectMembership.Role.PROJECT_LEAD,
            is_active=True,
        ).select_related("project__division__organization")

        return Response(
            {
                "profile": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": getattr(profile, "full_name", ""),
                    "major": getattr(profile, "major", ""),
                    "campus_location": getattr(profile, "campus_location", ""),
                },
                "memberships": memberships,
                "tasks": {
                    "assigned_to_me": TaskSerializer(
                        task_queryset.filter(assigned_to=user)[:10],
                        many=True,
                        context={"request": request},
                    ).data,
                    "created_by_me": TaskSerializer(
                        task_queryset.filter(created_by=user)[:10],
                        many=True,
                        context={"request": request},
                    ).data,
                    "managed": TaskSerializer(
                        task_queryset.filter(managed_task_filter)
                        .exclude(assigned_to=user)
                        .exclude(status=Task.Status.DONE)
                        .distinct()[:10],
                        many=True,
                        context={"request": request},
                    ).data,
                },
                "announcements": AnnouncementSerializer(
                    Announcement.objects.filter(
                        organization__memberships__user=user,
                        organization__memberships__is_active=True,
                    )
                    .select_related("organization", "created_by")
                    .distinct()[:10],
                    many=True,
                    context={"request": request},
                ).data,
                "documents": ResourceDocumentSerializer(
                    ResourceDocument.objects.filter(visible_document_filter)
                    .select_related(
                        "organization",
                        "division__organization",
                        "project__division__organization",
                        "uploaded_by",
                    )
                    .distinct()[:10],
                    many=True,
                    context={"request": request},
                ).data,
                "pending_invitations": InvitationSerializer(
                    Invitation.objects.filter(
                        email__iexact=user.email,
                        status=Invitation.Status.PENDING,
                    ).select_related(
                        "organization",
                        "division__organization",
                        "project__division__organization",
                        "invited_by",
                        "accepted_by",
                    ),
                    many=True,
                    context={"request": request},
                ).data,
                "management_summary": {
                    "organizations": [
                        {
                            "id": membership.organization_id,
                            "name": membership.organization.name,
                            "divisions_count": Division.objects.filter(
                                organization=membership.organization,
                            ).count(),
                            "projects_count": Project.objects.filter(
                                division__organization=membership.organization,
                            ).count(),
                            "open_tasks_count": Task.objects.filter(
                                Q(division__organization=membership.organization)
                                | Q(project__division__organization=membership.organization),
                            )
                            .exclude(status=Task.Status.DONE)
                            .distinct()
                            .count(),
                        }
                        for membership in core_organization_memberships
                    ],
                    "divisions": [
                        {
                            "id": membership.division_id,
                            "name": membership.division.name,
                            "organization_id": membership.division.organization_id,
                            "projects_count": Project.objects.filter(
                                division=membership.division,
                            ).count(),
                            "open_tasks_count": Task.objects.filter(
                                Q(division=membership.division)
                                | Q(project__division=membership.division),
                            )
                            .exclude(status=Task.Status.DONE)
                            .distinct()
                            .count(),
                        }
                        for membership in division_head_memberships
                    ],
                    "projects": [
                        {
                            "id": membership.project_id,
                            "name": membership.project.name,
                            "division_id": membership.project.division_id,
                            "members_count": ProjectMembership.objects.filter(
                                project=membership.project,
                                is_active=True,
                            ).count(),
                            "open_tasks_count": Task.objects.filter(
                                project=membership.project,
                            )
                            .exclude(status=Task.Status.DONE)
                            .count(),
                        }
                        for membership in project_lead_memberships
                    ],
                },
            }
        )


class OrganizationListCreateView(generics.ListCreateAPIView):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        return Organization.objects.filter(
            memberships__user=self.request.user,
            memberships__is_active=True,
        ).distinct()


class DivisionListCreateView(generics.ListCreateAPIView):
    serializer_class = DivisionSerializer

    def get_queryset(self):
        return Division.objects.filter(
            Q(memberships__user=self.request.user, memberships__is_active=True)
            | Q(
                organization__memberships__user=self.request.user,
                organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                organization__memberships__is_active=True,
            )
        ).distinct()


class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(
            Q(memberships__user=self.request.user, memberships__is_active=True)
            | Q(
                division__memberships__user=self.request.user,
                division__memberships__role=DivisionMembership.Role.DIVISION_HEAD,
                division__memberships__is_active=True,
            )
            | Q(
                division__organization__memberships__user=self.request.user,
                division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                division__organization__memberships__is_active=True,
            )
        ).distinct()


class ScopeInvitationCreateView(generics.CreateAPIView):
    serializer_class = InvitationCreateSerializer

    scope_model = None
    scope_url_kwarg = "pk"

    def get_scope(self):
        return generics.get_object_or_404(
            self.scope_model,
            pk=self.kwargs[self.scope_url_kwarg],
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["scope"] = self.get_scope()
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()
        return Response(InvitationSerializer(invitation).data, status=201)


class OrganizationInvitationCreateView(ScopeInvitationCreateView):
    scope_model = Organization


class DivisionInvitationCreateView(ScopeInvitationCreateView):
    scope_model = Division


class ProjectInvitationCreateView(ScopeInvitationCreateView):
    scope_model = Project


class InvitationAcceptView(APIView):
    def post(self, request):
        serializer = InvitationAcceptSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()
        return Response(InvitationSerializer(invitation).data)


class RepositoryDocumentListCreateView(generics.ListCreateAPIView):
    serializer_class = ResourceDocumentSerializer
    scope_model = None
    scope_url_kwarg = "pk"

    def get_scope(self):
        return generics.get_object_or_404(
            self.scope_model,
            pk=self.kwargs[self.scope_url_kwarg],
        )

    def check_scope_permission(self):
        scope = self.get_scope()
        if not can_access_repository(self.request.user, scope):
            raise PermissionDenied("You do not have access to this repository.")
        return scope

    def get_queryset(self):
        scope = self.check_scope_permission()
        if isinstance(scope, Organization):
            return ResourceDocument.objects.filter(organization=scope)
        if isinstance(scope, Division):
            return ResourceDocument.objects.filter(division=scope)
        return ResourceDocument.objects.filter(project=scope)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["scope"] = self.get_scope()
        return context


class OrganizationDocumentListCreateView(RepositoryDocumentListCreateView):
    scope_model = Organization


class DivisionDocumentListCreateView(RepositoryDocumentListCreateView):
    scope_model = Division


class ProjectDocumentListCreateView(RepositoryDocumentListCreateView):
    scope_model = Project


class ResourceDocumentDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ResourceDocumentSerializer
    queryset = ResourceDocument.objects.select_related(
        "organization",
        "division__organization",
        "project__division__organization",
        "uploaded_by",
    )

    def get_object(self):
        document = super().get_object()
        if not can_access_resource_document(self.request.user, document):
            raise PermissionDenied("You do not have access to this document.")
        return document

    def perform_destroy(self, instance):
        if not can_delete_resource_document(self.request.user, instance):
            raise PermissionDenied("You do not have permission to delete this document.")
        instance.delete()


class ResourceDocumentDownloadView(APIView):
    def get(self, request, pk):
        document = generics.get_object_or_404(
            ResourceDocument.objects.select_related(
                "organization",
                "division__organization",
                "project__division__organization",
            ),
            pk=pk,
        )
        if not can_access_resource_document(request.user, document):
            raise PermissionDenied("You do not have access to this document.")
        return FileResponse(document.file.open("rb"), as_attachment=True)


class OrganizationAnnouncementListCreateView(generics.ListCreateAPIView):
    serializer_class = AnnouncementSerializer

    def get_organization(self):
        return generics.get_object_or_404(Organization, pk=self.kwargs["pk"])

    def get_queryset(self):
        organization = self.get_organization()
        if not OrganizationMembership.objects.filter(
            organization=organization,
            user=self.request.user,
            is_active=True,
        ).exists():
            raise PermissionDenied("You do not have access to these announcements.")
        return Announcement.objects.filter(organization=organization).select_related(
            "organization",
            "created_by",
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = self.get_organization()
        return context


class AnnouncementFeedView(generics.ListAPIView):
    serializer_class = AnnouncementSerializer

    def get_queryset(self):
        return Announcement.objects.filter(
            organization__memberships__user=self.request.user,
            organization__memberships__is_active=True,
        ).select_related("organization", "created_by").distinct()


class AnnouncementDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = AnnouncementSerializer
    queryset = Announcement.objects.select_related("organization", "created_by")

    def get_object(self):
        announcement = super().get_object()
        if not can_access_announcement(self.request.user, announcement):
            raise PermissionDenied("You do not have access to this announcement.")
        return announcement

    def perform_destroy(self, instance):
        if not can_manage_announcement(self.request.user, instance):
            raise PermissionDenied(
                "You do not have permission to delete this announcement."
            )
        instance.delete()


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer

    def get_queryset(self):
        return (
            Task.objects.filter(
                Q(created_by=self.request.user)
                | Q(assigned_to=self.request.user)
                | Q(
                    division__memberships__user=self.request.user,
                    division__memberships__role=DivisionMembership.Role.DIVISION_HEAD,
                    division__memberships__is_active=True,
                )
                | Q(
                    division__organization__memberships__user=self.request.user,
                    division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                    division__organization__memberships__is_active=True,
                )
                | Q(
                    project__memberships__user=self.request.user,
                    project__memberships__role=ProjectMembership.Role.PROJECT_LEAD,
                    project__memberships__is_active=True,
                )
                | Q(
                    project__division__memberships__user=self.request.user,
                    project__division__memberships__role=DivisionMembership.Role.DIVISION_HEAD,
                    project__division__memberships__is_active=True,
                )
                | Q(
                    project__division__organization__memberships__user=self.request.user,
                    project__division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                    project__division__organization__memberships__is_active=True,
                )
            )
            .select_related(
                "division__organization",
                "project__division__organization",
                "created_by",
                "assigned_to",
            )
            .distinct()
        )


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    queryset = Task.objects.select_related(
        "division__organization",
        "project__division__organization",
        "created_by",
        "assigned_to",
    )

    def get_object(self):
        task = super().get_object()
        if not can_access_task(self.request.user, task):
            raise PermissionDenied("You do not have access to this task.")
        return task

    def perform_destroy(self, instance):
        if not can_delete_task(self.request.user, instance):
            raise PermissionDenied("You do not have permission to delete this task.")
        instance.delete()
