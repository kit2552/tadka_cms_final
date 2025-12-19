"""
Video Agent Service
Handles YouTube video search for trailers, teasers, trending videos, events/interviews and tadka shorts
"""

import httpx
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import crud

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

class VideoAgentService:
    """Service for Video Agent - searches YouTube for videos based on category"""
    
    # Video categories
    CATEGORIES = {
        'trailers_teasers': {
            'name': 'Trailers & Teasers',
            'keywords': ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster'],
            'search_suffix': 'official'
        },
        'trending_videos': {
            'name': 'Trending Videos',
            'keywords': ['trending', 'viral', 'hit song', 'movie song'],
            'search_suffix': ''
        },
        'events_interviews': {
            'name': 'Events & Interviews',
            'keywords': ['interview', 'press meet', 'event', 'promotion', 'talk show'],
            'search_suffix': ''
        },
        'tadka_shorts': {
            'name': 'Tadka Shorts',
            'keywords': ['hot', 'sexy', 'bold', 'photoshoot', 'actress'],
            'search_suffix': '#shorts',
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
            # Try to fetch from DB
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
    
    def _get_today_ist(self) -> str:
        """Get today's date in IST timezone in YouTube format (YYYY-MM-DD)"""
        now_ist = datetime.now(IST)
        return now_ist.strftime('%Y-%m-%d')
    
    def _get_published_after(self, days_ago: int = 7) -> str:
        """Get the publishedAfter parameter for YouTube API (RFC 3339 format)
        
        Args:
            days_ago: Number of days to look back (default 7 for more results)
        """
        now_ist = datetime.now(IST)
        # Go back N days
        start_date = now_ist - timedelta(days=days_ago)
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_date.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    async def search_youtube(
        self,
        query: str,
        max_results: int = 10,
        video_type: Optional[str] = None,
        published_after: Optional[str] = None,
        video_duration: Optional[str] = None
    ) -> List[Dict]:
        """Search YouTube using Data API v3
        
        Args:
            query: Search query
            max_results: Maximum number of results
            video_type: 'short' for YouTube Shorts, None for regular videos
            published_after: RFC 3339 timestamp to filter videos after this date
            video_duration: 'short' (<4min), 'medium' (4-20min), 'long' (>20min)
        
        Returns:
            List of video dictionaries with id, title, thumbnail, channel, publishedAt
        """
        if not self.youtube_api_key:
            self.youtube_api_key = await self._get_youtube_api_key()
            
        if not self.youtube_api_key:
            print("❌ YouTube API key not configured")
            return []
        
        # Build API URL
        base_url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            'part': 'snippet',
            'q': query,
            'type': 'video',
            'maxResults': max_results,
            'order': 'relevance',  # Most relevant first for better quality
            'key': self.youtube_api_key,
            'regionCode': 'IN',  # India
            'relevanceLanguage': 'hi'  # Default to Hindi
        }
        
        # Filter by video duration
        if video_type == 'short':
            params['videoDuration'] = 'short'  # Under 4 minutes
        elif video_duration:
            params['videoDuration'] = video_duration  # 'short', 'medium', 'long'
        
        # Filter by publish date
        if published_after:
            params['publishedAfter'] = published_after
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(base_url, params=params)
                
                if response.status_code != 200:
                    print(f"❌ YouTube API error: {response.status_code}")
                    print(f"   Response: {response.text[:500]}")
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
                            'published_at': snippet.get('publishedAt', ''),
                            'url': f"https://www.youtube.com/watch?v={video_id}"
                        })
                
                print(f"📺 Found {len(videos)} YouTube videos for: {query}")
                return videos
                
        except Exception as e:
            print(f"❌ YouTube API error: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def search_trailers_teasers(self, language: str, movie_name: Optional[str] = None) -> List[Dict]:
        """Search for official movie trailers and teasers"""
        if movie_name:
            # Search for specific movie trailer from official channel
            query = f"{movie_name} official trailer {language}"
        else:
            # General search for official trailers - exclude shorts, reviews, reactions
            query = f"{language} movie official trailer teaser -shorts -review -reaction -scene"
        
        print(f"🔍 Searching trailers: {query}")
        videos = await self.search_youtube(
            query=query,
            max_results=20,  # Get more to filter
            published_after=self._get_published_after(),
            video_duration='medium'  # Trailers are typically 1-4 minutes
        )
        
        # Filter results to get only likely official trailers
        filtered = []
        for video in videos:
            title_lower = video['title'].lower()
            # Skip if title contains unwanted keywords
            if any(skip in title_lower for skip in ['#shorts', 'review', 'reaction', 'scene', 'spoof', 'roast', 'explained']):
                continue
            # Prefer titles with "official" or "trailer" or "teaser"
            if any(keyword in title_lower for keyword in ['official', 'trailer', 'teaser', 'first look', 'glimpse', 'motion poster']):
                filtered.append(video)
        
        return filtered[:10]
    
    async def search_trending_videos(self, language: str) -> List[Dict]:
        """Search for trending movie/music videos"""
        query = f"{language} movie song trending viral"
        
        print(f"🔍 Searching trending videos: {query}")
        return await self.search_youtube(
            query=query,
            max_results=10,
            published_after=self._get_published_after()
        )
    
    async def search_events_interviews(self, language: str, celebrity_name: Optional[str] = None) -> List[Dict]:
        """Search for celebrity events and interviews"""
        if celebrity_name:
            query = f"{celebrity_name} interview event press meet"
        else:
            query = f"{language} actress actor interview event promotion"
        
        print(f"🔍 Searching events/interviews: {query}")
        return await self.search_youtube(
            query=query,
            max_results=10,
            published_after=self._get_published_after()
        )
    
    async def search_tadka_shorts(self, language: str, actress_name: Optional[str] = None) -> List[Dict]:
        """Search for hot/trending YouTube Shorts of actresses"""
        if actress_name:
            query = f"{actress_name} hot photoshoot shorts"
        else:
            query = f"{language} actress hot trending shorts"
        
        print(f"🔍 Searching tadka shorts: {query}")
        return await self.search_youtube(
            query=query,
            max_results=10,
            video_type='short'
        )
    
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
        
        print(f"\n🎬 Running Video Agent: {agent.get('name', 'Unnamed')}")
        
        # Get configuration from agent
        target_state = agent.get('target_state', 'bollywood')
        video_category = agent.get('video_category', 'trailers_teasers')
        search_query = agent.get('search_query', '')  # Optional specific search
        max_videos = agent.get('max_videos', 5)
        
        # Get state-language mapping
        self.state_language_map = await self._get_state_language_mapping()
        
        # Get language for target state
        language = self._get_language_for_state(target_state)
        print(f"📌 Target State: {target_state}")
        print(f"📌 Language: {language}")
        print(f"📌 Video Category: {video_category}")
        print(f"📌 Today (IST): {self._get_today_ist()}")
        
        # Search based on category
        videos = []
        if video_category == 'trailers_teasers':
            videos = await self.search_trailers_teasers(language, search_query if search_query else None)
        elif video_category == 'trending_videos':
            videos = await self.search_trending_videos(language)
        elif video_category == 'events_interviews':
            videos = await self.search_events_interviews(language, search_query if search_query else None)
        elif video_category == 'tadka_shorts':
            videos = await self.search_tadka_shorts(language, search_query if search_query else None)
        else:
            # Default general search
            videos = await self.search_youtube(
                query=f"{language} {search_query or 'movie video'} {self._get_today_ist()}",
                max_results=max_videos,
                published_after=self._get_published_after()
            )
        
        if not videos:
            return {
                "success": False,
                "message": "No videos found for the given criteria",
                "videos_found": 0,
                "posts_created": 0
            }
        
        # Limit to max_videos
        videos = videos[:max_videos]
        
        # Create video posts
        created_posts = []
        for video in videos:
            try:
                # Clean up title - remove hashtags and extra content
                clean_title = self._clean_video_title(video['title'])
                
                # Create article with video content type
                article_data = {
                    "title": clean_title,
                    "content": f"<p>{video['description'][:500] if video['description'] else clean_title}</p>",
                    "excerpt": video['description'][:200] if video['description'] else clean_title,
                    "content_type": "video",  # Explicitly set to video
                    "video_url": video['url'],
                    "featured_image": video['thumbnail'],
                    "category": self._get_category_for_video_type(video_category),
                    "section": self._get_section_for_state(target_state),
                    "status": "draft",
                    "source": "YouTube",
                    "source_url": video['url'],
                    "meta_title": clean_title[:60],
                    "meta_description": video['description'][:160] if video['description'] else clean_title[:160],
                    "created_by_agent": agent_id,
                    "agent_type": "video",
                    "youtube_video_id": video['video_id'],
                    "channel_name": video.get('channel', '')
                }
                
                print(f"📝 Creating article with content_type: {article_data['content_type']}")
                
                # Create the article
                created = crud.create_article(db, article_data)
                if created:
                    created_posts.append({
                        "id": created.get('id'),
                        "title": clean_title,
                        "video_url": video['url'],
                        "channel": video.get('channel', '')
                    })
                    print(f"✅ Created video post: {clean_title[:50]}...")
                else:
                    print(f"❌ Failed to create article for: {clean_title[:50]}")
                    
            except Exception as e:
                print(f"❌ Error creating post for video: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        return {
            "success": True,
            "message": f"Successfully created {len(created_posts)} video posts",
            "videos_found": len(videos),
            "posts_created": len(created_posts),
            "posts": created_posts
        }
    
    def _clean_video_title(self, title: str) -> str:
        """Clean up video title - remove hashtags and excessive text"""
        import re
        # Remove hashtags
        title = re.sub(r'#\w+', '', title)
        # Remove multiple spaces
        title = re.sub(r'\s+', ' ', title)
        # Remove leading/trailing whitespace
        title = title.strip()
        # Truncate if too long
        if len(title) > 150:
            title = title[:147] + '...'
        return title
    
    def _get_category_for_video_type(self, video_category: str) -> str:
        """Map video category to article category"""
        category_map = {
            'trailers_teasers': 'trailers',
            'trending_videos': 'trending',
            'events_interviews': 'events-interviews',
            'tadka_shorts': 'tadka-shorts'
        }
        return category_map.get(video_category, 'videos')
    
    def _get_section_for_state(self, target_state: str) -> str:
        """Map target state to section"""
        state_section_map = {
            'bollywood': 'bollywood',
            'andhra-pradesh': 'tollywood',
            'telangana': 'tollywood',
            'tamil-nadu': 'kollywood',
            'karnataka': 'sandalwood',
            'kerala': 'mollywood',
            'maharashtra': 'marathi',
            'west-bengal': 'bengali',
            'punjab': 'pollywood'
        }
        state_lower = target_state.lower().replace(' ', '-')
        return state_section_map.get(state_lower, 'bollywood')


# Singleton instance
video_agent_runner = VideoAgentService()
