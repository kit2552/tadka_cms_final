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
    
    async def fetch_channel_rss(self, channel_id: str, channel_name: str, channel_type: str, languages: List[str], rss_url: Optional[str] = None, fetch_videos: bool = True, fetch_shorts: bool = False, full_movies_only: bool = False) -> List[Dict]:
        """Fetch videos from a single channel's RSS feed
        
        Args:
            channel_id: YouTube channel ID
            channel_name: Name of the channel
            channel_type: Type (production_house, music_label, movie_news_channel, movie_interviews_channel, tech_interviews_channel, etc.)
            languages: Languages this channel covers
            rss_url: Pre-stored RSS URL (optional, will be generated if not provided)
            fetch_videos: Whether to fetch regular videos (default True)
            fetch_shorts: Whether to fetch YouTube Shorts (default False)
        
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
                        
                        # Apply fetch_videos and fetch_shorts filters
                        if is_short:
                            if not fetch_shorts:
                                continue  # Skip shorts if fetch_shorts is disabled
                        else:
                            if not fetch_videos:
                                continue  # Skip regular videos if fetch_videos is disabled
                        
                        # For movie_channel type, only keep full-length movies
                        if channel_type == 'movie_channel':
                            if detected_category != 'Full Movie':
                                # Check if title suggests it's a full movie (relaxed criteria)
                                is_full_movie = any(kw in title_lower for kw in [
                                    'full movie', 'full film', 'complete movie', 'hd movie',
                                    'superhit movie', 'blockbuster movie', 'latest movie',
                                    'movie |', '| movie', ' movie ', # Common patterns like "Title Movie | Channel"
                                ])
                                # Skip shorts, trailers, promos, songs etc
                                is_not_movie = any(kw in title_lower for kw in [
                                    'trailer', 'teaser', 'promo', 'song', 'scene', 'clip',
                                    'making', 'behind', 'interview', 'review', 'glimpse',
                                    '#shorts', 'shorts', 'best scenes', 'comedy scenes',
                                    'best movies of', 'top movies', 'new year special', 'grand finale'
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
        """Detect video language from title/description
        
        For multi-language channels (2+ languages):
        - Returns "Multi Language" - agent will check title for specific language
        
        For single-language channels:
        - Returns the channel's configured language
        """
        # If channel has multiple languages, mark as Multi Language
        # The agent will later check the title for specific language tags
        if len(channel_languages) > 1:
            return "Multi Language"
        
        # For single-language channels, use the channel's language
        return channel_languages[0] if channel_languages else 'Hindi'
    
    def detect_language_from_title(self, title: str) -> str:
        """Extract language from video title if explicitly mentioned
        
        Looks for patterns like [Telugu], (Tamil), - Hindi, etc.
        Returns None if no language tag found in title
        """
        title_lower = title.lower()
        
        # Explicit language tag patterns in titles
        language_patterns = {
            'Telugu': [r'\[telugu\]', r'\(telugu\)', r'- telugu\b', r'\| telugu\b', r'telugu song', r'telugu lyric', r'telugu video', r'తెలుగు'],
            'Tamil': [r'\[tamil\]', r'\(tamil\)', r'- tamil\b', r'\| tamil\b', r'tamil song', r'tamil lyric', r'tamil video', r'தமிழ்'],
            'Hindi': [r'\[hindi\]', r'\(hindi\)', r'- hindi\b', r'\| hindi\b', r'hindi song', r'hindi lyric', r'hindi video', r'हिंदी'],
            'Kannada': [r'\[kannada\]', r'\(kannada\)', r'- kannada\b', r'\| kannada\b', r'kannada song', r'kannada lyric', r'kannada video', r'ಕನ್ನಡ'],
            'Malayalam': [r'\[malayalam\]', r'\(malayalam\)', r'- malayalam\b', r'\| malayalam\b', r'malayalam song', r'malayalam lyric', r'malayalam video', r'മലയാളം'],
            'Bengali': [r'\[bengali\]', r'\(bengali\)', r'- bengali\b', r'\| bengali\b', r'bengali song', r'বাংলা', r'bangla'],
            'Marathi': [r'\[marathi\]', r'\(marathi\)', r'- marathi\b', r'\| marathi\b', r'marathi song', r'मराठी'],
            'Punjabi': [r'\[punjabi\]', r'\(punjabi\)', r'- punjabi\b', r'\| punjabi\b', r'punjabi song', r'ਪੰਜਾਬੀ']
        }
        
        for lang, patterns in language_patterns.items():
            for pattern in patterns:
                if re.search(pattern, title_lower, re.IGNORECASE):
                    return lang
        
        return None  # No language tag found in title
    
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
            'Glimpse or Promos': [r'\bglimpse\b', r'\bmotion poster\b'],
            'Song': [r'\bsong\b', r'\blyrical\b', r'\bvideo song\b', r'\bfull song\b', r'\bmusic video\b', r'\bjukebox\b', r'\bpromo\b', r'\bsong promo\b'],
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
                # Get fetch preferences (default: videos=True, shorts=False)
                fetch_videos = channel.get('fetch_videos', True)
                fetch_shorts = channel.get('fetch_shorts', False)
                
                task = self.fetch_channel_rss(
                    channel_id=channel.get('channel_id'),
                    channel_name=channel.get('channel_name', 'Unknown'),
                    channel_type=channel.get('channel_type', 'unknown'),
                    languages=channel.get('languages', ['Hindi']),
                    rss_url=channel.get('rss_url'),  # Use stored RSS URL if available
                    fetch_videos=fetch_videos,
                    fetch_shorts=fetch_shorts
                )
                tasks.append(task)
            
            # Execute all fetches in parallel (with some rate limiting)
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results and store in database
            total_videos = 0
            new_videos = 0
            updated_videos = 0
            errors = 0
            channel_breakdown = []  # Track new videos by channel
            
            for idx, result in enumerate(results):
                if isinstance(result, Exception):
                    print(f"   ❌ Task error: {result}")
                    errors += 1
                    continue
                
                channel_new_count = 0
                channel_name = channels[idx].get('channel_name', 'Unknown') if idx < len(channels) else 'Unknown'
                
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
                        channel_new_count += 1
                
                if channel_new_count > 0:
                    channel_breakdown.append({
                        'channel_name': channel_name,
                        'new_count': channel_new_count
                    })
            
            # Update last fetch timestamp
            db.system_settings.update_one(
                {"setting_key": "youtube_rss_config"},
                {"$set": {"last_fetch": datetime.now(timezone.utc)}},
                upsert=True
            )
            
            # Log this fetch run
            from uuid import uuid4
            log_entry = {
                'log_id': str(uuid4()),
                'timestamp': datetime.now(timezone.utc),
                'channels_processed': len(channels),
                'new_videos_count': new_videos,
                'updated_videos_count': updated_videos,
                'errors_count': errors,
                'channel_breakdown': channel_breakdown,
                'status': 'success' if errors == 0 else ('partial' if new_videos > 0 else 'failed')
            }
            db.rss_fetch_logs.insert_one(log_entry)
            
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
        languages: List[str] = None,
        language: str = None,  # Keep for backward compatibility
        video_category: str = None,
        max_videos: int = 10,
        days_ago: int = 7,
        content_filter: str = 'videos',  # 'videos', 'shorts', or 'both'
        custom_include_keywords: List[str] = None,
        custom_exclude_keywords: List[str] = None
    ) -> List[Dict]:
        """Get videos from youtube_videos collection for Video Agent
        
        Args:
            channel_types: List of channel types to filter
            languages: List of languages to filter (preferred)
            language: Single language to filter (backward compatibility)
            video_category: Category for keyword filtering
            max_videos: Maximum videos to return
            days_ago: How many days back to look
            content_filter: Filter by 'videos', 'shorts', or 'both'
            custom_include_keywords: Custom include keywords (overrides defaults)
            custom_exclude_keywords: Custom exclude keywords (overrides defaults)
        
        Returns:
            List of matching videos
        """
        # Handle backward compatibility - convert single language to list
        if languages is None and language:
            languages = [language]
        elif languages is None:
            languages = []
        
        # Default category keywords for filtering
        default_category_keywords = {
            'trailers_teasers': ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster'],
            'latest_video_songs': ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
            'events_interviews': ['interview', 'press meet', 'event', 'promotion', 'launch', 'speech'],
            'tadka_shorts': ['shorts', 'reels', 'hot', 'photoshoot'],
            # Bollywood categories
            'trailers_teasers_bollywood': ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster'],
            'latest_video_songs_bollywood': ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
            'events_interviews_bollywood': ['interview', 'press meet', 'event', 'promotion', 'launch', 'speech'],
            'tadka_shorts_bollywood': ['shorts', 'reels', 'hot', 'photoshoot']
        }
        
        default_exclude_keywords = {
            'trailers_teasers': ['reaction', 'review', 'explained', 'scene', 'behind the scenes', 'making', 'dubbed', 'full movie', 'song promo', 'promo song'],
            'latest_video_songs': ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'best of', 'top 10', 'mashup', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored'],
            'events_interviews': ['trailer', 'teaser', 'song'],
            'tadka_shorts': [],
            # Bollywood categories
            'trailers_teasers_bollywood': ['reaction', 'review', 'explained', 'scene', 'behind the scenes', 'making', 'dubbed', 'full movie', 'song promo', 'promo song'],
            'latest_video_songs_bollywood': ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'best of', 'top 10', 'mashup', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored'],
            'events_interviews_bollywood': ['trailer', 'teaser', 'song'],
            'tadka_shorts_bollywood': []
        }
        
        # Use custom keywords if provided, otherwise use defaults
        category_keywords = custom_include_keywords if custom_include_keywords else default_category_keywords.get(video_category, [])
        exclude_keywords = custom_exclude_keywords if custom_exclude_keywords else default_exclude_keywords.get(video_category, [])
        
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
        
        # Filter by languages (now supports multiple languages)
        # For single-language channels: match channel's languages field
        # For multi-language channels: also check detected_language field on each video
        if languages and len(languages) > 0:
            # Map language names to database values
            lang_map = {
                'hindi': 'Hindi', 'bollywood': 'Hindi',
                'telugu': 'Telugu', 'tollywood': 'Telugu',
                'tamil': 'Tamil', 'kollywood': 'Tamil',
                'kannada': 'Kannada', 'malayalam': 'Malayalam',
                'bengali': 'Bengali', 'marathi': 'Marathi',
                'punjabi': 'Punjabi'
            }
            # Convert all languages to DB format
            db_languages = [lang_map.get(lang.lower(), lang) for lang in languages]
            
            # Filter by channel's assigned languages (at least one must match)
            query['languages'] = {'$in': db_languages}
            print(f"   🔍 Filtering videos by channel languages: {db_languages}")
        
        # Also include videos from multi-language channels
        if languages and len(languages) > 0:
            # Modify query to include multi-language channels
            query['$or'] = [
                {'languages': {'$in': db_languages}},  # Single-language channels matching target
                {'detected_language': 'Multi Language'}  # Multi-language channels (we'll filter by title)
            ]
            del query['languages']  # Remove the simple filter since we're using $or
        
        # Fetch videos
        videos = list(
            db.youtube_videos.find(query)
            .sort('published_at', -1)
            .limit(max_videos * 5)  # Fetch more for filtering (multi-lang channels need more)
        )
        
        # Log filter settings being used
        print(f"   🔍 Include keywords: {category_keywords}")
        print(f"   🔍 Exclude keywords: {exclude_keywords}")
        
        # Convert db_languages to set for faster lookup
        target_languages_set = set(db_languages) if languages and len(languages) > 0 else set()
        
        filtered_videos = []
        
        for video in videos:
            title = video.get('title', '')
            title_lower = title.lower()
            detected_lang = video.get('detected_language', '')
            
            # Skip if video is marked as skipped by user
            if video.get('is_skipped'):
                continue
            
            # Language filtering - use detected_language from RSS collection only
            if target_languages_set:
                # Skip videos marked for identification (user hasn't set language yet)
                if detected_lang in ['Multi Language', 'Identify Language', '']:
                    continue
                
                # Check if detected language matches target
                if detected_lang not in target_languages_set:
                    continue  # Skip - different language than target
            
            # Skip if contains exclude keywords
            if any(excl in title_lower for excl in exclude_keywords):
                continue
            
            # Apply content_filter (videos/shorts/both)
            video_url = video.get('video_url', '')
            is_short = (
                '/shorts/' in video_url or 
                '#shorts' in title_lower or 
                '#short' in title_lower or
                video.get('detected_category') == 'Shorts'
            )
            
            if content_filter == 'videos' and is_short:
                continue  # Skip shorts when only videos requested
            elif content_filter == 'shorts' and not is_short:
                continue  # Skip videos when only shorts requested
            # 'both' allows all content
            
            # For trailers/teasers, latest_video_songs, and events_interviews - must have keyword
            if video_category in ['trailers_teasers', 'latest_video_songs', 'events_interviews', 'trailers_teasers_bollywood', 'latest_video_songs_bollywood', 'events_interviews_bollywood']:
                if not any(kw in title_lower for kw in category_keywords):
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
        update_fields = {
            'is_skipped': skipped, 
            'skipped_at': datetime.now(timezone.utc) if skipped else None
        }
        
        # If skipping, also clear the needs_language_identification flag
        if skipped:
            update_fields['needs_language_identification'] = False
        
        result = db.youtube_videos.update_one(
            {'video_id': video_id},
            {'$set': update_fields}
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
        for ctype in ['production_house', 'music_label', 'movie_news_channel', 'movie_interviews_channel', 'tech_interviews_channel']:
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
