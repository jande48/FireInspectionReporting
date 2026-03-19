from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()

try:
    from projects.s3_utils import generate_presigned_upload_url
except ImportError:
    generate_presigned_upload_url = None


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """
    Register a new user.
    
    POST /api/auth/register/
    Body: {
        "email": "user@example.com",
        "username": "username",
        "password": "password123",
        "password2": "password123",
        "first_name": "First",
        "last_name": "Last",
        "phone_number": "+1234567890"  # optional
    }
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Register request received from {request.META.get('REMOTE_ADDR')}")
    logger.info(f"Request headers: {dict(request.headers)}")
    logger.info(f"Request data: {request.data}")
    
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'success': True,
            'message': 'User registered successfully',
            'data': {
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'success': False,
        'message': 'Registration failed',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login user and return JWT tokens.
    
    POST /api/auth/login/
    Body: {
        "email": "user@example.com",
        "password": "password123"
    }
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Login request received from {request.META.get('REMOTE_ADDR')}")
    logger.info(f"Request headers: {dict(request.headers)}")
    logger.info(f"Request data: {dict(request.data)}")
    
    serializer = LoginSerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'success': True,
            'message': 'Login successful',
            'data': {
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }
        }, status=status.HTTP_200_OK)
    
    # Log the serializer errors for debugging
    logger.error(f"Login serializer errors: {serializer.errors}")
    logger.error(f"Email provided: {request.data.get('email')}")
    logger.error(f"Password provided: {'***' if request.data.get('password') else 'None'}")
    
    return Response({
        'success': False,
        'message': 'Login failed',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout user by blacklisting refresh token.
    
    POST /api/auth/logout/
    Headers: Authorization: Bearer <access_token>
    Body: {
        "refresh": "refresh_token_string"
    }
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({
                'success': True,
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'message': 'Refresh token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Invalid token',
            'errors': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile_view(request):
    """
    Get current user profile.
    
    GET /api/auth/profile/
    Headers: Authorization: Bearer <access_token>
    Returns: { success, data: { user: <user with avatar_url presigned> } }
    """
    serializer = UserSerializer(request.user)
    return Response({
        'success': True,
        'data': {'user': serializer.data},
    }, status=status.HTTP_200_OK)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_profile_view(request):
    """
    Update current user profile.
    
    PUT/PATCH /api/auth/profile/update/
    Headers: Authorization: Bearer <access_token>
    Body: {
        "first_name": "Updated",
        "last_name": "Name",
        "phone_number": "+1234567890",
        "profile_photo_key": "uploads/user_1/avatar/uuid.jpg"  # after uploading to S3
    }
    """
    serializer = UserSerializer(
        request.user,
        data=request.data,
        partial=True,
    )
    if serializer.is_valid():
        serializer.save()
        return Response({
            'success': True,
            'message': 'Profile updated successfully',
            'data': {'user': serializer.data},
        }, status=status.HTTP_200_OK)
    return Response({
        'success': False,
        'message': 'Update failed',
        'errors': serializer.errors,
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    Change password for the current user.
    
    POST /api/auth/change-password/
    Headers: Authorization: Bearer <access_token>
    Body: {
        "current_password": "old",
        "new_password": "newsecure",
        "new_password2": "newsecure"
    }
    """
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)
    user = request.user
    if not user.check_password(serializer.validated_data['current_password']):
        return Response({
            'success': False,
            'message': 'Current password is incorrect',
            'errors': {'current_password': ['Current password is incorrect.']},
        }, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(serializer.validated_data['new_password'])
    user.save()
    return Response({
        'success': True,
        'message': 'Password changed successfully',
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def profile_avatar_upload_url_view(request):
    """
    Get a presigned URL to upload a profile avatar. Client uploads with PUT, then PATCH profile with profile_photo_key.
    
    POST /api/auth/profile/avatar/upload-url/
    Headers: Authorization: Bearer <access_token>
    Body: { "filename": "photo.jpg", "content_type": "image/jpeg" }
    Returns: { success, data: { upload_url, file_key } }
    """
    if not generate_presigned_upload_url:
        return Response({
            'success': False,
            'message': 'Avatar upload not configured',
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    filename = request.data.get('filename') or 'avatar.jpg'
    content_type = (request.data.get('content_type') or 'image/jpeg').strip()
    if not content_type.startswith('image/'):
        content_type = 'image/jpeg'
    try:
        result = generate_presigned_upload_url(
            user_id=request.user.id,
            field_name='avatar',
            filename=filename,
            content_type=content_type,
        )
        return Response({
            'success': True,
            'data': result,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e),
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
