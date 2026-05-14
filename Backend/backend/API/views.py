from django.db.models import Q
from rest_framework import generics, permissions
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
