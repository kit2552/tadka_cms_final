"""
Reality Shows Configuration Routes
Manage reality show mappings for TV Reality Show agents
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from database import get_db, db

router = APIRouter(prefix="/reality-shows", tags=["Reality Shows"])

# Pydantic models
class RealityShowCreate(BaseModel):
    show_name: str
    youtube_channel_id: str
    youtube_channel_name: Optional[str] = None
    filter_keywords: str  # Comma-separated keywords
    language: str  # Telugu, Tamil, Hindi, etc.

class RealityShowUpdate(BaseModel):
    show_name: Optional[str] = None
    youtube_channel_id: Optional[str] = None
    youtube_channel_name: Optional[str] = None
    filter_keywords: Optional[str] = None
    language: Optional[str] = None

class RealityShowResponse(BaseModel):
    id: str
    show_name: str
    youtube_channel_id: str
    youtube_channel_name: Optional[str] = None
    filter_keywords: str
    language: str
    created_at: datetime
    updated_at: datetime

# Collection name
REALITY_SHOWS = "reality_shows"


@router.get("")
async def get_reality_shows(db = Depends(get_db)):
    """Get all configured reality shows"""
    try:
        shows = list(db[REALITY_SHOWS].find({}, {"_id": 0}).sort("show_name", 1))
        return shows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reality shows: {str(e)}")


@router.get("/{show_id}")
async def get_reality_show(show_id: str, db = Depends(get_db)):
    """Get a specific reality show by ID"""
    show = db[REALITY_SHOWS].find_one({"id": show_id}, {"_id": 0})
    if not show:
        raise HTTPException(status_code=404, detail="Reality show not found")
    return show


@router.post("")
async def create_reality_show(show: RealityShowCreate, db = Depends(get_db)):
    """Create a new reality show mapping"""
    try:
        # Check if show name already exists
        existing = db[REALITY_SHOWS].find_one({"show_name": show.show_name})
        if existing:
            raise HTTPException(status_code=400, detail="A reality show with this name already exists")
        
        # Create new show
        show_data = {
            "id": str(uuid.uuid4()),
            "show_name": show.show_name,
            "youtube_channel_id": show.youtube_channel_id,
            "youtube_channel_name": show.youtube_channel_name,
            "filter_keywords": show.filter_keywords,
            "language": show.language,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        db[REALITY_SHOWS].insert_one(show_data)
        show_data.pop("_id", None)
        return show_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create reality show: {str(e)}")


@router.put("/{show_id}")
async def update_reality_show(show_id: str, show: RealityShowUpdate, db = Depends(get_db)):
    """Update a reality show mapping"""
    try:
        # Check if show exists
        existing = db[REALITY_SHOWS].find_one({"id": show_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Reality show not found")
        
        # Build update data
        update_data = {k: v for k, v in show.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        
        # Update show
        db[REALITY_SHOWS].update_one(
            {"id": show_id},
            {"$set": update_data}
        )
        
        # Return updated show
        updated_show = db[REALITY_SHOWS].find_one({"id": show_id}, {"_id": 0})
        return updated_show
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update reality show: {str(e)}")


@router.delete("/{show_id}")
async def delete_reality_show(show_id: str, db = Depends(get_db)):
    """Delete a reality show mapping"""
    try:
        result = db[REALITY_SHOWS].delete_one({"id": show_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reality show not found")
        return {"message": "Reality show deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete reality show: {str(e)}")


@router.get("/by-name/{show_name}")
async def get_reality_show_by_name(show_name: str, db = Depends(get_db)):
    """Get reality show configuration by show name (for agent form)"""
    show = db[REALITY_SHOWS].find_one({"show_name": show_name}, {"_id": 0})
    if not show:
        raise HTTPException(status_code=404, detail="Reality show not found")
    return show
