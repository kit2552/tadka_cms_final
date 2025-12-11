"""
Ad Settings Routes for managing advertisement placements
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db

router = APIRouter()

class AdSettings(BaseModel):
    article_content_mid: bool = False  # Between main and secondary content
    article_sidebar_comments: bool = False  # Between comments and related posts
    homepage_banner: bool = False  # Homepage top banner (future)
    homepage_sidebar: bool = False  # Homepage sidebar (future)
    category_page_top: bool = False  # Category pages top (future)
    homepage_sponsored_ads: bool = False  # Homepage sponsored ads section

@router.get("/ad-settings")
def get_ad_settings(db = Depends(get_db)):
    """Get current ad settings"""
    settings = db.ad_settings.find_one({"_id": "global"}, {"_id": 0})
    
    if not settings:
        # Return default settings if none exist
        return {
            "article_content_mid": False,
            "article_sidebar_comments": False,
            "homepage_banner": False,
            "homepage_sidebar": False,
            "category_page_top": False,
            "homepage_sponsored_ads": False
        }
    
    return settings

@router.post("/ad-settings")
def update_ad_settings(settings: AdSettings, db = Depends(get_db)):
    """Update ad settings"""
    settings_dict = settings.dict()
    
    # Upsert the settings
    db.ad_settings.update_one(
        {"_id": "global"},
        {"$set": settings_dict},
        upsert=True
    )
    
    return {"message": "Ad settings updated successfully", "settings": settings_dict}
