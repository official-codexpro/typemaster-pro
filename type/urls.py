
from django.urls import path
from django.contrib.auth import views as auth_views
from . import views


urlpatterns = [

    # Main Pages
    path('', views.home, name='home'),
    path('results/', views.results, name='results'),

    # Authentication
    path('signup/', views.signup, name='signup'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),

    # User Profile
    path('profile/', views.user_profile, name='profile'),
    path('profile/edit/', views.edit_profile, name='edit_profile'),
    # Space Shooter
    path('space-shooter/',views.space_shooter,name='space_shooter'),
    path('space-shooter/play/',views.space_shooter_game,name='space_shooter_game'),
    path('space-shooter/result/<int:result_id>/',views.space_shooter_result,name='space_shooter_result'),
    path('space-shooter/save/',views.save_space_shooter_result,name='save_space_shooter_result'),

    # Car Racing
    path('car-racing/', views.car_racing, name='car_racing'),
    path('car-racing/play/', views.car_racing_game, name='car_racing_game'),
    path('car-racing/result/<int:result_id>/', views.car_racing_result, name='car_racing_result'),
    path('car-racing/save/', views.save_car_racing_result, name='save_car_racing_result'),

    # Type Fighter
    path('type-fighter/', views.type_fighter, name='type_fighter'),
    path('type-fighter/play/', views.type_fighter_game, name='type_fighter_game'),
    path('type-fighter/result/<int:result_id>/', views.type_fighter_result, name='type_fighter_result'),
    path('type-fighter/save/', views.save_type_fighter_result, name='save_type_fighter_result'),

    path('certifications/',views.certifications,name='certifications'),


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
