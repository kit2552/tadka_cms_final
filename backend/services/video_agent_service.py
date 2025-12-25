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
        'latest_video_songs': {
            'name': 'Latest Video Songs',
            'keywords': ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
            'exclude_keywords': ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored']
        },
        'events_interviews': {
            'name': 'Events & Press Meets',
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
        'latest_video_songs_bollywood': {
            'name': 'Latest Video Songs Bollywood',
            'keywords': ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
            'exclude_keywords': ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored']
        },
        'events_interviews_bollywood': {
            'name': 'Events & Press Meets Bollywood',
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
    
    def get_language_code(self, language_name: str) -> str:
        """Convert language name to language code for content_language field"""
        lang_code_map = {
            'Hindi': 'hi',
            'Telugu': 'te',
            'Tamil': 'ta',
            'Kannada': 'kn',
            'Malayalam': 'ml',
            'Bengali': 'bn',
            'Marathi': 'mr',
            'Punjabi': 'pa',
            'Gujarati': 'gu',
            'Odia': 'or',
            'Assamese': 'as',
            'Urdu': 'ur',
            'English': 'en'
        }
        return lang_code_map.get(language_name, language_name.lower()[:2])
    
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
        target_language = agent.get('target_language', 'Hindi')  # Direct language selection
        video_category = agent.get('video_category', 'trailers_teasers')
        search_query = agent.get('search_query', '')
        max_videos = agent.get('max_videos', 5)
        agent_article_language = agent.get('article_language', 'en')
        content_workflow = agent.get('content_workflow', 'draft')
        content_filter = agent.get('content_filter', 'videos')  # 'videos', 'shorts', or 'both'
        
        # Get aggregation settings
        enable_aggregation = agent.get('enable_aggregation', False)
        aggregation_lookback_days = agent.get('aggregation_lookback_days', 2)
        
        # Use video_category as article category slug (with underscores replaced by dashes)
        agent_category = video_category.replace('_', '-')
        
        # Get custom filter keywords from agent config (comma-separated strings)
        include_keywords_str = agent.get('include_keywords', '')
        exclude_keywords_str = agent.get('exclude_keywords', '')
        
        # Parse custom keywords if provided
        custom_include_keywords = [k.strip().lower() for k in include_keywords_str.split(',') if k.strip()] if include_keywords_str else None
        custom_exclude_keywords = [k.strip().lower() for k in exclude_keywords_str.split(',') if k.strip()] if exclude_keywords_str else None
        
        # Get channel types from agent config - NO DEFAULTS
        channel_types = agent.get('channel_types')
        if not channel_types or len(channel_types) == 0:
            print("❌ No channel types selected in agent configuration")
            return {
                'success': False,
                'error': 'No channel types selected. Please select at least one channel type in agent settings.'
            }
        
        print(f"📌 Target Language: {target_language}")
        print(f"📌 Video Category: {video_category}")
        print(f"📌 Article Category: {agent_category}")
        print(f"📌 Channel Types: {channel_types}")
        print(f"📌 Content Filter: {content_filter}")
        if enable_aggregation:
            print(f"📌 Post Aggregation: ENABLED (Lookback: {aggregation_lookback_days} days)")
        if custom_include_keywords:
            print(f"📌 Custom Include Keywords: {custom_include_keywords}")
        if custom_exclude_keywords:
            print(f"📌 Custom Exclude Keywords: {custom_exclude_keywords}")
        print(f"📌 Article Language: {agent_article_language}")
        print(f"📌 Content Workflow: {content_workflow}")
        
        # Use RSS collection only (no YouTube API calls)
        from services.youtube_rss_service import youtube_rss_service
        
        # IMPORTANT: Filter channels by language FIRST, then get videos from those channels
        print(f"🔎 Finding channels: type={channel_types}, language={target_language}")
        
        matching_channels = list(db.youtube_channels.find({
            "channel_type": {"$in": channel_types},
            "languages": target_language,
            "is_active": True
        }))
        
        if not matching_channels:
            print(f"❌ No channels found with type {channel_types} and language {target_language}")
            return {
                "success": False,
                "message": f"No {channel_types} channels found for {target_language} language. Please add channels in Settings.",
                "videos_found": 0,
                "posts_created": 0
            }
        
        # Get channel IDs
        channel_ids = [ch.get('channel_id') for ch in matching_channels if ch.get('channel_id')]
        
        print(f"✅ Found {len(matching_channels)} matching channels:")
        for ch in matching_channels:
            print(f"   - {ch.get('channel_name')} ({ch.get('channel_type')})")
        
        # Fetch videos directly from youtube_videos collection
        from datetime import datetime, timedelta, timezone
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=7)
        
        # Build query
        query = {
            "channel_id": {"$in": channel_ids},
            "published_at": {"$gte": cutoff_time.replace(tzinfo=None)}
        }
        
        # Apply content filter
        if content_filter == 'videos':
            query["$or"] = [
                {"video_type": {"$ne": "short"}},
                {"video_type": {"$exists": False}},
                {"video_type": None}
            ]
        elif content_filter == 'shorts':
            query["video_type"] = "short"
        
        # Fetch ALL videos (no limit)
        all_videos = list(db.youtube_videos.find(query).sort("published_at", -1))
        
        print(f"📺 Found {len(all_videos)} total videos from RSS collection")
        
        if not all_videos:
            return {
                "success": False,
                "message": f"No videos found in the last 7 days from selected channels. Try increasing the period or check RSS feed.",
                "videos_found": 0,
                "posts_created": 0
            }
        
        # Apply keyword filtering if provided
        if video_category:
            category_config = self.CATEGORIES.get(video_category, {})
            include_kw = custom_include_keywords if custom_include_keywords else category_config.get('keywords', [])
            exclude_kw = custom_exclude_keywords if custom_exclude_keywords else category_config.get('exclude_keywords', [])
            
            filtered_videos = []
            for video in all_videos:
                title_lower = video.get('title', '').lower()
                
                # Check include keywords
                if include_kw:
                    has_include = any(kw in title_lower for kw in include_kw)
                    if not has_include:
                        continue
                
                # Check exclude keywords
                if exclude_kw:
                    has_exclude = any(kw in title_lower for kw in exclude_kw)
                    if has_exclude:
                        continue
                
                filtered_videos.append(video)
            
            videos = filtered_videos
            print(f"📋 After keyword filtering: {len(videos)} videos")
        else:
            videos = all_videos
        
        if not videos:
            return {
                "success": False,
                "message": f"No videos matched the keyword criteria. Found {len(all_videos)} videos but none matched filters.",
                "videos_found": 0,
                "posts_created": 0
            }
        
        # Log channels in results
        channels_found = set(v.get('channel_name', 'Unknown') for v in videos[:10])
        print(f"   Channels in results: {', '.join(channels_found)}")
        
        # Create video posts - NO LIMIT, process all matched videos
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
                video_language = video.get('detected_language', target_language)  # Get language from video or use target
                
                # Convert target_language name to language code for content_language
                content_language_code = self.get_language_code(target_language)
                print(f"🔍 DEBUG - Setting content_language: {target_language} -> code: {content_language_code}")  # Debug log
                
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
                    "video_language": video_language,  # Store the video's language for frontend filtering
                    "content_language": content_language_code,  # Set content_language code from agent's target_language
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
                
                print(f"🔍 DEBUG - article_data content_language: {article_data.get('content_language')}")  # Debug log
                
                print(f"📝 Creating: {display_title[:50]}... from {channel_name or 'Unknown'}")
                
                created = crud.create_article(db, article_data)
                if created:
                    post_id = created.get('id')
                    created_posts.append({
                        "id": post_id,
                        "title": display_title,
                        "video_url": youtube_url,
                        "channel": channel_name
                    })
                    print(f"   ✅ Created successfully (ID: {post_id})")
                    
                    # Handle post aggregation if enabled
                    if enable_aggregation and post_id:
                        try:
                            # Extract movie/event name from title
                            movie_name = self._extract_movie_name_for_grouping(title_cased_youtube)
                            print(f"   🔗 Grouping: Extracted movie name '{movie_name}' from title")
                            
                            # Find or create grouped post (pass full title for word matching)
                            matching_group = crud.find_matching_grouped_post(
                                db, 
                                movie_name, 
                                agent_category, 
                                aggregation_lookback_days,
                                new_post_title=title_cased_youtube  # Pass full title for common word detection
                            )
                            
                            if matching_group:
                                print(f"   ✅ Added to existing group '{matching_group.get('group_title')}'")
                            else:
                                print(f"   ✨ Created new group '{movie_name}'")
                            
                            # Create or update the grouped post
                            crud.create_or_update_grouped_post(
                                db,
                                movie_name,
                                agent_category,
                                post_id
                            )
                        except Exception as e:
                            print(f"   ⚠️ Aggregation error (continuing anyway): {e}")
                    
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
    
    def _extract_movie_name_for_grouping(self, title: str) -> str:
        """Extract movie/event name from video title for aggregation
        
        Priority:
        1. Extract hashtags (e.g., #Rowdyjanardhana, #SVC59, #Dhandoraa)
        2. Look for @ symbol and extract movie name
        3. Look for pattern "MovieName Pre Release Event" after |
        4. Search for other patterns
        
        All matching is case-insensitive
        """
        if not title:
            return "Other Events"
        
        # Work with lowercase for consistent matching
        title_lower = title.lower()
        
        # Priority 1: Look for hashtags first
        hashtag_match = re.search(r'#([A-Za-z0-9]+)', title)
        if hashtag_match:
            hashtag_name = hashtag_match.group(1)
            if len(hashtag_name) >= 4:
                return hashtag_name.title()
        
        # Priority 2: Look for @ symbol
        if '@' in title_lower:
            after_at = title_lower.split('@', 1)[1].strip()
            
            words = re.split(r'[\s]+', after_at)
            movie_name_parts = []
            event_keywords = ['movie', 'pre', 'press', 'trailer', 'teaser', 'audio', 'success', 
                             'interview', 'event', 'launch', 'promotion', 'in', 'at', 'exclusive',
                             'official', 'first', 'glimpse', 'motion', 'poster', 'release', 'meet',
                             'team', 'says', 'super', 'fun', 'emotional', 'cute', 'superb', 'about']
            
            for word in words:
                word_lower = word.lower()
                if word_lower in event_keywords:
                    break
                movie_name_parts.append(word)
                if len(movie_name_parts) >= 3:
                    break
            
            if movie_name_parts:
                movie_name = ' '.join(movie_name_parts).strip()
                if movie_name:
                    return movie_name.title()  # Return with proper case
        
        # Priority 3: Look for "MovieName Pre Release Event" or "MovieName Press Meet" after | or -
        # Example: "... | Eesha Pre Release Event" -> "Eesha"
        # Use case-insensitive matching and capture from lowercase string
        event_pattern = r'[\|\-]\s*([a-z][a-z]+(?:\s+[a-z][a-z]+)?)\s+(?:pre\s+release(?:\s+event)?|press\s+meet|audio\s+launch|teaser\s+launch|trailer\s+launch|success\s+meet|event)'
        event_match = re.search(event_pattern, title_lower)
        if event_match:
            movie_name = event_match.group(1).strip()
            # Avoid names that are clearly people (common first names)
            person_names = ['sree', 'vishnu', 'ram', 'bunny', 'vasu', 'kumar', 'reddy']
            if movie_name not in person_names:
                return movie_name.title()  # Return with proper case
        
        # Priority 4: Search for patterns
        patterns = [
            r'(?:with|about)\s+([a-z][a-z]+(?:\s+[a-z][a-z]+)?)\s+(?:team|movie|event|pre|press)',
            r'([a-z][a-z]+(?:\s+[a-z][a-z]+)?)\s+(?:movie|team|event|pre-release|press\s+meet)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, title_lower)
            if match:
                candidate = match.group(1).strip()
                person_keywords = ['actress', 'actor', 'hero', 'heroine', 'director', 'music', 
                                  'producer', 'comedian']
                if candidate.lower() not in person_keywords:
                    return candidate.title()  # Return with proper case
        
        # Fallback: Use full title (better than partial sentence)
        # Remove emojis and extra spaces
        title_clean = re.sub(r'[\U0001F300-\U0001F9FF]', '', title)  # Remove emojis
        title_clean = ' '.join(title_clean.split()).strip()  # Normalize spaces
        
        # Limit length and add ... if truncated
        max_length = 80
        if len(title_clean) > max_length:
            # Truncate at word boundary and add ...
            truncated = title_clean[:max_length].rsplit(' ', 1)[0]
            return truncated + '...'
        
        return title_clean if title_clean else "Other Events"


# Singleton instance
video_agent_runner = VideoAgentService()
