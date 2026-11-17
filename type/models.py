
from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )

    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username


class TestResult(models.Model):

    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('normal', 'Normal'),
        ('hard', 'Hard'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='test_results'
    )

    wpm = models.PositiveIntegerField(default=0)
    accuracy = models.FloatField(default=0)

    correct_characters = models.PositiveIntegerField(default=0)
    mistakes = models.PositiveIntegerField(default=0)

    duration = models.PositiveIntegerField(
        help_text='Test duration in seconds'
    )

    difficulty = models.CharField(
        max_length=10,
        choices=DIFFICULTY_CHOICES,
        default='normal'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} - {self.wpm} WPM'
