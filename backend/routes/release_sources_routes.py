"""
Release Sources Routes - Manage OTT/Theater release data sources (RSS feeds & websites)
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

from database import db

router = APIRouter(prefix="/release-sources", tags=["Release Sources"])

# Collection names
RELEASE_SOURCES = "release_sources"
RELEASE_FEED_ITEMS = "release_feed_items"

# Pydantic Models
class ReleaseSourceCreate(BaseModel):
    source_name: str
    source_type: str  # 'rss' or 'website'
    source_url: str
    content_filter: str = "auto_detect"  # auto_detect, ott_only, theater_only, web_series_only, movies_only, documentary_only, tv_shows_only
    language_filter: str = "all"  # all, Telugu, Hindi, Tamil, etc.
    is_active: bool = True
    fetch_mode: str = "manual"  # manual or scheduled
    schedule_interval: Optional[str] = None  # hourly, daily, etc.

class ReleaseSourceUpdate(BaseModel):
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    source_url: Optional[str] = None
    content_filter: Optional[str] = None
    language_filter: Optional[str] = None
    is_active: Optional[bool] = None
    fetch_mode: Optional[str] = None
    schedule_interval: Optional[str] = None

class ReleaseSourceResponse(BaseModel):
    id: str
    source_name: str
    source_type: str
    source_url: str
    content_filter: str
    language_filter: str
    is_active: bool
    fetch_mode: str
    schedule_interval: Optional[str]
    last_fetch: Optional[datetime]
    items_count: int
    created_at: datetime
    updated_at: datetime


# Static routes MUST come before parameterized routes
@router.get("/stats")
async def get_release_stats():
    """Get statistics about release sources and items"""
    total_sources = db[RELEASE_SOURCES].count_documents({})
    active_sources = db[RELEASE_SOURCES].count_documents({"is_active": True})
    
    total_items = db[RELEASE_FEED_ITEMS].count_documents({})
    unused_items = db[RELEASE_FEED_ITEMS].count_documents({"is_used": False, "is_skipped": {"$ne": True}})
    used_items = db[RELEASE_FEED_ITEMS].count_documents({"is_used": True})
    skipped_items = db[RELEASE_FEED_ITEMS].count_documents({"is_skipped": True})
    
    # Count by content type
    by_content_type = {}
    for ctype in ['ott', 'theater', 'web_series', 'movie', 'documentary', 'tv_show']:
        by_content_type[ctype] = db[RELEASE_FEED_ITEMS].count_documents({"content_type": ctype})
    
    return {
        "sources": {
            "total": total_sources,
            "active": active_sources
        },
        "items": {
            "total": total_items,
            "unused": unused_items,
            "used": used_items,
            "skipped": skipped_items
        },
        "by_content_type": by_content_type
    }


@router.get("/content-filters")
async def get_content_filter_options():
    """Get available content filter options"""
    return {
        "filters": [
            {"value": "auto_detect", "label": "Auto-Detect from Content"},
            {"value": "ott_only", "label": "OTT Releases Only"},
            {"value": "theater_only", "label": "Theater Releases Only"},
            {"value": "web_series_only", "label": "Web Series Only"},
            {"value": "movies_only", "label": "Movies Only"},
            {"value": "documentary_only", "label": "Documentary Only"},
            {"value": "tv_shows_only", "label": "TV Shows Only"}
        ]
    }


@router.get("/language-options")
async def get_language_options():
    """Get available language filter options"""
    return {
        "languages": [
            {"value": "all", "label": "All Languages"},
            {"value": "Telugu", "label": "Telugu"},
            {"value": "Hindi", "label": "Hindi"},
            {"value": "Tamil", "label": "Tamil"},
            {"value": "Kannada", "label": "Kannada"},
            {"value": "Malayalam", "label": "Malayalam"},
            {"value": "Bengali", "label": "Bengali"},
            {"value": "Marathi", "label": "Marathi"},
            {"value": "Punjabi", "label": "Punjabi"},
            {"value": "English", "label": "English"},
            {"value": "Korean", "label": "Korean"},
            {"value": "Spanish", "label": "Spanish"}
        ]
    }


@router.get("/items/all")
async def get_all_feed_items(
    skip: int = 0,
    limit: int = 50,
    content_type: Optional[str] = None,
    language: Optional[str] = None,
    is_used: Optional[bool] = None
):
    """Get all release feed items with filters"""
    query = {}
    
    if content_type:
        query["content_type"] = content_type
    if language:
        query["languages"] = language
    if is_used is not None:
        query["is_used"] = is_used
    
    items = list(
        db[RELEASE_FEED_ITEMS]
        .find(query, {"_id": 0})
        .sort("fetched_at", -1)
        .skip(skip)
        .limit(limit)
    )
    
    total = db[RELEASE_FEED_ITEMS].count_documents(query)
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/items/unused")
async def get_unused_feed_items(
    content_type: Optional[str] = None,
    language: Optional[str] = None,
    limit: int = 20
):
    """Get unused release items for AI agent processing"""
    query = {"is_used": False, "is_skipped": {"$ne": True}}
    
    if content_type:
        query["content_type"] = content_type
    if language:
        query["languages"] = language
    
    items = list(
        db[RELEASE_FEED_ITEMS]
        .find(query, {"_id": 0})
        .sort("release_date", -1)
        .limit(limit)
    )
    
    return items


@router.post("/fetch-all")
async def fetch_all_sources(background_tasks: BackgroundTasks):
    """Fetch all active release sources"""
    from services.release_scraper_service import release_scraper_service
    
    sources = list(db[RELEASE_SOURCES].find({"is_active": True}))
    
    if not sources:
        return {"message": "No active sources to fetch", "count": 0}
    
    # Run fetch in background
    background_tasks.add_task(
        release_scraper_service.fetch_all_sources
    )
    
    return {
        "message": f"Fetch started for {len(sources)} sources",
        "sources": [s['source_name'] for s in sources]
    }


@router.get("", response_model=List[ReleaseSourceResponse])
async def get_release_sources():
    """Get all release sources"""
    sources = list(db[RELEASE_SOURCES].find({}, {"_id": 0}).sort("source_name", 1))
    
    # Add items count for each source
    for source in sources:
        source['items_count'] = db[RELEASE_FEED_ITEMS].count_documents({
            "source_id": source.get('id')
        })
    
    return sources


@router.get("/{source_id}")
async def get_release_source(source_id: str):
    """Get a specific release source"""
    source = db[RELEASE_SOURCES].find_one({"id": source_id}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Release source not found")

    
    source['items_count'] = db[RELEASE_FEED_ITEMS].count_documents({
        "source_id": source_id
    })
    
    return source


@router.post("", response_model=ReleaseSourceResponse)
async def create_release_source(source: ReleaseSourceCreate):
    """Create a new release source"""
    # Check if source with same URL exists
    existing = db[RELEASE_SOURCES].find_one({"source_url": source.source_url})
    if existing:
        raise HTTPException(status_code=400, detail="A source with this URL already exists")
    
    now = datetime.now(timezone.utc)
    source_doc = {
        "id": str(uuid.uuid4()),
        "source_name": source.source_name,
        "source_type": source.source_type,
        "source_url": source.source_url,
        "content_filter": source.content_filter,
        "language_filter": source.language_filter,
        "is_active": source.is_active,
        "fetch_mode": source.fetch_mode,
        "schedule_interval": source.schedule_interval,
        "last_fetch": None,
        "items_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    db[RELEASE_SOURCES].insert_one(source_doc)
    del source_doc["_id"]
    return source_doc


@router.put("/{source_id}", response_model=ReleaseSourceResponse)
async def update_release_source(source_id: str, source: ReleaseSourceUpdate):
    """Update a release source"""
    existing = db[RELEASE_SOURCES].find_one({"id": source_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Release source not found")
    
    update_data = {k: v for k, v in source.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    db[RELEASE_SOURCES].update_one({"id": source_id}, {"$set": update_data})
    
    updated = db[RELEASE_SOURCES].find_one({"id": source_id}, {"_id": 0})
    updated['items_count'] = db[RELEASE_FEED_ITEMS].count_documents({"source_id": source_id})
    return updated


@router.delete("/{source_id}")
async def delete_release_source(source_id: str):
    """Delete a release source and its items"""
    existing = db[RELEASE_SOURCES].find_one({"id": source_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Release source not found")
    
    # Delete all items from this source
    deleted_items = db[RELEASE_FEED_ITEMS].delete_many({"source_id": source_id})
    
    # Delete the source
    db[RELEASE_SOURCES].delete_one({"id": source_id})
    
    return {
        "message": "Release source deleted successfully",
        "items_deleted": deleted_items.deleted_count
    }


@router.post("/{source_id}/fetch")
async def fetch_release_source(source_id: str, background_tasks: BackgroundTasks):
    """Manually trigger fetch for a release source"""
    from services.release_scraper_service import release_scraper_service
    
    source = db[RELEASE_SOURCES].find_one({"id": source_id})
    if not source:
        raise HTTPException(status_code=404, detail="Release source not found")
    
    # Run fetch in background - wrap async function properly
    import asyncio
    
    def run_fetch():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(release_scraper_service.fetch_source(source))
        finally:
            loop.close()
    
    background_tasks.add_task(run_fetch)
    
    return {
        "message": f"Fetch started for {source['source_name']}",
        "source_id": source_id
    }
