from django.urls import path
from .views import (
    template_list_create_view,
    template_detail_view,
    project_list_create_view,
    project_detail_view,
    report_list_create_view,
    report_detail_view,
)

app_name = 'projects'

urlpatterns = [
    path('templates/', template_list_create_view, name='template-list-create'),
    path('templates/<int:pk>/', template_detail_view, name='template-detail'),
    path('projects/', project_list_create_view, name='project-list-create'),
    path('projects/<int:pk>/', project_detail_view, name='project-detail'),
    path('reports/', report_list_create_view, name='report-list-create'),
    path('reports/<int:pk>/', report_detail_view, name='report-detail'),
]
