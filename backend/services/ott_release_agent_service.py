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
        
        print(f"   📋 Settings: Language={language}, StreamingNow={streaming_now}, StreamingSoon={streaming_soon}, Limit={fetch_limit}")
        
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
                    release_data = self._prepare_ott_release_data(release, platform_id)
                    
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
            "movie_name": {"$regex": f"^{normalized_name}$", "$options": "i"}
        })
        
        if existing:
            return existing
        
        # Try with year if available
        if year:
            existing = db.ott_releases.find_one({
                "movie_name": {"$regex": normalized_name, "$options": "i"},
                "release_year": str(year)
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
    
    def _prepare_ott_release_data(self, release: Dict, platform_id: Optional[int]) -> Dict:
        """Prepare release data for OTT release creation"""
        # Parse release date
        release_date = None
        if release.get('release_date'):
            try:
                release_date = datetime.strptime(release['release_date'], '%Y-%m-%d')
            except:
                release_date = datetime.now()
        
        # Format languages as comma-separated string
        languages = release.get('languages', [])
        language_str = ', '.join(languages) if languages else 'Hindi'
        
        # Format cast as comma-separated string
        cast = release.get('cast', [])
        cast_str = ', '.join(cast[:10]) if cast else None  # Limit to 10 cast members
        
        # Format genres
        genres = release.get('genres', [])
        genre_str = ', '.join(genres) if genres else None
        
        # Determine content type for category
        content_type = release.get('content_type', 'movie')
        if content_type == 'web_series':
            category = 'Web Series'
        elif content_type == 'documentary':
            category = 'Documentary'
        elif content_type == 'tv_show':
            category = 'TV Show'
        else:
            category = 'Movie'
        
        return {
            "movie_name": release.get('movie_name', 'Unknown'),
            "movie_tagline": release.get('synopsis', '')[:200] if release.get('synopsis') else None,
            "movie_description": release.get('synopsis'),
            "release_date": release_date,
            "release_year": release.get('year'),
            "ott_platform_id": platform_id,
            "language": language_str,
            "cast": cast_str,
            "director": release.get('director'),
            "producer": None,
            "music_director": None,
            "runtime": release.get('runtime'),
            "genre": genre_str,
            "movie_poster": release.get('poster_url'),
            "movie_banner": None,
            "trailer_url": release.get('youtube_url'),
            "category": category,
            "is_published": False,  # Keep in draft
            "created_at": datetime.now(timezone.utc),
            "source_url": release.get('source_url'),
            "release_type": release.get('release_type', 'streaming_now')
        }


# Singleton instance
ott_release_agent_service = OTTReleaseAgentService()
