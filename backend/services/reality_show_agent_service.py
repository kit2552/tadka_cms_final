"""
Reality Show Agent Service
Handles reality show video search from specific shows
Fetches videos from a specific reality show channel
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import crud

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

class RealityShowAgentService:
    """Service for Reality Show Agent - fetches videos from specific reality shows"""
    
    # Language name to code mapping
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
    
    async def run_reality_show_agent(self, agent_id: str) -> Dict:
        """
        Run Reality Show Agent - fetch videos from a specific reality show
        
        Returns:
            Dict with status and created articles info
        """
        try:
            # Get agent configuration
            agent = crud.get_ai_agent(db, agent_id)
            if not agent:
                return {"success": False, "error": "Agent not found"}
            
            print(f"\n{'='*60}")
            print(f"📺 REALITY SHOW AGENT STARTING: {agent.get('agent_name')}")
            print(f"{'='*60}\n")
            
            # Extract agent settings
            reality_show_name = agent.get('reality_show_name')
            reality_show_category = agent.get('reality_show_category') or agent.get('category')
            target_language = agent.get('target_language')
            lookback_days = agent.get('reality_show_lookback_days', 2)
            max_videos = agent.get('max_videos', 5)
            content_filter = agent.get('content_filter', 'videos')
            agent_article_language = agent.get('article_language', 'en')
            content_workflow = agent.get('content_workflow', 'in_review')
            
            # Validate required fields
            if not reality_show_name:
                print("❌ Reality show name not specified")
                return {"success": False, "error": "Reality show name is required"}
            
            if not reality_show_category:
                print("❌ Category not specified")
                return {"success": False, "error": "Category is required"}
            
            if not target_language:
                print("❌ Target language not specified")
                return {"success": False, "error": "Target language is required"}
            
            print(f"📌 Reality Show: {reality_show_name}")
            print(f"📌 Category: {reality_show_category}")
            print(f"📌 Target Language: {target_language}")
            print(f"📌 Lookback Days: {lookback_days}")
            print(f"📌 Max Videos: {max_videos}")
            print(f"📌 Content Filter: {content_filter}")
            
            # Find the reality show channel
            reality_show_channel = db.youtube_channels.find_one({
                "channel_name": reality_show_name,
                "channel_type": "reality_show",
                "is_active": True
            })
            
            if not reality_show_channel:
                print(f"❌ Reality show channel not found: {reality_show_name}")
                return {
                    "success": False,
                    "error": f"Reality show channel not found: {reality_show_name}"
                }
            
            channel_id = reality_show_channel.get('channel_id')
            print(f"✅ Found channel: {reality_show_name} (ID: {channel_id})")
            
            # Fetch videos from this channel
            cutoff_time = datetime.now(timezone.utc) - timedelta(days=lookback_days)
            
            # Build query with content filter
            query = {
                "channel_id": channel_id,
                "published_at": {"$gte": cutoff_time.replace(tzinfo=None)}
            }
            
            # Apply content filter
            if content_filter == 'videos':
                # Only regular videos (exclude shorts)
                query["$or"] = [
                    {"video_type": {"$ne": "short"}},
                    {"video_type": {"$exists": False}},
                    {"video_type": None}
                ]
                print(f"📌 Content Filter: Only Videos (excluding shorts)")
            elif content_filter == 'shorts':
                # Only shorts
                query["video_type"] = "short"
                print(f"📌 Content Filter: Only Shorts")
            else:
                # Both videos and shorts
                print(f"📌 Content Filter: Both Videos and Shorts")
            
            # Fetch videos
            videos = list(db.youtube_videos.find(query).sort("published_at", -1).limit(max_videos))
            
            if not videos:
                print("❌ No videos found matching criteria")
                return {
                    "success": True,
                    "articles_created": 0,
                    "message": "No new videos found"
                }
            
            print(f"✅ Found {len(videos)} videos")
            
            # Create articles from videos
            articles_created = 0
            articles_existing = 0
            
            # Get language code for content_language field
            language_code = self.LANGUAGE_CODE_MAP.get(target_language, target_language.lower()[:2])
            
            for video in videos:
                # Check if article already exists
                existing_article = db.articles.find_one({
                    "youtube_url": video.get('video_url'),
                    "category": reality_show_category
                })
                
                if existing_article:
                    articles_existing += 1
                    continue
                
                # Create video article
                video_title = video.get('title', 'Untitled')
                
                # Generate slug from title
                import re
                slug_base = re.sub(r'[^a-z0-9]+', '-', video_title.lower())
                slug_base = slug_base.strip('-')[:50]
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                slug = f"{slug_base}-{timestamp}"
                
                article_data = {
                    "title": video_title,
                    "slug": slug,
                    "content": f"<p>{video.get('description', '')}</p>",
                    "summary": video.get('description', '')[:200] if video.get('description') else 'Reality show content',
                    "author": "AI Agent",
                    "agent_name": agent.get('agent_name'),
                    "article_language": agent_article_language,
                    "content_language": language_code,
                    "category": reality_show_category,
                    "content_type": "video",
                    "youtube_url": video.get('video_url'),
                    "status": content_workflow,
                    "is_published": content_workflow == 'published',
                    "published_at": video.get('published_at') or datetime.now(timezone.utc).replace(tzinfo=None),
                    "is_top_story": False,
                    "is_featured": False,
                    "comments_enabled": True
                }
                
                # Insert article
                result = crud.create_article(db, article_data)
                articles_created += 1
                print(f"  ✅ Created article: {video.get('title', '')[:50]}")
            
            print(f"\n{'='*60}")
            print(f"✅ REALITY SHOW AGENT COMPLETED")
            print(f"📊 Articles: {articles_created} created, {articles_existing} already existed")
            print(f"{'='*60}\n")
            
            return {
                "success": True,
                "articles_created": articles_created,
                "articles_existing": articles_existing,
                "total_videos": len(videos),
                "message": f"{articles_created} new articles created from {reality_show_name}"
            }
            
        except Exception as e:
            print(f"❌ Error in Reality Show Agent: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

# Global instance
reality_show_agent_service = RealityShowAgentService()

