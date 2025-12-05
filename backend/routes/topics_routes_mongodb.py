"""
Topics Routes - MongoDB Version
Refactored from SQLAlchemy to MongoDB
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Optional
import os
import uuid
from datetime import datetime
from pydantic import BaseModel
import re

from database import get_db
import crud

router = APIRouter()

class TopicCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    language: Optional[str] = "en"

class TopicUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None

class TopicResponse(BaseModel):
    id: int
    title: str
    slug: str
    description: Optional[str]
    category: str
    image: Optional[str]
    language: str
    created_at: datetime
    updated_at: datetime
    articles_count: Optional[int] = 0

    class Config:
        from_attributes = True

class TopicCategoryCreate(BaseModel):
    name: str

class TopicCategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    created_at: datetime

    class Config:
        from_attributes = True

def create_slug(title: str) -> str:
    """Create a URL-friendly slug from title"""
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', title)
    slug = re.sub(r'\s+', '-', slug.strip())
    return slug.lower()

# Get all topics with filtering
@router.get("/topics", response_model=List[TopicResponse])
async def get_topics(
    category: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db = Depends(get_db)
):
    """Get all topics with optional filtering"""
    topics = crud.get_topics(db, category=category, language=language, search=search, skip=skip, limit=limit)
    
    # Add article count for each topic
    result = []
    for topic in topics:
        articles_count = crud.count_topic_articles(db, topic["id"])
        topic["articles_count"] = articles_count
        result.append(TopicResponse(**topic))
    
    return result

# Get single topic by ID
@router.get("/topics/{topic_id}", response_model=TopicResponse)
async def get_topic(topic_id: int, db = Depends(get_db)):
    """Get single topic by ID"""
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get articles count
    articles_count = crud.count_topic_articles(db, topic["id"])
    topic["articles_count"] = articles_count
    
    return TopicResponse(**topic)

# Get topic by slug
@router.get("/topics/slug/{topic_slug}", response_model=TopicResponse)
async def get_topic_by_slug(topic_slug: str, db = Depends(get_db)):
    """Get topic by slug"""
    topic = crud.get_topic_by_slug(db, topic_slug)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get articles count
    articles_count = crud.count_topic_articles(db, topic["id"])
    topic["articles_count"] = articles_count
    
    return TopicResponse(**topic)

# Create new topic
@router.post("/topics", response_model=TopicResponse)
async def create_topic(
    topic_data: TopicCreate,
    db = Depends(get_db)
):
    """Create a new topic"""
    
    # Create slug from title
    base_slug = create_slug(topic_data.title)
    slug = base_slug
    
    # Ensure unique slug
    counter = 1
    while crud.get_topic_by_slug(db, slug):
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Create topic
    new_topic = crud.create_topic(db, {
        "title": topic_data.title,
        "slug": slug,
        "description": topic_data.description,
        "category": topic_data.category,
        "language": topic_data.language
    })
    
    new_topic["articles_count"] = 0
    return TopicResponse(**new_topic)

# Update topic
@router.put("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: int,
    topic_data: TopicUpdate,
    db = Depends(get_db)
):
    """Update an existing topic"""
    
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    update_dict = {}
    
    # Update fields
    if topic_data.title is not None:
        update_dict["title"] = topic_data.title
        # Update slug if title changed
        new_slug = create_slug(topic_data.title)
        if new_slug != topic["slug"]:
            slug = new_slug
            counter = 1
            existing = crud.get_topic_by_slug(db, slug)
            while existing and existing["id"] != topic_id:
                slug = f"{new_slug}-{counter}"
                counter += 1
                existing = crud.get_topic_by_slug(db, slug)
            update_dict["slug"] = slug
    
    if topic_data.description is not None:
        update_dict["description"] = topic_data.description
    
    if topic_data.category is not None:
        update_dict["category"] = topic_data.category
    
    if topic_data.language is not None:
        update_dict["language"] = topic_data.language
    
    updated_topic = crud.update_topic(db, topic_id, update_dict)
    
    # Get articles count
    articles_count = crud.count_topic_articles(db, topic_id)
    updated_topic["articles_count"] = articles_count
    
    return TopicResponse(**updated_topic)

# Delete topic
@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: int, db = Depends(get_db)):
    """Delete a topic"""
    
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Delete topic image if exists
    if topic.get("image"):
        try:
            image_path = f"/app/backend/uploads/{topic['image']}"
            if os.path.exists(image_path):
                os.remove(image_path)
        except Exception as e:
            print(f"Warning: Could not delete topic image: {e}")
    
    # Delete topic (also removes associations)
    crud.delete_topic(db, topic_id)
    
    return {"message": "Topic deleted successfully"}

# Upload topic image
@router.post("/topics/{topic_id}/upload-image")
async def upload_topic_image(
    topic_id: int,
    file: UploadFile = File(...),
    db = Depends(get_db)
):
    """Upload image for a topic"""
    
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Create uploads directory if it doesn't exist
    os.makedirs("/app/backend/uploads", exist_ok=True)
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"topic_{topic_id}_{uuid.uuid4()}.{file_extension}"
    file_path = f"/app/backend/uploads/{filename}"
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    
    # Delete old image if exists
    if topic.get("image"):
        try:
            old_image_path = f"/app/backend/uploads/{topic['image']}"
            if os.path.exists(old_image_path):
                os.remove(old_image_path)
        except Exception as e:
            print(f"Warning: Could not delete old topic image: {e}")
    
    # Update topic with new image path
    crud.update_topic(db, topic_id, {"image": filename})
    
    return {"message": "Image uploaded successfully", "image": filename}

# Get topic categories
@router.get("/topic-categories", response_model=List[TopicCategoryResponse])
async def get_topic_categories(db = Depends(get_db)):
    """Get all topic categories"""
    categories = crud.get_topic_categories(db)
    return [TopicCategoryResponse(**cat) for cat in categories]

# Create topic category
@router.post("/topic-categories", response_model=TopicCategoryResponse)
async def create_topic_category(
    category_data: TopicCategoryCreate,
    db = Depends(get_db)
):
    """Create a new topic category"""
    
    # Create slug from name
    slug = create_slug(category_data.name)
    
    # Check if category already exists
    categories = crud.get_topic_categories(db)
    for cat in categories:
        if cat["name"] == category_data.name or cat["slug"] == slug:
            raise HTTPException(status_code=400, detail="Category already exists")
    
    # Create category
    new_category = crud.create_topic_category(db, category_data.name, slug)
    
    return TopicCategoryResponse(**new_category)

# Get articles for a topic
@router.get("/topics/{topic_id}/articles")
async def get_topic_articles(
    topic_id: int,
    skip: int = 0,
    limit: int = 50,
    db = Depends(get_db)
):
    """Get all articles associated with a topic"""
    
    # Verify topic exists
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get articles
    articles = crud.get_articles_by_topic(db, topic_id, skip=skip, limit=limit)
    
    return articles

# Associate article with topic
@router.post("/topics/{topic_id}/articles/{article_id}")
async def associate_article_with_topic(
    topic_id: int,
    article_id: int,
    db = Depends(get_db)
):
    """Associate an article with a topic"""
    
    # Verify topic exists
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Verify article exists
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Create association
    success = crud.associate_article_with_topic(db, article_id, topic_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Association already exists")
    
    return {"message": "Article associated with topic successfully"}

# Remove article from topic
@router.delete("/topics/{topic_id}/articles/{article_id}")
async def remove_article_from_topic(
    topic_id: int,
    article_id: int,
    db = Depends(get_db)
):
    """Remove association between article and topic"""
    
    success = crud.remove_article_from_topic(db, article_id, topic_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Association not found")
    
    return {"message": "Article removed from topic successfully"}

# Get topics for a specific article
@router.get("/articles/{article_id}/topics", response_model=List[TopicResponse])
async def get_article_topics(
    article_id: int,
    db = Depends(get_db)
):
    """Get all topics associated with an article"""
    
    # Verify article exists
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Get topics
    topics = crud.get_topics_by_article(db, article_id)
    
    # Format response with articles count for each topic
    result = []
    for topic in topics:
        articles_count = crud.count_topic_articles(db, topic["id"])
        topic["articles_count"] = articles_count
        result.append(TopicResponse(**topic))
    
    return result

# Gallery-Topic Association Endpoints

@router.post("/topics/{topic_id}/galleries/{gallery_id}")
async def associate_topic_with_gallery(
    topic_id: int,
    gallery_id: int,
    db = Depends(get_db)
):
    """Associate a topic with a gallery"""
    
    # Verify topic exists
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Verify gallery exists
    gallery = crud.get_gallery_by_id(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    # Create association
    success = crud.associate_topic_with_gallery(db, topic_id, gallery_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Topic is already associated with this gallery")
    
    return {"message": "Topic successfully associated with gallery"}

@router.delete("/topics/{topic_id}/galleries/{gallery_id}")
async def disassociate_topic_from_gallery(
    topic_id: int,
    gallery_id: int,
    db = Depends(get_db)
):
    """Remove association between a topic and a gallery"""
    
    # Verify topic exists
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Verify gallery exists
    gallery = crud.get_gallery_by_id(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    # Remove association
    success = crud.remove_topic_from_gallery(db, topic_id, gallery_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Association not found")
    
    return {"message": "Topic association removed from gallery"}

@router.get("/galleries/{gallery_id}/topics", response_model=List[TopicResponse])
async def get_gallery_topics(gallery_id: int, db = Depends(get_db)):
    """Get all topics associated with a gallery"""
    
    # Verify gallery exists
    gallery = crud.get_gallery_by_id(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    # Get topics
    topics = crud.get_topics_by_gallery(db, gallery_id)
    
    # Format response with articles count for each topic
    result = []
    for topic in topics:
        articles_count = crud.count_topic_articles(db, topic["id"])
        topic["articles_count"] = articles_count
        result.append(TopicResponse(**topic))
    
    return result

@router.get("/topics/{topic_id}/galleries")
async def get_topic_galleries(topic_id: int, db = Depends(get_db)):
    """Get all galleries associated with a topic"""
    
    # Verify topic exists
    topic = crud.get_topic_by_id(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get galleries
    galleries = crud.get_galleries_by_topic(db, topic_id)
    
    return galleries
