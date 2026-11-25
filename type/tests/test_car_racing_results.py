import json

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from type.models import CarRacingResult


class CarRacingFinishResultTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="finish-line-player",
            password="a-long-test-password-2026",
        )
        self.client.force_login(self.user)

    def test_finish_line_metadata_is_saved_and_shown_on_the_result_page(self):
        payload = {
            "difficulty": "normal",
            "mode": "paragraph",
            "finish_position": 2,
            "score": 900,
            "wpm": 52,
            "accuracy": 96.5,
            "words_typed": 62,
            "finish_words_typed": 40,
            "finish_time": 38,
            "distance": 900,
            "mistakes": 2,
            "duration": 60,
        }
        response = self.client.post(
            reverse("save_car_racing_result"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        result = CarRacingResult.objects.get(user=self.user)
        self.assertEqual(result.finish_words_typed, 40)
        self.assertEqual(result.finish_time, 38)

        result_response = self.client.get(
            reverse("car_racing_result", args=[result.pk])
        )
        self.assertEqual(result_response.status_code, 200)
        self.assertContains(result_response, "PLACE #2")
        self.assertContains(result_response, "Words at Finish")
        self.assertContains(result_response, "38")
        self.assertContains(result_response, "62")

    def test_finish_metadata_defaults_when_the_finish_line_was_not_reached(self):
        response = self.client.post(
            reverse("save_car_racing_result"),
            data=json.dumps(
                {
                    "difficulty": "easy",
                    "mode": "paragraph",
                    "words_typed": 14,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        result = CarRacingResult.objects.get(user=self.user)
        self.assertEqual(result.finish_words_typed, 0)
        self.assertEqual(result.finish_time, 0)
