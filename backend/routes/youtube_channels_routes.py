"""
YouTube Channels Routes - Manage official YouTube channels for video agent
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from database import get_db, db

router = APIRouter(prefix="/youtube-channels", tags=["YouTube Channels"])

# Pydantic models
class YouTubeChannelCreate(BaseModel):
    channel_name: str
    channel_id: Optional[str] = None  # YouTube channel ID (optional)
    channel_type: str  # production_house, music_label, popular_channel
    languages: List[str] = []  # Languages this channel covers
    is_active: bool = True
    priority: int = 1  # Higher priority = checked first

class YouTubeChannelUpdate(BaseModel):
    channel_name: Optional[str] = None
    channel_id: Optional[str] = None
    channel_type: Optional[str] = None
    languages: Optional[List[str]] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None

class YouTubeChannelResponse(BaseModel):
    id: str
    channel_name: str
    channel_id: Optional[str] = None
    channel_type: str
    languages: List[str]
    is_active: bool
    priority: int
    created_at: datetime
    updated_at: datetime

# Collection name
YOUTUBE_CHANNELS = "youtube_channels"

@router.get("", response_model=List[YouTubeChannelResponse])
async def get_youtube_channels(
    channel_type: Optional[str] = None,
    language: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all YouTube channels with optional filters"""
    query = {}
    
    if channel_type:
        query["channel_type"] = channel_type
    
    if language:
        query["languages"] = language
    
    if is_active is not None:
        query["is_active"] = is_active
    
    channels = list(db[YOUTUBE_CHANNELS].find(query, {"_id": 0}).sort([("priority", -1), ("channel_name", 1)]))
    return channels

@router.post("", response_model=YouTubeChannelResponse)
async def create_youtube_channel(channel: YouTubeChannelCreate):
    """Create a new YouTube channel"""
    # Check if channel already exists
    existing = db[YOUTUBE_CHANNELS].find_one({"channel_name": {"$regex": f"^{channel.channel_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Channel already exists")
    
    now = datetime.utcnow()
    channel_doc = {
        "id": str(uuid.uuid4()),
        "channel_name": channel.channel_name,
        "channel_id": channel.channel_id,
        "channel_type": channel.channel_type,
        "languages": channel.languages,
        "is_active": channel.is_active,
        "priority": channel.priority,
        "created_at": now,
        "updated_at": now
    }
    
    db[YOUTUBE_CHANNELS].insert_one(channel_doc)
    del channel_doc["_id"]
    return channel_doc

@router.put("/{channel_id}", response_model=YouTubeChannelResponse)
async def update_youtube_channel(channel_id: str, channel: YouTubeChannelUpdate):
    """Update a YouTube channel"""
    existing = db[YOUTUBE_CHANNELS].find_one({"id": channel_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    update_data = {k: v for k, v in channel.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    db[YOUTUBE_CHANNELS].update_one({"id": channel_id}, {"$set": update_data})
    
    updated = db[YOUTUBE_CHANNELS].find_one({"id": channel_id}, {"_id": 0})
    return updated

@router.delete("/{channel_id}")
async def delete_youtube_channel(channel_id: str):
    """Delete a YouTube channel"""
    result = db[YOUTUBE_CHANNELS].delete_one({"id": channel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"message": "Channel deleted successfully"}

@router.post("/bulk-create")
async def bulk_create_channels(channels: List[YouTubeChannelCreate]):
    """Bulk create YouTube channels (for initial setup)"""
    created = 0
    skipped = 0
    
    for channel in channels:
        existing = db[YOUTUBE_CHANNELS].find_one({"channel_name": {"$regex": f"^{channel.channel_name}$", "$options": "i"}})
        if existing:
            skipped += 1
            continue
        
        now = datetime.utcnow()
        channel_doc = {
            "id": str(uuid.uuid4()),
            "channel_name": channel.channel_name,
            "channel_id": channel.channel_id,
            "channel_type": channel.channel_type,
            "languages": channel.languages,
            "is_active": channel.is_active,
            "priority": channel.priority,
            "created_at": now,
            "updated_at": now
        }
        db[YOUTUBE_CHANNELS].insert_one(channel_doc)
        created += 1
    
    return {"created": created, "skipped": skipped}

@router.get("/channel-types")
async def get_channel_types():
    """Get available channel types"""
    return {
        "channel_types": [
            {"value": "production_house", "label": "Production House"},
            {"value": "music_label", "label": "Music Label"},
            {"value": "popular_channel", "label": "Popular YouTube Channel"}
        ]
    }

@router.get("/languages")
async def get_available_languages():
    """Get list of available languages"""
    return {
        "languages": [
            {"value": "Hindi", "label": "Hindi (Bollywood)"},
            {"value": "Telugu", "label": "Telugu (Tollywood)"},
            {"value": "Tamil", "label": "Tamil (Kollywood)"},
            {"value": "Kannada", "label": "Kannada (Sandalwood)"},
            {"value": "Malayalam", "label": "Malayalam (Mollywood)"},
            {"value": "Marathi", "label": "Marathi"},
            {"value": "Bengali", "label": "Bengali"},
            {"value": "Punjabi", "label": "Punjabi (Pollywood)"},
            {"value": "Gujarati", "label": "Gujarati"},
            {"value": "Bhojpuri", "label": "Bhojpuri"},
            {"value": "Multi", "label": "Multi-language"}
        ]
    }

@router.post("/seed-default")
async def seed_default_channels():
    """Seed the database with default Indian YouTube channels with real channel IDs"""
    default_channels = [
        # Hindi/Bollywood - Music Labels
        {"channel_name": "T-Series", "channel_id": "UCq-Fj5jknLsUf-MWSy4_brA", "channel_type": "music_label", "languages": ["Hindi", "Multi"], "priority": 10},
        {"channel_name": "Zee Music Company", "channel_id": "UCFFbwnve3yF62ChKcSW4dOQ", "channel_type": "music_label", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Sony Music India", "channel_id": "UCUoiJBFGEH1WuL33VqZ2XEw", "channel_type": "music_label", "languages": ["Hindi", "Multi"], "priority": 9},
        {"channel_name": "Saregama Music", "channel_id": "UCuHpCqKtZV_5VRG7OOsjR5A", "channel_type": "music_label", "languages": ["Hindi", "Bengali", "Multi"], "priority": 8},
        {"channel_name": "Tips Official", "channel_id": "UCJrDMFOdv1I2k8n9oK_V21w", "channel_type": "music_label", "languages": ["Hindi"], "priority": 8},
        {"channel_name": "Venus", "channel_id": "UCn30ij_Y0_5pKHXFq-GUtZg", "channel_type": "music_label", "languages": ["Hindi"], "priority": 7},
        {"channel_name": "Shemaroo Filmi Gaane", "channel_id": "UCnB94s68V4z7JXSoLBaYwLw", "channel_type": "music_label", "languages": ["Hindi", "Gujarati"], "priority": 7},
        {"channel_name": "Ultra Bollywood", "channel_id": "UCQu1Y-uvHgzmPwMQIOefoGA", "channel_type": "music_label", "languages": ["Hindi"], "priority": 7},
        {"channel_name": "Eros Now Music", "channel_id": "UCPuP3PD_BTHM2g5gJgMy8hg", "channel_type": "music_label", "languages": ["Hindi", "Multi"], "priority": 7},
        {"channel_name": "Speed Records", "channel_id": "UCmBMRE6K-1dDAMYkFYKNyWg", "channel_type": "music_label", "languages": ["Punjabi", "Hindi"], "priority": 7},
        {"channel_name": "White Hill Music", "channel_id": "UC2pIKZJMxOBK2-rvz2HnGCg", "channel_type": "music_label", "languages": ["Punjabi"], "priority": 6},
        
        # Hindi/Bollywood - Production Houses
        {"channel_name": "YRF", "channel_id": "UCbTLwN10NoCU4WDzLf1JMOA", "channel_type": "production_house", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "Dharma Productions", "channel_id": "UC28eATvr3Ox1bb_v-bHHLHQ", "channel_type": "production_house", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "Red Chillies Entertainment", "channel_id": "UCzRn3FvDy8-FP0GHSzn0-sQ", "channel_type": "production_house", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Excel Movies", "channel_id": "UCmOzb-xsGhBR8KxL7SlFW4Q", "channel_type": "production_house", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Nadiadwala Grandson Entertainment", "channel_id": "UCz0nFb4-E6hfQZqFCFPWxXQ", "channel_type": "production_house", "languages": ["Hindi"], "priority": 8},
        {"channel_name": "Pen Movies", "channel_id": "UCPTxuUK-VJk56IYNpHb4xYg", "channel_type": "production_house", "languages": ["Hindi", "Multi"], "priority": 8},
        {"channel_name": "Reliance Entertainment", "channel_id": "UCTVwTe0aTwGCNbW2OggFJzg", "channel_type": "production_house", "languages": ["Hindi", "Multi"], "priority": 8},
        {"channel_name": "Maddock Films", "channel_id": "UCGODlv-yW9QZfQUfzCQPljA", "channel_type": "production_house", "languages": ["Hindi"], "priority": 7},
        {"channel_name": "Balaji Motion Pictures", "channel_id": "UC8Tmj0NWlJgPqIVNCgDVj2A", "channel_type": "production_house", "languages": ["Hindi"], "priority": 7},
        {"channel_name": "Ajay Devgn FFilms", "channel_id": "UCLn-CjLjWvH0YQk7H-tR3-w", "channel_type": "production_house", "languages": ["Hindi"], "priority": 6},
        
        # Telugu - Music Labels
        {"channel_name": "Aditya Music", "channel_id": "UCNApqoVYJbYSrni8YsbHbmA", "channel_type": "music_label", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "Lahari Music", "channel_id": "UC-C0PFg5RcC4vHzKgDKMi8g", "channel_type": "music_label", "languages": ["Telugu", "Kannada"], "priority": 9},
        {"channel_name": "Mango Music", "channel_id": "UC5wwJHNvKP1n9s3w0PRgL3Q", "channel_type": "music_label", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "Sony Music South", "channel_id": "UCpuP3PD_BTHM2g5gJgMy8hg", "channel_type": "music_label", "languages": ["Telugu", "Tamil", "Kannada", "Malayalam"], "priority": 9},
        {"channel_name": "Saregama Telugu", "channel_id": "UC8gq0-2k8mHYvz8I5zxB1gw", "channel_type": "music_label", "languages": ["Telugu"], "priority": 7},
        
        # Telugu - Production Houses
        {"channel_name": "Sri Venkateswara Creations", "channel_id": "UC2IWVwWpBGUxyFUOxyPb5DA", "channel_type": "production_house", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "Mythri Movie Makers", "channel_id": "UCaYBcHTx88X88OOjwTHB18w", "channel_type": "production_house", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "Geetha Arts", "channel_id": "UC-2v_YvH1rCLHqr4G1yNXNg", "channel_type": "production_house", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "UV Creations", "channel_id": "UCBtvSXh4GwFWxq_9elUPCyg", "channel_type": "production_house", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "Sithara Entertainments", "channel_id": "UCaQxl6Jj47dkUd8i0lALsZQ", "channel_type": "production_house", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "Sri Venkateswara Cine Chitra", "channel_id": "UC6ldWk5nh5vwZ8o5JqmQfhA", "channel_type": "production_house", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "Suresh Productions", "channel_id": "UCsBjPiJTG6ERxSdmMaGVHhA", "channel_type": "production_house", "languages": ["Telugu"], "priority": 8},
        {"channel_name": "Annapurna Studios", "channel_id": "UC5Z3tJLfrL-V-Rv7tRgJvWw", "channel_type": "production_house", "languages": ["Telugu"], "priority": 8},
        {"channel_name": "People Media Factory", "channel_id": "UC9wJR89AJD7xBnCb6UOJvgQ", "channel_type": "production_house", "languages": ["Telugu"], "priority": 8},
        {"channel_name": "14 Reels Plus", "channel_id": "UC7P5-b4R9zqxhL6TCaGIIvQ", "channel_type": "production_house", "languages": ["Telugu"], "priority": 7},
        
        # Telugu - Popular Channels
        {"channel_name": "Mango Telugu Cinema", "channel_id": "UCNApqoVYJbYSrni8YsbHbmA", "channel_type": "popular_channel", "languages": ["Telugu"], "priority": 8},
        {"channel_name": "Telugu Filmnagar", "channel_id": "UCCp2mSpCAwc01DUrfMjv_qg", "channel_type": "popular_channel", "languages": ["Telugu"], "priority": 7},
        {"channel_name": "iDream Telugu Movies", "channel_id": "UCfMAvufcxvLFqEWE4pQFbJA", "channel_type": "popular_channel", "languages": ["Telugu"], "priority": 6},
        
        # Tamil - Music Labels
        {"channel_name": "Think Music India", "channel_id": "UCpPzPdxvFjPvDwwbQAJWkvw", "channel_type": "music_label", "languages": ["Tamil"], "priority": 10},
        {"channel_name": "Sun Music", "channel_id": "UCOVpmZr1b-gELzQQ8bGIEDg", "channel_type": "music_label", "languages": ["Tamil"], "priority": 9},
        {"channel_name": "Divo Music", "channel_id": "UCosgJD9D5jvXYzKHuZ9xqtw", "channel_type": "music_label", "languages": ["Tamil"], "priority": 8},
        
        # Tamil - Production Houses
        {"channel_name": "Lyca Productions", "channel_id": "UCqOO_AkI8Y71cjF3FzHzF0g", "channel_type": "production_house", "languages": ["Tamil"], "priority": 10},
        {"channel_name": "Sun Pictures", "channel_id": "UCqXqU8i9a4vTQx5Q9uUq7oQ", "channel_type": "production_house", "languages": ["Tamil"], "priority": 9},
        {"channel_name": "AGS Entertainment", "channel_id": "UC3r4eQ15tFXEoJjOw6iE65A", "channel_type": "production_house", "languages": ["Tamil"], "priority": 8},
        {"channel_name": "Red Giant Movies", "channel_id": "UCJLhHhBdN3qZZ8R3XPz8kfQ", "channel_type": "production_house", "languages": ["Tamil"], "priority": 8},
        {"channel_name": "Raaj Kamal Films International", "channel_id": "UClAaZD7wuWqVRjn7hdQn8wA", "channel_type": "production_house", "languages": ["Tamil"], "priority": 8},
        
        # Kannada
        {"channel_name": "Hombale Films", "channel_id": "UCFvPmMl1CJILCqnG-MhUHwQ", "channel_type": "production_house", "languages": ["Kannada"], "priority": 10},
        {"channel_name": "Anand Audio", "channel_id": "UCwPXVxCnx7VnFTBhpH7-8Ng", "channel_type": "music_label", "languages": ["Kannada"], "priority": 9},
        {"channel_name": "Zee Kannada", "channel_id": "UCpuP3PD_BTHM2g5gJgMy8hg", "channel_type": "popular_channel", "languages": ["Kannada"], "priority": 7},
        
        # Malayalam
        {"channel_name": "Muzik247", "channel_id": "UCxyozfLfYidHp6BSvQtMCnA", "channel_type": "music_label", "languages": ["Malayalam"], "priority": 9},
        {"channel_name": "Goodwill Entertainments", "channel_id": "UChFwj3M2o6pPukVSa3c0UrQ", "channel_type": "production_house", "languages": ["Malayalam"], "priority": 8},
        {"channel_name": "Aashirvad Cinemas", "channel_id": "UCvvOz3PxZa0cSUzp2G9aY8A", "channel_type": "production_house", "languages": ["Malayalam"], "priority": 8},
        
        # Bengali
        {"channel_name": "SVF", "channel_id": "UCXDGbkl6e-l-8U9NvFqWevA", "channel_type": "production_house", "languages": ["Bengali"], "priority": 9},
        {"channel_name": "Zee Bangla Cinema", "channel_id": "UCFwj8IW3fV3RCvPFJ3Qkcdg", "channel_type": "popular_channel", "languages": ["Bengali"], "priority": 7},
        
        # Marathi
        {"channel_name": "Zee Marathi", "channel_id": "UCa0k7vLAE79vPvw5XVdRMJQ", "channel_type": "popular_channel", "languages": ["Marathi"], "priority": 8},
        
        # Multi-language
        {"channel_name": "Goldmines", "channel_id": "UCyoXW-Dse7fURq30EWl_CUA", "channel_type": "popular_channel", "languages": ["Hindi", "Telugu", "Tamil", "Multi"], "priority": 8},
    ]
    
    created = 0
    skipped = 0
    
    for channel_data in default_channels:
        existing = db[YOUTUBE_CHANNELS].find_one({"channel_name": {"$regex": f"^{channel_data['channel_name']}$", "$options": "i"}})
        if existing:
            skipped += 1
            continue
        
        now = datetime.utcnow()
        channel_doc = {
            "id": str(uuid.uuid4()),
            "channel_name": channel_data["channel_name"],
            "channel_id": None,
            "channel_type": channel_data["channel_type"],
            "languages": channel_data["languages"],
            "is_active": True,
            "priority": channel_data["priority"],
            "created_at": now,
            "updated_at": now
        }
        db[YOUTUBE_CHANNELS].insert_one(channel_doc)
        created += 1
    
    return {"message": f"Seeded {created} channels, skipped {skipped} existing"}
