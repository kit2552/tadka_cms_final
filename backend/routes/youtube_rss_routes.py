"""
YouTube RSS Routes - Manage RSS feed fetching and video collection
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from database import db
from services.youtube_rss_service import youtube_rss_service

router = APIRouter(prefix="/youtube-rss", tags=["YouTube RSS"])


class RSSConfigUpdate(BaseModel):
    enabled: bool
    frequency_hours: int = 1  # 1, 2, 3, 4, 6, 12, 24


class DeleteOldVideosRequest(BaseModel):
    days_to_keep: int = 30  # 30, 60, 90, 180, 365


@router.get("/config")
async def get_rss_config():
    """Get YouTube RSS scheduler configuration"""
    config = db.system_settings.find_one({"setting_key": "youtube_rss_config"})
    
    if not config:
        # Default config
        return {
            "enabled": False,
            "frequency_hours": 1,
            "last_fetch": None,
            "next_fetch": None
        }
    
    return {
        "enabled": config.get("enabled", False),
        "frequency_hours": config.get("frequency_hours", 1),
        "last_fetch": config.get("last_fetch"),
        "next_fetch": config.get("next_fetch")
    }


@router.put("/config")
async def update_rss_config(config: RSSConfigUpdate):
    """Update YouTube RSS scheduler configuration"""
    from services.youtube_rss_scheduler import youtube_rss_scheduler
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "enabled": config.enabled,
        "frequency_hours": config.frequency_hours,
        "updated_at": now
    }
    
    # Calculate next fetch time if enabled
    if config.enabled:
        from datetime import timedelta
        update_data["next_fetch"] = now + timedelta(hours=config.frequency_hours)
    
    db.system_settings.update_one(
        {"setting_key": "youtube_rss_config"},
        {"$set": update_data},
        upsert=True
    )
    
    # Update scheduler
    if config.enabled:
        youtube_rss_scheduler.start_scheduler(config.frequency_hours)
    else:
        youtube_rss_scheduler.stop_scheduler()
    
    return {
        "success": True,
        "message": f"RSS scheduler {'enabled' if config.enabled else 'disabled'}",
        "config": update_data
    }


@router.post("/fetch")
async def trigger_rss_fetch(background_tasks: BackgroundTasks):
    """Manually trigger RSS feed fetch"""
    if youtube_rss_service.is_running:
        raise HTTPException(status_code=409, detail="RSS fetch already in progress")
    
    # Run in background
    background_tasks.add_task(youtube_rss_service.fetch_all_channels)
    
    return {
        "success": True,
        "message": "RSS fetch started in background"
    }


@router.post("/fetch-sync")
async def trigger_rss_fetch_sync():
    """Trigger RSS feed fetch and wait for completion"""
    if youtube_rss_service.is_running:
        raise HTTPException(status_code=409, detail="RSS fetch already in progress")
    
    result = await youtube_rss_service.fetch_all_channels()
    return result


@router.get("/stats")
async def get_video_stats():
    """Get video collection statistics"""
    stats = youtube_rss_service.get_total_video_count()
    
    # Get config for last fetch time
    config = db.system_settings.find_one({"setting_key": "youtube_rss_config"})
    
    return {
        **stats,
        "last_fetch": config.get("last_fetch") if config else None,
        "scheduler_enabled": config.get("enabled", False) if config else False
    }


@router.get("/videos/by-channel")
async def get_videos_by_channel(channel_type: Optional[str] = None):
    """Get video counts grouped by channel"""
    counts = youtube_rss_service.get_video_counts_by_channel()
    
    # Filter by type if specified
    if channel_type:
        counts = [c for c in counts if c.get('channel_type') == channel_type]
    
    return {"channels": counts}


@router.get("/videos")
async def get_videos(
    channel_type: Optional[str] = None,
    channel_id: Optional[str] = None,
    language: Optional[str] = None,
    is_used: Optional[bool] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get videos from collection with filters"""
    query = {}
    
    if channel_type:
        query['channel_type'] = channel_type
    
    if channel_id:
        query['channel_id'] = channel_id
    
    if language:
        query['$or'] = [
            {'languages': language},
            {'detected_language': language}
        ]
    
    if is_used is not None:
        query['is_used'] = is_used
    
    videos = list(
        db.youtube_videos.find(query, {'_id': 0})
        .sort('published_at', -1)
        .skip(skip)
        .limit(limit)
    )
    
    total = db.youtube_videos.count_documents(query)
    
    return {
        "videos": videos,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.delete("/videos/old")
async def delete_old_videos(request: DeleteOldVideosRequest):
    """Delete videos older than specified days"""
    result = youtube_rss_service.delete_old_videos(request.days_to_keep)
    return result


@router.delete("/videos/all")
async def delete_all_videos():
    """Delete all videos from collection (use with caution)"""
    count = db.youtube_videos.count_documents({})
    db.youtube_videos.delete_many({})
    
    return {
        "success": True,
        "deleted_count": count,
        "message": "All videos deleted from collection"
    }


@router.get("/status")
async def get_fetch_status():
    """Check if RSS fetch is currently running"""
    return {
        "is_running": youtube_rss_service.is_running
    }
