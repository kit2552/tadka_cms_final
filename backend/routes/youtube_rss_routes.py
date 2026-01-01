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


@router.post("/fetch-channel/{channel_id}")
async def fetch_single_channel(channel_id: str):
    """Fetch RSS feed for a single channel by its database ID"""
    # Get channel from database
    channel = db.youtube_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if not channel.get('channel_id'):
        raise HTTPException(status_code=400, detail="Channel has no YouTube channel ID configured")
    
    # Fetch RSS for this channel
    videos = await youtube_rss_service.fetch_channel_rss(
        channel_id=channel.get('channel_id'),
        channel_name=channel.get('channel_name', 'Unknown'),
        channel_type=channel.get('channel_type', 'unknown'),
        languages=channel.get('languages', ['Hindi']),
        rss_url=channel.get('rss_url'),
        fetch_videos=channel.get('fetch_videos', True),
        fetch_shorts=channel.get('fetch_shorts', False),
        full_movies_only=channel.get('full_movies_only', False)
    )
    
    # Store videos in database
    new_videos = 0
    updated_videos = 0
    
    for video in videos:
        existing = db.youtube_videos.find_one({'video_id': video['video_id']})
        if existing:
            if video.get('updated_at') != existing.get('updated_at'):
                db.youtube_videos.update_one(
                    {'video_id': video['video_id']},
                    {'$set': {
                        'title': video['title'],
                        'description': video['description'],
                        'thumbnail': video['thumbnail'],
                        'updated_at': video['updated_at'],
                        'fetched_at': video['fetched_at']
                    }}
                )
                updated_videos += 1
        else:
            db.youtube_videos.insert_one(video)
            new_videos += 1
    
    return {
        "success": True,
        "channel_name": channel.get('channel_name'),
        "videos_found": len(videos),
        "new_videos": new_videos,
        "updated_videos": updated_videos
    }


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
    
    # Lookup internal channel IDs from youtube_channels collection
    for channel_data in counts:
        yt_channel_id = channel_data.get('channel_id')
        if yt_channel_id:
            channel_doc = db.youtube_channels.find_one({'channel_id': yt_channel_id}, {'_id': 0, 'id': 1})
            if channel_doc:
                channel_data['internal_id'] = channel_doc.get('id')
    
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


class SkipVideoRequest(BaseModel):
    video_id: str
    skipped: bool = True


@router.post("/videos/skip")
async def skip_video(request: SkipVideoRequest):
    """Mark a video as skipped (won't be picked by agent)"""
    success = youtube_rss_service.mark_video_as_skipped(request.video_id, request.skipped)
    
    if success:
        return {
            "success": True,
            "message": f"Video {'skipped' if request.skipped else 'unskipped'} successfully",
            "video_id": request.video_id
        }
    else:
        raise HTTPException(status_code=404, detail="Video not found")


class MarkAvailableRequest(BaseModel):
    video_id: str


@router.post("/videos/mark-available")
async def mark_video_available(request: MarkAvailableRequest):
    """Mark a used video as available again"""
    success = youtube_rss_service.mark_video_as_available(request.video_id)
    
    if success:
        return {
            "success": True,
            "message": "Video marked as available",
            "video_id": request.video_id
        }
    else:
        raise HTTPException(status_code=404, detail="Video not found")


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


# === Language Identification Endpoints ===

class UpdateVideoLanguageRequest(BaseModel):
    video_id: str
    language: str


@router.get("/videos/needs-identification")
async def get_videos_needing_identification():
    """Get videos that need manual language identification"""
    videos = list(
        db.youtube_videos.find(
            {'needs_language_identification': True},
            {'_id': 0, 'video_id': 1, 'title': 1, 'channel_name': 1, 'thumbnail': 1, 'detected_language': 1, 'languages': 1}
        ).sort('published_at', -1).limit(100)
    )
    
    return {
        "videos": videos,
        "count": len(videos)
    }


@router.get("/videos/needs-identification/count")
async def get_videos_needing_identification_count():
    """Get count of videos that need manual language identification"""
    count = db.youtube_videos.count_documents({'needs_language_identification': True})
    return {"count": count}


@router.post("/videos/update-language")
async def update_video_language(request: UpdateVideoLanguageRequest):
    """Update a video's detected language and clear the identification flag"""
    result = db.youtube_videos.update_one(
        {'video_id': request.video_id},
        {
            '$set': {
                'detected_language': request.language,
                'needs_language_identification': False
            }
        }
    )
    
    if result.modified_count > 0:
        return {
            "success": True,
            "message": f"Video language updated to {request.language}",
            "video_id": request.video_id
        }
    else:
        raise HTTPException(status_code=404, detail="Video not found")


@router.post("/videos/update-language/bulk")
async def update_video_language_bulk(updates: List[UpdateVideoLanguageRequest]):
    """Update multiple videos' languages at once"""
    updated_count = 0
    
    for update in updates:
        result = db.youtube_videos.update_one(
            {'video_id': update.video_id},
            {
                '$set': {
                    'detected_language': update.language,
                    'needs_language_identification': False
                }
            }
        )
        if result.modified_count > 0:
            updated_count += 1
    
    return {
        "success": True,
        "updated_count": updated_count,
        "message": f"Updated {updated_count} videos"
    }


# === RSS Fetch Logs Endpoints ===

@router.get("/logs")
async def get_rss_logs(limit: int = 50):
    """Get RSS fetch logs"""
    logs = list(
        db.rss_fetch_logs.find(
            {},
            {'_id': 0}
        ).sort('timestamp', -1).limit(limit)
    )
    
    return {"logs": logs}


@router.get("/logs/{log_id}")
async def get_rss_log_detail(log_id: str):
    """Get details of a specific RSS fetch log"""
    log = db.rss_fetch_logs.find_one({'log_id': log_id}, {'_id': 0})
    
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    return log

