from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class OTTPlatformCreate(BaseModel):
    name: str
    is_active: Optional[bool] = True

class OTTPlatformUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/api/cms/ott-platforms")
def get_ott_platforms():
    """Get all OTT platforms"""
    from server import db
    import crud
    
    platforms = crud.get_ott_platforms(db)
    return {"platforms": platforms}

@router.post("/api/cms/ott-platforms")
def create_ott_platform(platform: OTTPlatformCreate):
    """Create new OTT platform"""
    from server import db
    import crud
    
    # Check if platform with same name exists
    existing = db.ott_platforms.find_one({"name": platform.name})
    if existing:
        raise HTTPException(status_code=400, detail="Platform with this name already exists")
    
    new_platform = crud.create_ott_platform(db, platform.dict())
    return {"success": True, "platform": new_platform}

@router.put("/api/cms/ott-platforms/{platform_id}")
def update_ott_platform(platform_id: int, platform: OTTPlatformUpdate):
    """Update OTT platform"""
    from server import db
    import crud
    
    existing = db.ott_platforms.find_one({"id": platform_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    updated_platform = crud.update_ott_platform(db, platform_id, platform.dict(exclude_unset=True))
    return {"success": True, "platform": updated_platform}

@router.delete("/api/cms/ott-platforms/{platform_id}")
def delete_ott_platform(platform_id: int):
    """Delete OTT platform"""
    from server import db
    import crud
    
    success = crud.delete_ott_platform(db, platform_id)
    if not success:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    return {"success": True, "message": "Platform deleted successfully"}
