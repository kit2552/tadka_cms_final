"""
AWS S3 Service for Image/File Upload
Handles all S3 operations based on stored configuration
"""
import boto3
from botocore.exceptions import ClientError
from typing import Optional
import os
from pathlib import Path
import mimetypes

class S3Service:
    def __init__(self):
        self.s3_client = None
        self.config = None
    
    def initialize(self, config: dict):
        """Initialize S3 client with configuration"""
        self.config = config
        
        if not config or not config.get('is_enabled'):
            print("S3 initialization failed: Config not provided or not enabled")
            self.s3_client = None
            return False
        
        # Validate credentials
        access_key = config.get('aws_access_key_id')
        secret_key = config.get('aws_secret_access_key')
        
        if not access_key or not secret_key:
            print(f"S3 initialization failed: Missing credentials (access_key: {bool(access_key)}, secret_key: {bool(secret_key)})")
            self.s3_client = None
            return False
        
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=config.get('aws_region', 'us-east-1')
            )
            print(f"✅ S3 client initialized successfully for region: {config.get('aws_region', 'us-east-1')}")
            return True
        except Exception as e:
            print(f"❌ Failed to initialize S3 client: {e}")
            self.s3_client = None
            return False
    
    def is_enabled(self) -> bool:
        """Check if S3 is enabled and configured"""
        return self.s3_client is not None and self.config and self.config.get('is_enabled')
    
    def upload_file(self, file_content: bytes, filename: str, content_type: str = None) -> Optional[str]:
        """
        Upload file to S3 and return the URL
        Returns None if S3 is not enabled or upload fails
        """
        if not self.is_enabled():
            return None
        
        try:
            bucket_name = self.config.get('s3_bucket_name')
            root_folder = self.config.get('root_folder_path', '').strip('/')
            
            # Construct S3 key (path)
            if root_folder:
                s3_key = f"{root_folder}/{filename}"
            else:
                s3_key = filename
            
            # Check file size limit
            max_size = self.config.get('max_file_size_mb', 10) * 1024 * 1024  # Convert to bytes
            if len(file_content) > max_size:
                raise ValueError(f"File size exceeds maximum allowed size of {self.config.get('max_file_size_mb')}MB")
            
            # Detect content type if not provided
            if not content_type:
                content_type, _ = mimetypes.guess_type(filename)
                content_type = content_type or 'application/octet-stream'
            
            # Upload to S3
            # Note: ACL is not used as most buckets have Block Public Access enabled
            # Public access should be configured at the bucket level
            self.s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type
            )
            
            # Construct and return URL
            region = self.config.get('aws_region', 'us-east-1')
            if region == 'us-east-1':
                url = f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"
            else:
                url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
            
            return url
            
        except Exception as e:
            import traceback
            print(f"S3 upload failed: {e}")
            print(f"Traceback: {traceback.format_exc()}")
            return None
    
    def delete_file(self, file_url: str) -> bool:
        """Delete file from S3 given its URL"""
        if not self.is_enabled():
            return False
        
        try:
            bucket_name = self.config.get('s3_bucket_name')
            
            # Extract S3 key from URL
            if bucket_name in file_url:
                s3_key = file_url.split(f"{bucket_name}.s3")[1].split('/', 2)[-1]
                
                self.s3_client.delete_object(
                    Bucket=bucket_name,
                    Key=s3_key
                )
                return True
        except Exception as e:
            print(f"S3 delete failed: {e}")
        
        return False
    
    def test_connection(self) -> tuple[bool, str]:
        """Test S3 connection and permissions"""
        if not self.s3_client:
            return False, "S3 client not initialized"
        
        try:
            bucket_name = self.config.get('s3_bucket_name')
            
            # Try to list objects (just check access)
            self.s3_client.head_bucket(Bucket=bucket_name)
            
            return True, "Connection successful"
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                return False, "Bucket not found"
            elif error_code == '403':
                return False, "Access denied - check credentials"
            else:
                return False, f"Connection failed: {error_code}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"

# Global S3 service instance
s3_service = S3Service()
