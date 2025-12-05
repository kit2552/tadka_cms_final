"""
System Settings API Routes
Handles AWS configuration and user management
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional
from database import get_db
import crud
from s3_service import s3_service
import hashlib

router = APIRouter()

# ==================== AWS Configuration Models ====================

class AWSConfigUpdate(BaseModel):
    is_enabled: bool = False
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"
    s3_bucket_name: Optional[str] = None
    root_folder_path: str = ""
    max_file_size_mb: int = 10

# ==================== User Management Models ====================

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "editor"  # admin, editor, viewer
    is_active: bool = True

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

# ==================== AWS Configuration Endpoints ====================

@router.get("/system-settings/aws-config")
async def get_aws_configuration(db = Depends(get_db)):
    """Get AWS S3 configuration"""
    config = crud.get_aws_config(db)
    
    # Hide sensitive data
    if config:
        if config.get('aws_secret_access_key'):
            config['aws_secret_access_key'] = '****' + config['aws_secret_access_key'][-4:]
        if config.get('aws_access_key_id'):
            config['aws_access_key_id'] = config['aws_access_key_id'][:4] + '****' + config['aws_access_key_id'][-4:]
    
    return config or {
        "is_enabled": False,
        "aws_region": "us-east-1",
        "root_folder_path": "",
        "max_file_size_mb": 10
    }

@router.put("/system-settings/aws-config")
async def update_aws_configuration(config: AWSConfigUpdate, db = Depends(get_db)):
    """Update AWS S3 configuration"""
    
    # Don't allow empty credentials if enabling
    if config.is_enabled:
        if not config.aws_access_key_id or not config.aws_secret_access_key or not config.s3_bucket_name:
            raise HTTPException(
                status_code=400,
                detail="AWS credentials and bucket name are required when enabling S3"
            )
    
    # Update in database
    updated_config = crud.update_aws_config(db, config.dict())
    
    # Initialize S3 service with new config
    if config.is_enabled:
        s3_service.initialize(config.dict())
    
    # Return masked credentials
    if updated_config.get('aws_secret_access_key'):
        updated_config['aws_secret_access_key'] = '****' + updated_config['aws_secret_access_key'][-4:]
    if updated_config.get('aws_access_key_id'):
        updated_config['aws_access_key_id'] = updated_config['aws_access_key_id'][:4] + '****' + updated_config['aws_access_key_id'][-4:]
    
    return updated_config

@router.post("/system-settings/aws-config/test")
async def test_aws_connection(db = Depends(get_db)):
    """Test AWS S3 connection"""
    config = crud.get_aws_config(db)
    
    if not config or not config.get('is_enabled'):
        raise HTTPException(status_code=400, detail="AWS S3 is not configured")
    
    # Initialize S3 service
    s3_service.initialize(config)
    
    # Test connection
    success, message = s3_service.test_connection()
    
    return {
        "success": success,
        "message": message
    }

@router.post("/system-settings/upload-to-s3")
async def upload_file_to_s3(file: UploadFile = File(...), db = Depends(get_db)):
    """Upload a file to S3 (used for testing and manual uploads)"""
    config = crud.get_aws_config(db)
    
    if not config or not config.get('is_enabled'):
        raise HTTPException(status_code=400, detail="AWS S3 is not enabled")
    
    # Initialize S3 service
    s3_service.initialize(config)
    
    # Read file content
    file_content = await file.read()
    
    # Upload to S3
    url = s3_service.upload_file(file_content, file.filename, file.content_type)
    
    if not url:
        raise HTTPException(status_code=500, detail="Failed to upload to S3")
    
    return {
        "success": True,
        "url": url,
        "filename": file.filename
    }

# ==================== User Management Endpoints ====================

@router.get("/system-settings/users")
async def get_users_list(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    """Get list of users"""
    users = crud.get_users(db, skip=skip, limit=limit)
    total = crud.count_users(db)
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/system-settings/users/{user_id}")
async def get_user_detail(user_id: str, db = Depends(get_db)):
    """Get user details"""
    user = crud.get_user_by_id(db, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.post("/system-settings/users")
async def create_new_user(user: UserCreate, db = Depends(get_db)):
    """Create new user"""
    
    # Check if username already exists
    existing_user = crud.get_user_by_username(db, user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_password = hashlib.sha256(user.password.encode()).hexdigest()
    
    user_data = user.dict()
    user_data['password'] = hashed_password
    
    new_user = crud.create_user(db, user_data)
    
    return new_user

@router.put("/system-settings/users/{user_id}")
async def update_existing_user(user_id: str, user: UserUpdate, db = Depends(get_db)):
    """Update user"""
    
    # Check if user exists
    existing_user = crud.get_user_by_id(db, user_id)
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = user.dict(exclude_unset=True)
    
    # Hash password if provided
    if user_data.get('password'):
        user_data['password'] = hashlib.sha256(user_data['password'].encode()).hexdigest()
    
    updated_user = crud.update_user(db, user_id, user_data)
    
    return updated_user

@router.delete("/system-settings/users/{user_id}")
async def delete_existing_user(user_id: str, db = Depends(get_db)):
    """Delete user"""
    
    # Check if user exists
    existing_user = crud.get_user_by_id(db, user_id)
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting the last admin
    if existing_user.get('role') == 'admin':
        all_users = crud.get_users(db)
        admin_count = sum(1 for u in all_users if u.get('role') == 'admin')
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin user")
    
    success = crud.delete_user(db, user_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user")
    
    return {"message": "User deleted successfully"}
