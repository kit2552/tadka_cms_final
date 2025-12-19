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
    
    def _get_published_after(self) -> str:
        """Get the publishedAfter parameter for YouTube API (RFC 3339 format)"""
        now_ist = datetime.now(IST)
        # Start of today in IST
        start_of_day = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_day.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    async def search_youtube(
        self,
        query: str,
        max_results: int = 10,
        video_type: Optional[str] = None,
        published_after: Optional[str] = None
    ) -> List[Dict]:
        """Search YouTube using Data API v3
        
        Args:
            query: Search query
            max_results: Maximum number of results
            video_type: 'short' for YouTube Shorts, None for regular videos
            published_after: RFC 3339 timestamp to filter videos after this date
        
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
            'order': 'date',  # Most recent first
            'key': self.youtube_api_key,
            'regionCode': 'IN',  # India
            'relevanceLanguage': 'hi'  # Default to Hindi, will be overridden
        }
        
        # Filter for shorts if specified
        if video_type == 'short':
            params['videoDuration'] = 'short'  # Under 4 minutes
        
        # Filter by publish date (today)
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
        """Search for movie trailers and teasers released today"""
        category = self.CATEGORIES['trailers_teasers']
        
        if movie_name:
            query = f"{movie_name} {language} trailer teaser official {self._get_today_ist()}"
        else:
            # General search for trailers released today
            keywords = ' OR '.join(category['keywords'])
            query = f"{language} movie ({keywords}) {self._get_today_ist()}"
        
        return await self.search_youtube(
            query=query,
            max_results=10,
            published_after=self._get_published_after()
        )
    
    async def search_trending_videos(self, language: str) -> List[Dict]:
        """Search for trending movie/music videos"""
        category = self.CATEGORIES['trending_videos']
        
        query = f"{language} trending movie song video {self._get_today_ist()}"
        
        return await self.search_youtube(
            query=query,
            max_results=10,
            published_after=self._get_published_after()
        )
    
    async def search_events_interviews(self, language: str, celebrity_name: Optional[str] = None) -> List[Dict]:
        """Search for celebrity events and interviews"""
        category = self.CATEGORIES['events_interviews']
        
        if celebrity_name:
            query = f"{celebrity_name} {language} interview event press meet {self._get_today_ist()}"
        else:
            query = f"{language} celebrity interview event promotion {self._get_today_ist()}"
        
        return await self.search_youtube(
            query=query,
            max_results=10,
            published_after=self._get_published_after()
        )
    
    async def search_tadka_shorts(self, language: str, actress_name: Optional[str] = None) -> List[Dict]:
        """Search for hot/trending YouTube Shorts of actresses"""
        if actress_name:
            query = f"{actress_name} hot sexy photoshoot #shorts"
        else:
            query = f"{language} actress hot trending #shorts"
        
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
                # Create article with video content type
                article_data = {
                    "title": video['title'],
                    "content": f"<p>{video['description'][:500] if video['description'] else video['title']}</p>",
                    "excerpt": video['description'][:200] if video['description'] else video['title'],
                    "content_type": "video",
                    "video_url": video['url'],
                    "video_id": video['video_id'],
                    "featured_image": video['thumbnail'],
                    "category": self._get_category_for_video_type(video_category),
                    "section": self._get_section_for_state(target_state),
                    "status": "draft",
                    "source": "YouTube",
                    "source_url": video['url'],
                    "meta_title": video['title'][:60],
                    "meta_description": video['description'][:160] if video['description'] else video['title'][:160],
                    "created_by_agent": agent_id,
                    "agent_type": "video"
                }
                
                # Create the article
                created = crud.create_article(db, article_data)
                if created:
                    created_posts.append({
                        "id": created.get('id'),
                        "title": video['title'],
                        "video_url": video['url']
                    })
                    print(f"✅ Created video post: {video['title'][:50]}...")
                    
            except Exception as e:
                print(f"❌ Error creating post for video: {e}")
                continue
        
        return {
            "success": True,
            "message": f"Successfully created {len(created_posts)} video posts",
            "videos_found": len(videos),
            "posts_created": len(created_posts),
            "posts": created_posts
        }
    
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
