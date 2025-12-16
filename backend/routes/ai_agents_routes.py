"""
AI Agents API Routes
Handles AI agent creation and management
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db
import crud

router = APIRouter()

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
    topic: Optional[str] = None
    target_state: Optional[str] = None
    word_count: Optional[str] = None  # "<100", "<150", etc.
    image_option: Optional[str] = None  # "ai_generate", "upload", "existing", "web_search"
    content_workflow: Optional[str] = None  # "in_review", "ready_to_publish", "auto_post"
    
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
