from django.http import FileResponse, HttpResponseRedirect
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Announcement,
    CalendarEvent,
    Division,
    DivisionMembership,
    Invitation,
    Organization,
    OrganizationMembership,
    Notification,
    Profile,
    Project,
    ProjectMembership,
    ResourceDocument,
    Task,
)
from .permissions import (
    can_access_announcement,
    can_access_calendar_event,
    can_access_repository,
    can_access_resource_document,
    can_access_task,
    can_delete_division,
    can_delete_project,
    can_delete_resource_document,
    can_delete_task,
    can_manage_announcement,
    can_manage_calendar_event,
    can_manage_division,
    can_manage_project_members,
)
from .serializers import (
    AnnouncementSerializer,
    CalendarEventSerializer,
    ChangePasswordSerializer,
    DivisionMembershipSerializer,
    DivisionSerializer,
    EmailTokenObtainPairSerializer,
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    NotificationSerializer,
    OrganizationMembershipSerializer,
    OrganizationSerializer,
    ProfileSerializer,
    ProjectMembershipSerializer,
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


class CurrentUserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


class DashboardView(APIView):
    def get(self, request):
        user = request.user
        profile = getattr(user, "profile", None)
        memberships = UserSerializer(user, context={"request": request}).data["memberships"]

        task_queryset = Task.objects.prefetch_related(
            "assigned_to",
        ).select_related(
            "division__organization",
            "project__division__organization",
            "created_by",
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
                "calendar_events": CalendarEventSerializer(
                    CalendarEvent.objects.filter(visible_document_filter)
                    .select_related(
                        "organization",
                        "division__organization",
                        "project__division__organization",
                        "created_by",
                    )
                    .distinct()[:10],
                    many=True,
                    context={"request": request},
                ).data,
                "notifications": NotificationSerializer(
                    Notification.objects.filter(recipient=user)[:10],
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


class OrganizationLeaveView(APIView):
    def post(self, request, pk):
        organization = generics.get_object_or_404(Organization, pk=pk)

        with transaction.atomic():
            membership = (
                OrganizationMembership.objects.select_for_update()
                .filter(
                    organization=organization,
                    user=request.user,
                    is_active=True,
                )
                .first()
            )
            if membership is None:
                raise PermissionDenied("You are not an active member of this organization.")

            if membership.role == OrganizationMembership.Role.CORE_BOARD:
                active_core_board_ids = list(
                    OrganizationMembership.objects.select_for_update()
                    .filter(
                        organization=organization,
                        role=OrganizationMembership.Role.CORE_BOARD,
                        is_active=True,
                    )
                    .values_list("pk", flat=True)
                )
                if len(active_core_board_ids) <= 1:
                    return Response(
                        {
                            "detail": (
                                "You are the last Core Board member. "
                                "Invite or promote another Core Board member before leaving."
                            )
                        },
                        status=400,
                    )

            ProjectMembership.objects.filter(
                user=request.user,
                project__division__organization=organization,
                is_active=True,
            ).update(is_active=False)
            DivisionMembership.objects.filter(
                user=request.user,
                division__organization=organization,
                is_active=True,
            ).update(is_active=False)
            membership.is_active = False
            membership.save(update_fields=["is_active"])

        return Response(status=204)


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


class DivisionDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = DivisionSerializer
    queryset = Division.objects.select_related("organization")

    def get_object(self):
        division = super().get_object()
        if not can_manage_division(self.request.user, division):
            raise PermissionDenied("You do not have access to this division.")
        return division

    def perform_destroy(self, instance):
        if not can_delete_division(self.request.user, instance):
            raise PermissionDenied("Only Core Board members can delete divisions.")
        instance.delete()


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


class ProjectDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ProjectSerializer
    queryset = Project.objects.select_related("division__organization")

    def get_object(self):
        project = super().get_object()
        if not can_manage_project_members(self.request.user, project):
            raise PermissionDenied("You do not have access to this project.")
        return project

    def perform_destroy(self, instance):
        if not can_delete_project(self.request.user, instance):
            raise PermissionDenied(
                "Only Core Board members or Division Heads can delete projects."
            )
        instance.delete()


class ScopeInvitationCreateView(APIView):
    scope_model = None
    scope_url_kwarg = "pk"

    def get_scope(self):
        return generics.get_object_or_404(
            self.scope_model,
            pk=self.kwargs[self.scope_url_kwarg],
        )

    def post(self, request, *args, **kwargs):
        scope = self.get_scope()
        emails = request.data.get("emails", [])
        role = request.data.get("role")
        expires_at = request.data.get("expires_at")

        if not emails:
            emails = [request.data.get("email", "")]
        emails = [e.strip().lower() for e in emails if e and e.strip()]

        if not emails:
            return Response(
                {"detail": "At least one email is required."},
                status=400,
            )

        invitations = []
        errors = []
        for email in emails:
            serializer = InvitationCreateSerializer(
                data={"email": email, "role": role, "expires_at": expires_at},
                context={"request": request, "scope": scope},
            )
            if serializer.is_valid():
                invitation = serializer.save()
                invitations.append(InvitationSerializer(invitation, context={"request": request}).data)
            else:
                errors.append({"email": email, "errors": serializer.errors})

        if errors and not invitations:
            return Response({"detail": "All invitations failed.", "errors": errors}, status=400)

        return Response(
            {"invitations": invitations, "errors": errors} if errors else invitations,
            status=201 if invitations else 400,
        )


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
        if getattr(document.file.storage, "redirect_downloads", False):
            return HttpResponseRedirect(document.file.url)
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


class CalendarEventListView(generics.ListAPIView):
    serializer_class = CalendarEventSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = CalendarEvent.objects.filter(
            Q(organization__memberships__user=user, organization__memberships__is_active=True)
            | Q(
                division__organization__memberships__user=user,
                division__organization__memberships__role=OrganizationMembership.Role.CORE_BOARD,
                division__organization__memberships__is_active=True,
            )
            | Q(division__memberships__user=user, division__memberships__is_active=True)
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
            | Q(project__memberships__user=user, project__memberships__is_active=True)
        ).select_related(
            "organization",
            "division__organization",
            "project__division__organization",
            "created_by",
        )

        starts_after = self.request.query_params.get("starts_after")
        starts_before = self.request.query_params.get("starts_before")
        if starts_after:
            queryset = queryset.filter(starts_at__gte=starts_after)
        if starts_before:
            queryset = queryset.filter(starts_at__lte=starts_before)
        return queryset.distinct()


class ScopeCalendarEventListCreateView(generics.ListCreateAPIView):
    serializer_class = CalendarEventSerializer
    scope_model = None
    scope_url_kwarg = "pk"

    def get_scope(self):
        return generics.get_object_or_404(
            self.scope_model,
            pk=self.kwargs[self.scope_url_kwarg],
        )

    def get_queryset(self):
        scope = self.get_scope()
        if not can_access_repository(self.request.user, scope):
            raise PermissionDenied("You do not have access to this calendar.")
        if isinstance(scope, Organization):
            return CalendarEvent.objects.filter(organization=scope)
        if isinstance(scope, Division):
            return CalendarEvent.objects.filter(division=scope)
        return CalendarEvent.objects.filter(project=scope)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["scope"] = self.get_scope()
        return context


class OrganizationCalendarEventListCreateView(ScopeCalendarEventListCreateView):
    scope_model = Organization


class DivisionCalendarEventListCreateView(ScopeCalendarEventListCreateView):
    scope_model = Division


class ProjectCalendarEventListCreateView(ScopeCalendarEventListCreateView):
    scope_model = Project


class CalendarEventDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CalendarEventSerializer
    queryset = CalendarEvent.objects.select_related(
        "organization",
        "division__organization",
        "project__division__organization",
        "created_by",
    )

    def get_object(self):
        event = super().get_object()
        if not can_access_calendar_event(self.request.user, event):
            raise PermissionDenied("You do not have access to this calendar event.")
        return event

    def perform_update(self, serializer):
        if not can_manage_calendar_event(self.request.user, serializer.instance):
            raise PermissionDenied("You do not have permission to update this event.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_calendar_event(self.request.user, instance):
            raise PermissionDenied("You do not have permission to delete this event.")
        instance.delete()


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        queryset = Notification.objects.filter(recipient=self.request.user).select_related(
            "task",
            "calendar_event",
        )
        is_read = self.request.query_params.get("is_read")
        if is_read == "true":
            queryset = queryset.filter(is_read=True)
        if is_read == "false":
            queryset = queryset.filter(is_read=False)
        return queryset


class NotificationDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related(
            "task",
            "calendar_event",
        )


class NotificationMarkAllReadView(APIView):
    def post(self, request):
        for notification in Notification.objects.filter(recipient=request.user, is_read=False):
            notification.mark_read()
        return Response({"detail": "Notifications marked as read."})


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
            .prefetch_related("assigned_to")
            .select_related(
                "division__organization",
                "project__division__organization",
                "created_by",
            )
            .distinct()
        )


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    queryset = Task.objects.prefetch_related(
        "assigned_to",
    ).select_related(
        "division__organization",
        "project__division__organization",
        "created_by",
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


class OrganizationMemberListView(generics.ListAPIView):
    serializer_class = OrganizationMembershipSerializer

    def get_queryset(self):
        organization = generics.get_object_or_404(Organization, pk=self.kwargs["pk"])
        if not OrganizationMembership.objects.filter(
            organization=organization,
            user=self.request.user,
            is_active=True,
        ).exists():
            raise PermissionDenied("You do not have access to this organization's members.")
        return OrganizationMembership.objects.filter(
            organization=organization,
            is_active=True,
        ).select_related("user__profile").order_by("user__email")


class DivisionMemberListView(generics.ListAPIView):
    serializer_class = DivisionMembershipSerializer

    def get_queryset(self):
        division = generics.get_object_or_404(Division, pk=self.kwargs["pk"])
        if not (
            OrganizationMembership.objects.filter(
                organization=division.organization,
                user=self.request.user,
                is_active=True,
            ).exists()
        ):
            raise PermissionDenied("You do not have access to this division's members.")
        return DivisionMembership.objects.filter(
            division=division,
            is_active=True,
        ).select_related("user__profile").order_by("user__email")


class ProjectMemberListView(generics.ListAPIView):
    serializer_class = ProjectMembershipSerializer

    def get_queryset(self):
        project = generics.get_object_or_404(Project, pk=self.kwargs["pk"])
        if not (
            DivisionMembership.objects.filter(
                division=project.division,
                user=self.request.user,
                is_active=True,
            ).exists()
            or OrganizationMembership.objects.filter(
                organization=project.division.organization,
                user=self.request.user,
                role=OrganizationMembership.Role.CORE_BOARD,
                is_active=True,
            ).exists()
        ):
            raise PermissionDenied("You do not have access to this project's members.")
        return ProjectMembership.objects.filter(
            project=project,
            is_active=True,
        ).select_related("user__profile").order_by("user__email")


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Password changed successfully."})
