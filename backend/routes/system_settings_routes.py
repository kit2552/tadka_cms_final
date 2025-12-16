"""
System Settings API Routes
Handles AWS configuration, user management, and AI API keys
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from database import get_db
import crud
from s3_service import s3_service
import hashlib
import requests
import os

router = APIRouter()

# ==================== AWS Configuration Models ====================

class AWSConfigUpdate(BaseModel):
    is_enabled: bool = False
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"
    s3_bucket_name: Optional[str] = None
    root_folder_path: str = ""  # Legacy field, kept for backwards compatibility
    articles_root_folder: str = "articles"
    galleries_root_folder: str = "galleries"
    tadka_pics_root_folder: str = "tadka-pics"
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

# ==================== AI API Keys Models ====================

class AIAPIKeysConfig(BaseModel):
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    openai_default_model: Optional[str] = None
    gemini_default_model: Optional[str] = None
    anthropic_default_model: Optional[str] = None
    default_text_model: Optional[str] = None
    default_image_model: Optional[str] = None

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
    
    # Get existing config
    existing_config = crud.get_aws_config(db)
    
    # Merge with existing config (only update provided fields)
    update_data = config.dict(exclude_unset=True)
    
    # If enabling, check if we have credentials (either new or existing)
    if config.is_enabled:
        # Check access key
        if not config.aws_access_key_id and (not existing_config or not existing_config.get('aws_access_key_id')):
            raise HTTPException(status_code=400, detail="AWS Access Key ID is required when enabling S3")
        
        # Check secret key
        if not config.aws_secret_access_key and (not existing_config or not existing_config.get('aws_secret_access_key')):
            raise HTTPException(status_code=400, detail="AWS Secret Access Key is required when enabling S3")
        
        # Check bucket name
        if not config.s3_bucket_name:
            raise HTTPException(status_code=400, detail="S3 Bucket Name is required when enabling S3")
    
    # Update in database
    updated_config = crud.update_aws_config(db, update_data)
    
    # Initialize S3 service with full config (including existing keys if not updated)
    if updated_config.get('is_enabled'):
        s3_service.initialize(updated_config)
    
    # Return masked credentials
    if updated_config.get('aws_secret_access_key'):
        updated_config['aws_secret_access_key'] = '****' + updated_config['aws_secret_access_key'][-4:]
    if updated_config.get('aws_access_key_id'):
        updated_config['aws_access_key_id'] = updated_config['aws_access_key_id'][:4] + '****' + updated_config['aws_access_key_id'][-4:]
    
    return updated_config

@router.post("/system-settings/aws-config/test")
async def test_aws_connection(db = Depends(get_db)):
    """Test AWS S3 connection"""
    from datetime import datetime
    
    config = crud.get_aws_config(db)
    
    if not config or not config.get('is_enabled'):
        raise HTTPException(status_code=400, detail="AWS S3 is not configured or disabled")
    
    # Validate required fields
    if not config.get('aws_access_key_id'):
        raise HTTPException(status_code=400, detail="AWS Access Key ID is missing")
    
    if not config.get('aws_secret_access_key'):
        raise HTTPException(status_code=400, detail="AWS Secret Access Key is missing")
    
    if not config.get('s3_bucket_name'):
        raise HTTPException(status_code=400, detail="S3 Bucket Name is missing")
    
    # Initialize S3 service with full config
    initialized = s3_service.initialize(config)
    
    if not initialized:
        raise HTTPException(status_code=500, detail="Failed to initialize S3 client. Check your credentials.")
    
    # Test connection
    success, message = s3_service.test_connection()
    
    # Save connection test result
    test_result = {
        "last_test_status": "connected" if success else "disconnected",
        "last_test_message": message,
        "last_test_time": datetime.utcnow()
    }
    crud.update_aws_config(db, test_result)
    
    return {
        "success": success,
        "message": message,
        "tested_at": test_result["last_test_time"].isoformat()
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

# ==================== AI API Keys Endpoints ====================

@router.get("/system-settings/ai-api-keys")
async def get_ai_api_keys(unmask: bool = False, db = Depends(get_db)):
    """Get AI API keys configuration (masked by default, unmask with query param)"""
    config = crud.get_ai_api_keys(db)
    
    # Mask sensitive data unless unmask=true
    if config and not unmask:
        if config.get('openai_api_key'):
            config['openai_api_key'] = 'sk-****' + config['openai_api_key'][-4:]
        if config.get('gemini_api_key'):
            config['gemini_api_key'] = '****' + config['gemini_api_key'][-4:]
        if config.get('anthropic_api_key'):
            config['anthropic_api_key'] = 'sk-****' + config['anthropic_api_key'][-4:]
    
    return config or {
        "openai_api_key": None,
        "gemini_api_key": None,
        "anthropic_api_key": None,
        "openai_default_model": None,
        "gemini_default_model": None,
        "anthropic_default_model": None,
        "default_text_model": None,
        "default_image_model": None
    }

@router.put("/system-settings/ai-api-keys")
async def update_ai_api_keys(config: AIAPIKeysConfig, db = Depends(get_db)):
    """Update AI API keys configuration"""
    
    # Get existing config
    existing_config = crud.get_ai_api_keys(db)
    
    # Prepare update data
    update_data = config.dict(exclude_unset=True)
    
    # Don't update keys if they're masked (haven't been changed)
    if update_data.get('openai_api_key') and update_data['openai_api_key'].startswith('sk-****'):
        del update_data['openai_api_key']
    if update_data.get('gemini_api_key') and update_data['gemini_api_key'].startswith('****'):
        del update_data['gemini_api_key']
    if update_data.get('anthropic_api_key') and update_data['anthropic_api_key'].startswith('sk-****'):
        del update_data['anthropic_api_key']
    
    # Update in database
    updated_config = crud.update_ai_api_keys(db, update_data)
    
    # Return masked credentials
    if updated_config.get('openai_api_key'):
        updated_config['openai_api_key'] = 'sk-****' + updated_config['openai_api_key'][-4:]
    if updated_config.get('gemini_api_key'):
        updated_config['gemini_api_key'] = '****' + updated_config['gemini_api_key'][-4:]
    if updated_config.get('anthropic_api_key'):
        updated_config['anthropic_api_key'] = 'sk-****' + updated_config['anthropic_api_key'][-4:]
    
    return updated_config

@router.get("/system-settings/ai-models/openai")
async def get_openai_models(db = Depends(get_db)):
    """Fetch available OpenAI models"""
    try:
        config = crud.get_ai_api_keys(db)
        api_key = config.get('openai_api_key') if config else None
        
        if not api_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured")
        
        # Fetch models from OpenAI API
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        response = requests.get("https://api.openai.com/v1/models", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # Filter for GPT models only
            models = [
                {
                    "id": model["id"],
                    "name": model["id"],
                    "created": model.get("created", 0)
                }
                for model in data.get("data", [])
                if "gpt" in model["id"].lower()
            ]
            # Sort by name
            models.sort(key=lambda x: x["name"])
            return {"models": models}
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch OpenAI models")
            
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Request timeout while fetching models")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error fetching models: {str(e)}")

@router.get("/system-settings/ai-models/gemini")
async def get_gemini_models(db = Depends(get_db)):
    """Fetch available Gemini models"""
    try:
        config = crud.get_ai_api_keys(db)
        api_key = config.get('gemini_api_key') if config else None
        
        if not api_key:
            raise HTTPException(status_code=400, detail="Gemini API key not configured")
        
        # Fetch models from Gemini API
        response = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            models = [
                {
                    "id": model["name"].split("/")[-1],
                    "name": model.get("displayName", model["name"].split("/")[-1]),
                    "description": model.get("description", "")
                }
                for model in data.get("models", [])
                if "generateContent" in model.get("supportedGenerationMethods", [])
            ]
            return {"models": models}
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch Gemini models")
            
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Request timeout while fetching models")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error fetching models: {str(e)}")

@router.get("/system-settings/ai-models/anthropic")
async def get_anthropic_models():
    """Return available Anthropic Claude models (static list as API doesn't provide model listing)"""
    # Anthropic doesn't provide a models API endpoint, so we return a curated list
    models = [
        {
            "id": "claude-3-5-sonnet-20241022",
            "name": "Claude 3.5 Sonnet (Latest)",
            "description": "Most intelligent model, best for complex tasks"
        },
        {
            "id": "claude-3-5-haiku-20241022",
            "name": "Claude 3.5 Haiku (Latest)",
            "description": "Fastest model, best for quick responses"
        },
        {
            "id": "claude-3-opus-20240229",
            "name": "Claude 3 Opus",
            "description": "Powerful model for highly complex tasks"
        },
        {
            "id": "claude-3-sonnet-20240229",
            "name": "Claude 3 Sonnet",
            "description": "Balanced intelligence and speed"
        },
        {
            "id": "claude-3-haiku-20240307",
            "name": "Claude 3 Haiku",
            "description": "Fast and compact model"
        }
    ]
    return {"models": models}

@router.post("/system-settings/ai-api-keys/test/{provider}")
async def test_ai_api_key(provider: str, db = Depends(get_db)):
    """Test AI API key by making a simple API call"""
    config = crud.get_ai_api_keys(db)
    
    if not config:
        raise HTTPException(status_code=400, detail="AI API keys not configured")
    
    try:
        if provider == "openai":
            api_key = config.get('openai_api_key')
            if not api_key:
                raise HTTPException(status_code=400, detail="OpenAI API key not configured")
            
            headers = {"Authorization": f"Bearer {api_key}"}
            response = requests.get("https://api.openai.com/v1/models", headers=headers, timeout=10)
            
            if response.status_code == 200:
                return {"success": True, "message": "OpenAI API key is valid"}
            else:
                return {"success": False, "message": "Invalid OpenAI API key"}
                
        elif provider == "gemini":
            api_key = config.get('gemini_api_key')
            if not api_key:
                raise HTTPException(status_code=400, detail="Gemini API key not configured")
            
            response = requests.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
                timeout=10
            )
            
            if response.status_code == 200:
                return {"success": True, "message": "Gemini API key is valid"}
            else:
                return {"success": False, "message": "Invalid Gemini API key"}
                
        elif provider == "anthropic":
            api_key = config.get('anthropic_api_key')
            if not api_key:
                raise HTTPException(status_code=400, detail="Anthropic API key not configured")
            
            # Test with a minimal API call
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            test_data = {
                "model": "claude-3-haiku-20240307",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Hi"}]
            }
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=test_data,
                timeout=10
            )
            
            if response.status_code == 200:
                return {"success": True, "message": "Anthropic API key is valid"}
            else:
                return {"success": False, "message": "Invalid Anthropic API key"}
        else:
            raise HTTPException(status_code=400, detail="Invalid provider")
            
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Request timeout while testing API key")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error testing API key: {str(e)}")
