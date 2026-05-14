import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Division,
    DivisionMembership,
    Organization,
    OrganizationMembership,
    Profile,
    Project,
    ProjectMembership,
    ResourceDocument,
)


User = get_user_model()
TEST_MEDIA_ROOT = tempfile.mkdtemp()


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
            {"token": invite_response.data["token"]},
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

    def test_project_invite_requires_existing_division_member(self):
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

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        DivisionMembership.objects.create(
            division=division,
            user=self.member_user,
            role=DivisionMembership.Role.MEMBER,
        )
        response = self.client.post(
            reverse("project_invite", kwargs={"pk": project.pk}),
            {"email": self.member_user.email, "role": "PROJECT_LEAD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
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
