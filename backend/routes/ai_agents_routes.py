"""
AI Agents API Routes
Handles AI agent creation and management
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Union, Any
from datetime import datetime
from database import get_db
import crud

router = APIRouter()

# Track running agents to prevent duplicate runs
running_agents = set()

class ReferenceUrlItem(BaseModel):
    """Reference URL with type specification"""
    url: str
    url_type: Optional[str] = "auto"  # "auto", "listing", "direct"

class AIAgent(BaseModel):
    agent_name: str
    agent_type: str  # post, photo_gallery, review
    mode: str  # recurring, adhoc
    
    # Recurring mode fields
    schedule_selection: Optional[str] = None  # all_days, scheduled_days
    selected_days: Optional[List[str]] = None  # ["monday", "tuesday", ...]
    post_time: Optional[str] = None  # "09:00 AM"
    timezone: Optional[str] = None  # "IST", "EST"
    
    # Common fields
    category: Optional[str] = None
    target_state: Optional[str] = None
    target_language: Optional[str] = None  # Target language for content targeting
    scraper_website: Optional[str] = None  # Force specific website scraper
    article_language: Optional[str] = "en"  # Article language code
    content_type: Optional[str] = "post"  # Content type
    word_count: Optional[str] = None  # "<100", "<150", etc.
    split_content: Optional[bool] = False  # Whether to split content
    split_paragraphs: Optional[int] = 2  # Number of paragraphs for split
    reference_urls: Optional[List[Any]] = None  # Reference URLs - can be strings or ReferenceUrlItem objects
    image_option: Optional[str] = None  # "ai_generate", "upload", "existing", "web_search"
    content_workflow: Optional[str] = None  # "in_review", "ready_to_publish", "auto_post"
    is_top_story: Optional[bool] = False  # Mark as top story
    comments_enabled: Optional[bool] = True  # Enable comments
    custom_prompt: Optional[str] = None  # Custom prompt for this agent instance (overrides category mapping)
    
    # Photo Gallery Agent fields
    gallery_type: Optional[str] = "vertical"  # vertical or horizontal
    gallery_category: Optional[str] = "Actress"  # Actor, Actress, Events, Politics, Travel, Others
    tadka_pics_enabled: Optional[bool] = False  # Show in Tadka Pics section
    max_images: Optional[int] = 50  # Maximum images to download
    
    # Tadka Pics Agent fields
    source_type: Optional[str] = "websites"  # websites or instagram
    instagram_content_type: Optional[str] = "photos"  # photos or reels
    instagram_urls: Optional[List[Any]] = None  # Instagram post/reel URLs
    
    # Video Agent fields
    video_category: Optional[str] = "trailers_teasers"  # trailers_teasers, latest_video_songs, events_interviews, tadka_shorts
    target_language: Optional[str] = None  # Target language for video filtering (Telugu, Tamil, Hindi, etc.)
    search_query: Optional[str] = None  # Optional specific search query (movie name, celebrity name, etc.)
    max_videos: Optional[int] = 5  # Maximum videos to fetch
    channel_types: Optional[List[str]] = None  # List of channel types: production_house, music_label, popular_channel
    content_filter: Optional[str] = "videos"  # videos, shorts, or both
    include_keywords: Optional[str] = None  # Comma-separated include keywords for filtering
    exclude_keywords: Optional[str] = None  # Comma-separated exclude keywords for filtering
    
    # TV Video Agent fields
    tv_video_category: Optional[str] = None  # Category for TV video posts (tv-today, news-today, etc.)
    tv_channel_types: Optional[List[str]] = None  # List of channel types: tv_channel, news_channel
    lookback_days: Optional[int] = 2  # Days to look back for videos
    
    # Reality Show Agent fields
    reality_show_category: Optional[str] = None  # Category for reality show posts (tv-reality-shows, tv-reality-shows-hindi)
    reality_show_name: Optional[str] = None  # Specific reality show name (e.g., "Bigg Boss", "Indian Idol")
    youtube_channel_id: Optional[str] = None  # YouTube channel ID for the reality show
    reality_show_lookback_days: Optional[int] = 2  # Days to look back for videos
    include_keywords: Optional[str] = None  # Comma-separated keywords that MUST be in title (e.g., "Big Boss,Entertainment Ki Raat")
    
    # OTT Release Agent fields
    ott_language: Optional[str] = None  # Language filter: Hindi, Telugu, Tamil, etc.
    ott_streaming_now: Optional[bool] = True  # Fetch "Streaming Now" releases
    ott_streaming_soon: Optional[bool] = False  # Fetch "Streaming Soon" releases
    ott_fetch_limit: Optional[int] = 10  # Number of releases to fetch: 5, 10, 20, 50
    
    # Theater Release Agent fields
    theater_fetch_limit: Optional[int] = 10  # Number of releases to fetch: 5, 10, 20, 50
    theater_include_english: Optional[bool] = True  # Include English language movies
    theater_search_trailers: Optional[bool] = False  # Search YouTube RSS for trailers after creation
    
    # Movie Review Agent fields
    review_rating_strategy: Optional[str] = "lowest"  # lowest, highest, average - when multiple URLs provided
    review_language: Optional[str] = "Telugu"  # Language for the review (Telugu, Tamil, Hindi, etc.)
    max_reviews_from_listing: Optional[int] = 10  # Number of reviews to fetch from listing page (1-50)
    
    # Post Aggregation fields (for Video Agent)
    enable_aggregation: Optional[bool] = False  # Enable post grouping by movie/event name
    aggregation_lookback_days: Optional[int] = 2  # Days to look back for grouping (1-30)
    
    # Adhoc mode fields
    schedule_post: Optional[bool] = False
    post_date: Optional[str] = None
    adhoc_post_time: Optional[str] = None
    
    is_active: Optional[bool] = True

class CategoryPromptMapping(BaseModel):
    category: str
    prompt: str

# ==================== Category-Prompt Mappings ====================
# These routes must come before /ai-agents/{agent_id} to avoid path conflicts

@router.get("/category-prompt-mappings")
async def get_category_prompt_mappings(db = Depends(get_db)):
    """Get all category-prompt mappings"""
    mappings = crud.get_category_prompt_mappings(db)
    return {"mappings": mappings}

@router.put("/category-prompt-mappings")
async def update_category_prompt_mappings(mappings: List[CategoryPromptMapping], db = Depends(get_db)):
    """Update category-prompt mappings"""
    mappings_dict = {m.category: m.prompt for m in mappings}
    result = crud.update_category_prompt_mappings(db, mappings_dict)
    return {"mappings": result}

# ==================== AI Agents ====================

@router.get("/ai-agents")
async def get_ai_agents(db = Depends(get_db)):
    """Get all AI agents"""
    agents = crud.get_all_ai_agents(db)
    return {"agents": agents}

@router.get("/ai-agents/{agent_id}")
async def get_ai_agent(agent_id: str, db = Depends(get_db)):
    """Get a specific AI agent"""
    agent = crud.get_ai_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.post("/ai-agents")
async def create_ai_agent(agent: AIAgent, db = Depends(get_db)):
    """Create a new AI agent"""
    agent_data = agent.dict()
    agent_data["created_at"] = datetime.utcnow()
    agent_data["updated_at"] = datetime.utcnow()
    
    created_agent = crud.create_ai_agent(db, agent_data)
    return created_agent

@router.put("/ai-agents/{agent_id}")
async def update_ai_agent(agent_id: str, agent: AIAgent, db = Depends(get_db)):
    """Update an AI agent"""
    agent_data = agent.dict()
    agent_data["updated_at"] = datetime.utcnow()
    
    updated_agent = crud.update_ai_agent(db, agent_id, agent_data)
    if not updated_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return updated_agent

@router.delete("/ai-agents/{agent_id}")
async def delete_ai_agent(agent_id: str, db = Depends(get_db)):
    """Delete an AI agent"""
    result = crud.delete_ai_agent(db, agent_id)
    if not result:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent deleted successfully"}

@router.post("/ai-agents/{agent_id}/toggle")
async def toggle_ai_agent(agent_id: str, db = Depends(get_db)):
    """Toggle agent active status"""
    result = crud.toggle_ai_agent_status(db, agent_id)
    if not result:
        raise HTTPException(status_code=404, detail="Agent not found")
    return result


@router.post("/ai-agents/{agent_id}/run")
async def run_ai_agent(agent_id: str, db = Depends(get_db)):
    """Run an AI agent to generate content"""
    from services.agent_runner_service import agent_runner
    from services.gallery_agent_service import gallery_agent_runner
    
    # Check if agent exists
    agent = crud.get_ai_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check if agent is already running
    if agent_id in running_agents:
        raise HTTPException(status_code=409, detail="Agent is already running")
    
    try:
        # Mark agent as running
        running_agents.add(agent_id)
        
        # Run appropriate agent based on type
        agent_type = agent.get('agent_type', 'post')
        
        if agent_type == 'photo_gallery':
            # Use Gallery Agent Service
            result = await gallery_agent_runner.run_gallery_agent(agent_id)
        elif agent_type == 'tadka_pics':
            # Use Tadka Pics Agent Service
            from services.tadka_pics_agent_service import tadka_pics_agent_runner
            result = await tadka_pics_agent_runner.run_tadka_pics_agent(agent_id)
        elif agent_type == 'video':
            # Use Video Agent Service
            from services.video_agent_service import video_agent_runner
            result = await video_agent_runner.run_video_agent(agent_id)
        elif agent_type == 'tv_video':
            # Use TV Video Agent Service
            from services.tv_video_agent_service import tv_video_agent_service
            result = await tv_video_agent_service.run_tv_video_agent(agent_id)
        elif agent_type == 'reality_show':
            # Use Reality Show Agent Service
            from services.reality_show_agent_service import reality_show_agent_service
            result = await reality_show_agent_service.run_reality_show_agent(agent_id)
        elif agent_type == 'ott_release':
            # Use OTT Release Agent Service
            from services.ott_release_agent_service import ott_release_agent_service
            result = await ott_release_agent_service.run_ott_release_agent(agent_id)
        elif agent_type == 'theater_release':
            # Use Theater Release Agent Service
            from services.theater_release_agent_service import theater_release_agent_service
            result = await theater_release_agent_service.run_theater_release_agent(agent_id)
        elif agent_type == 'movie_review':
            # Use Movie Review Agent Service
            from services.movie_review_agent_service import movie_review_agent_service
            result = await movie_review_agent_service.run_movie_review_agent(agent_id)
        elif agent_type == 'ott_review':
            # Use OTT Review Agent Service
            from services.ott_review_agent_service import ott_review_agent_service
            # Get agent config
            agent_config = crud.get_ai_agent(db, agent_id)
            result = await ott_review_agent_service.run(agent_config, db)
        else:
            # Use Post Agent Service (default)
            result = await agent_runner.run_agent(agent_id)
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {str(e)}")
    finally:
        # Remove from running set
        running_agents.discard(agent_id)


@router.get("/ai-agents/{agent_id}/status")
async def get_agent_run_status(agent_id: str, db = Depends(get_db)):
    """Check if an agent is currently running"""
    agent = crud.get_ai_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "agent_id": agent_id,
        "is_running": agent_id in running_agents
    }
