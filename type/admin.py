from django.contrib import admin

from .models import SpaceShooterResult, TestResult, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "updated_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(TestResult)
class TestResultAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "wpm",
        "accuracy",
        "mistakes",
        "duration",
        "difficulty",
        "created_at",
    )

    list_filter = ("difficulty", "created_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


@admin.register(SpaceShooterResult)
class SpaceShooterResultAdmin(admin.ModelAdmin):

    list_display = (
        "user",
        "score",
        "difficulty",
        "wpm",
        "accuracy",
        "words_destroyed",
        "highest_wave",
        "created_at",
    )

    list_filter = ("difficulty", "created_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
