"""
Video Agent Service
Handles YouTube video search for trailers, teasers, trending videos, events/interviews and tadka shorts
Uses RSS feed collection only (no YouTube API calls)
"""

import asyncio
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import crud

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

class VideoAgentService:
    """Service for Video Agent - uses RSS feed collection only"""
    
    # Video categories with their search keywords
    CATEGORIES = {
        'trailers_teasers': {
            'name': 'Trailers & Teasers',
            'keywords': ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster'],
            'exclude_keywords': ['reaction', 'review', 'explained', 'scene', 'behind the scenes', 'making', 'dubbed', 'full movie', 'song promo', 'promo song']
        },
        'trending_videos': {
            'name': 'Latest Video Songs',
            'keywords': ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
            'exclude_keywords': ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored']
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
        },
        # Bollywood categories
        'trailers_teasers_bollywood': {
            'name': 'Trailers & Teasers Bollywood',
            'keywords': ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster'],
            'exclude_keywords': ['reaction', 'review', 'explained', 'scene', 'behind the scenes', 'making', 'dubbed', 'full movie', 'song promo', 'promo song']
        },
        'trending_videos_bollywood': {
            'name': 'Latest Video Songs Bollywood',
            'keywords': ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
            'exclude_keywords': ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored']
        },
        'events_interviews_bollywood': {
            'name': 'Events & Interviews Bollywood',
            'keywords': ['interview', 'press meet', 'event', 'promotion', 'launch', 'speech'],
            'exclude_keywords': ['trailer', 'teaser', 'song']
        },
        'tadka_shorts_bollywood': {
            'name': 'Tadka Shorts Bollywood',
            'keywords': ['shorts', 'reels', 'hot', 'photoshoot'],
            'exclude_keywords': [],
            'video_type': 'short'
        }
    }
    
    # State to language mapping (will be fetched from DB)
    DEFAULT_STATE_LANGUAGE_MAP = {
        'andhra-pradesh': ['Telugu'],
        'ap': ['Telugu'],
        'telangana': ['Telugu'],
        'ts': ['Telugu'],
        'tamil-nadu': ['Tamil'],
        'tn': ['Tamil'],
        'karnataka': ['Kannada'],
        'ka': ['Kannada'],
        'kerala': ['Malayalam'],
        'kl': ['Malayalam'],
        'maharashtra': ['Marathi', 'Hindi'],
        'mh': ['Marathi', 'Hindi'],
        'west-bengal': ['Bengali'],
        'wb': ['Bengali'],
        'bollywood': ['Hindi'],
        'all': ['Hindi'],
        'gujarat': ['Gujarati', 'Hindi'],
        'gj': ['Gujarati', 'Hindi'],
        'punjab': ['Punjabi', 'Hindi'],
        'pb': ['Punjabi', 'Hindi'],
        'delhi': ['Hindi', 'Punjabi', 'Urdu'],
        'dl': ['Hindi', 'Punjabi', 'Urdu']
    }
    
    # State name to code mapping for articles states field
    STATE_NAME_TO_CODE = {
        'Andhra Pradesh': 'ap',
        'Telangana': 'ts',
        'Tamil Nadu': 'tn',
        'Karnataka': 'ka',
        'Kerala': 'kl',
        'Maharashtra': 'mh',
        'West Bengal': 'wb',
        'Gujarat': 'gj',
        'Punjab': 'pb',
        'Delhi': 'dl',
        'Rajasthan': 'rj',
        'Uttar Pradesh': 'up',
        'Bihar': 'bh',
        'Odisha': 'od',
        'Madhya Pradesh': 'mp',
        'Bollywood': 'bollywood',
        'All': 'all'
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
        self.state_language_map = {}
    
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
        """Get primary language for a given state"""
        state_lower = state.lower().replace(' ', '-')
        languages = self.state_language_map.get(state_lower, 'Hindi')
        # Handle both array and string formats
        if isinstance(languages, list):
            return languages[0] if languages else 'Hindi'
        return languages
    
    def _get_languages_for_state(self, state: str) -> List[str]:
        """Get all languages for a given state (returns list)"""
        state_lower = state.lower().replace(' ', '-')
        languages = self.state_language_map.get(state_lower, ['Hindi'])
        # Handle both array and string formats
        if isinstance(languages, list):
            return languages if languages else ['Hindi']
        return [languages]
    
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
        content_filter = agent.get('content_filter', 'videos')  # 'videos', 'shorts', or 'both'
        
        # Map video_category to article category slug
        VIDEO_CATEGORY_TO_ARTICLE_CATEGORY = {
            'trailers_teasers': 'trailers-teasers',
            'trending_videos': 'latest-video-songs',
            'events_interviews': 'events-interviews',
            'tadka_shorts': 'tadka-shorts',
            'trailers_teasers_bollywood': 'trailers-teasers-bollywood',
            'trending_videos_bollywood': 'latest-video-songs-bollywood',
            'events_interviews_bollywood': 'events-interviews-bollywood',
            'tadka_shorts_bollywood': 'tadka-shorts-bollywood'
        }
        agent_category = VIDEO_CATEGORY_TO_ARTICLE_CATEGORY.get(video_category, agent.get('category', 'trailers-teasers'))
        
        # Get custom filter keywords from agent config (comma-separated strings)
        include_keywords_str = agent.get('include_keywords', '')
        exclude_keywords_str = agent.get('exclude_keywords', '')
        
        # Parse custom keywords if provided
        custom_include_keywords = [k.strip().lower() for k in include_keywords_str.split(',') if k.strip()] if include_keywords_str else None
        custom_exclude_keywords = [k.strip().lower() for k in exclude_keywords_str.split(',') if k.strip()] if exclude_keywords_str else None
        
        # Get channel types from agent config (NEW FIELD)
        channel_types = agent.get('channel_types', [])
        if not channel_types:
            # Default to all types if not specified
            channel_types = ['production_house', 'music_label', 'popular_channel']
        
        # Get state-language mapping
        self.state_language_map = await self._get_state_language_mapping()
        state_languages = self._get_languages_for_state(target_state)
        search_language = state_languages[0] if state_languages else 'Hindi'
        
        print(f"📌 Target State: {target_state}")
        print(f"📌 State Languages: {state_languages}")
        print(f"📌 Primary Search Language: {search_language}")
        print(f"📌 Video Category: {video_category}")
        print(f"📌 Article Category: {agent_category}")
        print(f"📌 Channel Types: {channel_types}")
        print(f"📌 Content Filter: {content_filter}")
        if custom_include_keywords:
            print(f"📌 Custom Include Keywords: {custom_include_keywords}")
        if custom_exclude_keywords:
            print(f"📌 Custom Exclude Keywords: {custom_exclude_keywords}")
        print(f"📌 Article Language: {agent_article_language}")
        print(f"📌 Content Workflow: {content_workflow}")
        
        # Use RSS collection only (no YouTube API calls)
        from services.youtube_rss_service import youtube_rss_service
        
        # Pass all state languages to filter videos (uses channel's assigned languages only)
        print(f"🔎 Fetching videos for languages: {state_languages}, channel_types: {channel_types}")
        videos = youtube_rss_service.get_videos_for_agent(
            channel_types=channel_types,
            languages=state_languages,  # Pass all languages for the state
            video_category=video_category,
            max_videos=max_videos * 2,  # Get extra for filtering
            days_ago=7,
            content_filter=content_filter,  # Pass content filter
            custom_include_keywords=custom_include_keywords,
            custom_exclude_keywords=custom_exclude_keywords
        )
        
        if videos:
            print(f"📺 Found {len(videos)} videos from RSS collection")
            # Log channels represented to verify correct filtering
            channels_found = set(v.get('channel_name', 'Unknown') for v in videos[:10])
            print(f"   Channels in results: {', '.join(channels_found)}")
        
        if not videos:
            return {
                "success": False,
                "message": f"No videos found in RSS collection for the given criteria. Please ensure RSS feed is running and channels are configured.",
                "videos_found": 0,
                "posts_created": 0
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
                
                original_youtube_title = video['title']  # Full YouTube title
                display_title = self._extract_display_title(original_youtube_title)  # Extract display title (before first pipe)
                
                # Apply title case to main title
                title_cased_youtube = self._to_title_case(original_youtube_title)
                
                slug = self._generate_slug(display_title)
                current_time = datetime.now(timezone.utc)
                
                # Handle both RSS and API video formats
                description = video.get('description', '') or ''
                thumbnail = video.get('thumbnail', '') or video.get('image', '')
                channel_name = video.get('channel_name', '') or video.get('channel', '')
                
                article_data = {
                    "title": title_cased_youtube,  # Store full YouTube title as main title (title case)
                    "display_title": display_title,  # Store text before first pipe for home page display
                    "slug": slug,
                    "author": "AI Agent",
                    "agent_name": agent_name,
                    "content": f"<p>{description[:500] if description else display_title}</p>",
                    "summary": description[:200] if description else display_title,
                    "content_type": "video",
                    "youtube_url": youtube_url,
                    "image": thumbnail,
                    "category": agent_category,
                    "states": f'["{self.STATE_NAME_TO_CODE.get(target_state, target_state.lower())}"]',
                    "status": content_workflow,
                    "source": "YouTube",
                    "source_url": youtube_url,
                    "seo_title": display_title[:60],
                    "seo_description": description[:160] if description else display_title[:160],
                    "created_by_agent": agent_id,
                    "agent_type": "video",
                    "youtube_video_id": video['video_id'],
                    "channel_name": channel_name,
                    "article_language": agent_article_language,
                    "created_at": current_time,
                    "published_at": current_time
                }
                
                print(f"📝 Creating: {display_title[:50]}... from {channel_name or 'Unknown'}")
                
                created = crud.create_article(db, article_data)
                if created:
                    created_posts.append({
                        "id": created.get('id'),
                        "title": display_title,
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
            "source_method": "rss_collection",
            "posts": created_posts
        }
    
    def _to_title_case(self, text: str) -> str:
        """Convert text to title case (first letter of each word capitalized, rest lowercase)
        Handles special cases like words in brackets: (Hindi) -> (Hindi)
        """
        if not text:
            return text
        
        result = []
        words = text.split()
        
        for word in words:
            if not word:
                continue
            
            # Handle words with leading special characters like (word) or [word]
            leading_chars = ''
            trailing_chars = ''
            core_word = word
            
            # Extract leading special characters
            i = 0
            while i < len(core_word) and not core_word[i].isalnum():
                leading_chars += core_word[i]
                i += 1
            core_word = core_word[i:]
            
            # Extract trailing special characters
            j = len(core_word) - 1
            while j >= 0 and not core_word[j].isalnum():
                trailing_chars = core_word[j] + trailing_chars
                j -= 1
            core_word = core_word[:j+1] if j >= 0 else ''
            
            # Capitalize the core word
            if core_word:
                core_word = core_word[0].upper() + core_word[1:].lower() if len(core_word) > 1 else core_word.upper()
            
            result.append(leading_chars + core_word + trailing_chars)
        
        return ' '.join(result)
    
    def _extract_display_title(self, title: str, video_category: str = None) -> str:
        """Extract display title from YouTube video title for homepage
        
        Simple rule: Show everything before the first pipe (|)
        
        Examples:
        - "Tere Sang Yaara - Rustom | Akshay Kumar & Ileana D'cruz" -> "Tere Sang Yaara - Rustom"
        - "Pushpa 2 Official Trailer | Allu Arjun | Rashmika" -> "Pushpa 2 Official Trailer"
        - "MADHAM Trailer | Harsha | Anuroop" -> "Madham Trailer"
        """
        if not title:
            return "Video"
        
        # Remove hashtags but keep the text after #
        clean = re.sub(r'#(\w+)', r'\1', title).strip()
        
        # Get everything before the first pipe
        if '|' in clean:
            result = clean.split('|')[0].strip()
        else:
            result = clean.strip()
        
        # Clean up trailing punctuation
        result = result.rstrip('|-:,').strip()
        
        # Apply title case
        return self._to_title_case(result) if result else "Video"
    
    def _clean_video_title(self, title: str) -> str:
        """Legacy method - calls _extract_display_title for backward compatibility"""
        return self._extract_display_title(title)
    
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
