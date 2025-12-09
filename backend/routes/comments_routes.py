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
    rating: Optional[int] = None  # 1-5 stars for reviews

class CommentResponse(BaseModel):
    id: str
    article_id: str
    name: str
    comment: str
    comment_type: str
    rating: Optional[int] = None
    ip_address: str
    device_info: str
    created_at: str

@router.post("/api/articles/{article_id}/comments")
def add_comment(article_id: str, comment: CommentCreate, request: Request):
    """Add a comment to an article"""
    from server import db
    
    # Get IP address
    ip_address = request.client.host
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    # Check if user already has a review for this article (only for review type)
    if comment.comment_type == "review":
        existing_review = db.comments.find_one({
            "article_id": article_id,
            "ip_address": ip_address,
            "comment_type": "review",
            "is_approved": True
        })
        
        if existing_review:
            return {
                "success": False,
                "message": "You have already submitted a review for this movie. Please edit your existing review.",
                "existing_review": {
                    "id": existing_review["id"],
                    "name": existing_review["name"],
                    "comment": existing_review["comment"],
                    "rating": existing_review.get("rating"),
                    "created_at": existing_review["created_at"]
                }
            }
    
    # Get device info (user agent)
    device_info = request.headers.get("user-agent", "Unknown")
    
    # Create comment document
    comment_doc = {
        "id": str(uuid.uuid4()),
        "article_id": article_id,
        "name": comment.name,
        "comment": comment.comment,
        "comment_type": comment.comment_type,
        "rating": comment.rating,
        "ip_address": ip_address,
        "device_info": device_info,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_approved": True  # Auto-approve for now
    }
    
    db.comments.insert_one(comment_doc)
    
    return {
        "success": True,
        "message": "Comment added successfully",
        "comment": {
            "id": comment_doc["id"],
            "article_id": comment_doc["article_id"],
            "name": comment_doc["name"],
            "comment": comment_doc["comment"],
            "comment_type": comment_doc["comment_type"],
            "rating": comment_doc["rating"],
            "ip_address": comment_doc["ip_address"],
            "device_info": comment_doc["device_info"],
            "created_at": comment_doc["created_at"]
        }
    }

@router.get("/api/articles/{article_id}/comments")
def get_comments(article_id: str, comment_type: Optional[str] = None):
    """Get all comments for an article"""
    from server import db
    
    query = {"article_id": article_id, "is_approved": True}
    if comment_type:
        query["comment_type"] = comment_type
    
    comments = list(db.comments.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(1000))
    
    return {"comments": comments, "count": len(comments)}

@router.get("/api/articles/{article_id}/check-review")
def check_existing_review(article_id: str, request: Request):
    """Check if the current user has already submitted a review"""
    from server import db
    
    # Get IP address
    ip_address = request.client.host
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    # Check for existing review
    existing_review = db.comments.find_one({
        "article_id": article_id,
        "ip_address": ip_address,
        "comment_type": "review",
        "is_approved": True
    }, {"_id": 0})
    
    if existing_review:
        return {
            "has_reviewed": True,
            "review": existing_review
        }
    
    return {"has_reviewed": False}

@router.put("/api/articles/{article_id}/comments/{comment_id}")
def update_comment(article_id: str, comment_id: str, comment: CommentCreate, request: Request):
    """Update an existing comment/review"""
    from server import db
    
    # Get IP address
    ip_address = request.client.host
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    # Find existing comment
    existing_comment = db.comments.find_one({
        "id": comment_id,
        "article_id": article_id
    })
    
    if not existing_comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Verify IP address matches (security check)
    if existing_comment.get("ip_address") != ip_address:
        raise HTTPException(status_code=403, detail="You can only edit your own review")
    
    # Update the comment
    update_data = {
        "name": comment.name,
        "comment": comment.comment,
        "rating": comment.rating,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    db.comments.update_one(
        {"id": comment_id, "article_id": article_id},
        {"$set": update_data}
    )
    
    # Get updated comment
    updated_comment = db.comments.find_one({"id": comment_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": "Review updated successfully",
        "comment": updated_comment
    }

@router.delete("/api/articles/{article_id}/comments/{comment_id}")
def delete_comment(article_id: str, comment_id: str):
    """Delete a comment (admin only)"""
    from server import db
    
    result = db.comments.delete_one({
        "id": comment_id,
        "article_id": article_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    return {"success": True, "message": "Comment deleted successfully"}


# Video Comments Endpoints
class VideoCommentCreate(BaseModel):
    video_id: int
    name: str
    comment: str

@router.post("/api/videos/{video_id}/comments")
def add_video_comment(video_id: int, comment: VideoCommentCreate, request: Request):
    """Add a comment to a viral video"""
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
        "video_id": video_id,
        "name": comment.name,
        "comment": comment.comment,
        "ip_address": ip_address,
        "device_info": device_info,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_approved": True  # Auto-approve for now
    }
    
    db.video_comments.insert_one(comment_doc)
    
    return {
        "success": True,
        "message": "Comment added successfully",
        "comment": {
            "id": comment_doc["id"],
            "video_id": comment_doc["video_id"],
            "name": comment_doc["name"],
            "text": comment_doc["comment"],
            "time": "Just now",
            "created_at": comment_doc["created_at"]
        }
    }

@router.get("/api/videos/{video_id}/comments")
def get_video_comments(video_id: int):
    """Get all comments for a viral video"""
    from server import db
    
    comments = list(db.video_comments.find(
        {"video_id": video_id, "is_approved": True},
        {"_id": 0}
    ).sort("created_at", -1).limit(1000))
    
    # Format comments for frontend
    formatted_comments = []
    for comment in comments:
        # Calculate time ago
        created_at = datetime.fromisoformat(comment["created_at"])
        time_diff = datetime.now(timezone.utc) - created_at
        
        if time_diff.days > 0:
            time_ago = f"{time_diff.days} day{'s' if time_diff.days > 1 else ''} ago"
        elif time_diff.seconds >= 3600:
            hours = time_diff.seconds // 3600
            time_ago = f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif time_diff.seconds >= 60:
            minutes = time_diff.seconds // 60
            time_ago = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        else:
            time_ago = "Just now"
        
        formatted_comments.append({
            "id": comment["id"],
            "name": comment["name"],
            "text": comment["comment"],
            "time": time_ago
        })
    
    return {"comments": formatted_comments, "count": len(formatted_comments)}


@router.get("/api/videos/{video_id}/user-name")
def get_user_name_by_ip(video_id: int, request: Request):
    """Get the user's previous name if they've commented before from this IP"""
    from server import db
    
    # Get IP address
    ip_address = request.client.host
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    # Find the most recent comment from this IP for this video
    previous_comment = db.video_comments.find_one(
        {"video_id": video_id, "ip_address": ip_address},
        {"name": 1, "_id": 0},
        sort=[("created_at", -1)]
    )
    
    if previous_comment:
        return {"name": previous_comment["name"], "has_commented": True}
    else:
        return {"name": None, "has_commented": False}


