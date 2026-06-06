import shutil
import tempfile
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

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


User = get_user_model()
TEST_MEDIA_ROOT = tempfile.mkdtemp()
TEST_STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


def tearDownModule():
    shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)


class AuthAPITests(APITestCase):
    def test_register_creates_user_with_email_username_and_tokens(self):
        response = self.client.post(
            reverse("register"),
            {"email": "Test@Example.com", "password": "Password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "test@example.com")
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        user = User.objects.get(email="test@example.com")
        self.assertEqual(user.username, "test@example.com")
        self.assertTrue(user.check_password("Password123"))
        self.assertTrue(Profile.objects.filter(user=user).exists())

    def test_login_accepts_email_and_password(self):
        User.objects.create_user(
            username="member@example.com",
            email="member@example.com",
            password="Password123",
        )

        response = self.client.post(
            reverse("login"),
            {"email": "member@example.com", "password": "Password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_current_user_requires_authentication(self):
        response = self.client.get(reverse("current_user"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_update_requires_authentication(self):
        response = self.client.patch(
            reverse("current_user_profile"),
            {"full_name": "Unauthenticated User"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_can_read_and_update_own_profile(self):
        user = User.objects.create_user(
            username="profile@example.com",
            email="profile@example.com",
            password="Password123",
        )
        Profile.objects.create(user=user, full_name="Old Name")
        self.client.force_authenticate(user)

        response = self.client.get(reverse("current_user_profile"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Old Name")

        response = self.client.patch(
            reverse("current_user_profile"),
            {
                "full_name": "Alex Johnson",
                "major": "Computer Science",
                "campus_location": "Alam Sutera",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Alex Johnson")
        self.assertEqual(response.data["major"], "Computer Science")
        self.assertEqual(response.data["campus_location"], "Alam Sutera")

        user.profile.refresh_from_db()
        self.assertEqual(user.profile.full_name, "Alex Johnson")

    def test_profile_endpoint_creates_missing_profile_for_current_user(self):
        user = User.objects.create_user(
            username="missing-profile@example.com",
            email="missing-profile@example.com",
            password="Password123",
        )
        self.client.force_authenticate(user)

        response = self.client.patch(
            reverse("current_user_profile"),
            {"full_name": "New Profile"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Profile.objects.filter(user=user, full_name="New Profile").exists())


class MembershipAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core@example.com",
            email="core@example.com",
            password="Password123",
        )
        Profile.objects.create(user=self.core_user)
        self.member_user = User.objects.create_user(
            username="member@example.com",
            email="member@example.com",
            password="Password123",
        )
        Profile.objects.create(user=self.member_user)

    def test_organization_creator_becomes_core_board(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("organization_list"),
            {"name": "OrgHub", "description": "Student org"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        organization = Organization.objects.get(name="OrgHub")
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=organization,
                user=self.core_user,
                role=OrganizationMembership.Role.CORE_BOARD,
                is_active=True,
            ).exists()
        )

    def test_member_can_leave_organization_and_child_memberships_are_deactivated(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        organization_membership = OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        division = Division.objects.create(organization=organization, name="Operations")
        division_membership = DivisionMembership.objects.create(
            division=division,
            user=self.member_user,
            role=DivisionMembership.Role.MEMBER,
        )
        project = Project.objects.create(division=division, name="Orientation")
        project_membership = ProjectMembership.objects.create(
            project=project,
            user=self.member_user,
            role=ProjectMembership.Role.MEMBER,
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.post(
            reverse("organization_leave", kwargs={"pk": organization.pk}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        organization_membership.refresh_from_db()
        division_membership.refresh_from_db()
        project_membership.refresh_from_db()
        self.assertFalse(organization_membership.is_active)
        self.assertFalse(division_membership.is_active)
        self.assertFalse(project_membership.is_active)

    def test_last_core_board_member_cannot_leave_organization(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )

        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("organization_leave", kwargs={"pk": organization.pk}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        membership.refresh_from_db()
        self.assertTrue(membership.is_active)

    def test_core_board_member_can_leave_when_another_core_board_member_exists(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )

        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("organization_leave", kwargs={"pk": organization.pk}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        membership.refresh_from_db()
        self.assertFalse(membership.is_active)

    def test_outsider_cannot_leave_organization(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.post(
            reverse("organization_leave", kwargs={"pk": organization.pk}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_core_board_can_invite_organization_member(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )

        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("organization_invite", kwargs={"pk": organization.pk}),
            {"email": "invitee@example.com", "role": "MEMBER"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Invitation.objects.filter(
                organization=organization,
                email="invitee@example.com",
                role=Invitation.Role.MEMBER,
                status=Invitation.Status.PENDING,
                invited_by=self.core_user,
            ).exists()
        )

    def test_ordinary_member_cannot_invite_organization_member(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.post(
            reverse("organization_invite", kwargs={"pk": organization.pk}),
            {"email": "invitee@example.com", "role": "MEMBER"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            Invitation.objects.filter(
                organization=organization,
                email="invitee@example.com",
            ).exists()
        )

    def test_only_core_board_can_assign_division_head(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        division = Division.objects.create(organization=organization, name="R&D")
        DivisionMembership.objects.create(
            division=division,
            user=self.member_user,
            role=DivisionMembership.Role.MEMBER,
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.post(
            reverse("division_invite", kwargs={"pk": division.pk}),
            {"email": "lead@example.com", "role": "DIVISION_HEAD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("division_invite", kwargs={"pk": division.pk}),
            {"email": "lead@example.com", "role": "DIVISION_HEAD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_accepting_division_invite_creates_org_and_division_memberships(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        division = Division.objects.create(organization=organization, name="Marketing")

        self.client.force_authenticate(self.core_user)
        invite_response = self.client.post(
            reverse("division_invite", kwargs={"pk": division.pk}),
            {"email": self.member_user.email, "role": "MEMBER"},
            format="json",
        )
        self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.member_user)
        accept_response = self.client.post(
            reverse("invitation_accept"),
            {"token": invite_response.data[0]["token"]},
            format="json",
        )

        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=organization,
                user=self.member_user,
                role=OrganizationMembership.Role.MEMBER,
            ).exists()
        )
        self.assertTrue(
            DivisionMembership.objects.filter(
                division=division,
                user=self.member_user,
                role=DivisionMembership.Role.MEMBER,
            ).exists()
        )

    def test_project_membership_requires_parent_division_membership(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        division = Division.objects.create(organization=organization, name="Finance")
        project = Project.objects.create(division=division, name="Budget Tool")

        with self.assertRaisesMessage(
            Exception,
            "Project members must belong to the parent division.",
        ):
            ProjectMembership.objects.create(
                project=project,
                user=self.member_user,
                role=ProjectMembership.Role.MEMBER,
            )

    def test_project_invite_allows_any_org_member(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        division = Division.objects.create(organization=organization, name="Events")
        project = Project.objects.create(division=division, name="Welcome Night")

        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("project_invite", kwargs={"pk": project.pk}),
            {"email": self.member_user.email, "role": "MEMBER"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_project_invite_rejects_non_org_member(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        division = Division.objects.create(organization=organization, name="Events")
        project = Project.objects.create(division=division, name="Welcome Night")

        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("project_invite", kwargs={"pk": project.pk}),
            {"email": self.member_user.email, "role": "MEMBER"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_project_lead_can_invite_org_member_to_project(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        lead_user = User.objects.create_user(
            username="lead-project@example.com",
            email="lead-project@example.com",
            password="Password123",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=lead_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        division = Division.objects.create(organization=organization, name="Events")
        DivisionMembership.objects.create(
            division=division,
            user=lead_user,
            role=DivisionMembership.Role.MEMBER,
        )
        project = Project.objects.create(division=division, name="Welcome Night")
        ProjectMembership.objects.create(
            project=project,
            user=lead_user,
            role=ProjectMembership.Role.PROJECT_LEAD,
        )

        self.client.force_authenticate(lead_user)
        response = self.client.post(
            reverse("project_invite", kwargs={"pk": project.pk}),
            {"email": self.member_user.email, "role": "MEMBER"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_accepting_project_invite_creates_org_division_and_project_memberships(self):
        organization = Organization.objects.create(
            name="OrgHub",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        division = Division.objects.create(organization=organization, name="Events")
        project = Project.objects.create(division=division, name="Welcome Night")

        self.client.force_authenticate(self.core_user)
        invite_response = self.client.post(
            reverse("project_invite", kwargs={"pk": project.pk}),
            {"email": self.member_user.email, "role": "MEMBER"},
            format="json",
        )
        self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.member_user)
        accept_response = self.client.post(
            reverse("invitation_accept"),
            {"token": invite_response.data[0]["token"]},
            format="json",
        )

        self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=organization,
                user=self.member_user,
                is_active=True,
            ).exists()
        )
        self.assertTrue(
            DivisionMembership.objects.filter(
                division=division,
                user=self.member_user,
                is_active=True,
            ).exists()
        )
        self.assertTrue(
            ProjectMembership.objects.filter(
                project=project,
                user=self.member_user,
                is_active=True,
            ).exists()
        )


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, STORAGES=TEST_STORAGES)
class ResourceDocumentAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-docs@example.com",
            email="core-docs@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="member-docs@example.com",
            email="member-docs@example.com",
            password="Password123",
        )
        self.outsider_user = User.objects.create_user(
            username="outsider@example.com",
            email="outsider@example.com",
            password="Password123",
        )
        self.project_lead_user = User.objects.create_user(
            username="lead-docs@example.com",
            email="lead-docs@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Docs Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Education",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Workshop",
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.project_lead_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        DivisionMembership.objects.create(
            division=self.division,
            user=self.member_user,
            role=DivisionMembership.Role.MEMBER,
        )
        DivisionMembership.objects.create(
            division=self.division,
            user=self.project_lead_user,
            role=DivisionMembership.Role.MEMBER,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.project_lead_user,
            role=ProjectMembership.Role.PROJECT_LEAD,
        )

    def upload_file(self, name="guide.pdf"):
        return SimpleUploadedFile(
            name,
            b"document contents",
            content_type="application/pdf",
        )

    def test_core_board_can_upload_org_document_and_member_can_read(self):
        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("organization_documents", kwargs={"pk": self.organization.pk}),
            {
                "title": "Org Handbook",
                "description": "Global docs",
                "file": self.upload_file(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        document = ResourceDocument.objects.get(title="Org Handbook")
        self.assertEqual(document.organization, self.organization)

        self.client.force_authenticate(self.member_user)
        response = self.client.get(reverse("document_detail", kwargs={"pk": document.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_org_member_cannot_upload_org_document(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.post(
            reverse("organization_documents", kwargs={"pk": self.organization.pk}),
            {"title": "Notes", "file": self.upload_file("notes.pdf")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_division_document_requires_division_access(self):
        document = ResourceDocument.objects.create(
            division=self.division,
            uploaded_by=self.core_user,
            title="Division Plan",
            file=self.upload_file("division.pdf"),
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.get(reverse("document_detail", kwargs={"pk": document.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.outsider_user)
        response = self.client.get(reverse("document_detail", kwargs={"pk": document.pk}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_project_lead_can_upload_project_document_and_division_member_cannot_read(self):
        self.client.force_authenticate(self.project_lead_user)
        response = self.client.post(
            reverse("project_documents", kwargs={"pk": self.project.pk}),
            {"title": "Workshop Slides", "file": self.upload_file("slides.pdf")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        document = ResourceDocument.objects.get(title="Workshop Slides")

        self.client.force_authenticate(self.member_user)
        response = self.client.get(reverse("document_detail", kwargs={"pk": document.pk}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rejects_unsupported_file_type(self):
        self.client.force_authenticate(self.core_user)
        response = self.client.post(
            reverse("organization_documents", kwargs={"pk": self.organization.pk}),
            {
                "title": "Bad File",
                "file": SimpleUploadedFile("bad.txt", b"text", content_type="text/plain"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AnnouncementAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-announcements@example.com",
            email="core-announcements@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="member-announcements@example.com",
            email="member-announcements@example.com",
            password="Password123",
        )
        self.outsider_user = User.objects.create_user(
            username="outsider-announcements@example.com",
            email="outsider-announcements@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Announcements Org",
            created_by=self.core_user,
        )
        self.other_organization = Organization.objects.create(
            name="Other Announcements Org",
            created_by=self.outsider_user,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        OrganizationMembership.objects.create(
            organization=self.other_organization,
            user=self.outsider_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )

    def test_core_board_can_broadcast_organization_announcement(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("organization_announcements", kwargs={"pk": self.organization.pk}),
            {
                "title": "Spring Innovation Summit",
                "content": "Registration opens today.",
                "priority": "HIGH",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        announcement = Announcement.objects.get(title="Spring Innovation Summit")
        self.assertEqual(announcement.organization, self.organization)
        self.assertEqual(announcement.created_by, self.core_user)

    def test_member_can_read_but_not_create_announcement(self):
        announcement = Announcement.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Weekly Briefing",
            content="Meeting at 5 PM.",
        )
        self.client.force_authenticate(self.member_user)

        response = self.client.get(
            reverse("announcement_detail", kwargs={"pk": announcement.pk})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            reverse("organization_announcements", kwargs={"pk": self.organization.pk}),
            {"title": "Member Post", "content": "Not allowed."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_announcement_feed_only_returns_membership_organizations(self):
        visible_announcement = Announcement.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Visible Update",
            content="Shown in feed.",
        )
        Announcement.objects.create(
            organization=self.other_organization,
            created_by=self.outsider_user,
            title="Hidden Update",
            content="Not shown in feed.",
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.get(reverse("announcement_feed"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [visible_announcement.pk])

    def test_outsider_cannot_read_announcement(self):
        announcement = Announcement.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Private Broadcast",
            content="Members only.",
        )

        self.client.force_authenticate(self.outsider_user)
        response = self.client.get(
            reverse("announcement_detail", kwargs={"pk": announcement.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_only_core_board_can_delete_announcement(self):
        announcement = Announcement.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Delete Me",
            content="Core Board only.",
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.delete(
            reverse("announcement_detail", kwargs={"pk": announcement.pk})
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.core_user)
        response = self.client.delete(
            reverse("announcement_detail", kwargs={"pk": announcement.pk})
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class CalendarEventAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-calendar@example.com",
            email="core-calendar@example.com",
            password="Password123",
        )
        self.division_head_user = User.objects.create_user(
            username="head-calendar@example.com",
            email="head-calendar@example.com",
            password="Password123",
        )
        self.project_lead_user = User.objects.create_user(
            username="lead-calendar@example.com",
            email="lead-calendar@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="member-calendar@example.com",
            email="member-calendar@example.com",
            password="Password123",
        )
        self.outsider_user = User.objects.create_user(
            username="outsider-calendar@example.com",
            email="outsider-calendar@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Calendar Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Programs",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Mentoring Track",
        )

        for user in [
            self.core_user,
            self.division_head_user,
            self.project_lead_user,
            self.member_user,
        ]:
            OrganizationMembership.objects.create(
                organization=self.organization,
                user=user,
                role=(
                    OrganizationMembership.Role.CORE_BOARD
                    if user == self.core_user
                    else OrganizationMembership.Role.MEMBER
                ),
            )
        DivisionMembership.objects.create(
            division=self.division,
            user=self.division_head_user,
            role=DivisionMembership.Role.DIVISION_HEAD,
        )
        for user in [self.project_lead_user, self.member_user]:
            DivisionMembership.objects.create(
                division=self.division,
                user=user,
                role=DivisionMembership.Role.MEMBER,
            )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.project_lead_user,
            role=ProjectMembership.Role.PROJECT_LEAD,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.member_user,
            role=ProjectMembership.Role.MEMBER,
        )

    def event_payload(self, **overrides):
        starts_at = timezone.now() + timedelta(days=1)
        payload = {
            "title": "Weekly Sync",
            "description": "Discuss upcoming work.",
            "event_type": CalendarEvent.EventType.MEETING,
            "location": "Room 501",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=1)).isoformat(),
        }
        payload.update(overrides)
        return payload

    def test_core_board_can_create_organization_event(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("organization_calendar_events", kwargs={"pk": self.organization.pk}),
            self.event_payload(title="General Assembly"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        event = CalendarEvent.objects.get(title="General Assembly")
        self.assertEqual(event.organization, self.organization)
        self.assertEqual(event.created_by, self.core_user)

    def test_division_head_can_create_division_event(self):
        self.client.force_authenticate(self.division_head_user)

        response = self.client.post(
            reverse("division_calendar_events", kwargs={"pk": self.division.pk}),
            self.event_payload(title="Division Planning"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CalendarEvent.objects.get(title="Division Planning").division, self.division)

    def test_project_lead_can_create_project_meeting(self):
        self.client.force_authenticate(self.project_lead_user)

        response = self.client.post(
            reverse("project_calendar_events", kwargs={"pk": self.project.pk}),
            self.event_payload(title="Mentoring Session"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CalendarEvent.objects.get(title="Mentoring Session").project, self.project)

    def test_regular_member_can_read_but_not_create_project_event(self):
        event = CalendarEvent.objects.create(
            project=self.project,
            created_by=self.project_lead_user,
            title="Member Visible Meeting",
            event_type=CalendarEvent.EventType.MEETING,
            starts_at=timezone.now() + timedelta(days=1),
        )
        self.client.force_authenticate(self.member_user)

        response = self.client.get(reverse("calendar_event_detail", kwargs={"pk": event.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            reverse("project_calendar_events", kwargs={"pk": self.project.pk}),
            self.event_payload(title="Unauthorized Meeting"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_calendar_feed_only_returns_accessible_events(self):
        visible_event = CalendarEvent.objects.create(
            project=self.project,
            created_by=self.project_lead_user,
            title="Visible Project Meeting",
            starts_at=timezone.now() + timedelta(days=1),
        )
        other_organization = Organization.objects.create(
            name="Other Calendar Org",
            created_by=self.outsider_user,
        )
        CalendarEvent.objects.create(
            organization=other_organization,
            created_by=self.outsider_user,
            title="Hidden Organization Event",
            starts_at=timezone.now() + timedelta(days=1),
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.get(reverse("calendar_event_list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([event["id"] for event in response.data], [visible_event.pk])

    def test_calendar_feed_can_filter_by_start_range(self):
        soon_event = CalendarEvent.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Soon Event",
            starts_at=timezone.now() + timedelta(days=1),
        )
        CalendarEvent.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Later Event",
            starts_at=timezone.now() + timedelta(days=10),
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.get(
            reverse("calendar_event_list"),
            {"starts_before": (timezone.now() + timedelta(days=2)).isoformat()},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([event["id"] for event in response.data], [soon_event.pk])

    def test_outsider_cannot_read_event(self):
        event = CalendarEvent.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Private Event",
            starts_at=timezone.now() + timedelta(days=1),
        )

        self.client.force_authenticate(self.outsider_user)
        response = self.client.get(reverse("calendar_event_detail", kwargs={"pk": event.pk}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_only_calendar_managers_can_update_or_delete_event(self):
        event = CalendarEvent.objects.create(
            project=self.project,
            created_by=self.project_lead_user,
            title="Managed Meeting",
            starts_at=timezone.now() + timedelta(days=1),
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.patch(
            reverse("calendar_event_detail", kwargs={"pk": event.pk}),
            {"title": "Member Rename"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.project_lead_user)
        response = self.client.patch(
            reverse("calendar_event_detail", kwargs={"pk": event.pk}),
            {"title": "Lead Rename"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.delete(reverse("calendar_event_detail", kwargs={"pk": event.pk}))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_event_end_time_cannot_be_before_start_time(self):
        starts_at = timezone.now() + timedelta(days=1)
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("organization_calendar_events", kwargs={"pk": self.organization.pk}),
            self.event_payload(
                starts_at=starts_at.isoformat(),
                ends_at=(starts_at - timedelta(hours=1)).isoformat(),
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class NotificationAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-notifications@example.com",
            email="core-notifications@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="member-notifications@example.com",
            email="member-notifications@example.com",
            password="Password123",
        )
        self.outsider_user = User.objects.create_user(
            username="outsider-notifications@example.com",
            email="outsider-notifications@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Notification Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Notification Division",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Notification Project",
        )
        for user in [self.core_user, self.member_user]:
            OrganizationMembership.objects.create(
                organization=self.organization,
                user=user,
                role=(
                    OrganizationMembership.Role.CORE_BOARD
                    if user == self.core_user
                    else OrganizationMembership.Role.MEMBER
                ),
            )
            DivisionMembership.objects.create(
                division=self.division,
                user=user,
                role=DivisionMembership.Role.MEMBER,
            )
            ProjectMembership.objects.create(
                project=self.project,
                user=user,
                role=ProjectMembership.Role.MEMBER,
            )

    def test_generate_reminders_creates_task_and_event_notifications(self):
        task = Task.objects.create(
            project=self.project,
            title="Submit report",
            due_at=timezone.now() + timedelta(hours=2),
            created_by=self.core_user,
        )
        task.assigned_to.add(self.member_user)
        event = CalendarEvent.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="General Meeting",
            event_type=CalendarEvent.EventType.MEETING,
            starts_at=timezone.now() + timedelta(hours=3),
        )

        output = StringIO()
        call_command("generate_reminders", stdout=output)

        self.assertIn("Created 3 reminder notification(s).", output.getvalue())
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.member_user,
                task=task,
                notification_type=Notification.NotificationType.TASK_REMINDER,
            ).exists()
        )
        self.assertEqual(
            Notification.objects.filter(
                calendar_event=event,
                notification_type=Notification.NotificationType.EVENT_REMINDER,
            ).count(),
            2,
        )

        output = StringIO()
        call_command("generate_reminders", stdout=output)
        self.assertIn("Created 0 reminder notification(s).", output.getvalue())

    def test_generate_reminders_ignores_done_tasks_and_later_events(self):
        Task.objects.create(
            project=self.project,
            title="Completed report",
            status=Task.Status.DONE,
            due_at=timezone.now() + timedelta(hours=2),
            created_by=self.core_user,
        )
        Task.objects.get(title="Completed report").assigned_to.add(self.member_user)
        CalendarEvent.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Later Meeting",
            starts_at=timezone.now() + timedelta(days=3),
        )

        call_command("generate_reminders", stdout=StringIO())

        self.assertFalse(Notification.objects.exists())

    def test_user_can_list_and_mark_own_notifications_read(self):
        task = Task.objects.create(
            project=self.project,
            title="Read notification task",
            due_at=timezone.now() + timedelta(hours=2),
            created_by=self.core_user,
        )
        task.assigned_to.add(self.member_user)
        notification = Notification.objects.create(
            recipient=self.member_user,
            notification_type=Notification.NotificationType.TASK_REMINDER,
            task=task,
            title="Task due soon",
            message="Read this notification.",
        )
        Notification.objects.create(
            recipient=self.outsider_user,
            notification_type=Notification.NotificationType.ANNOUNCEMENT,
            title="Other user notification",
            message="Hidden.",
        )
        self.client.force_authenticate(self.member_user)

        response = self.client.get(reverse("notification_list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [notification.pk])

        response = self.client.patch(
            reverse("notification_detail", kwargs={"pk": notification.pk}),
            {"is_read": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_user_can_mark_all_notifications_read(self):
        for index in range(2):
            Notification.objects.create(
                recipient=self.member_user,
                notification_type=Notification.NotificationType.ANNOUNCEMENT,
                title=f"Notification {index}",
                message="Unread.",
            )
        self.client.force_authenticate(self.member_user)

        response = self.client.post(reverse("notification_mark_all_read"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            Notification.objects.filter(recipient=self.member_user, is_read=False).exists()
        )

    def test_user_cannot_read_another_users_notification(self):
        notification = Notification.objects.create(
            recipient=self.member_user,
            notification_type=Notification.NotificationType.ANNOUNCEMENT,
            title="Private Notification",
            message="Members only.",
        )
        self.client.force_authenticate(self.outsider_user)

        response = self.client.get(reverse("notification_detail", kwargs={"pk": notification.pk}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, STORAGES=TEST_STORAGES)
class DashboardAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-dashboard@example.com",
            email="core-dashboard@example.com",
            password="Password123",
        )
        Profile.objects.create(
            user=self.core_user,
            full_name="Core Dashboard",
            major="Information Systems",
            campus_location="Kemanggisan",
        )
        self.division_head_user = User.objects.create_user(
            username="head-dashboard@example.com",
            email="head-dashboard@example.com",
            password="Password123",
        )
        self.project_lead_user = User.objects.create_user(
            username="lead-dashboard@example.com",
            email="lead-dashboard@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="member-dashboard@example.com",
            email="member-dashboard@example.com",
            password="Password123",
        )
        self.outsider_user = User.objects.create_user(
            username="outsider-dashboard@example.com",
            email="outsider-dashboard@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Dashboard Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Product",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Portal",
        )

        for user in [
            self.core_user,
            self.division_head_user,
            self.project_lead_user,
            self.member_user,
        ]:
            OrganizationMembership.objects.create(
                organization=self.organization,
                user=user,
                role=(
                    OrganizationMembership.Role.CORE_BOARD
                    if user == self.core_user
                    else OrganizationMembership.Role.MEMBER
                ),
            )

        DivisionMembership.objects.create(
            division=self.division,
            user=self.division_head_user,
            role=DivisionMembership.Role.DIVISION_HEAD,
        )
        for user in [self.project_lead_user, self.member_user]:
            DivisionMembership.objects.create(
                division=self.division,
                user=user,
                role=DivisionMembership.Role.MEMBER,
            )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.project_lead_user,
            role=ProjectMembership.Role.PROJECT_LEAD,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.member_user,
            role=ProjectMembership.Role.MEMBER,
        )

    def test_dashboard_requires_authentication(self):
        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_returns_member_personal_feed(self):
        assigned_task = Task.objects.create(
            project=self.project,
            title="Prepare onboarding notes",
            created_by=self.project_lead_user,
        )
        assigned_task.assigned_to.add(self.member_user)
        created_task = Task.objects.create(
            project=self.project,
            title="Review onboarding notes",
            created_by=self.member_user,
        )
        created_task.assigned_to.add(self.member_user)
        announcement = Announcement.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="General Broadcast",
            content="Welcome to the semester.",
            priority=Announcement.Priority.HIGH,
        )
        document = ResourceDocument.objects.create(
            project=self.project,
            uploaded_by=self.project_lead_user,
            title="Starter Guide",
            file=SimpleUploadedFile("starter.pdf", b"guide", content_type="application/pdf"),
        )
        invitation = Invitation.objects.create(
            organization=self.organization,
            invited_by=self.core_user,
            email=self.member_user.email,
            role=Invitation.Role.MEMBER,
        )

        self.client.force_authenticate(self.member_user)
        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["profile"]["email"], self.member_user.email)
        self.assertEqual(
            response.data["memberships"]["organizations"][0]["id"],
            self.organization.pk,
        )
        self.assertIn(
            assigned_task.pk,
            [task["id"] for task in response.data["tasks"]["assigned_to_me"]],
        )
        self.assertIn(
            created_task.pk,
            [task["id"] for task in response.data["tasks"]["created_by_me"]],
        )
        self.assertEqual(response.data["announcements"][0]["id"], announcement.pk)
        self.assertEqual(response.data["documents"][0]["id"], document.pk)
        self.assertEqual(response.data["pending_invitations"][0]["id"], invitation.pk)
        self.assertEqual(response.data["management_summary"]["organizations"], [])
        self.assertEqual(response.data["management_summary"]["divisions"], [])
        self.assertEqual(response.data["management_summary"]["projects"], [])

    def test_dashboard_returns_role_based_management_summary(self):
        div_task = Task.objects.create(
            division=self.division,
            title="Division plan",
            created_by=self.core_user,
        )
        div_task.assigned_to.add(self.division_head_user)
        proj_task = Task.objects.create(
            project=self.project,
            title="Project roadmap",
            created_by=self.division_head_user,
        )
        proj_task.assigned_to.add(self.project_lead_user)
        done_task = Task.objects.create(
            project=self.project,
            title="Completed work",
            status=Task.Status.DONE,
            created_by=self.project_lead_user,
        )
        done_task.assigned_to.add(self.member_user)

        self.client.force_authenticate(self.core_user)
        core_response = self.client.get(reverse("dashboard"))
        self.assertEqual(core_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            core_response.data["management_summary"]["organizations"][0][
                "open_tasks_count"
            ],
            2,
        )
        self.assertEqual(
            len(core_response.data["tasks"]["managed"]),
            2,
        )

        self.client.force_authenticate(self.division_head_user)
        division_response = self.client.get(reverse("dashboard"))
        self.assertEqual(division_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            division_response.data["management_summary"]["divisions"][0][
                "open_tasks_count"
            ],
            2,
        )

        self.client.force_authenticate(self.project_lead_user)
        project_response = self.client.get(reverse("dashboard"))
        self.assertEqual(project_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            project_response.data["management_summary"]["projects"][0][
                "members_count"
            ],
            2,
        )

    def test_dashboard_does_not_leak_unrelated_data(self):
        Announcement.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Private Org Broadcast",
            content="Members only.",
        )
        ResourceDocument.objects.create(
            division=self.division,
            uploaded_by=self.core_user,
            title="Private Division Doc",
            file=SimpleUploadedFile("private.pdf", b"doc", content_type="application/pdf"),
        )

        self.client.force_authenticate(self.outsider_user)
        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["memberships"]["organizations"], [])
        self.assertEqual(response.data["announcements"], [])
        self.assertEqual(response.data["documents"], [])


class TaskAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-tasks@example.com",
            email="core-tasks@example.com",
            password="Password123",
        )
        self.division_head_user = User.objects.create_user(
            username="head@example.com",
            email="head@example.com",
            password="Password123",
        )
        self.project_lead_user = User.objects.create_user(
            username="lead@example.com",
            email="lead@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="task-member@example.com",
            email="task-member@example.com",
            password="Password123",
        )
        self.other_member_user = User.objects.create_user(
            username="other-member@example.com",
            email="other-member@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Task Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Operations",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Launch",
        )

        for user in [
            self.core_user,
            self.division_head_user,
            self.project_lead_user,
            self.member_user,
            self.other_member_user,
        ]:
            OrganizationMembership.objects.create(
                organization=self.organization,
                user=user,
                role=(
                    OrganizationMembership.Role.CORE_BOARD
                    if user == self.core_user
                    else OrganizationMembership.Role.MEMBER
                ),
            )

        DivisionMembership.objects.create(
            division=self.division,
            user=self.division_head_user,
            role=DivisionMembership.Role.DIVISION_HEAD,
        )
        for user in [self.project_lead_user, self.member_user, self.other_member_user]:
            DivisionMembership.objects.create(
                division=self.division,
                user=user,
                role=DivisionMembership.Role.MEMBER,
            )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.project_lead_user,
            role=ProjectMembership.Role.PROJECT_LEAD,
        )
        for user in [self.member_user, self.other_member_user]:
            ProjectMembership.objects.create(
                project=self.project,
                user=user,
                role=ProjectMembership.Role.MEMBER,
            )

    def test_core_board_can_assign_task_to_division_head(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "division": self.division.pk,
                "title": "Prepare division plan",
                "assigned_emails": [self.division_head_user.email],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(title="Prepare division plan")
        self.assertEqual(task.status, Task.Status.TODO)
        self.assertIn(self.division_head_user, task.assigned_to.all())

    def test_core_board_can_assign_directly_to_project_member(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "project": self.project.pk,
                "title": "Skip hierarchy",
                "assigned_emails": [self.member_user.email],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_division_head_can_assign_task_to_project_lead(self):
        self.client.force_authenticate(self.division_head_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "project": self.project.pk,
                "title": "Build project roadmap",
                "assigned_emails": [self.project_lead_user.email],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_project_lead_can_assign_task_to_project_member(self):
        self.client.force_authenticate(self.project_lead_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "project": self.project.pk,
                "title": "Draft workshop material",
                "assigned_emails": [self.member_user.email],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_assigned_user_can_update_only_task_status(self):
        task = Task.objects.create(
            project=self.project,
            title="Finish slides",
            created_by=self.project_lead_user,
        )
        task.assigned_to.add(self.member_user)
        self.client.force_authenticate(self.member_user)

        response = self.client.patch(
            reverse("task_detail", kwargs={"pk": task.pk}),
            {"status": "InProgress"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.IN_PROGRESS)

        response = self.client.patch(
            reverse("task_detail", kwargs={"pk": task.pk}),
            {"title": "Rename task"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_member_cannot_read_unassigned_task(self):
        task = Task.objects.create(
            project=self.project,
            title="Private assignment",
            created_by=self.project_lead_user,
        )
        task.assigned_to.add(self.member_user)

        self.client.force_authenticate(self.other_member_user)
        response = self.client.get(reverse("task_detail", kwargs={"pk": task.pk}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RegisterAutoAcceptTests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-regauto@example.com",
            email="core-regauto@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="RegAuto Org",
            created_by=self.core_user,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="RegAuto Division",
        )

    def test_register_auto_accepts_pending_org_invitation(self):
        Invitation.objects.create(
            organization=self.organization,
            invited_by=self.core_user,
            email="newmember@example.com",
            role=Invitation.Role.MEMBER,
        )

        response = self.client.post(
            reverse("register"),
            {"email": "newmember@example.com", "password": "Password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=self.organization,
                user__email="newmember@example.com",
                role=OrganizationMembership.Role.MEMBER,
                is_active=True,
            ).exists()
        )

    def test_register_auto_accepts_pending_division_invitation(self):
        Invitation.objects.create(
            division=self.division,
            invited_by=self.core_user,
            email="divnew@example.com",
            role=Invitation.Role.MEMBER,
        )

        response = self.client.post(
            reverse("register"),
            {"email": "divnew@example.com", "password": "Password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=self.organization,
                user__email="divnew@example.com",
                is_active=True,
            ).exists()
        )
        self.assertTrue(
            DivisionMembership.objects.filter(
                division=self.division,
                user__email="divnew@example.com",
                role=DivisionMembership.Role.MEMBER,
                is_active=True,
            ).exists()
        )

    def test_register_without_pending_invitations_still_succeeds(self):
        response = self.client.post(
            reverse("register"),
            {"email": "free@example.com", "password": "Password123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(OrganizationMembership.objects.filter(user__email="free@example.com").exists())


class MemberListAPITests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-members@example.com",
            email="core-members@example.com",
            password="Password123",
        )
        Profile.objects.create(user=self.core_user, full_name="Core Board")
        self.member_user = User.objects.create_user(
            username="member-members@example.com",
            email="member-members@example.com",
            password="Password123",
        )
        Profile.objects.create(user=self.member_user, full_name="Org Member")
        self.outsider_user = User.objects.create_user(
            username="outsider-members@example.com",
            email="outsider-members@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Members Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Members Division",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Members Project",
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        DivisionMembership.objects.create(
            division=self.division,
            user=self.member_user,
            role=DivisionMembership.Role.MEMBER,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.member_user,
            role=ProjectMembership.Role.MEMBER,
        )

    def test_org_member_can_list_org_members(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.get(
            reverse("organization_members", kwargs={"pk": self.organization.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emails = [m["email"] for m in response.data]
        self.assertIn(self.core_user.email, emails)
        self.assertIn(self.member_user.email, emails)

    def test_org_member_list_includes_role_and_full_name(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.get(
            reverse("organization_members", kwargs={"pk": self.organization.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        core_entry = next(m for m in response.data if m["email"] == self.core_user.email)
        self.assertEqual(core_entry["role"], OrganizationMembership.Role.CORE_BOARD)
        self.assertEqual(core_entry["full_name"], "Core Board")

    def test_division_member_can_list_division_members(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.get(
            reverse("division_members", kwargs={"pk": self.division.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emails = [m["email"] for m in response.data]
        self.assertIn(self.member_user.email, emails)

    def test_project_member_can_list_project_members(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.get(
            reverse("project_members", kwargs={"pk": self.project.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emails = [m["email"] for m in response.data]
        self.assertIn(self.member_user.email, emails)

    def test_outsider_cannot_list_org_members(self):
        self.client.force_authenticate(self.outsider_user)

        response = self.client.get(
            reverse("organization_members", kwargs={"pk": self.organization.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TaskPermissionUpdateTests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-perm@example.com",
            email="core-perm@example.com",
            password="Password123",
        )
        self.division_head_user = User.objects.create_user(
            username="head-perm@example.com",
            email="head-perm@example.com",
            password="Password123",
        )
        self.project_lead_user = User.objects.create_user(
            username="lead-perm@example.com",
            email="lead-perm@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="member-perm@example.com",
            email="member-perm@example.com",
            password="Password123",
        )
        self.other_div_member = User.objects.create_user(
            username="other-div-perm@example.com",
            email="other-div-perm@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Perm Org",
            created_by=self.core_user,
        )
        self.other_organization = Organization.objects.create(
            name="Other Perm Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Perm Division",
        )
        self.other_division = Division.objects.create(
            organization=self.organization,
            name="Other Perm Division",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Perm Project",
        )
        for user in [
            self.core_user,
            self.division_head_user,
            self.project_lead_user,
            self.member_user,
            self.other_div_member,
        ]:
            OrganizationMembership.objects.create(
                organization=self.organization,
                user=user,
                role=(
                    OrganizationMembership.Role.CORE_BOARD
                    if user == self.core_user
                    else OrganizationMembership.Role.MEMBER
                ),
            )
        DivisionMembership.objects.create(
            division=self.division,
            user=self.division_head_user,
            role=DivisionMembership.Role.DIVISION_HEAD,
        )
        for user in [self.project_lead_user, self.member_user]:
            DivisionMembership.objects.create(
                division=self.division,
                user=user,
                role=DivisionMembership.Role.MEMBER,
            )
        DivisionMembership.objects.create(
            division=self.other_division,
            user=self.other_div_member,
            role=DivisionMembership.Role.MEMBER,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.project_lead_user,
            role=ProjectMembership.Role.PROJECT_LEAD,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.member_user,
            role=ProjectMembership.Role.MEMBER,
        )

    def test_core_board_can_assign_task_to_any_division_member(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "division": self.other_division.pk,
                "title": "Cross-division task",
                "assigned_emails": [self.other_div_member.email],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_core_board_can_update_any_task(self):
        task = Task.objects.create(
            division=self.division,
            title="Core update target",
            created_by=self.division_head_user,
        )
        task.assigned_to.add(self.member_user)

        self.client.force_authenticate(self.core_user)
        response = self.client.patch(
            reverse("task_detail", kwargs={"pk": task.pk}),
            {"title": "Core renamed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.title, "Core renamed")

    def test_core_board_can_delete_any_task(self):
        task = Task.objects.create(
            project=self.project,
            title="Core delete target",
            created_by=self.project_lead_user,
        )
        task.assigned_to.add(self.member_user)

        self.client.force_authenticate(self.core_user)
        response = self.client.delete(reverse("task_detail", kwargs={"pk": task.pk}))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_member_can_self_assign_division_task(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "division": self.division.pk,
                "title": "Self-assigned div task",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(title="Self-assigned div task")
        self.assertIn(self.member_user, task.assigned_to.all())

    def test_member_can_self_assign_project_task(self):
        self.client.force_authenticate(self.member_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "project": self.project.pk,
                "title": "Self-assigned proj task",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(title="Self-assigned proj task")
        self.assertIn(self.member_user, task.assigned_to.all())

    def test_non_member_cannot_create_task_in_scope(self):
        self.client.force_authenticate(self.other_div_member)

        response = self.client.post(
            reverse("task_list"),
            {
                "project": self.project.pk,
                "title": "Unauthorized task",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CalendarEventAssigneeTests(APITestCase):
    def setUp(self):
        self.core_user = User.objects.create_user(
            username="core-assignee@example.com",
            email="core-assignee@example.com",
            password="Password123",
        )
        self.member_user = User.objects.create_user(
            username="member-assignee@example.com",
            email="member-assignee@example.com",
            password="Password123",
        )
        self.organization = Organization.objects.create(
            name="Assignee Org",
            created_by=self.core_user,
        )
        self.division = Division.objects.create(
            organization=self.organization,
            name="Assignee Division",
        )
        self.other_division = Division.objects.create(
            organization=self.organization,
            name="Other Assignee Division",
        )
        self.project = Project.objects.create(
            division=self.division,
            name="Assignee Project",
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.core_user,
            role=OrganizationMembership.Role.CORE_BOARD,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.member_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        DivisionMembership.objects.create(
            division=self.division,
            user=self.member_user,
            role=DivisionMembership.Role.MEMBER,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.member_user,
            role=ProjectMembership.Role.MEMBER,
        )

    def event_payload(self, **overrides):
        starts_at = timezone.now() + timedelta(days=1)
        payload = {
            "title": "Assigned Event",
            "description": "Testing assignees.",
            "event_type": CalendarEvent.EventType.MEETING,
            "location": "Room 501",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=1)).isoformat(),
        }
        payload.update(overrides)
        return payload

    def test_org_event_with_assigned_emails(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("organization_calendar_events", kwargs={"pk": self.organization.pk}),
            self.event_payload(
                title="Org Assigned Event",
                assigned_emails=[self.member_user.email],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        event = CalendarEvent.objects.get(title="Org Assigned Event")
        self.assertIn(self.member_user, event.assigned_to.all())
        self.assertIn(self.member_user.email, response.data["assigned_to_emails"])

    def test_org_event_with_assigned_divisions(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("organization_calendar_events", kwargs={"pk": self.organization.pk}),
            self.event_payload(
                title="Division Assigned Event",
                assigned_divisions=[self.division.pk, self.other_division.pk],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        event = CalendarEvent.objects.get(title="Division Assigned Event")
        self.assertIn(self.division, event.assigned_divisions.all())
        self.assertIn(self.other_division, event.assigned_divisions.all())
        self.assertIn(self.division.pk, response.data["assigned_division_ids"])

    def test_assigned_divisions_only_on_org_scoped_events(self):
        self.client.force_authenticate(self.core_user)
        div_head_user = User.objects.create_user(
            username="head-assignee@example.com",
            email="head-assignee@example.com",
            password="Password123",
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=div_head_user,
            role=OrganizationMembership.Role.MEMBER,
        )
        DivisionMembership.objects.create(
            division=self.division,
            user=div_head_user,
            role=DivisionMembership.Role.DIVISION_HEAD,
        )
        self.client.force_authenticate(div_head_user)

        response = self.client.post(
            reverse("division_calendar_events", kwargs={"pk": self.division.pk}),
            self.event_payload(
                title="Bad Division Event",
                assigned_divisions=[self.division.pk],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assigned_divisions_must_belong_to_organization(self):
        other_org = Organization.objects.create(
            name="Other Assignee Org",
            created_by=self.core_user,
        )
        foreign_division = Division.objects.create(
            organization=other_org,
            name="Foreign Division",
        )

        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("organization_calendar_events", kwargs={"pk": self.organization.pk}),
            self.event_payload(
                title="Foreign Div Event",
                assigned_divisions=[foreign_division.pk],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_project_event_supports_assigned_emails(self):
        proj_lead = User.objects.create_user(
            username="lead-assignee@example.com",
            email="lead-assignee@example.com",
            password="Password123",
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=proj_lead,
            role=OrganizationMembership.Role.MEMBER,
        )
        DivisionMembership.objects.create(
            division=self.division,
            user=proj_lead,
            role=DivisionMembership.Role.MEMBER,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=proj_lead,
            role=ProjectMembership.Role.PROJECT_LEAD,
        )
        self.client.force_authenticate(proj_lead)

        response = self.client.post(
            reverse("project_calendar_events", kwargs={"pk": self.project.pk}),
            self.event_payload(
                title="Project Assigned Event",
                assigned_emails=[self.member_user.email],
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        event = CalendarEvent.objects.get(title="Project Assigned Event")
        self.assertIn(self.member_user, event.assigned_to.all())


class PersonalTaskAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="personal@example.com",
            email="personal@example.com",
            password="Password123",
        )
        self.other_user = User.objects.create_user(
            username="other-personal@example.com",
            email="other-personal@example.com",
            password="Password123",
        )

    def test_authenticated_user_can_create_personal_task(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("task_list"),
            {"title": "Buy groceries", "assigned_emails": [self.user.email]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(title="Buy groceries")
        self.assertIsNone(task.division_id)
        self.assertIsNone(task.project_id)
        self.assertEqual(task.created_by, self.user)
        self.assertIn(self.user, task.assigned_to.all())

    def test_personal_task_visible_to_creator(self):
        task = Task.objects.create(
            title="Personal task",
            created_by=self.user,
        )
        task.assigned_to.add(self.user)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("task_detail", kwargs={"pk": task.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_personal_task_visible_in_list_to_creator(self):
        task = Task.objects.create(
            title="Personal task",
            created_by=self.user,
        )
        task.assigned_to.add(self.user)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("task_list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_personal_task_not_visible_to_other_users(self):
        task = Task.objects.create(
            title="Private personal task",
            created_by=self.user,
        )
        task.assigned_to.add(self.user)

        self.client.force_authenticate(self.other_user)
        response = self.client.get(reverse("task_detail", kwargs={"pk": task.pk}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_personal_task_not_in_list_for_other_users(self):
        task = Task.objects.create(
            title="Private personal task",
            created_by=self.user,
        )
        task.assigned_to.add(self.user)

        self.client.force_authenticate(self.other_user)
        response = self.client.get(reverse("task_list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_personal_task_visible_to_assignee(self):
        task = Task.objects.create(
            title="Assigned personal task",
            created_by=self.user,
        )
        task.assigned_to.add(self.other_user)

        self.client.force_authenticate(self.other_user)
        response = self.client.get(reverse("task_detail", kwargs={"pk": task.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_only_creator_can_delete_personal_task(self):
        task = Task.objects.create(
            title="Deletable task",
            created_by=self.user,
        )
        task.assigned_to.add(self.other_user)

        self.client.force_authenticate(self.other_user)
        response = self.client.delete(reverse("task_detail", kwargs={"pk": task.pk}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.user)
        response = self.client.delete(reverse("task_detail", kwargs={"pk": task.pk}))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_assigned_user_can_update_status_of_personal_task(self):
        task = Task.objects.create(
            title="Update status task",
            created_by=self.user,
        )
        task.assigned_to.add(self.other_user)

        self.client.force_authenticate(self.other_user)
        response = self.client.patch(
            reverse("task_detail", kwargs={"pk": task.pk}),
            {"status": "InProgress"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.IN_PROGRESS)

    def test_assigned_user_cannot_update_title_of_personal_task(self):
        task = Task.objects.create(
            title="Original title",
            created_by=self.user,
        )
        task.assigned_to.add(self.other_user)

        self.client.force_authenticate(self.other_user)
        response = self.client.patch(
            reverse("task_detail", kwargs={"pk": task.pk}),
            {"title": "Changed title"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_creator_can_update_title_of_personal_task(self):
        task = Task.objects.create(
            title="Original title",
            created_by=self.user,
        )
        task.assigned_to.add(self.user)

        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("task_detail", kwargs={"pk": task.pk}),
            {"title": "Changed title"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.title, "Changed title")

    def test_cannot_create_task_with_both_division_and_project(self):
        org = Organization.objects.create(name="Test Org", created_by=self.user)
        division = Division.objects.create(organization=org, name="Div")
        project = Project.objects.create(division=division, name="Proj")

        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("task_list"),
            {
                "title": "Invalid task",
                "division": division.pk,
                "project": project.pk,
                "assigned_emails": [self.user.email],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_scope_organization_returns_none_for_personal_task(self):
        task = Task.objects.create(
            title="No scope",
            created_by=self.user,
        )
        task.assigned_to.add(self.user)
        self.assertIsNone(task.scope_organization)

    def test_scope_division_returns_none_for_personal_task(self):
        task = Task.objects.create(
            title="No scope",
            created_by=self.user,
        )
        task.assigned_to.add(self.user)
        self.assertIsNone(task.scope_division)


class ChangePasswordAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="changepw@example.com",
            email="changepw@example.com",
            password="OldPassword123",
        )

    def test_change_password_success(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": "OldPassword123",
                "new_password": "NewPassword456",
                "confirm_password": "NewPassword456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword456"))

    def test_change_password_wrong_old_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": "WrongPassword",
                "new_password": "NewPassword456",
                "confirm_password": "NewPassword456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPassword123"))

    def test_change_password_mismatch_confirmation(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": "OldPassword123",
                "new_password": "NewPassword456",
                "confirm_password": "DifferentPassword",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPassword123"))

    def test_change_password_too_short(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": "OldPassword123",
                "new_password": "Short1",
                "confirm_password": "Short1",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPassword123"))

    def test_change_password_requires_authentication(self):
        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": "OldPassword123",
                "new_password": "NewPassword456",
                "confirm_password": "NewPassword456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
