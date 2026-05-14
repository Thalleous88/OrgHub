from django.urls import path

from .views import (
    CurrentUserView,
    DivisionDocumentListCreateView,
    DivisionInvitationCreateView,
    DivisionListCreateView,
    InvitationAcceptView,
    LoginView,
    OrganizationDocumentListCreateView,
    OrganizationInvitationCreateView,
    OrganizationListCreateView,
    ProjectDocumentListCreateView,
    ProjectInvitationCreateView,
    ProjectListCreateView,
    RegisterView,
    ResourceDocumentDetailView,
    ResourceDocumentDownloadView,
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
    path(
        "organizations/<int:pk>/documents/",
        OrganizationDocumentListCreateView.as_view(),
        name="organization_documents",
    ),
    path("divisions/", DivisionListCreateView.as_view(), name="division_list"),
    path(
        "divisions/<int:pk>/invite/",
        DivisionInvitationCreateView.as_view(),
        name="division_invite",
    ),
    path(
        "divisions/<int:pk>/documents/",
        DivisionDocumentListCreateView.as_view(),
        name="division_documents",
    ),
    path("projects/", ProjectListCreateView.as_view(), name="project_list"),
    path(
        "projects/<int:pk>/invite/",
        ProjectInvitationCreateView.as_view(),
        name="project_invite",
    ),
    path(
        "projects/<int:pk>/documents/",
        ProjectDocumentListCreateView.as_view(),
        name="project_documents",
    ),
    path("documents/<int:pk>/", ResourceDocumentDetailView.as_view(), name="document_detail"),
    path(
        "documents/<int:pk>/download/",
        ResourceDocumentDownloadView.as_view(),
        name="document_download",
    ),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invitation_accept"),
]
