from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class GalleryEntityCreate(BaseModel):
    name: str
    is_active: Optional[bool] = True

@router.get("/api/cms/gallery-entities/{entity_type}")
def get_gallery_entities(entity_type: str):
    """Get all entities for a specific gallery type"""
    from server import db
    import crud
    
    valid_types = ["actor", "actress", "events", "politics", "travel", "others"]
    if entity_type.lower() not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    entities = crud.get_gallery_entities(db, entity_type)
    return {"entities": entities}

@router.post("/api/cms/gallery-entities/{entity_type}")
def create_gallery_entity(entity_type: str, entity: GalleryEntityCreate):
    """Create new gallery entity"""
    from server import db
    import crud
    
    valid_types = ["actor", "actress", "events", "politics", "travel", "others"]
    if entity_type.lower() not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    # Check if entity with same name exists
    existing_entities = crud.get_gallery_entities(db, entity_type)
    if any(e["name"].lower() == entity.name.lower() for e in existing_entities):
        raise HTTPException(status_code=400, detail=f"{entity_type.title()} with this name already exists")
    
    new_entity = crud.create_gallery_entity(db, entity_type, entity.dict())
    return {"success": True, "entity": new_entity}

@router.get("/api/cms/gallery-next-number/{category_type}/{entity_name}")
def get_next_gallery_number(category_type: str, entity_name: str):
    """Get next gallery number for an entity"""
    from server import db
    import crud
    
    next_number = crud.get_next_gallery_number(db, category_type, entity_name)
    return {"next_number": next_number}
