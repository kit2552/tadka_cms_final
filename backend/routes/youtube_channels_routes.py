"""
YouTube Channels Routes - Manage official YouTube channels for video agent
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
import httpx
import re

from database import get_db, db

router = APIRouter(prefix="/youtube-channels", tags=["YouTube Channels"])

# RSS URL template
RSS_URL_TEMPLATE = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

# Pydantic models
class YouTubeChannelCreate(BaseModel):
    channel_name: str
    channel_id: Optional[str] = None  # YouTube channel ID
    rss_url: Optional[str] = None  # RSS feed URL
    channel_type: str  # production_house, music_label, popular_channel, movie_channel, news_channel, tv_channel, reality_show
    languages: List[str] = []  # Languages this channel covers
    is_active: bool = True
    fetch_videos: bool = True  # Fetch regular videos
    fetch_shorts: bool = False  # Fetch YouTube Shorts

class YouTubeChannelUpdate(BaseModel):
    channel_name: Optional[str] = None
    channel_id: Optional[str] = None
    rss_url: Optional[str] = None
    channel_type: Optional[str] = None
    languages: Optional[List[str]] = None
    is_active: Optional[bool] = None
    fetch_videos: Optional[bool] = None
    fetch_shorts: Optional[bool] = None

class YouTubeChannelResponse(BaseModel):
    id: str
    channel_name: str
    channel_id: Optional[str] = None
    rss_url: Optional[str] = None
    channel_type: str
    languages: List[str]
    is_active: bool
    fetch_videos: bool = True
    fetch_shorts: bool = False
    created_at: datetime
    updated_at: datetime

class ChannelURLRequest(BaseModel):
    url: str

class ChannelDetailsResponse(BaseModel):
    channel_id: str
    channel_name: str
    rss_url: str
    thumbnail: Optional[str] = None
    description: Optional[str] = None

# Collection name
YOUTUBE_CHANNELS = "youtube_channels"


@router.post("/extract-details")
async def extract_channel_details(request: ChannelURLRequest):
    """Extract channel ID, name, and RSS URL from any YouTube channel URL
    
    Supports formats:
    - https://www.youtube.com/channel/UC...
    - https://www.youtube.com/@handle
    - https://www.youtube.com/user/username
    - https://www.youtube.com/c/customname
    - Direct channel ID (UC...)
    """
    url = request.url.strip()
    channel_id = None
    channel_name = None
    
    # Pattern 1: Direct channel ID (starts with UC)
    if url.startswith('UC') and len(url) == 24:
        channel_id = url
    
    # Pattern 2: Full channel URL with /channel/
    elif '/channel/' in url:
        match = re.search(r'/channel/(UC[a-zA-Z0-9_-]{22})', url)
        if match:
            channel_id = match.group(1)
    
    # Pattern 3: Handle URL (@username)
    elif '/@' in url or url.startswith('@'):
        handle = re.search(r'@([a-zA-Z0-9_-]+)', url)
        if handle:
            handle_name = handle.group(1)
            # Need to fetch the page to get channel ID
            channel_id = await _get_channel_id_from_handle(f"@{handle_name}")
    
    # Pattern 4: /user/ URL
    elif '/user/' in url:
        match = re.search(r'/user/([a-zA-Z0-9_-]+)', url)
        if match:
            username = match.group(1)
            channel_id = await _get_channel_id_from_handle(f"user/{username}")
    
    # Pattern 5: /c/ custom URL
    elif '/c/' in url:
        match = re.search(r'/c/([a-zA-Z0-9_-]+)', url)
        if match:
            custom_name = match.group(1)
            channel_id = await _get_channel_id_from_handle(f"c/{custom_name}")
    
    # Pattern 6: Just a handle without @
    elif not url.startswith('http'):
        channel_id = await _get_channel_id_from_handle(f"@{url}")
    
    if not channel_id:
        raise HTTPException(status_code=400, detail="Could not extract channel ID from URL. Please provide a valid YouTube channel URL.")
    
    # Generate RSS URL
    rss_url = RSS_URL_TEMPLATE.format(channel_id=channel_id)
    
    # Try to get channel name from RSS feed
    channel_name = await _get_channel_name_from_rss(rss_url)
    
    if not channel_name:
        channel_name = f"Channel {channel_id[-8:]}"
    
    return {
        "channel_id": channel_id,
        "channel_name": channel_name,
        "rss_url": rss_url
    }


async def _get_channel_id_from_handle(handle_path: str) -> Optional[str]:
    """Fetch channel ID by scraping YouTube page"""
    try:
        if handle_path.startswith('@'):
            url = f"https://www.youtube.com/{handle_path}"
        elif handle_path.startswith('user/') or handle_path.startswith('c/'):
            url = f"https://www.youtube.com/{handle_path}"
        else:
            url = f"https://www.youtube.com/@{handle_path}"
        
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            if response.status_code != 200:
                return None
            
            html = response.text
            
            # Pattern 1: "browseId":"UC..." - Most reliable for the actual channel
            match = re.search(r'"browseId":"(UC[a-zA-Z0-9_-]{22})"', html)
            if match:
                return match.group(1)
            
            # Pattern 2: canonical link with /channel/UC...
            match = re.search(r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[a-zA-Z0-9_-]{22})"', html)
            if match:
                return match.group(1)
            
            # Pattern 3: "externalId":"UC..." (for the main channel)
            match = re.search(r'"externalId":"(UC[a-zA-Z0-9_-]{22})"', html)
            if match:
                return match.group(1)
            
            # Pattern 4: /channel/UC... in canonical URL meta tag
            match = re.search(r'content="https://www\.youtube\.com/channel/(UC[a-zA-Z0-9_-]{22})"', html)
            if match:
                return match.group(1)
            
            # Pattern 5: "channelId":"UC..." - Less reliable as it may match recommended channels
            match = re.search(r'"channelId":"(UC[a-zA-Z0-9_-]{22})"', html)
            if match:
                return match.group(1)
            
            return None
            
    except Exception as e:
        print(f"Error fetching channel ID: {e}")
        return None


async def _get_channel_name_from_rss(rss_url: str) -> Optional[str]:
    """Get channel name from RSS feed"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(rss_url)
            
            if response.status_code != 200:
                return None
            
            # Parse XML to get channel title
            import xml.etree.ElementTree as ET
            root = ET.fromstring(response.text)
            
            # Find title element
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            title_elem = root.find('atom:title', ns)
            
            if title_elem is not None and title_elem.text:
                return title_elem.text
            
            return None
            
    except Exception as e:
        print(f"Error fetching channel name: {e}")
        return None


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
    
    channels = list(db[YOUTUBE_CHANNELS].find(query, {"_id": 0}).sort("channel_name", 1))
    return channels

@router.post("", response_model=YouTubeChannelResponse)
async def create_youtube_channel(channel: YouTubeChannelCreate):
    """Create a new YouTube channel"""
    # Check if channel already exists
    existing = db[YOUTUBE_CHANNELS].find_one({"channel_name": {"$regex": f"^{channel.channel_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Channel already exists")
    
    # Generate RSS URL if not provided but channel_id exists
    rss_url = channel.rss_url
    if not rss_url and channel.channel_id:
        rss_url = RSS_URL_TEMPLATE.format(channel_id=channel.channel_id)
    
    # Determine default fetch_shorts based on channel type
    fetch_shorts = channel.fetch_shorts
    if channel.channel_type in ['tv_channel', 'music_label']:
        fetch_shorts = True  # Enable shorts by default for TV and Music channels
    
    now = datetime.utcnow()
    channel_doc = {
        "id": str(uuid.uuid4()),
        "channel_name": channel.channel_name,
        "channel_id": channel.channel_id,
        "rss_url": rss_url,
        "channel_type": channel.channel_type,
        "languages": channel.languages,
        "is_active": channel.is_active,
        "fetch_videos": channel.fetch_videos,
        "fetch_shorts": fetch_shorts,
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
    
    # Generate RSS URL if channel_id is being updated
    if 'channel_id' in update_data and update_data['channel_id']:
        update_data['rss_url'] = RSS_URL_TEMPLATE.format(channel_id=update_data['channel_id'])
    
    db[YOUTUBE_CHANNELS].update_one({"id": channel_id}, {"$set": update_data})
    
    # Also update channel_type and languages in youtube_videos collection if changed
    video_update_data = {}
    if 'channel_type' in update_data:
        video_update_data['channel_type'] = update_data['channel_type']
    if 'languages' in update_data:
        video_update_data['languages'] = update_data['languages']
    if 'channel_name' in update_data:
        video_update_data['channel_name'] = update_data['channel_name']
    
    if video_update_data:
        # Get the YouTube channel_id to update videos
        yt_channel_id = update_data.get('channel_id') or existing.get('channel_id')
        if yt_channel_id:
            db.youtube_videos.update_many(
                {"channel_id": yt_channel_id},
                {"$set": video_update_data}
            )
            print(f"Updated {video_update_data} for videos with channel_id: {yt_channel_id}")
    
    updated = db[YOUTUBE_CHANNELS].find_one({"id": channel_id}, {"_id": 0})
    return updated

@router.delete("/{channel_id}")
async def delete_youtube_channel(channel_id: str):
    """Delete a YouTube channel"""
    result = db[YOUTUBE_CHANNELS].delete_one({"id": channel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"message": "Channel deleted successfully"}


@router.post("/sync-video-metadata")
async def sync_video_metadata():
    """Sync channel metadata (type, languages, name) from youtube_channels to youtube_videos"""
    channels = list(db[YOUTUBE_CHANNELS].find({}, {"_id": 0}))
    updated_count = 0
    
    for channel in channels:
        yt_channel_id = channel.get('channel_id')
        if not yt_channel_id:
            continue
        
        update_data = {
            'channel_type': channel.get('channel_type'),
            'languages': channel.get('languages', []),
            'channel_name': channel.get('channel_name')
        }
        
        result = db.youtube_videos.update_many(
            {"channel_id": yt_channel_id},
            {"$set": update_data}
        )
        updated_count += result.modified_count
    
    return {
        "message": f"Synced metadata for {updated_count} videos from {len(channels)} channels",
        "channels_processed": len(channels),
        "videos_updated": updated_count
    }


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
            {"value": "popular_channel", "label": "Popular YouTube Channel"},
            {"value": "movie_channel", "label": "Movie Channel"},
            {"value": "news_channel", "label": "News Channel"},
            {"value": "tv_channel", "label": "TV Channel"},
            {"value": "reality_show", "label": "Reality Show"}
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
            "channel_id": channel_data.get("channel_id"),  # Include channel ID from seed data
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


@router.post("/seed-extended")
async def seed_extended_channels():
    """Seed additional channels: Movie Channels, News Channels, TV Channels, Reality Shows"""
    extended_channels = [
        # ========== MOVIE CHANNELS (Full Length Movies) ==========
        # Hindi Movie Channels
        {"channel_name": "Goldmines", "channel_id": "UCyoXW-Dse7fURq30EWl_CUA", "channel_type": "movie_channel", "languages": ["Hindi", "Multi"], "priority": 10},
        {"channel_name": "Goldmines Telefilms", "channel_id": "UCXIcN2C8xgmvuOtX1v0FENw", "channel_type": "movie_channel", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Shemaroo Movies", "channel_id": "UCF1JIbMUs6uqoZEY1Haw0GQ", "channel_type": "movie_channel", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Ultra Movie Parlour", "channel_id": "UCo76UeCi9ybV13rPzMqfYdA", "channel_type": "movie_channel", "languages": ["Hindi"], "priority": 8},
        {"channel_name": "NH Studioz", "channel_id": "UC_p5HFAGmIL8aPnAvU3M8kQ", "channel_type": "movie_channel", "languages": ["Hindi"], "priority": 8},
        {"channel_name": "Rajshri", "channel_id": "UCFxWkWH5zSTJtLO4CXhvP5A", "channel_type": "movie_channel", "languages": ["Hindi"], "priority": 8},
        {"channel_name": "Pen Movies", "channel_id": "UCPTxuUK-VJk56IYNpHb4xYg", "channel_type": "movie_channel", "languages": ["Hindi"], "priority": 8},
        
        # Telugu Movie Channels
        {"channel_name": "Mango Telugu Cinema", "channel_id": "UCqOQ9xBq0_ubrXQlnM_n8Yw", "channel_type": "movie_channel", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "Telugu FilmNagar", "channel_id": "UCnJjcn5FrgrOEp5_N45ZLEQ", "channel_type": "movie_channel", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "iDream Telugu Movies", "channel_id": "UCfMAvufcxvLFqEWE4pQFbJA", "channel_type": "movie_channel", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "Telugu Full Movies", "channel_id": "UC5Z3tJLfrL-V-Rv7tRgJvWw", "channel_type": "movie_channel", "languages": ["Telugu"], "priority": 8},
        {"channel_name": "Sri Balaji Full Movies", "channel_id": "UCgYhw8dR4VB6G2u58vIlmqQ", "channel_type": "movie_channel", "languages": ["Telugu"], "priority": 8},
        
        # Tamil Movie Channels
        {"channel_name": "Tamil Full Movies", "channel_id": "UCpLKMt_S6h_Q3CtFJlMoiUA", "channel_type": "movie_channel", "languages": ["Tamil"], "priority": 9},
        {"channel_name": "AP International", "channel_id": "UCWGFb3hJQV8VKpK5J6ZJrpA", "channel_type": "movie_channel", "languages": ["Tamil"], "priority": 8},
        
        # Kannada Movie Channels
        {"channel_name": "Kannada Full Movies", "channel_id": "UCYr3u4v6jT3R0kZ0R5U5r5Q", "channel_type": "movie_channel", "languages": ["Kannada"], "priority": 8},
        
        # Malayalam Movie Channels
        {"channel_name": "Malayalam Full Movies", "channel_id": "UCXDGbkl6e-l-8U9NvFqWevA", "channel_type": "movie_channel", "languages": ["Malayalam"], "priority": 8},
        
        # ========== NEWS CHANNELS ==========
        # National News Channels
        {"channel_name": "NDTV", "channel_id": "UCttspZesZIDEwwpVIgoZtWQ", "channel_type": "news_channel", "languages": ["Hindi", "English"], "priority": 10},
        {"channel_name": "India Today", "channel_id": "UCYPvAwZP8pZhSMW8qs7cVCw", "channel_type": "news_channel", "languages": ["English"], "priority": 10},
        {"channel_name": "Aaj Tak", "channel_id": "UCt4t-jeY85JegMlZ-E5UWtA", "channel_type": "news_channel", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "ABP News", "channel_id": "UCRWFSbif-RFENbBrSiez1DA", "channel_type": "news_channel", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Zee News", "channel_id": "UCIvaYmXn910QMdemBG3v1pQ", "channel_type": "news_channel", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Republic World", "channel_id": "UCwqusr8YDwM-0SFcDPDrVOQ", "channel_type": "news_channel", "languages": ["English"], "priority": 9},
        {"channel_name": "Times Now", "channel_id": "UCHoxB8YJhG_p6FckBfjIDqA", "channel_type": "news_channel", "languages": ["English"], "priority": 9},
        {"channel_name": "News18 India", "channel_id": "UCaq1lGsphbqKxCezpgbshLg", "channel_type": "news_channel", "languages": ["Hindi"], "priority": 8},
        {"channel_name": "DD News", "channel_id": "UCGzA5R8HscSPLXCYWj_yXHA", "channel_type": "news_channel", "languages": ["Hindi", "English"], "priority": 8},
        {"channel_name": "WION", "channel_id": "UC_gUM8rL-Lrg6O3adPW9K1g", "channel_type": "news_channel", "languages": ["English"], "priority": 8},
        
        # Telugu News Channels
        {"channel_name": "TV9 Telugu", "channel_id": "UC3Zs7WxhODGGjgtL3ufP7pQ", "channel_type": "news_channel", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "NTV Telugu", "channel_id": "UCumtGkPBapFxHK4gDw6KJdQ", "channel_type": "news_channel", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "ABN Telugu", "channel_id": "UCC8WgKCu8rS7r88V4V5n-aQ", "channel_type": "news_channel", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "Sakshi TV", "channel_id": "UCB_IQoXVm3aJo9YCLVX-6Ug", "channel_type": "news_channel", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "V6 News Telugu", "channel_id": "UCWaibMqSPG_MxEEf4cJEu-Q", "channel_type": "news_channel", "languages": ["Telugu"], "priority": 8},
        {"channel_name": "10TV Telugu", "channel_id": "UCbVH3X00_Y89sEMUEuM-WPw", "channel_type": "news_channel", "languages": ["Telugu"], "priority": 8},
        {"channel_name": "ETV Andhra Pradesh", "channel_id": "UCPVuQHVF8JJh7TwGAHw2WJQ", "channel_type": "news_channel", "languages": ["Telugu"], "priority": 8},
        
        # Tamil News Channels
        {"channel_name": "Sun News", "channel_id": "UC2Bjr0F_uKPrdeTjsGWFqXQ", "channel_type": "news_channel", "languages": ["Tamil"], "priority": 10},
        {"channel_name": "Thanthi TV", "channel_id": "UCqOQ9xBq0_ubrXQlnM_n8Yw", "channel_type": "news_channel", "languages": ["Tamil"], "priority": 9},
        {"channel_name": "Puthiya Thalaimurai TV", "channel_id": "UCuGCjJw5pBfqHqL7pKsIqbQ", "channel_type": "news_channel", "languages": ["Tamil"], "priority": 9},
        {"channel_name": "Polimer News", "channel_id": "UC_sjLNVAy38y4N3IgexLx3g", "channel_type": "news_channel", "languages": ["Tamil"], "priority": 8},
        
        # Kannada News Channels
        {"channel_name": "TV9 Kannada", "channel_id": "UCrJsqhA97NUMIaKP9ftqHjQ", "channel_type": "news_channel", "languages": ["Kannada"], "priority": 10},
        {"channel_name": "Public TV", "channel_id": "UCpuP3PD_BTHM2g5gJgMy8hg", "channel_type": "news_channel", "languages": ["Kannada"], "priority": 9},
        
        # Malayalam News Channels
        {"channel_name": "Asianet News", "channel_id": "UCj-Z8fNjtwdqTl3Fhz7_Rdg", "channel_type": "news_channel", "languages": ["Malayalam"], "priority": 10},
        {"channel_name": "Manorama News", "channel_id": "UCiyIpTN1Ll57cjLRbdgLGZA", "channel_type": "news_channel", "languages": ["Malayalam"], "priority": 10},
        {"channel_name": "Mathrubhumi News", "channel_id": "UCzz4coGljuvHqGH65KPd4LA", "channel_type": "news_channel", "languages": ["Malayalam"], "priority": 9},
        
        # Bengali News Channels
        {"channel_name": "ABP Ananda", "channel_id": "UCgNgBBiWDwKINLmqnpUz6_A", "channel_type": "news_channel", "languages": ["Bengali"], "priority": 9},
        {"channel_name": "Zee 24 Ghanta", "channel_id": "UC_wKoBgrNEMFi49WEgCpn8A", "channel_type": "news_channel", "languages": ["Bengali"], "priority": 9},
        
        # Marathi News Channels  
        {"channel_name": "ABP Majha", "channel_id": "UCYJLVxPsCAaXaWQrEXOoq0w", "channel_type": "news_channel", "languages": ["Marathi"], "priority": 9},
        {"channel_name": "TV9 Marathi", "channel_id": "UCzNxdLbjI5k_GWE8hxRqKZA", "channel_type": "news_channel", "languages": ["Marathi"], "priority": 9},
        
        # ========== TV CHANNELS (Entertainment & Serials) ==========
        # Hindi TV Channels
        {"channel_name": "SET India", "channel_id": "UCpEhnqL0y41EpW2TvWAHD7Q", "channel_type": "tv_channel", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "Colors TV", "channel_id": "UCZf2Rs32KraSORu3-1rnitw", "channel_type": "tv_channel", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "Zee TV", "channel_id": "UC5hwFk32SbqUGNxFN-pRLUQ", "channel_type": "tv_channel", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "Star Plus", "channel_id": "UCiyIp5R_U2YfqgGvNapXFdg", "channel_type": "tv_channel", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "SAB TV", "channel_id": "UC6-F5tO8uklgE9Zy8IvbdFw", "channel_type": "tv_channel", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Star Bharat", "channel_id": "UCqJfVYA4cWsUcR8xd4VqLKw", "channel_type": "tv_channel", "languages": ["Hindi"], "priority": 8},
        
        # Telugu TV Channels
        {"channel_name": "Star Maa", "channel_id": "UC8Chy6L5M5Fh_UBWZ-Y1TeA", "channel_type": "tv_channel", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "Zee Telugu", "channel_id": "UCHpUvMRSQccdpYG1cWLBu5Q", "channel_type": "tv_channel", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "Gemini TV", "channel_id": "UC5Z3tJLfrL-V-Rv7tRgJvWw", "channel_type": "tv_channel", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "ETV Telugu", "channel_id": "UCPVuQHVF8JJh7TwGAHw2WJQ", "channel_type": "tv_channel", "languages": ["Telugu"], "priority": 9},
        
        # Tamil TV Channels
        {"channel_name": "Sun TV", "channel_id": "UC5Sb_aSSqyHQ8E34yQ6HLiA", "channel_type": "tv_channel", "languages": ["Tamil"], "priority": 10},
        {"channel_name": "Zee Tamil", "channel_id": "UC0MfxNJhzwBmwgI0MYNcdwQ", "channel_type": "tv_channel", "languages": ["Tamil"], "priority": 10},
        {"channel_name": "Star Vijay", "channel_id": "UCiPPAOa1I2CUJKXhHoTbmug", "channel_type": "tv_channel", "languages": ["Tamil"], "priority": 10},
        {"channel_name": "Colors Tamil", "channel_id": "UCi7HmjqD9MU4P_1-mJp4-VQ", "channel_type": "tv_channel", "languages": ["Tamil"], "priority": 9},
        
        # Kannada TV Channels
        {"channel_name": "Zee Kannada", "channel_id": "UCqxf4Y2uHj1RuGVhQWbZspQ", "channel_type": "tv_channel", "languages": ["Kannada"], "priority": 10},
        {"channel_name": "Colors Kannada", "channel_id": "UCRPiF1L2qBLIefBXWqjPNzQ", "channel_type": "tv_channel", "languages": ["Kannada"], "priority": 9},
        {"channel_name": "Star Suvarna", "channel_id": "UC5q3JgIwWrFnJP0hADPdDKA", "channel_type": "tv_channel", "languages": ["Kannada"], "priority": 9},
        
        # Malayalam TV Channels
        {"channel_name": "Asianet", "channel_id": "UCj2d_8sZQgrPJaKkdWKcT5A", "channel_type": "tv_channel", "languages": ["Malayalam"], "priority": 10},
        {"channel_name": "Zee Keralam", "channel_id": "UCv3BnBGlmWJVzRhCdJHjdBA", "channel_type": "tv_channel", "languages": ["Malayalam"], "priority": 9},
        {"channel_name": "Mazhavil Manorama", "channel_id": "UCqppS4-VaFvq1NC9HjLWo2A", "channel_type": "tv_channel", "languages": ["Malayalam"], "priority": 9},
        
        # Bengali TV Channels
        {"channel_name": "Zee Bangla", "channel_id": "UCOTFy5fZ09U6RPgvPk_-f3g", "channel_type": "tv_channel", "languages": ["Bengali"], "priority": 10},
        {"channel_name": "Star Jalsha", "channel_id": "UC2ksXQEiVlFYt1xMWWZJ8_w", "channel_type": "tv_channel", "languages": ["Bengali"], "priority": 9},
        {"channel_name": "Colors Bangla", "channel_id": "UCTd0kCZz8jSZCr-1-T79wKQ", "channel_type": "tv_channel", "languages": ["Bengali"], "priority": 9},
        
        # Marathi TV Channels
        {"channel_name": "Zee Marathi", "channel_id": "UCVJpR7SQnBwjzLqhaMBrX5g", "channel_type": "tv_channel", "languages": ["Marathi"], "priority": 10},
        {"channel_name": "Colors Marathi", "channel_id": "UCyDl3TgKCP7PCvl-qMPqFWQ", "channel_type": "tv_channel", "languages": ["Marathi"], "priority": 9},
        {"channel_name": "Star Pravah", "channel_id": "UCnF46TWTJS6P2a1opZ5gIiQ", "channel_type": "tv_channel", "languages": ["Marathi"], "priority": 9},
        
        # ========== REALITY SHOWS ==========
        # Hindi Reality Shows
        {"channel_name": "Indian Idol", "channel_id": "UCpEhnqL0y41EpW2TvWAHD7Q", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "Bigg Boss", "channel_id": "UCZf2Rs32KraSORu3-1rnitw", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 10},
        {"channel_name": "Khatron Ke Khiladi", "channel_id": "UCZf2Rs32KraSORu3-1rnitw", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Dance India Dance", "channel_id": "UC5hwFk32SbqUGNxFN-pRLUQ", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "The Kapil Sharma Show", "channel_id": "UCpEhnqL0y41EpW2TvWAHD7Q", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Kaun Banega Crorepati", "channel_id": "UCpEhnqL0y41EpW2TvWAHD7Q", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 9},
        {"channel_name": "Sa Re Ga Ma Pa", "channel_id": "UC5hwFk32SbqUGNxFN-pRLUQ", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 8},
        {"channel_name": "Super Dancer", "channel_id": "UCpEhnqL0y41EpW2TvWAHD7Q", "channel_type": "reality_show", "languages": ["Hindi"], "priority": 8},
        
        # Telugu Reality Shows
        {"channel_name": "Bigg Boss Telugu", "channel_id": "UC8Chy6L5M5Fh_UBWZ-Y1TeA", "channel_type": "reality_show", "languages": ["Telugu"], "priority": 10},
        {"channel_name": "Telugu Indian Idol", "channel_id": "UCgYTqPLJG9kEEo1OdWpBHPg", "channel_type": "reality_show", "languages": ["Telugu"], "priority": 9},
        {"channel_name": "Sa Re Ga Ma Pa Telugu", "channel_id": "UCHpUvMRSQccdpYG1cWLBu5Q", "channel_type": "reality_show", "languages": ["Telugu"], "priority": 8},
        
        # Tamil Reality Shows
        {"channel_name": "Bigg Boss Tamil", "channel_id": "UCiPPAOa1I2CUJKXhHoTbmug", "channel_type": "reality_show", "languages": ["Tamil"], "priority": 10},
        {"channel_name": "Super Singer", "channel_id": "UCiPPAOa1I2CUJKXhHoTbmug", "channel_type": "reality_show", "languages": ["Tamil"], "priority": 9},
        
        # Kannada Reality Shows
        {"channel_name": "Bigg Boss Kannada", "channel_id": "UCRPiF1L2qBLIefBXWqjPNzQ", "channel_type": "reality_show", "languages": ["Kannada"], "priority": 10},
        
        # Malayalam Reality Shows
        {"channel_name": "Bigg Boss Malayalam", "channel_id": "UCj2d_8sZQgrPJaKkdWKcT5A", "channel_type": "reality_show", "languages": ["Malayalam"], "priority": 10},
    ]
    
    created = 0
    skipped = 0
    updated = 0
    
    for channel_data in extended_channels:
        # Check if channel exists by name
        existing = db[YOUTUBE_CHANNELS].find_one({
            "channel_name": {"$regex": f"^{channel_data['channel_name']}$", "$options": "i"}
        })
        
        if existing:
            # Update to new type if it's a more specific type
            if existing.get('channel_type') in ['popular_channel'] and channel_data['channel_type'] in ['movie_channel', 'news_channel', 'tv_channel', 'reality_show']:
                db[YOUTUBE_CHANNELS].update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"channel_type": channel_data["channel_type"], "updated_at": datetime.utcnow()}}
                )
                updated += 1
            else:
                skipped += 1
            continue
        
        now = datetime.utcnow()
        channel_doc = {
            "id": str(uuid.uuid4()),
            "channel_name": channel_data["channel_name"],
            "channel_id": channel_data.get("channel_id"),
            "channel_type": channel_data["channel_type"],
            "languages": channel_data["languages"],
            "is_active": True,
            "priority": channel_data["priority"],
            "created_at": now,
            "updated_at": now
        }
        db[YOUTUBE_CHANNELS].insert_one(channel_doc)
        created += 1
    
    return {"message": f"Created {created} channels, updated {updated}, skipped {skipped} existing"}
