from urllib.parse import parse_qs, urlsplit

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse


class AuthenticationTemplateTests(TestCase):
    def test_public_authentication_pages_render(self):
        for route_name in ("login", "signup", "password_reset"):
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)

    def test_car_racing_login_redirect_uses_project_login_and_keeps_game_options(self):
        game_url = (
            f"{reverse('car_racing_game')}?"
            "difficulty=normal&mode=paragraph&language=python"
        )

        response = self.client.get(game_url)

        self.assertEqual(response.status_code, 302)
        location = urlsplit(response["Location"])
        self.assertEqual(location.path, reverse("login"))
        self.assertEqual(parse_qs(location.query)["next"], [game_url])

    def test_login_returns_user_to_safe_next_url(self):
        user = User.objects.create_user(
            username="car-racing-player",
            password="a-long-test-password-2026",
        )
        game_url = (
            f"{reverse('car_racing_game')}?"
            "difficulty=normal&mode=paragraph&language=python"
        )

        response = self.client.get(reverse("login"), {"next": game_url})
        self.assertEqual(response.context["next"], game_url)

        response = self.client.post(
            reverse("login"),
            {
                "username": user.username,
                "password": "a-long-test-password-2026",
                "next": game_url,
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], game_url)

        response = self.client.get(game_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["difficulty"], "normal")
        self.assertEqual(response.context["mode"], "paragraph")
        self.assertEqual(response.context["language"], "python")

    def test_login_ignores_external_next_url(self):
        user = User.objects.create_user(
            username="safe-redirect-player",
            password="a-long-test-password-2026",
        )

        response = self.client.post(
            reverse("login"),
            {
                "username": user.username,
                "password": "a-long-test-password-2026",
                "next": "https://example.com/",
            },
        )

        self.assertRedirects(response, reverse("home"))

    def test_password_change_pages_render_for_signed_in_user(self):
        user = User.objects.create_user(
            username="password-page-player",
            email="password-page@example.test",
            password="a-long-test-password-2026",
        )
        self.client.force_login(user)

        response = self.client.get(reverse("password_change"))

        self.assertEqual(response.status_code, 200)
