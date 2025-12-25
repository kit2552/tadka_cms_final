"""
Routes for Grouped Posts Management
Handles aggregated video posts grouped by movie/event name
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from database import get_db
import crud
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

class UpdateGroupTitleRequest(BaseModel):
    group_title: str

class AddArticleRequest(BaseModel):
    article_id: int

@router.get("/grouped-posts")
async def get_grouped_posts(skip: int = 0, limit: int = 100, category: Optional[str] = None, db = Depends(get_db)):
    """Get all grouped posts with optional category filter"""
    try:
        if category:
            # Filter by category
            groups = list(
                db.grouped_posts.find({"category": category})
                .sort("updated_at", -1)
                .skip(skip)
                .limit(limit)
            )
        else:
            groups = crud.get_all_grouped_posts(db, skip, limit)
            return {"groups": groups}
        
        # Enrich with representative post data
        for group in groups:
            rep_id = group.get('representative_post_id')
            if rep_id:
                rep_article = db.articles.find_one({"id": rep_id})
                group['representative_post'] = crud.serialize_doc(rep_article)
        
        return {"groups": crud.serialize_doc(groups)}
    except Exception as e:
        print(f"❌ Error getting grouped posts: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/grouped-posts/{group_id}")
async def get_grouped_post(group_id: str, db = Depends(get_db)):
    """Get a specific grouped post with all its articles"""
    try:
        group = crud.get_grouped_post_by_id(db, group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Grouped post not found")
        return group
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting grouped post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/grouped-posts/{group_id}")
async def delete_grouped_post(group_id: str, db = Depends(get_db)):
    """Delete a grouped post"""
    try:
        success = crud.delete_grouped_post(db, group_id)
        if not success:
            raise HTTPException(status_code=404, detail="Grouped post not found")
        return {"success": True, "message": "Grouped post deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting grouped post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/grouped-posts/{group_id}")
async def update_grouped_post(group_id: str, request: UpdateGroupTitleRequest, db = Depends(get_db)):
    """Update a grouped post's title"""
    try:
        success = crud.update_grouped_post_title(db, group_id, request.group_title)
        if not success:
            raise HTTPException(status_code=404, detail="Grouped post not found")
        return {"success": True, "message": "Grouped post updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating grouped post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/grouped-posts-stats")
async def get_grouped_posts_stats(db = Depends(get_db)):
    """Get statistics about grouped posts"""
    try:
        total_groups = db.grouped_posts.count_documents({})
        
        # Group by category
        pipeline = [
            {
                "$group": {
                    "_id": "$category",
                    "count": {"$sum": 1},
                    "total_posts": {"$sum": "$posts_count"}
                }
            }
        ]
        by_category = list(db.grouped_posts.aggregate(pipeline))
        
        return {
            "total_groups": total_groups,
            "by_category": by_category
        }
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/grouped-posts/{group_id}/add-article")
async def add_article_to_group(group_id: str, request: AddArticleRequest, db = Depends(get_db)):
    """Add an article to a grouped post"""
    try:
        from bson import ObjectId
        from datetime import datetime, timezone
        
        # Get the target group
        group = db.grouped_posts.find_one({"_id": ObjectId(group_id)})
        if not group:
            raise HTTPException(status_code=404, detail="Target group not found")
        
        # Get the article to verify it exists
        article = db.articles.find_one({"id": request.article_id})
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Remove article from all other groups in same category
        db.grouped_posts.update_many(
            {"category": group["category"]},
            {
                "$pull": {"post_ids": request.article_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Recalculate posts_count for all affected groups
        db.grouped_posts.update_many(
            {"category": group["category"]},
            [{
                "$set": {
                    "posts_count": {"$size": {"$ifNull": ["$post_ids", []]}}
                }
            }]
        )
        
        # Add article to the target group
        post_ids = group.get('post_ids', [])
        if request.article_id not in post_ids:
            post_ids.append(request.article_id)
        
        db.grouped_posts.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$set": {
                    "post_ids": post_ids,
                    "posts_count": len(post_ids),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {"success": True, "message": f"Article moved successfully to {group['group_title']}"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding article to group: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

