from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from type.models import SpaceShooterResult


class SpaceShooterDashboardTests(TestCase):
    def test_dashboard_summarizes_authenticated_player_results(self):
        user = User.objects.create_user(
            username="space-shooter-player",
            password="a-long-test-password-2026",
        )
        self.client.force_login(user)
        SpaceShooterResult.objects.create(
            user=user,
            difficulty="normal",
            score=22570,
            wpm=80,
            accuracy=97.5,
            words_destroyed=12,
            shots_fired=15,
            highest_wave=3,
            duration=45,
        )

        response = self.client.get(reverse("space_shooter"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["stats"]["total_games"], 1)
        self.assertEqual(response.context["stats"]["best_score"], 22570)
        self.assertEqual(response.context["stats"]["average_wpm"], 80)
        self.assertEqual(response.context["stats"]["average_accuracy"], 97.5)
