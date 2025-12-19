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
    video_category: Optional[str] = "trailers_teasers"  # trailers_teasers, trending_videos, events_interviews, tadka_shorts
    search_query: Optional[str] = None  # Optional specific search query (movie name, celebrity name, etc.)
    max_videos: Optional[int] = 5  # Maximum videos to fetch
    channel_types: Optional[List[str]] = None  # List of channel types: production_house, music_label, popular_channel
    
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
