from django.urls import path

from .views import (
    CurrentUserView,
    DivisionInvitationCreateView,
    DivisionListCreateView,
    InvitationAcceptView,
    LoginView,
    OrganizationInvitationCreateView,
    OrganizationListCreateView,
    ProjectInvitationCreateView,
    ProjectListCreateView,
    RegisterView,
)


urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("organizations/", OrganizationListCreateView.as_view(), name="organization_list"),
    path(
        "organizations/<int:pk>/invite/",
        OrganizationInvitationCreateView.as_view(),
        name="organization_invite",
    ),
    path("divisions/", DivisionListCreateView.as_view(), name="division_list"),
    path(
        "divisions/<int:pk>/invite/",
        DivisionInvitationCreateView.as_view(),
        name="division_invite",
    ),
    path("projects/", ProjectListCreateView.as_view(), name="project_list"),
    path(
        "projects/<int:pk>/invite/",
        ProjectInvitationCreateView.as_view(),
        name="project_invite",
    ),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invitation_accept"),
]
