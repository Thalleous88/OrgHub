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
            assigned_to=self.member_user,
        )
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
            assigned_to=self.member_user,
        )
        CalendarEvent.objects.create(
            organization=self.organization,
            created_by=self.core_user,
            title="Later Meeting",
            starts_at=timezone.now() + timedelta(days=3),
        )

        call_command("generate_reminders", stdout=StringIO())

        self.assertFalse(Notification.objects.exists())

    def test_user_can_list_and_mark_own_notifications_read(self):
        notification = Notification.objects.create(
            recipient=self.member_user,
            notification_type=Notification.NotificationType.TASK_REMINDER,
            task=Task.objects.create(
                project=self.project,
                title="Read notification task",
                due_at=timezone.now() + timedelta(hours=2),
                created_by=self.core_user,
                assigned_to=self.member_user,
            ),
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


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
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
            assigned_to=self.member_user,
        )
        created_task = Task.objects.create(
            project=self.project,
            title="Review onboarding notes",
            created_by=self.member_user,
            assigned_to=self.member_user,
        )
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
        Task.objects.create(
            division=self.division,
            title="Division plan",
            created_by=self.core_user,
            assigned_to=self.division_head_user,
        )
        Task.objects.create(
            project=self.project,
            title="Project roadmap",
            created_by=self.division_head_user,
            assigned_to=self.project_lead_user,
        )
        Task.objects.create(
            project=self.project,
            title="Completed work",
            status=Task.Status.DONE,
            created_by=self.project_lead_user,
            assigned_to=self.member_user,
        )

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
                "assigned_to": self.division_head_user.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(title="Prepare division plan")
        self.assertEqual(task.status, Task.Status.TODO)
        self.assertEqual(task.assigned_to, self.division_head_user)

    def test_core_board_cannot_assign_directly_to_project_member(self):
        self.client.force_authenticate(self.core_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "project": self.project.pk,
                "title": "Skip hierarchy",
                "assigned_to": self.member_user.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_division_head_can_assign_task_to_project_lead(self):
        self.client.force_authenticate(self.division_head_user)

        response = self.client.post(
            reverse("task_list"),
            {
                "project": self.project.pk,
                "title": "Build project roadmap",
                "assigned_to": self.project_lead_user.pk,
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
                "assigned_to": self.member_user.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_assigned_user_can_update_only_task_status(self):
        task = Task.objects.create(
            project=self.project,
            title="Finish slides",
            created_by=self.project_lead_user,
            assigned_to=self.member_user,
        )
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
            assigned_to=self.member_user,
        )

        self.client.force_authenticate(self.other_member_user)
        response = self.client.get(reverse("task_detail", kwargs={"pk": task.pk}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
