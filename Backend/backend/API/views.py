from django.http import FileResponse
from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
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
    can_access_repository,
    can_access_resource_document,
    can_access_task,
    can_delete_resource_document,
    can_delete_task,
)
from .serializers import (
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
