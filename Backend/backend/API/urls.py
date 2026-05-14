from django.urls import path

from .views import (
    AnnouncementDetailView,
    AnnouncementFeedView,
    CurrentUserView,
    DashboardView,
    DivisionDocumentListCreateView,
    DivisionInvitationCreateView,
    DivisionListCreateView,
    InvitationAcceptView,
    LoginView,
    OrganizationAnnouncementListCreateView,
    OrganizationDocumentListCreateView,
    OrganizationInvitationCreateView,
    OrganizationListCreateView,
    ProjectDocumentListCreateView,
    ProjectInvitationCreateView,
    ProjectListCreateView,
    RegisterView,
    ResourceDocumentDetailView,
    ResourceDocumentDownloadView,
    TaskDetailView,
    TaskListCreateView,
)


urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
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
    path(
        "organizations/<int:pk>/announcements/",
        OrganizationAnnouncementListCreateView.as_view(),
        name="organization_announcements",
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
    path("tasks/", TaskListCreateView.as_view(), name="task_list"),
    path("tasks/<int:pk>/", TaskDetailView.as_view(), name="task_detail"),
    path("announcements/", AnnouncementFeedView.as_view(), name="announcement_feed"),
    path(
        "announcements/<int:pk>/",
        AnnouncementDetailView.as_view(),
        name="announcement_detail",
    ),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invitation_accept"),
]
