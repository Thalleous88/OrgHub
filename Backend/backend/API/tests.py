from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


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
