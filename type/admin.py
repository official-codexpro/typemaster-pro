
from django.contrib import admin
from .models import UserProfile, TestResult


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'updated_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(TestResult)
class TestResultAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'wpm',
        'accuracy',
        'mistakes',
        'duration',
        'difficulty',
        'created_at',
    )

    list_filter = ('difficulty', 'created_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
