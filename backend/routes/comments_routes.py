from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter()

class CommentCreate(BaseModel):
    article_id: str
    name: str
    comment: str
    comment_type: str = "regular"  # regular or review

class CommentResponse(BaseModel):
    id: str
    article_id: str
    name: str
    comment: str
    comment_type: str
    ip_address: str
    device_info: str
    created_at: str

@router.post("/api/articles/{article_id}/comments")
async def add_comment(article_id: str, comment: CommentCreate, request: Request):
    """Add a comment to an article"""
    from server import db
    
    # Get IP address
    ip_address = request.client.host
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    # Get device info (user agent)
    device_info = request.headers.get("user-agent", "Unknown")
    
    # Create comment document
    comment_doc = {
        "id": str(uuid.uuid4()),
        "article_id": article_id,
        "name": comment.name,
        "comment": comment.comment,
        "comment_type": comment.comment_type,
        "ip_address": ip_address,
        "device_info": device_info,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_approved": True  # Auto-approve for now
    }
    
    await db.comments.insert_one(comment_doc)
    
    return {
        "success": True,
        "message": "Comment added successfully",
        "comment": {
            "id": comment_doc["id"],
            "article_id": comment_doc["article_id"],
            "name": comment_doc["name"],
            "comment": comment_doc["comment"],
            "comment_type": comment_doc["comment_type"],
            "ip_address": comment_doc["ip_address"],
            "device_info": comment_doc["device_info"],
            "created_at": comment_doc["created_at"]
        }
    }

@router.get("/api/articles/{article_id}/comments")
async def get_comments(article_id: str, comment_type: Optional[str] = None):
    """Get all comments for an article"""
    from server import db
    
    query = {"article_id": article_id, "is_approved": True}
    if comment_type:
        query["comment_type"] = comment_type
    
    comments = await db.comments.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {"comments": comments, "count": len(comments)}

@router.delete("/api/articles/{article_id}/comments/{comment_id}")
async def delete_comment(article_id: str, comment_id: str):
    """Delete a comment (admin only)"""
    from server import db
    
    result = await db.comments.delete_one({
        "id": comment_id,
        "article_id": article_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    return {"success": True, "message": "Comment deleted successfully"}
