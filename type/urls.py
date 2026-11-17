
from django.urls import path
from django.contrib.auth import views as auth_views
from . import views


urlpatterns = [

    # Main Pages
    path('', views.home, name='home'),

    # Authentication
    path('signup/', views.signup, name='signup'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),

    # User Profile
    path('profile/', views.user_profile, name='profile'),
    path('profile/edit/', views.edit_profile, name='edit_profile'),

    # Password Reset
    path(
        'password-reset/',
        auth_views.PasswordResetView.as_view(
            template_name='authentication/password_reset.html'
        ),
        name='password_reset'
    ),

    path(
        'password-reset/done/',
        auth_views.PasswordResetDoneView.as_view(
            template_name='authentication/password_reset_done.html'
        ),
        name='password_reset_done'
    ),

    path(
        'reset/<uidb64>/<token>/',
        auth_views.PasswordResetConfirmView.as_view(
            template_name='authentication/password_reset_confirm.html'
        ),
        name='password_reset_confirm'
    ),

    path(
        'reset/done/',
        auth_views.PasswordResetCompleteView.as_view(
            template_name='authentication/password_reset_complete.html'
        ),
        name='password_reset_complete'
    ),

    # Change Password
    path(
        'password-change/',
        auth_views.PasswordChangeView.as_view(
            template_name='authentication/password_change.html',
            success_url='/password-change/done/'
        ),
        name='password_change'
    ),

    path(
        'password-change/done/',
        auth_views.PasswordChangeDoneView.as_view(
            template_name='authentication/password_change_done.html'
        ),
        name='password_change_done'
    ),

    # Typing API
    path(
        'api/generate/',
        views.generate_passage,
        name='generate_passage'
    ),

    path(
    'api/save-result/',
    views.save_test_result,
    name='save_test_result'
    ),

]
