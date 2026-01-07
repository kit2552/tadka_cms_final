"""
OTT Release Agent Service
Fetches OTT releases from binged.com and creates OTT release records
"""

import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
from database import db
import crud
import uuid
import re


class OTTReleaseAgentService:
    """Service for running OTT Release agents"""
    
    def __init__(self):
        self.is_running = False
    
    async def run_ott_release_agent(self, agent_id: str) -> Dict:
        """
        Run the OTT Release agent to fetch and create OTT release records
        
        Args:
            agent_id: The ID of the agent to run
            
        Returns:
            Dict with execution results
        """
        from services.binged_scraper_service import binged_scraper
        
        print(f"\n🎬 Starting OTT Release Agent: {agent_id}")
        
        # Get agent configuration
        agent = db.ai_agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise ValueError(f"Agent not found: {agent_id}")
        
        # Extract agent settings
        language = agent.get('ott_language', 'Hindi')
        streaming_now = agent.get('ott_streaming_now', True)
        streaming_soon = agent.get('ott_streaming_soon', False)
        fetch_limit = agent.get('ott_fetch_limit', 10)
        content_workflow = agent.get('content_workflow', 'in_review')  # in_review, ready_to_publish, publish
        category = agent.get('category', '')  # Homepage section category
        
        print(f"   📋 Settings: Language={language}, StreamingNow={streaming_now}, StreamingSoon={streaming_soon}, Limit={fetch_limit}, Workflow={content_workflow}, Category={category}")
        
        # Update agent last run time
        db.ai_agents.update_one(
            {"id": agent_id},
            {"$set": {"last_run": datetime.now(timezone.utc)}}
        )
        
        results = {
            "agent_id": agent_id,
            "agent_name": agent.get('agent_name', 'Unknown'),
            "status": "success",
            "releases_fetched": 0,
            "releases_created": 0,
            "releases_skipped": 0,
            "errors": [],
            "created_releases": []
        }
        
        try:
            # Fetch releases from binged.com
            releases = await binged_scraper.fetch_ott_releases(
                language=language,
                streaming_now=streaming_now,
                streaming_soon=streaming_soon,
                limit=fetch_limit
            )
            
            results["releases_fetched"] = len(releases)
            print(f"\n📥 Fetched {len(releases)} releases from binged.com")
            
            # Process each release
            for i, release in enumerate(releases, 1):
                try:
                    movie_name = release.get('movie_name', 'Unknown')
                    print(f"\n   [{i}/{len(releases)}] Processing: {movie_name}")
                    
                    # Check if release already exists (by movie name + year)
                    existing = self._find_existing_release(movie_name, release.get('year'))
                    if existing:
                        print(f"      ⏭️ Skipping - already exists")
                        results["releases_skipped"] += 1
                        continue
                    
                    # Get or create OTT platform
                    platform_id = None
                    platforms = release.get('ott_platforms', [])
                    if platforms:
                        platform_name = platforms[0]  # Use first platform
                        platform_id = self._get_or_create_platform(platform_name)
                    
                    # Prepare release data for OTT release
                    release_data = self._prepare_ott_release_data(release, platform_id, content_workflow, category)
                    
                    # Create OTT release
                    created = crud.create_ott_release(db, release_data)
                    
                    if created:
                        results["releases_created"] += 1
                        results["created_releases"].append({
                            "id": created.get('id'),
                            "movie_name": movie_name,
                            "platform": platforms[0] if platforms else 'Unknown'
                        })
                        print(f"      ✅ Created OTT release")
                    else:
                        results["errors"].append(f"Failed to create release: {movie_name}")
                        print(f"      ❌ Failed to create release")
                    
                except Exception as e:
                    error_msg = f"Error processing {release.get('movie_name', 'Unknown')}: {str(e)}"
                    results["errors"].append(error_msg)
                    print(f"      ❌ {error_msg}")
            
            # Update agent with results
            db.ai_agents.update_one(
                {"id": agent_id},
                {"$set": {
                    "last_run_status": "success",
                    "last_run_results": {
                        "fetched": results["releases_fetched"],
                        "created": results["releases_created"],
                        "skipped": results["releases_skipped"]
                    }
                }}
            )
            
        except Exception as e:
            results["status"] = "error"
            results["errors"].append(str(e))
            
            db.ai_agents.update_one(
                {"id": agent_id},
                {"$set": {
                    "last_run_status": "error",
                    "last_run_error": str(e)
                }}
            )
            
            print(f"\n❌ Agent execution failed: {e}")
            import traceback
            traceback.print_exc()
        
        print(f"\n✅ OTT Release Agent completed: {results['releases_created']} created, {results['releases_skipped']} skipped")
        
        return results
    
    def _find_existing_release(self, movie_name: str, year: Optional[str]) -> Optional[Dict]:
        """Check if an OTT release already exists"""
        # Normalize movie name for comparison
        normalized_name = movie_name.lower().strip()
        
        # Try exact match first
        existing = db.ott_releases.find_one({
            "movie_name": {"$regex": f"^{re.escape(normalized_name)}$", "$options": "i"}
        })
        
        return existing
    
    def _get_or_create_platform(self, platform_name: str) -> Optional[int]:
        """Get existing platform ID or create new one"""
        # Normalize platform name
        platform_name = platform_name.strip()
        
        # Check existing platforms
        existing = db.ott_platforms.find_one({
            "name": {"$regex": f"^{platform_name}$", "$options": "i"}
        })
        
        if existing:
            return existing.get('id')
        
        # Create new platform
        try:
            # Get next ID
            last_platform = db.ott_platforms.find_one(
                sort=[("id", -1)]
            )
            new_id = (last_platform.get('id', 0) + 1) if last_platform else 1
            
            new_platform = {
                "id": new_id,
                "name": platform_name,
                "logo_url": None,
                "created_at": datetime.now(timezone.utc)
            }
            
            db.ott_platforms.insert_one(new_platform)
            print(f"      📺 Created new platform: {platform_name} (ID: {new_id})")
            return new_id
            
        except Exception as e:
            print(f"      ⚠️ Failed to create platform: {e}")
            return None
    
    def _prepare_ott_release_data(self, release: Dict, platform_id: Optional[int], content_workflow: str = 'in_review') -> Dict:
        """Prepare release data for OTT release creation"""
        # Parse release date
        release_date = None
        if release.get('release_date'):
            try:
                release_date = datetime.strptime(release['release_date'], '%Y-%m-%d')
            except:
                release_date = datetime.now()
        
        # Format languages as list
        languages = release.get('languages', [])
        if not languages:
            languages = ['Hindi']
        
        # Format cast as list
        cast = release.get('cast', [])
        cast_list = cast[:10] if cast else []  # Limit to 10 cast members
        
        # Format genres as list
        genres = release.get('genres', [])
        
        # OTT platforms as list
        platforms = release.get('ott_platforms', [])
        
        # Determine content type
        content_type = release.get('content_type', 'movie')
        if content_type == 'web_series':
            content_type = 'Web Series'
        elif content_type == 'documentary':
            content_type = 'Documentary'
        elif content_type == 'tv_show':
            content_type = 'TV Show'
        else:
            content_type = 'Movie'
        
        # Determine status based on workflow
        # in_review -> is_published: False, status: 'in_review'
        # ready_to_publish -> is_published: False, status: 'ready_to_publish'
        # publish -> is_published: True, status: 'published'
        is_published = content_workflow == 'publish'
        status = 'published' if content_workflow == 'publish' else content_workflow
        
        return {
            "movie_name": release.get('movie_name', 'Unknown'),
            "content_type": content_type,
            "season": None,
            "episodes_count": None,
            "original_language": languages[0] if languages else 'Hindi',
            "release_date": release_date,
            "movie_image": None,  # No poster extraction
            "youtube_url": release.get('youtube_url'),
            "ott_platforms": platforms,
            "states": [],
            "languages": languages,
            "genres": genres,
            "director": release.get('director'),
            "producer": None,
            "banner": None,
            "music_director": None,
            "dop": None,
            "editor": None,
            "cast": cast_list,
            "runtime": release.get('runtime'),
            "censor_rating": None,
            "is_published": is_published,
            "status": status,
            "source_url": release.get('source_url'),
            "release_type": release.get('release_type', 'streaming_now'),
            "synopsis": release.get('synopsis')
        }


# Singleton instance
ott_release_agent_service = OTTReleaseAgentService()
