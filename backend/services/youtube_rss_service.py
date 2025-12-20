"""
YouTube RSS Feed Service
Fetches videos from YouTube channels via RSS feeds (no API quota usage)
Stores videos in youtube_videos collection for Video Agent to use
"""

import httpx
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import re

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

class YouTubeRSSService:
    """Service for fetching YouTube videos via RSS feeds"""
    
    # RSS feed URL template
    RSS_URL_TEMPLATE = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    
    # XML namespaces used in YouTube RSS
    NAMESPACES = {
        'atom': 'http://www.w3.org/2005/Atom',
        'yt': 'http://www.youtube.com/xml/schemas/2015',
        'media': 'http://search.yahoo.com/mrss/'
    }
    
    def __init__(self):
        self.is_running = False
    
    async def fetch_channel_rss(self, channel_id: str, channel_name: str, channel_type: str, languages: List[str], rss_url: Optional[str] = None) -> List[Dict]:
        """Fetch videos from a single channel's RSS feed
        
        Args:
            channel_id: YouTube channel ID
            channel_name: Name of the channel
            channel_type: Type (production_house, music_label, popular_channel, etc.)
            languages: Languages this channel covers
            rss_url: Pre-stored RSS URL (optional, will be generated if not provided)
        
        Returns:
            List of video dictionaries
        """
        # Use stored rss_url if available, otherwise generate from channel_id
        url = rss_url if rss_url else self.RSS_URL_TEMPLATE.format(channel_id=channel_id)
        videos = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                
                if response.status_code != 200:
                    print(f"❌ RSS fetch failed for {channel_name}: HTTP {response.status_code}")
                    return []
                
                # Parse XML
                root = ET.fromstring(response.text)
                
                # Find all entry elements (videos)
                entries = root.findall('atom:entry', self.NAMESPACES)
                
                for entry in entries:
                    try:
                        # Extract video ID
                        video_id_elem = entry.find('yt:videoId', self.NAMESPACES)
                        if video_id_elem is None:
                            continue
                        video_id = video_id_elem.text
                        
                        # Extract title
                        title_elem = entry.find('atom:title', self.NAMESPACES)
                        title = title_elem.text if title_elem is not None else ""
                        
                        # Extract published date
                        published_elem = entry.find('atom:published', self.NAMESPACES)
                        published_at = published_elem.text if published_elem is not None else ""
                        
                        # Extract updated date
                        updated_elem = entry.find('atom:updated', self.NAMESPACES)
                        updated_at = updated_elem.text if updated_elem is not None else ""
                        
                        # Extract link
                        link_elem = entry.find('atom:link', self.NAMESPACES)
                        video_url = link_elem.get('href') if link_elem is not None else f"https://www.youtube.com/watch?v={video_id}"
                        
                        # Extract media group for thumbnail and description
                        media_group = entry.find('media:group', self.NAMESPACES)
                        thumbnail = ""
                        description = ""
                        
                        if media_group is not None:
                            # Get thumbnail
                            thumb_elem = media_group.find('media:thumbnail', self.NAMESPACES)
                            if thumb_elem is not None:
                                thumbnail = thumb_elem.get('url', '')
                            
                            # Get description
                            desc_elem = media_group.find('media:description', self.NAMESPACES)
                            if desc_elem is not None:
                                description = desc_elem.text or ""
                        
                        # Try to detect language from title/description
                        detected_language = self._detect_language(title, description, languages)
                        
                        # Detect video category from title
                        detected_category = self._detect_video_category(title, description, video_url)
                        
                        # Check if video is a YouTube Short
                        title_lower = title.lower()
                        is_short = (
                            '/shorts/' in video_url or 
                            '#shorts' in title_lower or 
                            '#short' in title_lower or
                            detected_category == 'Shorts'
                        )
                        
                        # Filter out Shorts for news, production house, music label, popular channels, reality shows
                        if channel_type in ['news_channel', 'production_house', 'music_label', 'popular_channel', 'reality_show']:
                            if is_short:
                                continue  # Skip Shorts for these channel types
                        
                        # For movie_channel type, only keep full-length movies
                        if channel_type == 'movie_channel':
                            if detected_category != 'Full Movie':
                                # Check if title suggests it's a full movie
                                is_full_movie = any(kw in title_lower for kw in [
                                    'full movie', 'full film', 'complete movie', 'hd movie',
                                    'superhit movie', 'blockbuster movie', 'latest movie'
                                ])
                                # Skip shorts, trailers, promos, songs etc
                                is_not_movie = any(kw in title_lower for kw in [
                                    'trailer', 'teaser', 'promo', 'song', 'scene', 'clip',
                                    'making', 'behind', 'interview', 'review', 'glimpse',
                                    '#shorts', 'shorts', 'best scenes', 'comedy scenes'
                                ])
                                # Also skip YouTube Shorts
                                if is_short:
                                    is_not_movie = True
                                
                                if is_not_movie or not is_full_movie:
                                    continue  # Skip non-movie content
                                detected_category = 'Full Movie'
                        
                        # Parse published date
                        try:
                            published_datetime = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                        except:
                            published_datetime = datetime.now(timezone.utc)
                        
                        video = {
                            'video_id': video_id,
                            'title': title,
                            'description': description[:1000] if description else "",  # Limit description length
                            'thumbnail': thumbnail,
                            'video_url': video_url,
                            'published_at': published_datetime,
                            'updated_at': updated_at,
                            'channel_id': channel_id,
                            'channel_name': channel_name,
                            'channel_type': channel_type,
                            'languages': languages,
                            'detected_language': detected_language,
                            'detected_category': detected_category,  # New field
                            'fetched_at': datetime.now(timezone.utc),
                            'is_used': False,  # Track if used by video agent
                            'is_skipped': False,  # Track if manually skipped
                            'source': 'rss'
                        }
                        
                        videos.append(video)
                        
                    except Exception as e:
                        print(f"   ⚠️ Error parsing entry: {e}")
                        continue
                
                if videos:
                    print(f"   ✅ {channel_name}: {len(videos)} videos from RSS")
                
                return videos
                
        except Exception as e:
            print(f"❌ RSS error for {channel_name}: {e}")
            return []
    
    def _detect_language(self, title: str, description: str, channel_languages: List[str]) -> str:
        """Try to detect video language from title/description
        
        Falls back to first channel language if detection fails
        """
        text = f"{title} {description}".lower()
        
        # Language detection patterns (basic)
        language_patterns = {
            'Telugu': [r'తెలుగు', r'telugu', r'tollywood'],
            'Tamil': [r'தமிழ்', r'tamil', r'kollywood'],
            'Hindi': [r'हिंदी', r'hindi', r'bollywood'],
            'Kannada': [r'ಕನ್ನಡ', r'kannada', r'sandalwood'],
            'Malayalam': [r'മലയാളം', r'malayalam', r'mollywood'],
            'Bengali': [r'বাংলা', r'bengali', r'bangla'],
            'Marathi': [r'मराठी', r'marathi'],
            'Punjabi': [r'ਪੰਜਾਬੀ', r'punjabi', r'pollywood']
        }
        
        for lang, patterns in language_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return lang
        
        # Fall back to first channel language
        return channel_languages[0] if channel_languages else 'Hindi'
    
    def _detect_video_category(self, title: str, description: str, video_url: str = "") -> str:
        """Detect video category from title, description and URL
        
        Categories: Trailer, Teaser, Song, Events, Interview, Press Meet, 
                   Making Videos, Review, Glimpse or Promos, Shorts, Full Movie, Other
        """
        # First check if it's a YouTube Short by URL
        if video_url and '/shorts/' in video_url:
            return 'Shorts'
        
        text = f"{title} {description}".lower()
        
        # Check for #shorts hashtag in title (common indicator)
        if '#shorts' in text or '#short' in text:
            return 'Shorts'
        
        # Category detection patterns (ordered by priority)
        category_patterns = {
            'Trailer': [r'\btrailer\b', r'\bofficial trailer\b', r'\bmovie trailer\b'],
            'Teaser': [r'\bteaser\b', r'\bofficial teaser\b'],
            'First Look': [r'\bfirst look\b', r'\b1st look\b'],
            'Glimpse or Promos': [r'\bglimpse\b', r'\bpromo\b', r'\bdialogue promo\b', r'\bscene\b', r'\bmotion poster\b'],
            'Song': [r'\bsong\b', r'\blyrical\b', r'\bvideo song\b', r'\bfull song\b', r'\bmusic video\b', r'\bjukebox\b'],
            'Interview': [r'\binterview\b', r'\bexclusive interview\b', r'\bchit chat\b', r'\bconversation\b'],
            'Press Meet': [r'\bpress meet\b', r'\bpressmeet\b', r'\bpress conference\b', r'\bmedia interaction\b'],
            'Events': [r'\bevent\b', r'\blaunch\b', r'\bpre-release\b', r'\bprerelease\b', r'\baudio launch\b', 
                     r'\bsuccess meet\b', r'\bcelebration\b', r'\bpromotion\b', r'\bpromo event\b'],
            'Speech': [r'\bspeech\b', r'\baddress\b'],
            'Making Videos': [r'\bbehind the scenes\b', r'\bbts\b', r'\bmaking\b', r'\bon set\b', r'\bmaking of\b'],
            'Review': [r'\breview\b', r'\bpublic talk\b', r'\bpublic response\b', r'\breaction\b'],
            'Full Movie': [r'\bfull movie\b', r'\bcomplete movie\b']
        }
        
        for category, patterns in category_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return category
        
        return 'Other'
    
    async def fetch_all_channels(self) -> Dict:
        """Fetch videos from all active YouTube channels
        
        Returns:
            Dictionary with fetch results
        """
        if self.is_running:
            return {"success": False, "message": "RSS fetch already running"}
        
        self.is_running = True
        print("\n🔄 Starting YouTube RSS Feed Fetch...")
        
        try:
            # Get all active channels with channel_id
            channels = list(db.youtube_channels.find({
                "is_active": True,
                "channel_id": {"$ne": None, "$exists": True}
            }))
            
            if not channels:
                return {
                    "success": False,
                    "message": "No active channels with channel IDs found"
                }
            
            print(f"📺 Fetching RSS from {len(channels)} channels...")
            
            # Create tasks for parallel fetching
            tasks = []
            for channel in channels:
                task = self.fetch_channel_rss(
                    channel_id=channel.get('channel_id'),
                    channel_name=channel.get('channel_name', 'Unknown'),
                    channel_type=channel.get('channel_type', 'unknown'),
                    languages=channel.get('languages', ['Hindi']),
                    rss_url=channel.get('rss_url')  # Use stored RSS URL if available
                )
                tasks.append(task)
            
            # Execute all fetches in parallel (with some rate limiting)
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results and store in database
            total_videos = 0
            new_videos = 0
            updated_videos = 0
            errors = 0
            
            for result in results:
                if isinstance(result, Exception):
                    print(f"   ❌ Task error: {result}")
                    errors += 1
                    continue
                
                for video in result:
                    total_videos += 1
                    
                    # Check if video already exists
                    existing = db.youtube_videos.find_one({'video_id': video['video_id']})
                    
                    if existing:
                        # Update if newer
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
                        # Insert new video
                        db.youtube_videos.insert_one(video)
                        new_videos += 1
            
            # Update last fetch timestamp
            db.system_settings.update_one(
                {"setting_key": "youtube_rss_config"},
                {"$set": {"last_fetch": datetime.now(timezone.utc)}},
                upsert=True
            )
            
            result = {
                "success": True,
                "message": f"RSS fetch complete",
                "channels_fetched": len(channels),
                "total_videos": total_videos,
                "new_videos": new_videos,
                "updated_videos": updated_videos,
                "errors": errors,
                "fetched_at": datetime.now(timezone.utc).isoformat()
            }
            
            print(f"\n✅ RSS Fetch Complete:")
            print(f"   Channels: {len(channels)}")
            print(f"   Total Videos: {total_videos}")
            print(f"   New: {new_videos}, Updated: {updated_videos}, Errors: {errors}")
            
            return result
            
        except Exception as e:
            print(f"❌ RSS fetch error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": str(e)
            }
        finally:
            self.is_running = False
    
    def get_videos_for_agent(
        self,
        channel_types: List[str],
        language: str,
        video_category: str,
        max_videos: int = 10,
        days_ago: int = 7
    ) -> List[Dict]:
        """Get videos from youtube_videos collection for Video Agent
        
        Args:
            channel_types: List of channel types to filter
            language: Language to filter
            video_category: Category for keyword filtering
            max_videos: Maximum videos to return
            days_ago: How many days back to look
        
        Returns:
            List of matching videos
        """
        # Category keywords for filtering
        category_keywords = {
            'trailers_teasers': ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster', 'promo'],
            'trending_videos': ['song', 'video song', 'lyrical', 'full video', 'music video'],
            'events_interviews': ['interview', 'press meet', 'event', 'promotion', 'launch', 'speech'],
            'tadka_shorts': ['shorts', 'reels', 'hot', 'photoshoot']
        }
        
        exclude_keywords = {
            'trailers_teasers': ['reaction', 'review', 'explained', 'scene', 'behind the scenes'],
            'trending_videos': ['reaction', 'cover', 'karaoke', 'instrumental'],
            'events_interviews': ['trailer', 'teaser', 'song'],
            'tadka_shorts': []
        }
        
        # Build query
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_ago)
        
        query = {
            'is_used': False,
            'is_skipped': {'$ne': True},  # Exclude skipped videos
            'published_at': {'$gte': cutoff_date}
        }
        
        # Filter by channel types
        if channel_types:
            query['channel_type'] = {'$in': channel_types}
        
        # Filter by language
        if language:
            # Map language names
            lang_map = {
                'hindi': 'Hindi', 'bollywood': 'Hindi',
                'telugu': 'Telugu', 'tollywood': 'Telugu',
                'tamil': 'Tamil', 'kollywood': 'Tamil',
                'kannada': 'Kannada', 'malayalam': 'Malayalam',
                'bengali': 'Bengali', 'marathi': 'Marathi',
                'punjabi': 'Punjabi'
            }
            db_language = lang_map.get(language.lower(), language)
            query['$or'] = [
                {'languages': db_language},
                {'detected_language': db_language}
            ]
        
        # Fetch videos
        videos = list(
            db.youtube_videos.find(query)
            .sort('published_at', -1)
            .limit(max_videos * 3)  # Fetch more for filtering
        )
        
        # Apply category keyword filtering
        keywords = category_keywords.get(video_category, [])
        excludes = exclude_keywords.get(video_category, [])
        
        filtered_videos = []
        for video in videos:
            title_lower = video.get('title', '').lower()
            
            # Skip if contains exclude keywords
            if any(excl in title_lower for excl in excludes):
                continue
            
            # For trailers/teasers, must have keyword
            if video_category == 'trailers_teasers':
                if not any(kw in title_lower for kw in keywords):
                    continue
            
            # Convert ObjectId to string for JSON serialization
            video['_id'] = str(video['_id'])
            filtered_videos.append(video)
            
            if len(filtered_videos) >= max_videos:
                break
        
        return filtered_videos
    
    def mark_video_as_used(self, video_id: str) -> bool:
        """Mark a video as used by Video Agent"""
        result = db.youtube_videos.update_one(
            {'video_id': video_id},
            {'$set': {'is_used': True, 'used_at': datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0
    
    def mark_video_as_available(self, video_id: str) -> bool:
        """Mark a used video as available again"""
        result = db.youtube_videos.update_one(
            {'video_id': video_id},
            {'$set': {'is_used': False, 'used_at': None}}
        )
        return result.modified_count > 0
    
    def mark_video_as_skipped(self, video_id: str, skipped: bool = True) -> bool:
        """Mark a video as skipped (won't be picked by agent)"""
        result = db.youtube_videos.update_one(
            {'video_id': video_id},
            {'$set': {'is_skipped': skipped, 'skipped_at': datetime.now(timezone.utc) if skipped else None}}
        )
        return result.modified_count > 0
    
    def get_video_counts_by_channel(self) -> List[Dict]:
        """Get video count per channel"""
        pipeline = [
            {
                '$group': {
                    '_id': {
                        'channel_id': '$channel_id',
                        'channel_name': '$channel_name',
                        'channel_type': '$channel_type'
                    },
                    'video_count': {'$sum': 1},
                    'unused_count': {
                        '$sum': {'$cond': [{'$eq': ['$is_used', False]}, 1, 0]}
                    }
                }
            },
            {
                '$project': {
                    '_id': 0,
                    'channel_id': '$_id.channel_id',
                    'channel_name': '$_id.channel_name',
                    'channel_type': '$_id.channel_type',
                    'video_count': 1,
                    'unused_count': 1
                }
            },
            {'$sort': {'video_count': -1}}
        ]
        
        return list(db.youtube_videos.aggregate(pipeline))
    
    def get_total_video_count(self) -> Dict:
        """Get total video statistics"""
        total = db.youtube_videos.count_documents({})
        unused = db.youtube_videos.count_documents({'is_used': False, 'is_skipped': {'$ne': True}})
        used = db.youtube_videos.count_documents({'is_used': True})
        skipped = db.youtube_videos.count_documents({'is_skipped': True})
        
        # Count by channel type
        by_type = {}
        for ctype in ['production_house', 'music_label', 'popular_channel']:
            by_type[ctype] = db.youtube_videos.count_documents({'channel_type': ctype})
        
        return {
            'total': total,
            'unused': unused,
            'used': used,
            'skipped': skipped,
            'by_type': by_type
        }
    
    def delete_old_videos(self, days_to_keep: int = 30) -> Dict:
        """Delete videos older than specified days
        
        Args:
            days_to_keep: Keep videos from the last N days
        
        Returns:
            Deletion result
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_to_keep)
        
        # Count before deletion
        count_before = db.youtube_videos.count_documents({})
        old_count = db.youtube_videos.count_documents({'published_at': {'$lt': cutoff_date}})
        
        # Delete old videos
        result = db.youtube_videos.delete_many({'published_at': {'$lt': cutoff_date}})
        
        return {
            'success': True,
            'deleted_count': result.deleted_count,
            'remaining_count': count_before - result.deleted_count,
            'cutoff_date': cutoff_date.isoformat(),
            'days_kept': days_to_keep
        }


# Singleton instance
youtube_rss_service = YouTubeRSSService()
