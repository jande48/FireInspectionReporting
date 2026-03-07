from django.urls import path
from .views import template_list_create_view, template_detail_view

app_name = 'projects'

urlpatterns = [
    path('templates/', template_list_create_view, name='template-list-create'),
    path('templates/<int:pk>/', template_detail_view, name='template-detail'),
]
