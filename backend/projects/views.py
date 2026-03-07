from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Template
from .serializers import TemplateSerializer


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

