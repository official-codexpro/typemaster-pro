from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")

    bio = models.TextField(blank=True)

    profile_picture = models.ImageField(
        upload_to="profile_pictures/", blank=True, null=True
    )

    cover_image = models.ImageField(
        upload_to="profile_covers/",
        blank=True,
        null=True,
        help_text="Optional profile banner image.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username


class TestResult(models.Model):

    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("normal", "Normal"),
        ("hard", "Hard"),
        ("code", "Code"),
    ]

    LANGUAGE_CHOICES = [
        ("python", "Python"),
        ("javascript", "JavaScript"),
        ("typescript", "TypeScript"),
        ("html", "HTML"),
        ("css", "CSS"),
        ("c", "C"),
        ("cpp", "C++"),
        ("java", "Java"),
        ("csharp", "C#"),
        ("php", "PHP"),
        ("sql", "SQL"),
        ("go", "Go"),
        ("rust", "Rust"),
        ("ruby", "Ruby"),
        ("swift", "Swift"),
        ("kotlin", "Kotlin"),
        ("bash", "Bash"),
        ("shell", "Shell"),
        ("json", "JSON"),
        ("xml", "XML"),
        ("yaml", "YAML"),
        ("dart", "Dart"),
        ("r", "R"),
        ("lua", "Lua"),
        ("perl", "Perl"),
        ("scala", "Scala"),
        ("powershell", "PowerShell"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="test_results"
    )

    wpm = models.PositiveIntegerField(default=0)
    accuracy = models.FloatField(default=0)

    correct_characters = models.PositiveIntegerField(default=0)
    mistakes = models.PositiveIntegerField(default=0)

    duration = models.PositiveIntegerField(help_text="Test duration in seconds")

    difficulty = models.CharField(
        max_length=10, choices=DIFFICULTY_CHOICES, default="normal"
    )

    language = models.CharField(
        max_length=30, choices=LANGUAGE_CHOICES, blank=True, default=""
    )

    CERTIFICATE_CHOICES = [
        ("none", "None"),
        ("bronze", "Bronze"),
        ("silver", "Silver"),
        ("gold", "Gold"),
    ]

    certificate = models.CharField(
        max_length=10, choices=CERTIFICATE_CHOICES, default="none"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        if self.difficulty == "code":
            return f"{self.user.username} - " f"{self.language} - {self.wpm} WPM"

        return f"{self.user.username} - {self.wpm} WPM"


class SpaceShooterResult(models.Model):

    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("normal", "Normal"),
        ("hard", "Hard"),
        ("extreme", "Extreme"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="space_shooter_results"
    )

    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES)

    score = models.PositiveIntegerField(default=0)
    wpm = models.PositiveIntegerField(default=0)
    accuracy = models.FloatField(default=0)

    words_destroyed = models.PositiveIntegerField(default=0)
    missed_words = models.PositiveIntegerField(default=0)
    mistakes = models.PositiveIntegerField(default=0)
    shots_fired = models.PositiveIntegerField(default=0)

    highest_wave = models.PositiveIntegerField(default=1)
    duration = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "difficulty"]),
        ]

    def __str__(self):
        return f"{self.user.username} - " f"{self.difficulty} - {self.score}"


class CarRacingResult(models.Model):

    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("normal", "Normal"),
        ("hard", "Hard"),
        ("extreme", "Extreme"),
    ]

    MODE_CHOICES = [
        ("paragraph", "Paragraph Race"),
        ("code", "Code Syntax Race"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="car_racing_results"
    )

    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES)

    mode = models.CharField(max_length=12, choices=MODE_CHOICES, default="paragraph")

    language = models.CharField(max_length=20, blank=True, default="")

    finish_position = models.PositiveSmallIntegerField(default=0)

    score = models.PositiveIntegerField(default=0)
    wpm = models.PositiveIntegerField(default=0)
    accuracy = models.FloatField(default=0)

    words_typed = models.PositiveIntegerField(default=0)
    distance = models.PositiveIntegerField(default=0)
    collisions = models.PositiveIntegerField(default=0)
    mistakes = models.PositiveIntegerField(default=0)

    duration = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "difficulty"]),
        ]

    def __str__(self):
        return f"{self.user.username} - " f"{self.difficulty} - {self.score}"


class TypeFighterResult(models.Model):

    MODE_CHOICES = [
        ("arcade", "Arena Duel"),
        ("training", "Training Room"),
    ]

    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("normal", "Normal"),
        ("hard", "Hard"),
        ("extreme", "Extreme"),
        ("custom", "Custom"),
    ]

    RESULT_CHOICES = [
        ("win", "Win"),
        ("loss", "Loss"),
        ("draw", "Draw"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="type_fighter_results"
    )

    mode = models.CharField(max_length=12, choices=MODE_CHOICES, default="arcade")

    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES)

    result = models.CharField(max_length=10, choices=RESULT_CHOICES, default="draw")

    client_match_id = models.UUIDField(null=True, blank=True)

    score = models.PositiveIntegerField(default=0)
    wpm = models.PositiveIntegerField(default=0)
    accuracy = models.FloatField(default=0)

    words_typed = models.PositiveIntegerField(default=0)
    mistakes = models.PositiveIntegerField(default=0)

    wins = models.PositiveIntegerField(default=0)
    losses = models.PositiveIntegerField(default=0)
    knockouts = models.PositiveIntegerField(default=0)
    damage_dealt = models.PositiveIntegerField(default=0)
    damage_received = models.PositiveIntegerField(default=0)
    attacks_successful = models.PositiveIntegerField(default=0)
    attacks_failed = models.PositiveIntegerField(default=0)
    highest_wpm = models.PositiveIntegerField(default=0)
    mistake_words = models.JSONField(default=list, blank=True)
    best_combo = models.PositiveIntegerField(default=0)
    perfect_inputs = models.PositiveIntegerField(default=0)

    duration = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "difficulty"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "client_match_id"],
                name="unique_type_fighter_client_match",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - " f"{self.difficulty} - {self.result}"
