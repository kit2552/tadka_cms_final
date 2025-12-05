"""
MongoDB CRUD Operations for Tadka CMS
Replaces SQLAlchemy ORM queries with MongoDB queries
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import json
from models.mongodb_collections import *

# Helper function to convert ObjectId to string in results
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id':
                result['id'] = str(value)
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc

# ==================== CATEGORY CRUD ====================

def get_category(db, category_id: str):
    """Get category by ID"""
    try:
        doc = db[CATEGORIES].find_one({"_id": ObjectId(category_id)})
        return serialize_doc(doc)
    except:
        return None

def get_category_by_slug(db, slug: str):
    """Get category by slug"""
    doc = db[CATEGORIES].find_one({"slug": slug})
    return serialize_doc(doc)

def get_categories(db, skip: int = 0, limit: int = 100):
    """Get paginated categories"""
    docs = list(db[CATEGORIES].find().skip(skip).limit(limit))
    return serialize_doc(docs)

def get_all_categories(db):
    """Get all categories for CMS dropdown"""
    docs = list(db[CATEGORIES].find())
    return serialize_doc(docs)

def create_category(db, category: dict):
    """Create new category"""
    category_doc = {
        "name": category.get("name"),
        "slug": category.get("slug"),
        "description": category.get("description"),
        "created_at": datetime.utcnow()
    }
    result = db[CATEGORIES].insert_one(category_doc)
    category_doc["_id"] = result.inserted_id
    return serialize_doc(category_doc)

# ==================== ARTICLE CRUD ====================

def get_article(db, article_id: int):
    """
    Get article by ID and increment view count
    Note: Using integer ID for backward compatibility
    """
    article = db[ARTICLES].find_one({"id": article_id})
    if article:
        # Increment view count
        db[ARTICLES].update_one(
            {"id": article_id},
            {"$inc": {"view_count": 1}}
        )
        article["view_count"] = article.get("view_count", 0) + 1
    return serialize_doc(article)

def get_article_by_id(db, article_id: int):
    """Get article by ID without incrementing view count"""
    article = db[ARTICLES].find_one({"id": article_id})
    return serialize_doc(article)

def get_articles(db, skip: int = 0, limit: int = 100, is_featured: Optional[bool] = None):
    """Get paginated articles"""
    query = {}
    if is_featured is not None:
        query["is_featured"] = is_featured
    
    docs = list(
        db[ARTICLES]
        .find(query)
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_articles_by_category_slug(db, category_slug: str, skip: int = 0, limit: int = 100):
    """Get articles by category slug"""
    docs = list(
        db[ARTICLES]
        .find({
            "category": category_slug,
            "is_published": True
        })
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_articles_by_states(db, category_slug: str, state_codes: List[str], skip: int = 0, limit: int = 100):
    """Get articles filtered by category and state codes"""
    # Articles where states field contains any of the state codes or "all"
    docs = list(
        db[ARTICLES]
        .find({
            "category": category_slug,
            "is_published": True,
            "$or": [
                {"states": {"$regex": state, "$options": "i"}} 
                for state in (state_codes + ["all"])
            ]
        })
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_articles_count_for_cms(
    db,
    language: str = "en",
    category: str = None,
    state: str = None,
    content_type: str = None,
    status: str = None
):
    """Count articles for CMS with filters"""
    query = {"language": language}
    
    if category:
        query["category"] = category
    
    if state and state != "all":
        query["states"] = {"$regex": state, "$options": "i"}
    
    if content_type:
        query["content_type"] = content_type
    
    if status == "published":
        query["is_published"] = True
    elif status == "draft":
        query["is_published"] = False
    elif status == "scheduled":
        query["is_scheduled"] = True
    
    return db[ARTICLES].count_documents(query)

def get_articles_for_cms(
    db,
    language: str = "en",
    skip: int = 0,
    limit: int = 20,
    category: str = None,
    state: str = None,
    content_type: str = None,
    status: str = None
):
    """Get paginated articles for CMS with filters"""
    query = {"language": language}
    
    if category:
        query["category"] = category
    
    if state and state != "all":
        query["states"] = {"$regex": state, "$options": "i"}
    
    if content_type:
        query["content_type"] = content_type
    
    if status == "published":
        query["is_published"] = True
    elif status == "draft":
        query["is_published"] = False
    elif status == "scheduled":
        query["is_scheduled"] = True
    
    docs = list(
        db[ARTICLES]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def create_article(db, article: dict):
    """Create new article"""
    # Generate new integer ID
    last_article = db[ARTICLES].find_one(sort=[("id", -1)])
    new_id = (last_article["id"] + 1) if last_article else 1
    
    article_doc = {
        "id": new_id,
        "title": article.get("title"),
        "short_title": article.get("short_title"),
        "slug": article.get("slug"),
        "content": article.get("content"),
        "summary": article.get("summary"),
        "author": article.get("author"),
        "language": article.get("language", "en"),
        "states": article.get("states"),
        "category": article.get("category"),
        "content_type": article.get("content_type", "post"),
        "image": article.get("image"),
        "image_gallery": article.get("image_gallery"),
        "gallery_id": article.get("gallery_id"),
        "youtube_url": article.get("youtube_url"),
        "tags": article.get("tags"),
        "artists": article.get("artists"),
        "movie_rating": article.get("movie_rating"),
        "is_featured": article.get("is_featured", False),
        "is_published": article.get("is_published", True),
        "is_scheduled": article.get("is_scheduled", False),
        "scheduled_publish_at": article.get("scheduled_publish_at"),
        "original_article_id": article.get("original_article_id"),
        "seo_title": article.get("seo_title"),
        "seo_description": article.get("seo_description"),
        "seo_keywords": article.get("seo_keywords"),
        # Movie review fields
        "review_quick_verdict": article.get("review_quick_verdict"),
        "review_plot_summary": article.get("review_plot_summary"),
        "review_performances": article.get("review_performances"),
        "review_what_works": article.get("review_what_works"),
        "review_what_doesnt_work": article.get("review_what_doesnt_work"),
        "review_technical_aspects": article.get("review_technical_aspects"),
        "review_final_verdict": article.get("review_final_verdict"),
        "review_cast": article.get("review_cast"),
        "review_director": article.get("review_director"),
        "review_genre": article.get("review_genre"),
        "review_runtime": article.get("review_runtime"),
        "view_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "published_at": article.get("published_at") or datetime.utcnow()
    }
    
    result = db[ARTICLES].insert_one(article_doc)
    article_doc["_id"] = result.inserted_id
    return serialize_doc(article_doc)

def create_article_cms(db, article: dict, slug: str, seo_title: str, seo_description: str):
    """Create article from CMS"""
    article["slug"] = slug
    article["seo_title"] = seo_title
    article["seo_description"] = seo_description
    
    if article.get("is_published") and not article.get("published_at"):
        article["published_at"] = datetime.utcnow()
    
    return create_article(db, article)

def update_article_cms(db, article_id: int, article: dict):
    """Update article from CMS"""
    update_data = {
        "$set": {
            "title": article.get("title"),
            "short_title": article.get("short_title"),
            "content": article.get("content"),
            "summary": article.get("summary"),
            "author": article.get("author"),
            "language": article.get("language"),
            "states": article.get("states"),
            "category": article.get("category"),
            "content_type": article.get("content_type"),
            "image": article.get("image"),
            "image_gallery": article.get("image_gallery"),
            "gallery_id": article.get("gallery_id"),
            "youtube_url": article.get("youtube_url"),
            "tags": article.get("tags"),
            "artists": article.get("artists"),
            "movie_rating": article.get("movie_rating"),
            "is_featured": article.get("is_featured"),
            "is_published": article.get("is_published"),
            "is_scheduled": article.get("is_scheduled"),
            "scheduled_publish_at": article.get("scheduled_publish_at"),
            "seo_title": article.get("seo_title"),
            "seo_description": article.get("seo_description"),
            "seo_keywords": article.get("seo_keywords"),
            # Movie review fields
            "review_quick_verdict": article.get("review_quick_verdict"),
            "review_plot_summary": article.get("review_plot_summary"),
            "review_performances": article.get("review_performances"),
            "review_what_works": article.get("review_what_works"),
            "review_what_doesnt_work": article.get("review_what_doesnt_work"),
            "review_technical_aspects": article.get("review_technical_aspects"),
            "review_final_verdict": article.get("review_final_verdict"),
            "review_cast": article.get("review_cast"),
            "review_director": article.get("review_director"),
            "review_genre": article.get("review_genre"),
            "review_runtime": article.get("review_runtime"),
            "updated_at": datetime.utcnow()
        }
    }
    
    # Update published_at if publishing
    if article.get("is_published"):
        existing = db[ARTICLES].find_one({"id": article_id})
        if existing and not existing.get("published_at"):
            update_data["$set"]["published_at"] = datetime.utcnow()
    
    db[ARTICLES].update_one({"id": article_id}, update_data)
    return get_article_by_id(db, article_id)

def delete_article(db, article_id: int):
    """Delete article"""
    result = db[ARTICLES].delete_one({"id": article_id})
    return result.deleted_count > 0

def toggle_article_publish(db, article_id: int):
    """Toggle article publish status"""
    article = db[ARTICLES].find_one({"id": article_id})
    if not article:
        return None
    
    new_status = not article.get("is_published", False)
    update_data = {
        "$set": {
            "is_published": new_status,
            "updated_at": datetime.utcnow()
        }
    }
    
    if new_status and not article.get("published_at"):
        update_data["$set"]["published_at"] = datetime.utcnow()
    
    db[ARTICLES].update_one({"id": article_id}, update_data)
    return get_article_by_id(db, article_id)

# ==================== SCHEDULER SETTINGS ====================

def get_scheduler_settings(db):
    """Get scheduler settings"""
    doc = db[SCHEDULER_SETTINGS].find_one()
    return serialize_doc(doc) if doc else None

def update_scheduler_settings(db, settings: dict):
    """Update scheduler settings"""
    db[SCHEDULER_SETTINGS].update_one(
        {},
        {
            "$set": {
                "is_enabled": settings.get("is_enabled"),
                "check_frequency_minutes": settings.get("check_frequency_minutes"),
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    return get_scheduler_settings(db)

# ==================== RELEASES ====================

def get_theater_releases(db, language: str = None):
    """Get theater releases"""
    query = {}
    if language:
        query["language"] = language
    
    docs = list(db[THEATER_RELEASES].find(query).sort("release_date", 1))
    return serialize_doc(docs)

def get_ott_releases(db, language: str = None):
    """Get OTT releases"""
    query = {}
    if language:
        query["language"] = language
    
    docs = list(db[OTT_RELEASES].find(query).sort("release_date", 1))
    return serialize_doc(docs)

def create_theater_release(db, release: dict):
    """Create theater release"""
    # Generate new ID
    last_release = db[THEATER_RELEASES].find_one(sort=[("id", -1)])
    new_id = (last_release["id"] + 1) if last_release else 1
    
    release_doc = {
        "id": new_id,
        "movie_name": release.get("movie_name"),
        "release_date": release.get("release_date"),
        "language": release.get("language"),
        "movie_image": release.get("movie_image"),
        "movie_banner": release.get("movie_banner"),
        "created_at": datetime.utcnow()
    }
    
    result = db[THEATER_RELEASES].insert_one(release_doc)
    release_doc["_id"] = result.inserted_id
    return serialize_doc(release_doc)

def create_ott_release(db, release: dict):
    """Create OTT release"""
    # Generate new ID
    last_release = db[OTT_RELEASES].find_one(sort=[("id", -1)])
    new_id = (last_release["id"] + 1) if last_release else 1
    
    release_doc = {
        "id": new_id,
        "movie_name": release.get("movie_name"),
        "release_date": release.get("release_date"),
        "language": release.get("language"),
        "ott_platform": release.get("ott_platform"),
        "movie_image": release.get("movie_image"),
        "created_at": datetime.utcnow()
    }
    
    result = db[OTT_RELEASES].insert_one(release_doc)
    release_doc["_id"] = result.inserted_id
    return serialize_doc(release_doc)

# ==================== GALLERIES ====================

def get_gallery(db, gallery_id: int):
    """Get gallery by ID"""
    doc = db[GALLERIES].find_one({"id": gallery_id})
    return serialize_doc(doc)

def get_galleries(db, category: str = None, skip: int = 0, limit: int = 100):
    """Get galleries with optional category filter"""
    query = {}
    if category:
        query["category"] = category
    
    docs = list(
        db[GALLERIES]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def create_gallery(db, gallery: dict):
    """Create gallery"""
    # Generate new ID
    last_gallery = db[GALLERIES].find_one(sort=[("id", -1)])
    new_id = (last_gallery["id"] + 1) if last_gallery else 1
    
    gallery_doc = {
        "id": new_id,
        "title": gallery.get("title"),
        "slug": gallery.get("slug"),
        "category": gallery.get("category"),
        "images": gallery.get("images"),
        "created_at": datetime.utcnow()
    }
    
    result = db[GALLERIES].insert_one(gallery_doc)
    gallery_doc["_id"] = result.inserted_id
    return serialize_doc(gallery_doc)

# ==================== RELATED ARTICLES CONFIG ====================

def get_related_articles_config(db, page_slug: str):
    """Get related articles configuration"""
    doc = db[RELATED_ARTICLES_CONFIG].find_one({"page_slug": page_slug})
    return serialize_doc(doc)

def update_related_articles_config(db, page_slug: str, config: dict):
    """Update related articles configuration"""
    db[RELATED_ARTICLES_CONFIG].update_one(
        {"page_slug": page_slug},
        {
            "$set": {
                "categories": config.get("categories"),
                "article_count": config.get("article_count", 5),
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    return get_related_articles_config(db, page_slug)

def get_related_articles_for_page(db, page_slug: str, limit: int = 5):
    """Get related articles for a page"""
    config = get_related_articles_config(db, page_slug)
    if not config:
        return []
    
    try:
        categories = json.loads(config.get("categories", "[]"))
    except:
        categories = []
    
    if not categories:
        return []
    
    docs = list(
        db[ARTICLES]
        .find({
            "category": {"$in": categories},
            "is_published": True
        })
        .sort("published_at", -1)
        .limit(limit)
    )
    return serialize_doc(docs)

# ==================== SYSTEM SETTINGS - AWS CONFIG ====================

def get_aws_config(db):
    """Get AWS S3 configuration"""
    doc = db['system_settings'].find_one({"type": "aws_config"})
    return serialize_doc(doc) if doc else None

def update_aws_config(db, config: dict):
    """Update AWS S3 configuration"""
    config_doc = {
        "type": "aws_config",
        "is_enabled": config.get("is_enabled", False),
        "aws_access_key_id": config.get("aws_access_key_id"),
        "aws_secret_access_key": config.get("aws_secret_access_key"),
        "aws_region": config.get("aws_region", "us-east-1"),
        "s3_bucket_name": config.get("s3_bucket_name"),
        "root_folder_path": config.get("root_folder_path", ""),
        "max_file_size_mb": config.get("max_file_size_mb", 10),
        "updated_at": datetime.utcnow()
    }
    
    db['system_settings'].update_one(
        {"type": "aws_config"},
        {"$set": config_doc},
        upsert=True
    )
    
    return get_aws_config(db)

# ==================== USER MANAGEMENT ====================

def get_users(db, skip: int = 0, limit: int = 100):
    """Get all users (for user management)"""
    docs = list(
        db['users']
        .find({}, {"password": 0})  # Don't return password
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_user_by_id(db, user_id: str):
    """Get user by ID"""
    try:
        doc = db['users'].find_one({"_id": ObjectId(user_id)}, {"password": 0})
        return serialize_doc(doc)
    except:
        return None

def get_user_by_username(db, username: str):
    """Get user by username (includes password for auth)"""
    doc = db['users'].find_one({"username": username})
    return serialize_doc(doc)

def create_user(db, user: dict):
    """Create new user"""
    user_doc = {
        "username": user.get("username"),
        "email": user.get("email"),
        "password": user.get("password"),  # Should be hashed before calling this
        "role": user.get("role", "editor"),  # admin, editor, viewer
        "is_active": user.get("is_active", True),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db['users'].insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    
    # Return without password
    doc = db['users'].find_one({"_id": result.inserted_id}, {"password": 0})
    return serialize_doc(doc)

def update_user(db, user_id: str, user: dict):
    """Update user"""
    try:
        update_data = {
            "$set": {
                "email": user.get("email"),
                "role": user.get("role"),
                "is_active": user.get("is_active"),
                "updated_at": datetime.utcnow()
            }
        }
        
        # Only update password if provided
        if user.get("password"):
            update_data["$set"]["password"] = user.get("password")
        
        db['users'].update_one(
            {"_id": ObjectId(user_id)},
            update_data
        )
        
        return get_user_by_id(db, user_id)
    except:
        return None

def delete_user(db, user_id: str):
    """Delete user"""
    try:
        result = db['users'].delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0
    except:
        return False

def count_users(db):
    """Count total users"""
    return db['users'].count_documents({})
