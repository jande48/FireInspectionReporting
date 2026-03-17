"""
S3 utility functions for file uploads using Linode Object Storage.
"""
import boto3
from botocore.config import Config
from django.conf import settings
import uuid
from pathlib import Path


def get_s3_client():
    """Get configured S3 client for Linode Object Storage."""
    config = Config(
        signature_version='s3v4',
        s3={
            # botocore supports: 'auto', 'virtual', 'path'
            'addressing_style': 'virtual'
        }
    )
    
    return boto3.client(
        's3',
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
        config=config
    )


def generate_presigned_upload_url(user_id, field_name, filename, content_type='image/jpeg', expiration=3600):
    """
    Generate a presigned PUT URL for uploading a file to S3.
    PUT is used instead of POST so the client can upload with a simple PUT body (no multipart).
    
    Args:
        user_id: The ID of the user uploading the file
        field_name: The name of the field this file belongs to
        filename: Original filename
        content_type: MIME type (e.g. image/jpeg, image/png)
        expiration: URL expiration time in seconds (default: 1 hour)
    
    Returns:
        dict with 'upload_url' and 'file_key' (S3 object key)
    """
    s3_client = get_s3_client()
    
    # Generate unique file key: uploads/user_{user_id}/{field_name}/{uuid}{suffix}
    file_extension = Path(filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_key = f"uploads/user_{user_id}/{field_name}/{unique_filename}"
    
    # Restrict to image types
    if not (content_type and content_type.startswith('image/')):
        content_type = 'image/jpeg'
    
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                'Key': file_key,
                'ContentType': content_type,
            },
            ExpiresIn=expiration
        )
        return {
            'upload_url': presigned_url,
            'file_key': file_key,
        }
    except Exception as e:
        raise Exception(f"Failed to generate presigned URL: {str(e)}")


def generate_presigned_download_url(file_key, expiration=3600):
    """
    Generate a presigned URL for downloading/viewing a file from S3.
    
    Args:
        file_key: S3 object key
        expiration: URL expiration time in seconds (default: 1 hour)
    
    Returns:
        Presigned URL string
    """
    s3_client = get_s3_client()
    
    try:
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                'Key': file_key
            },
            ExpiresIn=expiration
        )
        return presigned_url
    except Exception as e:
        raise Exception(f"Failed to generate download URL: {str(e)}")
