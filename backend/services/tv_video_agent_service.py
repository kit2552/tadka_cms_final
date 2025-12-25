"""
TV Video Agent Service
Handles TV and News videos - aggregates by YouTube channel name
Creates grouped posts (not individual articles)
"""

import asyncio
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import crud

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

class TVVideoAgentService:
    """Service for TV Video Agent - aggregates videos by channel name into grouped posts"""
    
    async def run_tv_video_agent(self, agent_id: str) -> Dict:
        """
        Run TV Video Agent - fetch videos and create grouped posts by channel name
        
        Returns:
            Dict with status and created groups info
        """
        try:
            # Get agent configuration
            agent = crud.get_ai_agent(db, agent_id)
            if not agent:
                return {"success": False, "error": "Agent not found"}
            
            print(f"\n{'='*60}")
            print(f"🎬 TV VIDEO AGENT STARTING: {agent.get('agent_name')}")
            print(f"{'='*60}\n")
            
            # Extract agent settings
            target_language = agent.get('target_language')
            tv_video_category = agent.get('tv_video_category') or agent.get('category')  # Fallback to category field
            lookback_days = agent.get('lookback_days', 2)  # Period to fetch videos
            # Use exactly what was selected - NO DEFAULTS
            channel_types = agent.get('tv_channel_types') or agent.get('channel_types')
            content_filter = agent.get('content_filter', 'videos')
            agent_article_language = agent.get('article_language', 'en')
            content_workflow = agent.get('content_workflow', 'published')
            
            # Validate required fields
            if not target_language:
                print("❌ Target language not specified")
                return {"success": False, "error": "Target language is required"}
            
            if not tv_video_category:
                print("❌ Category not specified")
                return {"success": False, "error": "Video category is required"}
            
            if not channel_types or len(channel_types) == 0:
                print("❌ No channel types selected")
                return {"success": False, "error": "Please select at least one channel type"}
            
            print(f"📌 Target Language: {target_language}")
            print(f"📌 Category: {tv_video_category}")
            print(f"📌 Channel Types: {channel_types}")
            print(f"📌 Content Filter: {content_filter}")
            print(f"📌 Lookback Period: {lookback_days} days")
            
            # IMPORTANT: Filter channels by language FIRST, then get videos from those channels only
            # Get channels that match both channel_type AND language
            matching_channels = list(db.youtube_channels.find({
                "channel_type": {"$in": channel_types},
                "languages": target_language,
                "is_active": True
            }))
            
            if not matching_channels:
                print(f"❌ No {channel_types} channels found with language {target_language}")
                return {
                    "success": True,
                    "groups_created": 0,
                    "message": f"No {channel_types} channels found for {target_language} language"
                }
            
            # Get channel IDs to filter videos
            channel_ids = [ch.get('channel_id') for ch in matching_channels if ch.get('channel_id')]
            
            print(f"✅ Found {len(matching_channels)} matching channels:")
            for ch in matching_channels:
                print(f"   - {ch.get('channel_name')} ({ch.get('channel_type')})")
            
            # Fetch videos ONLY from these specific channels
            from datetime import datetime, timedelta, timezone
            cutoff_time = datetime.now(timezone.utc) - timedelta(days=lookback_days)
            
            # Build query with content filter
            query = {
                "channel_id": {"$in": channel_ids},
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
            
            # Fetch ALL videos from the period (no limit)
            videos = list(db.youtube_videos.find(query).sort("published_at", -1))
            
            if not videos:
                print("❌ No videos found matching criteria")
                return {
                    "success": True,
                    "groups_created": 0,
                    "message": "No new videos found"
                }
            
            print(f"✅ Found {len(videos)} videos from {len(set(v.get('channel_name', 'Unknown') for v in videos))} channels")
            
            # Group videos by channel name
            channel_groups = {}
            for video in videos:
                channel_name = video.get('channel_name', 'Unknown Channel')
                if channel_name not in channel_groups:
                    channel_groups[channel_name] = []
                channel_groups[channel_name].append(video)
            
            print(f"📦 Grouped into {len(channel_groups)} channel groups")
            
            # Create or update grouped posts for each channel
            groups_created = 0
            groups_updated = 0
            total_articles_created = 0
            total_articles_existing = 0
            
            for channel_name, channel_videos in channel_groups.items():
                try:
                    # Sort by published date (most recent first)
                    channel_videos.sort(key=lambda x: x.get('published_at', ''), reverse=True)
                    
                    # Create individual video articles first
                    video_article_ids = []
                    new_articles_in_channel = 0
                    existing_articles_in_channel = 0
                    
                    for video in channel_videos:
                        # Check if article already exists
                        existing_article = db.articles.find_one({
                            "youtube_url": video.get('video_url'),
                            "category": tv_video_category
                        })
                        
                        if existing_article:
                            video_article_ids.append(existing_article.get('id'))
                            existing_articles_in_channel += 1
                            # print(f"  ⏭️  Video already exists: {video.get('title', '')[:50]}")
                        else:
                            # Create video article
                            video_title = video.get('title', 'Untitled')
                            
                            # Generate slug from title
                            import re
                            from datetime import datetime
                            slug_base = re.sub(r'[^a-z0-9]+', '-', video_title.lower())
                            slug_base = slug_base.strip('-')[:50]
                            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                            slug = f"{slug_base}-{timestamp}"
                            
                            article_data = {
                                "title": video_title,
                                "slug": slug,
                                "content": f"<p>{video.get('description', '')}</p>",
                                "summary": video.get('description', '')[:200] if video.get('description') else 'Video content',
                                "author": "AI Agent",
                                "agent_name": agent.get('agent_name'),
                                "article_language": agent_article_language,
                                "content_language": target_language.lower()[:2],
                                "category": tv_video_category,
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
                            video_article_ids.append(result.get('id'))
                            new_articles_in_channel += 1
                            # print(f"  ✅ Created article: {video.get('title', '')[:50]}")
                    
                    total_articles_created += new_articles_in_channel
                    total_articles_existing += existing_articles_in_channel
                    
                    if not video_article_ids:
                        print(f"⏭️  No new videos for {channel_name}")
                        continue
                    
                    # Create or update grouped post
                    group_title = channel_name
                    
                    # Check if group already exists
                    existing_group = db.grouped_posts.find_one({
                        "group_title": group_title,
                        "category": tv_video_category
                    })
                    
                    if existing_group:
                        # Update existing group - add new video IDs
                        existing_post_ids = existing_group.get('post_ids', [])
                        new_post_ids = list(set(existing_post_ids + video_article_ids))
                        
                        db.grouped_posts.update_one(
                            {"_id": existing_group["_id"]},
                            {
                                "$set": {
                                    "post_ids": new_post_ids,
                                    "representative_post_id": video_article_ids[0],  # Most recent
                                    "posts_count": len(new_post_ids),
                                    "updated_at": datetime.now(timezone.utc)
                                }
                            }
                        )
                        groups_updated += 1
                        print(f"✅ Updated group for {channel_name}: +{new_articles_in_channel} new videos ({len(new_post_ids)} total)")
                    else:
                        # Create new grouped post
                        group_data = {
                            "group_title": group_title,
                            "category": tv_video_category,
                            "post_ids": video_article_ids,
                            "representative_post_id": video_article_ids[0],
                            "posts_count": len(video_article_ids),
                            "created_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc)
                        }
                        
                        result = db.grouped_posts.insert_one(group_data)
                        groups_created += 1
                        print(f"✅ Created group for {channel_name} ({len(video_article_ids)} videos)")
                    
                except Exception as e:
                    print(f"❌ Error processing {channel_name}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            print(f"\n{'='*60}")
            print(f"✅ TV VIDEO AGENT COMPLETED")
            print(f"📊 Groups: {groups_created} created, {groups_updated} updated")
            print(f"📊 Articles: {total_articles_created} created, {total_articles_existing} already existed")
            print(f"📊 Total videos processed: {total_articles_created + total_articles_existing}")
            print(f"{'='*60}\n")
            
            return {
                "success": True,
                "groups_created": groups_created,
                "groups_updated": groups_updated,
                "articles_created": total_articles_created,
                "articles_existing": total_articles_existing,
                "total_channels": len(channel_groups),
                "message": f"{total_articles_created} new videos added across {groups_created} new + {groups_updated} updated channel groups"
            }
            
        except Exception as e:
            print(f"❌ Error in TV Video Agent: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

# Global instance
tv_video_agent_service = TVVideoAgentService()

