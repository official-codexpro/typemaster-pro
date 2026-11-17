
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

    cover_image = models.ImageField(
        upload_to='profile_covers/',
        blank=True,
        null=True,
        help_text='Optional profile banner image.'
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
        ('code', 'Code'),
    ]

    LANGUAGE_CHOICES = [
        ('python', 'Python'),
        ('javascript', 'JavaScript'),
        ('typescript', 'TypeScript'),
        ('html', 'HTML'),
        ('css', 'CSS'),
        ('c', 'C'),
        ('cpp', 'C++'),
        ('java', 'Java'),
        ('csharp', 'C#'),
        ('php', 'PHP'),
        ('sql', 'SQL'),
        ('go', 'Go'),
        ('rust', 'Rust'),
        ('ruby', 'Ruby'),
        ('swift', 'Swift'),
        ('kotlin', 'Kotlin'),
        ('bash', 'Bash'),
        ('shell', 'Shell'),
        ('json', 'JSON'),
        ('xml', 'XML'),
        ('yaml', 'YAML'),
        ('dart', 'Dart'),
        ('r', 'R'),
        ('lua', 'Lua'),
        ('perl', 'Perl'),
        ('scala', 'Scala'),
        ('powershell', 'PowerShell'),
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

    language = models.CharField(
        max_length=30,
        choices=LANGUAGE_CHOICES,
        blank=True,
        default=''
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        if self.difficulty == 'code':
            return (
                f'{self.user.username} - '
                f'{self.language} - {self.wpm} WPM'
            )

        return f'{self.user.username} - {self.wpm} WPM'
