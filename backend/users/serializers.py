from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        help_text="Enter the same password as above"
    )

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'password2', 
                  'first_name', 'last_name', 'phone_number')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'phone_number': {'required': False},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user details"""
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 
                  'phone_number', 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('id', 'is_active', 'created_at', 'updated_at')


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        import logging
        logger = logging.getLogger(__name__)
        
        email = attrs.get('email')
        password = attrs.get('password')

        if not email or not password:
            raise serializers.ValidationError(
                'Must include "email" and "password".'
            )

        # Try to get the user first to check if they exist
        try:
            user_obj = User.objects.get(email=email)
            logger.info(f"User found: {user_obj.email}, is_active: {user_obj.is_active}")
            logger.info(f"User username field: {user_obj.USERNAME_FIELD}")
        except User.DoesNotExist:
            logger.warning(f"User with email {email} does not exist")
            raise serializers.ValidationError(
                'Unable to log in with provided credentials.'
            )

        # Authenticate using email as username (since USERNAME_FIELD = 'email')
        # Django's authenticate() uses the USERNAME_FIELD, so username=email should work
        user = authenticate(request=self.context.get('request'),
                          username=email, password=password)
        
        if not user:
            logger.warning(f"Authentication failed for email: {email}")
            logger.warning(f"Trying manual password check...")
            # Manual password check for debugging
            if user_obj.check_password(password):
                logger.info("Manual password check PASSED - but authenticate() failed")
                logger.info("This suggests an authentication backend issue")
            else:
                logger.warning("Manual password check FAILED - password is incorrect")
            raise serializers.ValidationError(
                'Unable to log in with provided credentials.'
            )
        
        if not user.is_active:
            logger.warning(f"User {email} is not active")
            raise serializers.ValidationError(
                'User account is disabled.'
            )
        
        logger.info(f"Authentication successful for user: {user.email}")
        attrs['user'] = user
        return attrs
