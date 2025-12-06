"""
Gallery Routes - MongoDB Version
Refactored from SQLAlchemy to MongoDB
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import get_db
import crud

router = APIRouter()

class GalleryCreate(BaseModel):
    gallery_id: str
    title: str
    artists: List[str]
    images: List[dict]  # List of image objects with id, name, data, size
    gallery_type: Optional[str] = "vertical"  # horizontal or vertical
    category_type: Optional[str] = None  # Actor, Actress, Events, etc.
    entity_name: Optional[str] = None
    folder_path: Optional[str] = None
    tadka_pics_enabled: Optional[bool] = False

class GalleryUpdate(BaseModel):
    title: Optional[str] = None
    artists: Optional[List[str]] = None
    images: Optional[List[dict]] = None
    gallery_type: Optional[str] = None
    category_type: Optional[str] = None
    entity_name: Optional[str] = None
    folder_path: Optional[str] = None
    tadka_pics_enabled: Optional[bool] = None

class GalleryResponse(BaseModel):
    id: int
    gallery_id: str
    title: str
    artists: List[str]
    images: List[dict]
    gallery_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.post("/galleries", response_model=GalleryResponse)
async def create_gallery(gallery: GalleryCreate, db = Depends(get_db)):
    """Create a new gallery"""
    
    # Check if gallery_id already exists
    existing_gallery = crud.get_gallery_by_gallery_id(db, gallery.gallery_id)
    if existing_gallery:
        raise HTTPException(status_code=400, detail="Gallery ID already exists")
    
    # Create new gallery
    new_gallery = crud.create_gallery(db, {
        "gallery_id": gallery.gallery_id,
        "title": gallery.title,
        "artists": gallery.artists,
        "images": gallery.images,
        "gallery_type": gallery.gallery_type
    })
    
    return GalleryResponse(**new_gallery)

@router.get("/galleries", response_model=List[GalleryResponse])
async def get_galleries(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    """Get all galleries"""
    
    galleries = crud.get_galleries(db, skip=skip, limit=limit)
    
    return [GalleryResponse(**gallery) for gallery in galleries]

@router.get("/galleries/{gallery_id}", response_model=GalleryResponse)
async def get_gallery(gallery_id: str, db = Depends(get_db)):
    """Get a specific gallery by gallery_id"""
    
    gallery = crud.get_gallery_by_gallery_id(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    return GalleryResponse(**gallery)

@router.get("/galleries/by-id/{id}", response_model=GalleryResponse)
async def get_gallery_by_id(id: int, db = Depends(get_db)):
    """Get a specific gallery by numeric ID"""
    
    gallery = crud.get_gallery_by_id(db, id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    return GalleryResponse(**gallery)

@router.put("/galleries/{gallery_id}", response_model=GalleryResponse)
async def update_gallery(gallery_id: str, gallery_update: GalleryUpdate, db = Depends(get_db)):
    """Update a gallery"""
    
    gallery = crud.get_gallery_by_gallery_id(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    # Prepare update data
    update_data = {}
    if gallery_update.title is not None:
        update_data["title"] = gallery_update.title
    if gallery_update.artists is not None:
        update_data["artists"] = gallery_update.artists
    if gallery_update.images is not None:
        update_data["images"] = gallery_update.images
    if gallery_update.gallery_type is not None:
        update_data["gallery_type"] = gallery_update.gallery_type
    
    updated_gallery = crud.update_gallery(db, gallery_id, update_data)
    
    return GalleryResponse(**updated_gallery)

@router.delete("/galleries/{gallery_id}")
async def delete_gallery(gallery_id: str, db = Depends(get_db)):
    """Delete a gallery"""
    
    gallery = crud.get_gallery_by_gallery_id(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    crud.delete_gallery(db, gallery_id)
    
    return {"message": "Gallery deleted successfully"}
