from django.contrib.auth import get_user_model
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
)


User = get_user_model()


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
