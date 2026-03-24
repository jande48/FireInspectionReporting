from django.urls import path
from .views import (
    template_list_create_view,
    template_detail_view,
    project_list_create_view,
    project_detail_view,
    report_list_create_view,
    report_detail_view,
    generate_upload_url_view,
    generate_download_url_view,
    export_reports_view,
)

app_name = 'projects'

urlpatterns = [
    path('templates/', template_list_create_view, name='template-list-create'),
    path('templates/<int:pk>/', template_detail_view, name='template-detail'),
    path('projects/', project_list_create_view, name='project-list-create'),
    path('projects/<int:pk>/', project_detail_view, name='project-detail'),
    path('reports/', report_list_create_view, name='report-list-create'),
    path('reports/export/', export_reports_view, name='reports-export'),
    path('reports/<int:pk>/', report_detail_view, name='report-detail'),
    path('upload-url/', generate_upload_url_view, name='generate-upload-url'),
    path('download-url/', generate_download_url_view, name='generate-download-url'),
]
