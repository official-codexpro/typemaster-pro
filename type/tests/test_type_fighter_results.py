import json
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from type.models import TypeFighterResult


class TypeFighterResultTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="arena-player",
            email="arena@example.test",
            password="a-long-test-password-2026",
        )
        self.client.force_login(self.user)
        self.url = reverse("save_type_fighter_result")
        self.match_id = str(uuid.uuid4())

    def payload(self, **overrides):
        payload = {
            "client_match_id": self.match_id,
            "difficulty": "normal",
            "result": "win",
            "score": 1800,
            "wpm": 72,
            "accuracy": 97.5,
            "words_typed": 24,
            "mistakes": 3,
            "wins": 1,
            "losses": 0,
            "knockouts": 3,
            "damage_dealt": 214,
            "best_combo": 7,
            "perfect_inputs": 19,
            "duration": 58,
        }
        payload.update(overrides)
        return payload

    def post_payload(self, payload):
        return self.client.post(
            self.url,
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_type_fighter_game_page_renders(self):
        response = self.client.get(reverse("type_fighter_game"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["difficulty"], "normal")
        self.assertEqual(response.context["mode"], "arcade")

    def test_match_result_is_saved(self):
        response = self.post_payload(self.payload())

        self.assertEqual(response.status_code, 200)
        result = TypeFighterResult.objects.get(user=self.user)
        self.assertEqual(result.client_match_id, uuid.UUID(self.match_id))
        self.assertEqual(result.wpm, 72)
        self.assertEqual(result.result, "win")
        self.assertEqual(result.damage_dealt, 214)
        self.assertEqual(result.best_combo, 7)
        self.assertEqual(result.perfect_inputs, 19)

    def test_custom_difficulty_and_extended_analytics_are_saved(self):
        response = self.post_payload(self.payload(
            difficulty="custom", highest_wpm=98, damage_received=35,
            attacks_successful=22, attacks_failed=4,
            mistake_words=["counterpunch", "whirlwind"],
        ))
        self.assertEqual(response.status_code, 200)
        result = TypeFighterResult.objects.get(user=self.user)
        self.assertEqual(result.difficulty, "custom")
        self.assertEqual(result.highest_wpm, 98)
        self.assertEqual(result.damage_received, 35)
        self.assertEqual(result.attacks_successful, 22)
        self.assertEqual(result.attacks_failed, 4)
        self.assertEqual(result.mistake_words, ["counterpunch", "whirlwind"])

    def test_training_session_saves_without_match_losses(self):
        response = self.post_payload(self.payload(
            mode="training", result="draw", wins=0, losses=0,
            knockouts=0, duration=60,
        ))
        self.assertEqual(response.status_code, 200)
        result = TypeFighterResult.objects.get(user=self.user)
        self.assertEqual(result.mode, "training")
        self.assertEqual(result.losses, 0)
        self.assertEqual(result.knockouts, 0)

    def test_retried_match_save_is_idempotent(self):
        first_response = self.post_payload(self.payload())
        retry_response = self.post_payload(self.payload(score=1))

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(retry_response.status_code, 200)
        self.assertEqual(
            first_response.json()["result_id"], retry_response.json()["result_id"]
        )
        self.assertFalse(first_response.json()["duplicate"])
        self.assertTrue(retry_response.json()["duplicate"])
        self.assertEqual(TypeFighterResult.objects.filter(user=self.user).count(), 1)

    def test_type_fighter_dashboard_aggregates_combat_records(self):
        self.post_payload(self.payload())

        response = self.client.get(reverse("type_fighter"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["stats"]["total_games"], 1)
        self.assertEqual(response.context["stats"]["wins"], 1)
        self.assertEqual(response.context["stats"]["total_damage"], 214)
        self.assertEqual(response.context["stats"]["best_combo"], 7)
        self.assertEqual(response.context["stats"]["perfect_inputs"], 19)

    def test_unreasonable_stats_and_malformed_match_ids_are_rejected(self):
        invalid_payloads = [
            self.payload(wpm=10_000),
            self.payload(duration=61),
            self.payload(accuracy=float("inf")),
            self.payload(knockouts=4),
            self.payload(best_combo=501),
            self.payload(damage_dealt=20_001),
            self.payload(client_match_id="not-a-uuid"),
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.post_payload(payload)
                self.assertEqual(response.status_code, 400)

        self.assertFalse(TypeFighterResult.objects.exists())

    def test_anonymous_match_save_is_rejected(self):
        self.client.logout()

        response = self.post_payload(self.payload())

        self.assertEqual(response.status_code, 401)
        self.assertFalse(TypeFighterResult.objects.exists())

    def test_best_of_three_win_and_match_counters_must_agree(self):
        invalid_payloads = [
            self.payload(knockouts=1, duration=45),
            self.payload(wins=0),
            self.payload(result="loss", wins=1, losses=0),
            self.payload(result="draw", wins=0, losses=0, knockouts=2),
            self.payload(duration=0),
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.post_payload(payload)
                self.assertEqual(response.status_code, 400)

        self.assertFalse(TypeFighterResult.objects.exists())

    def test_two_rounds_win_or_full_time_decision_can_be_saved(self):
        knockout_win = self.post_payload(self.payload(knockouts=2, duration=42))
        timeout_win = self.post_payload(
            self.payload(
                client_match_id=str(uuid.uuid4()),
                knockouts=1,
                duration=60,
            )
        )

        self.assertEqual(knockout_win.status_code, 200)
        self.assertEqual(timeout_win.status_code, 200)
        self.assertEqual(TypeFighterResult.objects.count(), 2)

    def test_result_page_shows_saved_match_metrics(self):
        result = TypeFighterResult.objects.create(
            user=self.user,
            difficulty="normal",
            result="win",
            score=1800,
            wpm=72,
            accuracy=97.5,
            words_typed=24,
            mistakes=3,
            wins=1,
            knockouts=3,
            damage_dealt=214,
            best_combo=7,
            perfect_inputs=19,
            duration=58,
        )

        response = self.client.get(reverse("type_fighter_result", args=[result.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "72")
        self.assertContains(response, "97.5%")
        self.assertContains(response, "24")
        self.assertContains(response, "58")
        self.assertContains(response, "214")
        self.assertContains(response, "7")
