"""
Video Agent Service
Handles YouTube video search for trailers, teasers, trending videos, events/interviews and tadka shorts
Now searches directly in specified YouTube channels using channel IDs
"""

import httpx
import asyncio
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import crud

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

class VideoAgentService:
    """Service for Video Agent - searches YouTube channels by channel ID"""
    
    # Video categories with their search keywords
    CATEGORIES = {
        'trailers_teasers': {
            'name': 'Trailers & Teasers',
            'keywords': ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster', 'promo'],
            'exclude_keywords': ['reaction', 'review', 'explained', 'scene', 'behind the scenes', 'making']
        },
        'trending_videos': {
            'name': 'Trending Videos',
            'keywords': ['song', 'video song', 'lyrical', 'full video'],
            'exclude_keywords': ['reaction', 'cover', 'karaoke', 'instrumental']
        },
        'events_interviews': {
            'name': 'Events & Interviews',
            'keywords': ['interview', 'press meet', 'event', 'promotion', 'launch', 'speech'],
            'exclude_keywords': ['trailer', 'teaser', 'song']
        },
        'tadka_shorts': {
            'name': 'Tadka Shorts',
            'keywords': ['shorts', 'reels', 'hot', 'photoshoot'],
            'exclude_keywords': [],
            'video_type': 'short'
        }
    }
    
    # State to language mapping (will be fetched from DB)
    DEFAULT_STATE_LANGUAGE_MAP = {
        'andhra-pradesh': 'Telugu',
        'telangana': 'Telugu',
        'tamil-nadu': 'Tamil',
        'karnataka': 'Kannada',
        'kerala': 'Malayalam',
        'maharashtra': 'Marathi',
        'west-bengal': 'Bengali',
        'bollywood': 'Hindi',
        'gujarat': 'Gujarati',
        'punjab': 'Punjabi'
    }
    
    # Language name to code mapping for article_language field
    LANGUAGE_CODE_MAP = {
        'Telugu': 'te',
        'Tamil': 'ta',
        'Kannada': 'kn',
        'Malayalam': 'ml',
        'Marathi': 'mr',
        'Bengali': 'bn',
        'Hindi': 'hi',
        'Gujarati': 'gu',
        'Punjabi': 'pa',
        'English': 'en'
    }
    
    # Known fake/unannounced movie sequels to filter out
    FAKE_MOVIE_KEYWORDS = [
        'kgf 3', 'kgf chapter 3', 'pushpa 3', 'bahubali 3', 'rrr 2',
        'dangal 2', 'pk 2', '3 idiots 2', 'sholay 2', 'ddlj 2',
        'concept', 'fan made', 'fanmade', 'unofficial', 'fake',
        'leaked', 'update', 'announcement soon', 'coming soon 202'
    ]
    
    def __init__(self):
        self.youtube_api_key = None
        self.state_language_map = {}
    
    async def _get_youtube_api_key(self) -> Optional[str]:
        """Get YouTube API key from system settings"""
        config = crud.get_ai_api_keys(db)
        if config:
            return config.get('youtube_api_key')
        return None
    
    async def _get_state_language_mapping(self) -> Dict[str, str]:
        """Get state-language mapping from system settings"""
        try:
            mapping_doc = db.system_settings.find_one({"setting_key": "state_language_mapping"})
            if mapping_doc and mapping_doc.get('mapping'):
                return mapping_doc['mapping']
        except Exception as e:
            print(f"Warning: Could not fetch state-language mapping: {e}")
        return self.DEFAULT_STATE_LANGUAGE_MAP
    
    def _get_language_for_state(self, state: str) -> str:
        """Get language for a given state"""
        state_lower = state.lower().replace(' ', '-')
        return self.state_language_map.get(state_lower, 'Hindi')
    
    def _get_db_language(self, language: str) -> str:
        """Map common language names to database values"""
        lang_map = {
            'hindi': 'Hindi',
            'bollywood': 'Hindi',
            'telugu': 'Telugu',
            'tollywood': 'Telugu',
            'tamil': 'Tamil',
            'kollywood': 'Tamil',
            'kannada': 'Kannada',
            'sandalwood': 'Kannada',
            'malayalam': 'Malayalam',
            'mollywood': 'Malayalam',
            'bengali': 'Bengali',
            'marathi': 'Marathi',
            'punjabi': 'Punjabi'
        }
        return lang_map.get(language.lower(), language)
    
    def _get_published_after(self, days_ago: int = 7) -> str:
        """Get the publishedAfter parameter for YouTube API (RFC 3339 format)"""
        now_ist = datetime.now(IST)
        start_date = now_ist - timedelta(days=days_ago)
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_date.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    def _get_channels_by_types_and_language(
        self, 
        channel_types: List[str], 
        language: str,
        limit: int = 20
    ) -> List[Dict]:
        """Get YouTube channels from DB filtered by channel types and language
        
        Args:
            channel_types: List of channel types (production_house, music_label, popular_channel)
            language: Language to filter by (Telugu, Hindi, Tamil, etc.)
            limit: Maximum number of channels to return
        
        Returns:
            List of channel documents with channel_id, channel_name, etc.
        """
        try:
            db_language = self._get_db_language(language)
            
            query = {
                "is_active": True,
                "channel_id": {"$ne": None, "$exists": True},  # Must have channel_id
                "languages": db_language
            }
            
            # Filter by channel types if provided
            if channel_types and len(channel_types) > 0:
                query["channel_type"] = {"$in": channel_types}
            
            channels = list(
                db.youtube_channels.find(query, {"_id": 0})
                .sort("priority", -1)
                .limit(limit)
            )
            
            print(f"📺 Found {len(channels)} channels for {db_language} with types {channel_types}")
            for ch in channels[:5]:
                print(f"   - {ch.get('channel_name')} ({ch.get('channel_type')}) ID: {ch.get('channel_id', 'NO ID')}")
            
            return channels
            
        except Exception as e:
            print(f"❌ Error fetching channels from DB: {e}")
            return []
    
    async def search_channel_videos(
        self,
        channel_id: str,
        channel_name: str,
        query: str = "",
        max_results: int = 5,
        published_after: Optional[str] = None,
        video_duration: Optional[str] = None
    ) -> List[Dict]:
        """Search for videos within a specific YouTube channel
        
        Args:
            channel_id: YouTube channel ID
            channel_name: Channel name for logging
            query: Optional search query to filter within channel
            max_results: Maximum results per channel
            published_after: RFC 3339 timestamp
            video_duration: 'short', 'medium', 'long'
        
        Returns:
            List of video dictionaries
        """
        if not self.youtube_api_key:
            self.youtube_api_key = await self._get_youtube_api_key()
            
        if not self.youtube_api_key:
            print("❌ YouTube API key not configured")
            return []
        
        base_url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            'part': 'snippet',
            'channelId': channel_id,  # Search within this specific channel
            'type': 'video',
            'maxResults': max_results,
            'order': 'date',  # Most recent first
            'key': self.youtube_api_key
        }
        
        # Add search query if provided
        if query:
            params['q'] = query
        
        # Filter by video duration
        if video_duration:
            params['videoDuration'] = video_duration
        
        # Filter by publish date
        if published_after:
            params['publishedAfter'] = published_after
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(base_url, params=params)
                
                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    error_reason = error_data.get('error', {}).get('message', response.text[:200])
                    print(f"❌ YouTube API error for {channel_name}: {response.status_code} - {error_reason}")
                    return []
                
                data = response.json()
                videos = []
                
                for item in data.get('items', []):
                    snippet = item.get('snippet', {})
                    video_id = item.get('id', {}).get('videoId')
                    
                    if video_id:
                        videos.append({
                            'video_id': video_id,
                            'title': snippet.get('title', ''),
                            'description': snippet.get('description', ''),
                            'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                            'channel': snippet.get('channelTitle', ''),
                            'channel_id': channel_id,
                            'published_at': snippet.get('publishedAt', ''),
                            'url': f"https://www.youtube.com/watch?v={video_id}"
                        })
                
                if videos:
                    print(f"   ✅ {channel_name}: Found {len(videos)} videos")
                
                return videos
                
        except Exception as e:
            print(f"❌ Error searching channel {channel_name}: {e}")
            return []
    
    async def search_videos_from_channels(
        self,
        channels: List[Dict],
        video_category: str,
        search_query: str = "",
        max_videos_per_channel: int = 5,
        days_ago: int = 7
    ) -> List[Dict]:
        """Search for videos from multiple channels in parallel
        
        Args:
            channels: List of channel documents from DB
            video_category: Category type for filtering
            search_query: Optional specific search query
            max_videos_per_channel: Max videos to fetch per channel
            days_ago: How many days back to search
        
        Returns:
            Combined list of videos from all channels
        """
        if not channels:
            print("⚠️ No channels provided for search")
            return []
        
        category_config = self.CATEGORIES.get(video_category, {})
        keywords = category_config.get('keywords', [])
        exclude_keywords = category_config.get('exclude_keywords', [])
        video_duration = 'short' if category_config.get('video_type') == 'short' else None
        
        # Build search query based on category
        if search_query:
            query = search_query
        elif keywords:
            # Use first few keywords for search
            query = ' '.join(keywords[:2])
        else:
            query = ""
        
        published_after = self._get_published_after(days_ago)
        
        print(f"\n🔍 Searching {len(channels)} channels for '{video_category}'")
        print(f"   Query: '{query}' | Duration: {video_duration or 'any'} | After: {published_after[:10]}")
        
        # Create tasks for parallel execution
        tasks = []
        for channel in channels:
            channel_id = channel.get('channel_id')
            channel_name = channel.get('channel_name', 'Unknown')
            
            if not channel_id:
                print(f"   ⚠️ Skipping {channel_name} - no channel_id")
                continue
            
            task = self.search_channel_videos(
                channel_id=channel_id,
                channel_name=channel_name,
                query=query,
                max_results=max_videos_per_channel,
                published_after=published_after,
                video_duration=video_duration
            )
            tasks.append(task)
        
        if not tasks:
            print("⚠️ No valid channels to search")
            return []
        
        # Execute all searches in parallel
        print(f"   ⏳ Executing {len(tasks)} parallel API calls...")
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results and filter
        all_videos = []
        seen_ids = set()
        
        for result in results:
            if isinstance(result, Exception):
                print(f"   ❌ Task failed: {result}")
                continue
            
            for video in result:
                video_id = video.get('video_id')
                if video_id and video_id not in seen_ids:
                    # Apply category-specific filtering
                    title_lower = video['title'].lower()
                    
                    # Skip fake movies
                    if any(fake in title_lower for fake in self.FAKE_MOVIE_KEYWORDS):
                        continue
                    
                    # Skip excluded keywords
                    if any(excl in title_lower for excl in exclude_keywords):
                        continue
                    
                    # For trailers/teasers, must have at least one keyword
                    if video_category == 'trailers_teasers':
                        if not any(kw in title_lower for kw in keywords):
                            continue
                    
                    seen_ids.add(video_id)
                    all_videos.append(video)
        
        # Sort by published date (newest first)
        all_videos.sort(key=lambda x: x.get('published_at', ''), reverse=True)
        
        print(f"\n📊 Total: {len(all_videos)} unique videos from {len(channels)} channels")
        
        return all_videos
    
    async def run_video_agent(self, agent_id: str) -> Dict:
        """Run the Video Agent to find and create video posts
        
        Args:
            agent_id: The ID of the video agent configuration
        
        Returns:
            Dictionary with results including created posts
        """
        # Get agent configuration
        agent = crud.get_ai_agent(db, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        
        agent_name = agent.get('agent_name', 'Video')
        print(f"\n🎬 Running Video Agent: {agent_name}")
        
        # Get configuration from agent
        target_state = agent.get('target_state', 'bollywood')
        video_category = agent.get('video_category', 'trailers_teasers')
        search_query = agent.get('search_query', '')
        max_videos = agent.get('max_videos', 5)
        agent_article_language = agent.get('article_language', 'en')
        content_workflow = agent.get('content_workflow', 'draft')
        agent_category = agent.get('category', '')
        
        # Get channel types from agent config (NEW FIELD)
        channel_types = agent.get('channel_types', [])
        if not channel_types:
            # Default to all types if not specified
            channel_types = ['production_house', 'music_label', 'popular_channel']
        
        # Get state-language mapping
        self.state_language_map = await self._get_state_language_mapping()
        search_language = self._get_language_for_state(target_state)
        
        print(f"📌 Target State: {target_state}")
        print(f"📌 Search Language: {search_language}")
        print(f"📌 Video Category: {video_category}")
        print(f"📌 Channel Types: {channel_types}")
        print(f"📌 Article Language: {agent_article_language}")
        print(f"📌 Content Workflow: {content_workflow}")
        
        # Check if RSS collection has videos (preferred method - no API quota)
        from services.youtube_rss_service import youtube_rss_service
        
        rss_videos = youtube_rss_service.get_videos_for_agent(
            channel_types=channel_types,
            language=search_language,
            video_category=video_category,
            max_videos=max_videos * 2,  # Get extra for filtering
            days_ago=7
        )
        
        if rss_videos:
            print(f"📺 Using {len(rss_videos)} videos from RSS collection (no API calls)")
            videos = rss_videos
            source_method = "rss_collection"
        else:
            # Fallback to API calls if RSS collection is empty
            print("⚠️ RSS collection empty, falling back to YouTube API...")
            
            # Get channels from DB based on channel types and language
            channels = self._get_channels_by_types_and_language(
                channel_types=channel_types,
                language=search_language,
                limit=20  # Get top 20 channels by priority
            )
            
            if not channels:
                return {
                    "success": False,
                    "message": f"No channels found for language '{search_language}' with types {channel_types}. Please add channels in Settings > YouTube Channels.",
                    "videos_found": 0,
                    "posts_created": 0
                }
            
            # Search videos from channels using API
            videos = await self.search_videos_from_channels(
                channels=channels,
                video_category=video_category,
                search_query=search_query,
                max_videos_per_channel=3,
                days_ago=7
            )
            source_method = "youtube_api"
        
        if not videos:
            return {
                "success": False,
                "message": f"No videos found in {len(channels)} channels for the given criteria",
                "videos_found": 0,
                "posts_created": 0,
                "channels_searched": len(channels)
            }
        
        # Limit to max_videos
        videos = videos[:max_videos]
        
        # Create video posts
        created_posts = []
        skipped_duplicates = 0
        
        for video in videos:
            try:
                youtube_url = f"https://www.youtube.com/watch?v={video['video_id']}"
                
                # Check for duplicate
                existing = db.articles.find_one({
                    '$or': [
                        {'youtube_video_id': video['video_id']},
                        {'youtube_url': youtube_url}
                    ]
                })
                if existing:
                    print(f"⏭️ Skipping duplicate: {video['title'][:50]}...")
                    skipped_duplicates += 1
                    continue
                
                clean_title = self._clean_video_title(video['title'])
                original_youtube_title = video['title']  # Full YouTube title
                slug = self._generate_slug(clean_title)
                current_time = datetime.now(timezone.utc)
                
                # Handle both RSS and API video formats
                description = video.get('description', '') or ''
                thumbnail = video.get('thumbnail', '') or video.get('image', '')
                channel_name = video.get('channel_name', '') or video.get('channel', '')
                
                article_data = {
                    "title": original_youtube_title,  # Store full YouTube title as main title
                    "display_title": clean_title,  # Store extracted movie name for home page display
                    "slug": slug,
                    "author": "AI Agent",
                    "agent_name": agent_name,
                    "content": f"<p>{description[:500] if description else clean_title}</p>",
                    "summary": description[:200] if description else clean_title,
                    "content_type": "video",
                    "youtube_url": youtube_url,
                    "image": thumbnail,
                    "category": agent_category,
                    "states": f'["{target_state}"]',
                    "status": content_workflow,
                    "source": "YouTube",
                    "source_url": youtube_url,
                    "seo_title": clean_title[:60],
                    "seo_description": description[:160] if description else clean_title[:160],
                    "created_by_agent": agent_id,
                    "agent_type": "video",
                    "youtube_video_id": video['video_id'],
                    "channel_name": channel_name,
                    "article_language": agent_article_language,
                    "created_at": current_time,
                    "published_at": current_time
                }
                
                print(f"📝 Creating: {clean_title[:50]}... from {channel_name or 'Unknown'}")
                
                created = crud.create_article(db, article_data)
                if created:
                    created_posts.append({
                        "id": created.get('id'),
                        "title": clean_title,
                        "video_url": youtube_url,
                        "channel": channel_name
                    })
                    print(f"   ✅ Created successfully")
                    
                    # Mark video as used in RSS collection (if from RSS)
                    if video.get('source') == 'rss':
                        youtube_rss_service.mark_video_as_used(video['video_id'])
                    
            except Exception as e:
                print(f"❌ Error creating post: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        message = f"Successfully created {len(created_posts)} video posts"
        if skipped_duplicates > 0:
            message += f" (skipped {skipped_duplicates} duplicates)"
        
        return {
            "success": True,
            "message": message,
            "videos_found": len(videos),
            "posts_created": len(created_posts),
            "duplicates_skipped": skipped_duplicates,
            "source_method": source_method if 'source_method' in dir() else "unknown",
            "posts": created_posts
        }
    
    def _clean_video_title(self, title: str) -> str:
        """Extract clean title from video title"""
        # Remove hashtags
        title = re.sub(r'#\w+', '', title)
        
        # Split by common separators
        separators = ['|', ' - ', 'Official', 'OFFICIAL', 'Trailer', 'TRAILER', 
                      'Teaser', 'TEASER', 'First Look', 'Glimpse', 'Motion Poster', 
                      'Promo', 'Review', 'Song', 'Full Video']
        
        clean_title = title
        for sep in separators:
            if sep in clean_title:
                clean_title = clean_title.split(sep)[0]
        
        clean_title = clean_title.strip()
        clean_title = re.sub(r'\s+', ' ', clean_title)
        clean_title = clean_title.rstrip('|-:').strip()
        
        return clean_title if clean_title else title.split()[0] if title.split() else "Video"
    
    def _generate_slug(self, title: str) -> str:
        """Generate URL-friendly slug from title"""
        slug = title.lower()
        slug = slug.replace(' ', '-')
        slug = re.sub(r'[^a-z0-9\-]', '', slug)
        slug = re.sub(r'-+', '-', slug)
        slug = slug.strip('-')
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f"{slug}-{timestamp}"


# Singleton instance
video_agent_runner = VideoAgentService()
