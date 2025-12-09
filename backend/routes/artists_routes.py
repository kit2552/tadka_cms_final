from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from ..database import get_db

router = APIRouter()

ARTISTS_COLLECTION = "artists"

class ArtistCreate(BaseModel):
    name: str

class ArtistUpdate(BaseModel):
    name: str

class ArtistResponse(BaseModel):
    id: int
    name: str
    created_at: Optional[datetime] = None

@router.get("/artists", response_model=List[ArtistResponse])
async def get_all_artists(db = Depends(get_db)):
    """Get all artists sorted by name"""
    artists = list(db[ARTISTS_COLLECTION].find({}, {"_id": 0}).sort("name", 1))
    return artists

@router.post("/artists", response_model=ArtistResponse)
async def create_artist(artist: ArtistCreate, db = Depends(get_db)):
    """Create a new artist"""
    # Check if artist already exists
    existing = db[ARTISTS_COLLECTION].find_one({"name": artist.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Artist with this name already exists")
    
    # Get next ID
    max_artist = db[ARTISTS_COLLECTION].find_one({}, {"_id": 0}, sort=[("id", -1)])
    next_id = (max_artist["id"] + 1) if max_artist else 1
    
    # Create artist document
    artist_doc = {
        "id": next_id,
        "name": artist.name,
        "created_at": datetime.utcnow()
    }
    
    db[ARTISTS_COLLECTION].insert_one(artist_doc)
    
    return {
        "id": next_id,
        "name": artist.name,
        "created_at": artist_doc["created_at"]
    }

@router.put("/artists/{artist_id}", response_model=ArtistResponse)
async def update_artist(artist_id: int, artist: ArtistUpdate, db = Depends(get_db)):
    """Update an existing artist"""
    # Check if artist exists
    existing = db[ARTISTS_COLLECTION].find_one({"id": artist_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Artist not found")
    
    # Check if new name conflicts with another artist
    name_conflict = db[ARTISTS_COLLECTION].find_one(
        {"name": artist.name, "id": {"$ne": artist_id}}, 
        {"_id": 0}
    )
    if name_conflict:
        raise HTTPException(status_code=400, detail="Another artist with this name already exists")
    
    # Update artist
    db[ARTISTS_COLLECTION].update_one(
        {"id": artist_id},
        {"$set": {"name": artist.name}}
    )
    
    # Return updated artist
    updated = db[ARTISTS_COLLECTION].find_one({"id": artist_id}, {"_id": 0})
    return updated

@router.delete("/artists/{artist_id}")
async def delete_artist(artist_id: int, db = Depends(get_db)):
    """Delete an artist"""
    result = db[ARTISTS_COLLECTION].delete_one({"id": artist_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artist not found")
    
    return {"message": "Artist deleted successfully"}
