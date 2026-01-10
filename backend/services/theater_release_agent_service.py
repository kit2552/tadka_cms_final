"""
Theater Release Agent Service
Handles fetching theater releases from IMDb and creating entries in the database
"""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
from database import db
import crud
from services.imdb_scraper_service import imdb_scraper


class TheaterReleaseAgentService:
    """Service for Theater Release Agent operations"""
    
    async def run_theater_release_agent(self, agent_id: str) -> Dict:
        """Run the theater release agent to fetch and create releases"""
        print(f"\n🎬 Starting Theater Release Agent: {agent_id}")
        
        # Get agent configuration
        agent = db.ai_agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise ValueError(f"Agent not found: {agent_id}")
        
        # Extract agent settings
        reference_urls = agent.get('reference_urls', [])
        fetch_limit = agent.get('theater_fetch_limit', 10)
        content_workflow = agent.get('content_workflow', 'in_review')
        include_english = agent.get('theater_include_english', True)
        search_trailers = agent.get('theater_search_trailers', False)
        
        print(f"   📋 Settings: URLs={len(reference_urls)}, Limit={fetch_limit}, Workflow={content_workflow}, IncludeEnglish={include_english}, SearchTrailers={search_trailers}")
        
        # Update agent last run time
        db.ai_agents.update_one(
            {"id": agent_id},
            {"$set": {"last_run": datetime.now(timezone.utc)}}
        )
        
        results = {
            "agent_id": agent_id,
            "agent_name": agent.get('agent_name', 'Theater Release Agent'),
            "status": "success",
            "releases_fetched": 0,
            "releases_created": 0,
            "releases_skipped": 0,
            "trailers_found": 0,
            "errors": [],
            "created_releases": []
        }
        
        try:
            # Fetch releases from IMDb
            releases = await imdb_scraper.fetch_theater_releases(
                reference_urls=reference_urls,
                limit=fetch_limit,
                include_english=include_english
            )
            
            results["releases_fetched"] = len(releases)
            print(f"\n📥 Fetched {len(releases)} releases from IMDb")
            
            # Process each release
            created_release_ids = []
            for i, release in enumerate(releases, 1):
                movie_name = release.get('movie_name', 'Unknown')
                print(f"\n   [{i}/{len(releases)}] Processing: {movie_name}")
                
                try:
                    # Check if release already exists
                    existing = db.theater_releases.find_one({
                        "movie_name": {"$regex": f"^{re.escape(movie_name)}$", "$options": "i"}
                    })
                    
                    if existing:
                        print(f"      ⏭️ Skipping - already exists")
                        results["releases_skipped"] += 1
                        continue
                    
                    # Prepare release data
                    release_data = self._prepare_theater_release_data(release, content_workflow)
                    
                    # Create release
                    created = crud.create_theater_release(db, release_data)
                    
                    if created:
                        results["releases_created"] += 1
                        release_id = created.get('id')
                        created_release_ids.append(release_id)
                        results["created_releases"].append({
                            "id": release_id,
                            "movie_name": movie_name,
                            "release_date": release.get('release_date')
                        })
                        print(f"      ✅ Created theater release")
                    
                except Exception as e:
                    error_msg = f"Error processing {movie_name}: {str(e)}"
                    print(f"      ❌ {error_msg}")
                    results["errors"].append(error_msg)
            
            # Search for trailers if enabled
            if search_trailers and created_release_ids:
                print(f"\n🔍 Searching for trailers for {len(created_release_ids)} new releases...")
                trailers_found = await self._search_trailers_for_releases(created_release_ids)
                results["trailers_found"] = trailers_found
            
            print(f"\n✅ Theater Release Agent completed: {results['releases_created']} created, {results['releases_skipped']} skipped")
            
        except Exception as e:
            results["status"] = "error"
            results["errors"].append(str(e))
            print(f"\n❌ Agent error: {e}")
            import traceback
            traceback.print_exc()
        
        return results
    
    def _prepare_theater_release_data(self, release: Dict, content_workflow: str = 'in_review') -> Dict:
        """Prepare release data for theater release creation"""
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
        cast_list = cast[:10] if cast else []
        
        # Format genres as list
        genres = release.get('genres', [])
        
        # Determine status based on workflow
        is_published = content_workflow == 'publish'
        status = 'published' if content_workflow == 'publish' else content_workflow
        
        return {
            "movie_name": release.get('movie_name', 'Unknown'),
            "release_date": release_date,
            "youtube_url": release.get('youtube_url'),
            "states": [],
            "languages": languages,
            "original_language": languages[0] if languages else 'Hindi',
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
            "imdb_id": release.get('imdb_id'),
        }
    
    async def _search_trailers_for_releases(self, release_ids: List[int]) -> int:
        """Search for YouTube trailers for newly created releases"""
        trailers_found = 0
        
        for release_id in release_ids:
            # Get release details
            release = db.theater_releases.find_one({"id": release_id}, {"_id": 0})
            if not release:
                continue
            
            movie_name = release.get('movie_name', '')
            if not movie_name:
                continue
            
            print(f"   🔍 Searching trailer for: {movie_name}")
            
            # Search in YouTube RSS feeds stored in the database
            trailer_url = await self._search_youtube_rss_for_trailer(movie_name)
            
            if trailer_url:
                # Update release with trailer URL
                db.theater_releases.update_one(
                    {"id": release_id},
                    {"$set": {"youtube_url": trailer_url, "updated_at": datetime.now(timezone.utc)}}
                )
                trailers_found += 1
                print(f"      ✅ Found trailer: {trailer_url}")
            else:
                print(f"      ⚠️ No trailer found")
        
        return trailers_found
    
    async def _search_youtube_rss_for_trailer(self, movie_name: str) -> Optional[str]:
        """Search YouTube RSS feed data for movie trailer/teaser/promo"""
        import re
        
        # Clean movie name for search
        search_terms = movie_name.lower().strip()
        # Remove special characters
        search_terms = re.sub(r'[^\w\s]', '', search_terms)
        words = search_terms.split()
        
        # Keywords to look for in video titles
        trailer_keywords = ['trailer', 'teaser', 'promo', 'official', 'glimpse', 'first look']
        
        # Search in youtube_channels collection for RSS feed data
        # Look for videos with matching movie name and trailer keywords
        
        # Get all YouTube channels
        channels = list(db.youtube_channels.find({}, {"_id": 0}))
        
        for channel in channels:
            # Check if channel has cached videos/feed data
            feed_data = channel.get('feed_data', [])
            
            for video in feed_data:
                video_title = video.get('title', '').lower()
                video_url = video.get('url', '') or video.get('link', '')
                
                # Check if video title contains movie name words
                movie_match = all(word in video_title for word in words if len(word) > 2)
                
                # Check if video is a trailer/teaser
                is_trailer = any(keyword in video_title for keyword in trailer_keywords)
                
                if movie_match and is_trailer and video_url:
                    # Convert to standard YouTube watch URL
                    video_id_match = re.search(r'(?:v=|youtu\.be/|embed/)([\w-]+)', video_url)
                    if video_id_match:
                        return f'https://www.youtube.com/watch?v={video_id_match.group(1)}'
                    return video_url
        
        # Also search in youtube_videos collection if it exists
        try:
            videos = list(db.youtube_videos.find({}, {"_id": 0}).limit(500))
            
            for video in videos:
                video_title = video.get('title', '').lower()
                video_url = video.get('youtube_url', '') or video.get('url', '')
                
                # Check if video title contains movie name words
                movie_match = all(word in video_title for word in words if len(word) > 2)
                
                # Check if video is a trailer/teaser
                is_trailer = any(keyword in video_title for keyword in trailer_keywords)
                
                if movie_match and is_trailer and video_url:
                    # Convert to standard YouTube watch URL
                    video_id_match = re.search(r'(?:v=|youtu\.be/|embed/)([\w-]+)', video_url)
                    if video_id_match:
                        return f'https://www.youtube.com/watch?v={video_id_match.group(1)}'
                    return video_url
        except:
            pass
        
        return None


# Import re for regex
import re

# Singleton instance
theater_release_agent_service = TheaterReleaseAgentService()
