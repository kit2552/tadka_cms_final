"""
Reality Show Agent Service
Handles reality show video search from specific shows
Fetches videos from a specific reality show channel and groups them
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import crud
import uuid

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

class RealityShowAgentService:
    """Service for Reality Show Agent - fetches videos from specific reality shows and groups them"""
    
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
        Run Reality Show Agent - fetch videos from a specific reality show and create grouped posts
        
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
            youtube_channel_id = agent.get('youtube_channel_id')
            reality_show_category = agent.get('reality_show_category') or agent.get('category')
            target_language = agent.get('target_language')
            lookback_days = agent.get('reality_show_lookback_days', 2)
            content_filter = agent.get('content_filter', 'videos')
            agent_article_language = agent.get('article_language', 'en')
            content_workflow = agent.get('content_workflow', 'in_review')
            include_keywords = agent.get('include_keywords', '')  # Comma-separated keywords
            
            # Validate required fields
            if not reality_show_name:
                print("❌ Reality show name not specified")
                return {"success": False, "error": "Reality show name is required"}
            
            if not youtube_channel_id:
                print("❌ YouTube channel ID not specified")
                return {"success": False, "error": "YouTube channel is required"}
            
            if not reality_show_category:
                print("❌ Category not specified")
                return {"success": False, "error": "Category is required"}
            
            if not target_language:
                print("❌ Target language not specified")
                return {"success": False, "error": "Target language is required"}
            
            print(f"📌 Reality Show: {reality_show_name}")
            print(f"📌 YouTube Channel ID: {youtube_channel_id}")
            print(f"📌 Category: {reality_show_category}")
            print(f"📌 Target Language: {target_language}")
            print(f"📌 Lookback Days: {lookback_days}")
            print(f"📌 Content Filter: {content_filter}")
            print(f"📌 Include Keywords: {include_keywords}")
            
            # Parse include keywords
            include_keyword_list = []
            if include_keywords:
                include_keyword_list = [kw.strip().lower() for kw in include_keywords.split(',') if kw.strip()]
                print(f"📌 Parsed Keywords: {include_keyword_list}")
            
            # Fetch videos from this channel
            cutoff_time = datetime.now(timezone.utc) - timedelta(days=lookback_days)
            
            # Build query with content filter
            query = {
                "channel_id": youtube_channel_id,
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
            
            # Fetch ALL videos (no limit)
            videos = list(db.youtube_videos.find(query).sort("published_at", -1))
            
            if not videos:
                print("❌ No videos found matching criteria")
                return {
                    "success": True,
                    "articles_created": 0,
                    "groups_created": 0,
                    "message": "No new videos found"
                }
            
            print(f"✅ Found {len(videos)} videos before keyword filtering")
            
            # Filter by include keywords if specified
            filtered_videos = []
            if include_keyword_list:
                for video in videos:
                    video_title = video.get('title', '').lower()
                    # Check if ANY of the keywords are in the title
                    if any(keyword in video_title for keyword in include_keyword_list):
                        filtered_videos.append(video)
                print(f"✅ After keyword filtering: {len(filtered_videos)} videos")
                videos = filtered_videos
            else:
                print(f"ℹ️ No keyword filtering applied - using all {len(videos)} videos")
            
            if not videos:
                print("❌ No videos found after keyword filtering")
                return {
                    "success": True,
                    "articles_created": 0,
                    "groups_created": 0,
                    "message": "No videos matched the keyword filter"
                }
            
            # Create articles from videos
            articles_created = 0
            articles_existing = 0
            post_ids = []
            
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
                    post_ids.append(existing_article.get('id'))
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
                post_ids.append(result.get('id'))
                print(f"  ✅ Created article: {video.get('title', '')[:50]}")
            
            print(f"\n📊 Articles: {articles_created} created, {articles_existing} already existed")
            
            # Create or update grouped post for this reality show
            groups_created = 0
            groups_updated = 0
            
            if post_ids:
                # Check if grouped post already exists for this show
                existing_group = db.grouped_posts.find_one({
                    "category": reality_show_category,
                    "group_title": reality_show_name
                })
                
                if existing_group:
                    # Update existing group
                    db.grouped_posts.update_one(
                        {"id": existing_group.get('id')},
                        {
                            "$set": {
                                "post_ids": post_ids,
                                "posts_count": len(post_ids),
                                "representative_post_id": post_ids[0] if post_ids else None,
                                "updated_at": datetime.now(timezone.utc).replace(tzinfo=None)
                            }
                        }
                    )
                    groups_updated += 1
                    print(f"  ✅ Updated grouped post: {reality_show_name}")
                else:
                    # Create new grouped post
                    group_data = {
                        "id": str(uuid.uuid4()),
                        "category": reality_show_category,
                        "group_title": reality_show_name,
                        "group_type": "reality_show",
                        "post_ids": post_ids,
                        "posts_count": len(post_ids),
                        "representative_post_id": post_ids[0] if post_ids else None,
                        "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
                        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None)
                    }
                    db.grouped_posts.insert_one(group_data)
                    groups_created += 1
                    print(f"  ✅ Created grouped post: {reality_show_name}")
            
            print(f"\n{'='*60}")
            print(f"✅ REALITY SHOW AGENT COMPLETED")
            print(f"📊 Articles: {articles_created} created, {articles_existing} already existed")
            print(f"📊 Groups: {groups_created} created, {groups_updated} updated")
            print(f"{'='*60}\n")
            
            return {
                "success": True,
                "articles_created": articles_created,
                "articles_existing": articles_existing,
                "groups_created": groups_created,
                "groups_updated": groups_updated,
                "total_videos": len(videos),
                "message": f"{articles_created} new articles created and grouped for {reality_show_name}"
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
