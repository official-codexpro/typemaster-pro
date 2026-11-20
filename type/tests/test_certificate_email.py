import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse

from type.models import TestResult


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class CertificateEmailTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="typing-champion",
            email="champion@example.test",
            password="a-long-test-password-2026",
        )
        self.client.force_login(self.user)
        self.url = reverse("save_test_result")

    def save_result(self, *, wpm, accuracy, difficulty="normal"):
        payload = {
            "wpm": wpm,
            "accuracy": accuracy,
            "correct_characters": round(wpm * 5),
            "mistakes": round(round(wpm * 5) * (100 - accuracy) / accuracy),
            "duration": 60,
            "difficulty": difficulty,
        }
        if difficulty == "code":
            payload["language"] = "python"
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url,
                data=json.dumps(payload),
                content_type="application/json",
            )
        return response

    def test_gold_certificate_is_emailed_to_registered_address(self):
        response = self.save_result(wpm=70, accuracy=98)

        self.assertEqual(response.status_code, 200)
        result = TestResult.objects.get(user=self.user)
        self.assertEqual(result.certificate, "gold")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertIn("Gold", mail.outbox[0].subject)
        self.assertIn("TM-", mail.outbox[0].body)
        self.assertEqual(len(mail.outbox[0].alternatives), 1)
        self.assertIn("View or print certificate", mail.outbox[0].alternatives[0][0])

    def test_silver_certificate_is_emailed(self):
        response = self.save_result(wpm=50, accuracy=95)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(TestResult.objects.get(user=self.user).certificate, "silver")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Silver", mail.outbox[0].subject)

    def test_bronze_and_code_results_do_not_send_silver_or_gold_email(self):
        bronze_response = self.save_result(wpm=35, accuracy=90)
        code_response = self.save_result(wpm=100, accuracy=100, difficulty="code")

        self.assertEqual(bronze_response.status_code, 200)
        self.assertEqual(code_response.status_code, 200)
        self.assertEqual(
            list(
                TestResult.objects.order_by("id").values_list("certificate", flat=True)
            ),
            ["bronze", "none"],
        )
        self.assertEqual(mail.outbox, [])

    def test_invalid_result_does_not_create_certificate_or_send_email(self):
        response = self.client.post(
            self.url,
            data=json.dumps(
                {"correct_characters": 10_000, "mistakes": 0, "duration": 60}
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(TestResult.objects.exists())
        self.assertEqual(mail.outbox, [])

    def test_email_provider_failure_does_not_lose_the_earned_result(self):
        with patch(
            "type.emails.EmailMultiAlternatives.send",
            side_effect=OSError("SMTP unavailable"),
        ):
            with self.assertLogs("type.emails", level="ERROR"):
                response = self.save_result(wpm=70, accuracy=98)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(TestResult.objects.get(user=self.user).certificate, "gold")

    def test_browser_claims_cannot_award_a_certificate_without_character_counts(self):
        response = self.client.post(
            self.url,
            data=json.dumps(
                {
                    "wpm": 999,
                    "accuracy": 100,
                    "correct_characters": 5,
                    "mistakes": 0,
                    "duration": 60,
                    "difficulty": "normal",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        result = TestResult.objects.get(user=self.user)
        self.assertEqual(result.wpm, 1)
        self.assertEqual(result.certificate, "none")
        self.assertEqual(mail.outbox, [])
