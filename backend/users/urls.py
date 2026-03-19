from django.urls import path
from .views import (
    register_view,
    login_view,
    logout_view,
    user_profile_view,
    update_profile_view,
    change_password_view,
    profile_avatar_upload_url_view,
)

app_name = 'users'

urlpatterns = [
    path('register/', register_view, name='register'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('profile/', user_profile_view, name='profile'),
    path('profile/update/', update_profile_view, name='update-profile'),
    path('change-password/', change_password_view, name='change-password'),
    path('profile/avatar/upload-url/', profile_avatar_upload_url_view, name='profile-avatar-upload-url'),
]
