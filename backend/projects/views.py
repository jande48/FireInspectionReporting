from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Template, Project, Report
from .serializers import TemplateSerializer, ProjectSerializer, ReportSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def template_list_create_view(request):
    """
    List all templates for the authenticated user or create a new template.
    
    GET /api/projects/templates/
    Returns: List of templates
    
    POST /api/projects/templates/
    Body: {
        "name": "Template Name",
        "description": "Description",
        "fields": [
            {"type": "text", "name": "Field Name"},
            {"type": "time", "name": "Time Field"},
            {"type": "choice", "name": "Choice Field", "choices": ["Option 1", "Option 2"]}
        ]
    }
    """
    if request.method == 'GET':
        templates = Template.objects.filter(user=request.user)
        serializer = TemplateSerializer(templates, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        serializer = TemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({
                'success': True,
                'message': 'Template created successfully',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'message': 'Template creation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def template_detail_view(request, pk):
    """
    Retrieve, update, or delete a template.
    
    GET /api/projects/templates/<id>/
    PUT/PATCH /api/projects/templates/<id>/
    DELETE /api/projects/templates/<id>/
    """
    try:
        template = Template.objects.get(pk=pk, user=request.user)
    except Template.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Template not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = TemplateSerializer(template)
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    elif request.method in ['PUT', 'PATCH']:
        serializer = TemplateSerializer(
            template,
            data=request.data,
            partial=(request.method == 'PATCH')
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Template updated successfully',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response({
            'success': False,
            'message': 'Template update failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        template.delete()
        return Response({
            'success': True,
            'message': 'Template deleted successfully'
        }, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def project_list_create_view(request):
    """
    List all projects for the authenticated user or create a new project.
    
    GET /api/projects/projects/
    Returns: List of projects
    
    POST /api/projects/projects/
    Body: {
        "name": "Project Name",
        "description": "Description",
        "template": <template_id>
    }
    """
    if request.method == 'GET':
        projects = Project.objects.filter(user=request.user).select_related('template')
        serializer = ProjectSerializer(projects, many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        serializer = ProjectSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # Validate that the template belongs to the user
            template_id = serializer.validated_data.get('template').id
            try:
                template = Template.objects.get(id=template_id, user=request.user)
            except Template.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Template not found or you do not have permission to use it',
                    'errors': {'template': ['Invalid template']}
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer.save(user=request.user, template=template)
            return Response({
                'success': True,
                'message': 'Project created successfully',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'message': 'Project creation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def project_detail_view(request, pk):
    """
    Retrieve, update, or delete a project.
    
    GET /api/projects/projects/<id>/
    PUT/PATCH /api/projects/projects/<id>/
    DELETE /api/projects/projects/<id>/
    """
    try:
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Project not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = ProjectSerializer(project, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    elif request.method in ['PUT', 'PATCH']:
        # If template is being updated, validate it belongs to the user
        if 'template' in request.data:
            template_id = request.data.get('template')
            try:
                template = Template.objects.get(id=template_id, user=request.user)
            except Template.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Template not found or you do not have permission to use it',
                    'errors': {'template': ['Invalid template']}
                }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ProjectSerializer(
            project,
            data=request.data,
            partial=(request.method == 'PATCH'),
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Project updated successfully',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response({
            'success': False,
            'message': 'Project update failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        project.delete()
        return Response({
            'success': True,
            'message': 'Project deleted successfully'
        }, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def report_list_create_view(request):
    """
    List all reports for the authenticated user or create a new report.
    
    GET /api/projects/reports/
    Query params: ?project=<project_id> (optional filter)
    Returns: List of reports
    
    POST /api/projects/reports/
    Body: {
        "project": <project_id>,
        "data": {
            "field_name_1": "value1",
            "field_name_2": "value2",
            ...
        }
    }
    """
    if request.method == 'GET':
        reports = Report.objects.filter(user=request.user).select_related('project', 'project__template')
        
        # Optional filter by project
        project_id = request.query_params.get('project')
        if project_id:
            try:
                reports = reports.filter(project_id=project_id, project__user=request.user)
            except ValueError:
                return Response({
                    'success': False,
                    'message': 'Invalid project ID'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ReportSerializer(reports, many=True, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        serializer = ReportSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # Validate that the project belongs to the user
            project_id = serializer.validated_data.get('project').id
            try:
                project = Project.objects.get(id=project_id, user=request.user)
            except Project.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Project not found or you do not have permission to use it',
                    'errors': {'project': ['Invalid project']}
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer.save(user=request.user, project=project)
            return Response({
                'success': True,
                'message': 'Report created successfully',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'message': 'Report creation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def report_detail_view(request, pk):
    """
    Retrieve, update, or delete a report.
    
    GET /api/projects/reports/<id>/
    PUT/PATCH /api/projects/reports/<id>/
    DELETE /api/projects/reports/<id>/
    """
    try:
        report = Report.objects.get(pk=pk, user=request.user)
    except Report.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Report not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = ReportSerializer(report, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    elif request.method in ['PUT', 'PATCH']:
        serializer = ReportSerializer(
            report,
            data=request.data,
            partial=(request.method == 'PATCH'),
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Report updated successfully',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response({
            'success': False,
            'message': 'Report update failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        report.delete()
        return Response({
            'success': True,
            'message': 'Report deleted successfully'
        }, status=status.HTTP_200_OK)

