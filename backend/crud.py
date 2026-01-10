"""
MongoDB CRUD Operations for Tadka CMS
Replaces SQLAlchemy ORM queries with MongoDB queries
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import json
from models.mongodb_collections import *

def _clean_twitter_embed(embed_code):
    """Clean Twitter embed code to show full tweet card instead of compact video view"""
    if not embed_code or not isinstance(embed_code, str):
        return embed_code
    
    # Remove data-media-max-width attribute which causes compact video-only view
    if '<blockquote' in embed_code and 'twitter' in embed_code.lower():
        embed_code = embed_code.replace('data-media-max-width="560"', '')
        embed_code = embed_code.replace("data-media-max-width='560'", '')
    
    return embed_code


class DotDict(dict):
    """Dictionary that supports dot notation access for backward compatibility"""
    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError:
            return None
    
    def __setattr__(self, key, value):
        self[key] = value
    
    def __delattr__(self, key):
        try:
            del self[key]
        except KeyError:
            pass

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
            # Map article_language to language for backward compatibility
            if key == 'article_language':
                print(f"🔍 DEBUG serialize - Mapping article_language: {value} to both language and article_language")
                result['language'] = value or 'en'  # For backward compatibility
                result['article_language'] = value or 'en'
                continue
            # Map image to image_url for API response
            if key == 'image':
                result['image_url'] = value
                result['image'] = value  # Keep both for backward compatibility
                continue
            if key == '_id':
                # Only add _id as id if there's no existing id field
                if 'id' not in doc:
                    result['id'] = str(value)
                # Skip adding _id to result
                continue
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
        return DotDict(result)
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
        
        # Populate gallery if gallery_id exists
        if article.get("gallery_id"):
            gallery = db[GALLERIES].find_one({"id": article["gallery_id"]}, {"_id": 0})
            if gallery:
                article["gallery"] = gallery
    
    return serialize_doc(article)

def get_article_by_id(db, article_id: int):
    """Get article by ID without incrementing view count"""
    article = db[ARTICLES].find_one({"id": article_id})
    return serialize_doc(article)

def get_articles(db, skip: int = 0, limit: int = 100, is_featured: Optional[bool] = None):
    """Get paginated articles, excluding future-dated articles (based on EST)"""
    # Get current time in EST (UTC-5) and convert to UTC
    est_tz = timezone(timedelta(hours=-5))
    current_est_time = datetime.now(est_tz)
    current_utc_time = current_est_time.astimezone(timezone.utc)
    
    # MongoDB stores datetime objects (timezone-naive, assumed UTC)
    current_utc_naive = current_utc_time.replace(tzinfo=None)
    
    query = {
        "$or": [
            {"published_at": {"$lte": current_utc_naive}},
            {"published_at": {"$exists": False}}
        ]
    }
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
    """Get articles by category slug, excluding top stories and future-dated articles (based on EST)"""
    # Get current time in EST (UTC-5) and convert to UTC
    est_tz = timezone(timedelta(hours=-5))
    current_est_time = datetime.now(est_tz)
    current_utc_time = current_est_time.astimezone(timezone.utc)
    
    # MongoDB stores datetime objects (timezone-naive, assumed UTC)
    # Convert to naive UTC datetime for comparison
    current_utc_naive = current_utc_time.replace(tzinfo=None)
    
    docs = list(
        db[ARTICLES]
        .find({
            "category": category_slug,
            "is_published": True,
            "is_top_story": {"$ne": True},  # Exclude articles marked as top stories
            "$or": [
                {"published_at": {"$lte": current_utc_naive}},
                {"published_at": {"$exists": False}}  # Include articles without published_at
            ]
        })
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_articles_by_states(db, category_slug: str, state_codes: List[str], skip: int = 0, limit: int = 100):
    """Get articles filtered by category and state codes, excluding top stories and future-dated articles (based on EST)"""
    # Get current time in EST (UTC-5) and convert to UTC
    est_tz = timezone(timedelta(hours=-5))
    current_est_time = datetime.now(est_tz)
    current_utc_time = current_est_time.astimezone(timezone.utc)
    
    # MongoDB stores datetime objects (timezone-naive, assumed UTC)
    current_utc_naive = current_utc_time.replace(tzinfo=None)
    
    # Articles where states field contains any of the state codes or "all"
    docs = list(
        db[ARTICLES]
        .find({
            "category": category_slug,
            "is_published": True,
            "is_top_story": {"$ne": True},  # Exclude articles marked as top stories
            "$or": [
                {"states": {"$regex": state, "$options": "i"}} 
                for state in (state_codes + ["all"])
            ],
            "$and": [
                {
                    "$or": [
                        {"published_at": {"$lte": current_utc_naive}},
                        {"published_at": {"$exists": False}}
                    ]
                }
            ]
        })
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_articles_by_content_language(db, category_slug: str, language_codes: List[str], skip: int = 0, limit: int = 100):
    """Get video articles filtered by category and content_language field
    
    Args:
        db: Database connection
        category_slug: Category slug (e.g., 'latest-video-songs')
        language_codes: List of language codes (e.g., ['te', 'ta', 'hi'])
        skip: Number of records to skip
        limit: Maximum number of records to return
    """
    # Get current time in EST (UTC-5) and convert to UTC
    est_tz = timezone(timedelta(hours=-5))
    current_est_time = datetime.now(est_tz)
    current_utc_time = current_est_time.astimezone(timezone.utc)
    
    # MongoDB stores datetime objects (timezone-naive, assumed UTC)
    current_utc_naive = current_utc_time.replace(tzinfo=None)
    
    # Query for articles matching category and content_language
    docs = list(
        db[ARTICLES]
        .find({
            "category": category_slug,
            "is_published": True,
            "is_top_story": {"$ne": True},
            "content_language": {"$in": language_codes},  # Filter by content_language codes
            "$and": [
                {
                    "$or": [
                        {"published_at": {"$lte": current_utc_naive}},
                        {"published_at": {"$exists": False}}
                    ]
                }
            ]
        })
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_articles_by_video_language(db, category_slug: str, languages: List[str], skip: int = 0, limit: int = 100):
    """Get video articles filtered by category and video_language field"""
    # Get current time in EST (UTC-5) and convert to UTC
    est_tz = timezone(timedelta(hours=-5))
    current_est_time = datetime.now(est_tz)
    current_utc_time = current_est_time.astimezone(timezone.utc)
    
    # MongoDB stores datetime objects (timezone-naive, assumed UTC)
    current_utc_naive = current_utc_time.replace(tzinfo=None)
    
    # Articles where video_language matches any of the specified languages
    docs = list(
        db[ARTICLES]
        .find({
            "category": category_slug,
            "is_published": True,
            "is_top_story": {"$ne": True},
            "video_language": {"$in": languages},
            "$or": [
                {"published_at": {"$lte": current_utc_naive}},
                {"published_at": {"$exists": False}}
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
    """Count articles for CMS with filters - EXCLUDES ads"""
    # Build base conditions
    conditions = [
        {"article_language": language},
        # Exclude ads from posts count - ads have ad_type field with a truthy value
        {"$or": [{"ad_type": {"$exists": False}}, {"ad_type": None}]}
    ]
    
    if category:
        conditions.append({"category": category})
    
    if state and state != "all":
        conditions.append({"states": {"$regex": state, "$options": "i"}})
    
    if content_type:
        conditions.append({"content_type": content_type})
    
    # Filter by status field - supports: draft, in_review, approved, published, scheduled
    # Handle both new status field and legacy boolean fields for backward compatibility
    if status:
        if status == "published":
            # Published articles: is_published=True and not scheduled
            conditions.append({"is_published": True})
            conditions.append({"is_scheduled": {"$ne": True}})
        elif status == "scheduled":
            # Scheduled articles: is_scheduled=True
            conditions.append({"is_scheduled": True})
        elif status == "draft":
            # Draft articles: either status=draft OR (is_published=False and is_scheduled=False and no status field)
            conditions.append({
                "$or": [
                    {"status": "draft"},
                    {"$and": [
                        {"is_published": False},
                        {"is_scheduled": {"$ne": True}},
                        {"status": {"$exists": False}}
                    ]}
                ]
            })
        else:
            # For other statuses (in_review, approved), filter by status field only
            conditions.append({"status": status})
    
    query = {"$and": conditions}
    
    return db[ARTICLES].count_documents(query)

def get_ads_count_for_cms(
    db,
    language: str = "en",
    ad_type: str = None,
    status: str = None
):
    """Count ads for CMS with filters - ONLY ads"""
    query = {
        "article_language": language,
        # Only count ads
        "ad_type": {"$exists": True}
    }
    
    if ad_type:
        query["ad_type"] = ad_type
    
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
    """Get paginated articles for CMS with filters - EXCLUDES ads"""
    # Build base conditions
    conditions = [
        {"article_language": language},
        # Exclude ads from posts - ads have ad_type field with a truthy value
        {"$or": [{"ad_type": {"$exists": False}}, {"ad_type": None}]}
    ]
    
    if category:
        conditions.append({"category": category})
    
    if state and state != "all":
        conditions.append({"states": {"$regex": state, "$options": "i"}})
    
    if content_type:
        conditions.append({"content_type": content_type})
    
    # Filter by status field - supports: draft, in_review, approved, published, scheduled
    # Handle both new status field and legacy boolean fields for backward compatibility
    if status:
        if status == "published":
            # Published articles: is_published=True and not scheduled
            conditions.append({"is_published": True})
            conditions.append({"is_scheduled": {"$ne": True}})
        elif status == "scheduled":
            # Scheduled articles: is_scheduled=True
            conditions.append({"is_scheduled": True})
        elif status == "draft":
            # Draft articles: either status=draft OR (is_published=False and is_scheduled=False and no status field)
            conditions.append({
                "$or": [
                    {"status": "draft"},
                    {"$and": [
                        {"is_published": False},
                        {"is_scheduled": {"$ne": True}},
                        {"status": {"$exists": False}}
                    ]}
                ]
            })
        else:
            # For other statuses (in_review, approved), filter by status field only
            conditions.append({"status": status})
    
    query = {"$and": conditions}
    
    docs = list(
        db[ARTICLES]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_ads_for_cms(
    db,
    language: str = "en",
    skip: int = 0,
    limit: int = 20,
    ad_type: str = None,
    status: str = None
):
    """Get paginated ads for CMS with filters - ONLY ads"""
    query = {
        "article_language": language,
        # Only get ads - articles with ad_type field
        "ad_type": {"$exists": True}
    }
    
    if ad_type:
        query["ad_type"] = ad_type
    
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
    # Debug: Check content_language
    print(f"🔍 DEBUG crud.create_article - Received content_language: {article.get('content_language')}")
    
    # Generate new integer ID
    last_article = db[ARTICLES].find_one(sort=[("id", -1)])
    new_id = (last_article["id"] + 1) if last_article else 1
    
    article_doc = {
        "id": new_id,
        "title": article.get("title"),
        "display_title": article.get("display_title"),  # Short title for home page display
        "short_title": article.get("short_title"),
        "slug": article.get("slug"),
        "content": article.get("content"),
        "summary": article.get("summary"),
        "author": article.get("author"),
        "article_language": article.get("article_language", "en"),
        "content_language": article.get("content_language"),  # Content Language for movie/video categories
        "states": article.get("states"),
        "category": article.get("category"),
        "category": article.get("category"),
        "content_type": article.get("content_type", "post"),
        "ad_type": article.get("ad_type"),
        "sponsored_link": article.get("sponsored_link"),
        "sponsored_label": article.get("sponsored_label"),
        "image": article.get("image"),
        "image_gallery": article.get("image_gallery"),
        "gallery_id": article.get("gallery_id"),
        "youtube_url": article.get("youtube_url"),
        "tags": article.get("tags"),
        "artists": article.get("artists"),
        "movie_rating": article.get("movie_rating"),
        "is_featured": article.get("is_featured", False),
        "is_sponsored": True,  # All ads are sponsored by default
        "is_top_story": article.get("is_top_story", False),
        "top_story_duration_hours": article.get("top_story_duration_hours", 24),
        "top_story_expires_at": None,
        "is_published": article.get("is_published", True),
        "is_scheduled": article.get("is_scheduled", False),
        "scheduled_publish_at": article.get("scheduled_publish_at"),
        "scheduled_timezone": article.get("scheduled_timezone", "IST"),
        "status": article.get("status", "draft"),  # Status field: draft, in_review, approved, published, scheduled
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
        "movie_language": article.get("movie_language"),
        "platform": article.get("platform"),
        "ott_platform": article.get("ott_platform"),
        # Social media embed fields
        "social_media_type": article.get("social_media_type"),
        "social_media_embed": _clean_twitter_embed(article.get("social_media_embed")),
        "social_media_embeds": article.get("social_media_embeds"),
        # Comment fields
        "comments_enabled": article.get("comments_enabled", True),
        "review_comments_enabled": article.get("review_comments_enabled", False),
        "view_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "published_at": article.get("published_at") or datetime.utcnow()
    }
    
    print(f"🔍 DEBUG crud.create_article - Saving article_doc with content_language: {article_doc.get('content_language')}")  # Debug log
    
    result = db[ARTICLES].insert_one(article_doc)
    article_doc["_id"] = result.inserted_id
    
    # Manage top stories if is_top_story is True
    if article.get("is_top_story", False):
        from datetime import timedelta
        
        # Calculate expiration time
        duration_hours = article.get("top_story_duration_hours", 24)
        published_at = article_doc.get("published_at", datetime.utcnow())
        expires_at = published_at + timedelta(hours=duration_hours)
        
        # Update article with expiration time
        db[ARTICLES].update_one(
            {"id": new_id},
            {"$set": {"top_story_expires_at": expires_at}}
        )
        
        manage_top_stories(
            db,
            str(new_id),
            article.get("content_type", "post"),
            article.get("states", "[]"),
            published_at,
            True
        )
    
    return serialize_doc(article_doc)

def create_article_cms(db, article, slug: str, seo_title: str, seo_description: str):
    """Create article from CMS"""
    # Convert Pydantic model to dict if needed
    if hasattr(article, 'dict'):
        article_dict = article.dict()
    else:
        article_dict = dict(article)
    
    article_dict["slug"] = slug
    article_dict["seo_title"] = seo_title
    article_dict["seo_description"] = seo_description
    
    if article_dict.get("is_published") and not article_dict.get("published_at"):
        article_dict["published_at"] = datetime.utcnow()
    
    return create_article(db, article_dict)

def update_article_cms(db, article_id: int, article: dict):
    """Update article from CMS"""
    # Build update dict - only include fields that are in the article dict
    update_fields = {}
    
    # Map of fields that can be updated
    allowed_fields = [
        "title", "display_title", "short_title", "content", "content_secondary", "summary", "author", 
        "states", "category", "content_type", "ad_type", "sponsored_link", "sponsored_label", "image", "image_gallery", 
        "gallery_id", "youtube_url", "tags", "artists", "movie_rating",
        "is_featured", "is_sponsored", "is_top_story", "top_story_duration_hours", "is_published", "is_scheduled", "scheduled_publish_at", "scheduled_timezone",
        "status",  # Status field: draft, in_review, approved, published, scheduled
        "seo_title", "seo_description", "seo_keywords",
        "aeo_title", "aeo_description", "aeo_keywords", "faqs",
        "author_credentials", "sources", "fact_checked_by", "last_reviewed_date",
        "review_quick_verdict", "review_plot_summary", "review_performances",
        "review_what_works", "review_what_doesnt_work", "review_technical_aspects",
        "review_final_verdict", "review_cast", "review_director", "review_producer",
        "review_music_director", "review_dop", "review_genre", "review_runtime", "movie_language",
        "censor_rating", "release_date", "platform", "ott_content_type", "ott_platforms",
        "comments_enabled", "review_comments_enabled", "social_media_type", "social_media_embed", "social_media_embeds"
    ]
    
    # Only update fields that are present in the article dict
    for field in allowed_fields:
        if field in article:
            value = article[field]
            # Clean Twitter embed code to show full tweet card
            if field == "social_media_embed":
                value = _clean_twitter_embed(value)
            update_fields[field] = value
    
    # Handle language field - support both 'language' and 'article_language'
    if "article_language" in article:
        update_fields["article_language"] = article["article_language"] or "en"
    elif "language" in article:
        update_fields["article_language"] = article["language"] or "en"
    
    # Always update timestamp
    update_fields["updated_at"] = datetime.utcnow()
    
    # Build MongoDB update query
    update_data = {"$set": update_fields}
    
    # Update published_at if publishing
    published_at = None
    if article.get("is_published"):
        existing = db[ARTICLES].find_one({"id": article_id})
        if existing and not existing.get("published_at"):
            update_data["$set"]["published_at"] = datetime.utcnow()
            published_at = datetime.utcnow()
        else:
            published_at = existing.get("published_at", datetime.utcnow())
    
    db[ARTICLES].update_one({"id": article_id}, update_data)
    
    # Manage top stories if is_top_story field is present
    if "is_top_story" in article:
        from datetime import timedelta
        
        article_obj = db[ARTICLES].find_one({"id": article_id})
        
        # Calculate expiration time if being set as top story
        if article.get("is_top_story", False):
            duration_hours = article.get("top_story_duration_hours", article_obj.get("top_story_duration_hours", 24))
            published_time = published_at or article_obj.get("published_at", datetime.utcnow())
            expires_at = published_time + timedelta(hours=duration_hours)
            
            # Update expiration time
            db[ARTICLES].update_one(
                {"id": article_id},
                {"$set": {"top_story_expires_at": expires_at}}
            )
        
        manage_top_stories(
            db,
            str(article_id),
            article_obj.get("content_type", "post"),
            article_obj.get("states", "[]"),
            published_at or article_obj.get("published_at", datetime.utcnow()),
            article.get("is_top_story", False)
        )
    
    return get_article_by_id(db, article_id)

def delete_article(db, article_id: int, s3_service=None):
    """Delete article and its images from S3"""
    # Get article to access image URLs
    article = db[ARTICLES].find_one({"id": article_id}, {"_id": 0})
    
    if article and s3_service and s3_service.is_enabled():
        # Delete main article image
        image_url = article.get("image")
        if image_url:
            try:
                s3_service.delete_file(image_url)
                print(f"Deleted article image from S3: {image_url}")
            except Exception as e:
                print(f"Failed to delete article image from S3: {image_url}, Error: {e}")
        
        # Delete gallery images if any (image_gallery field)
        image_gallery = article.get("image_gallery")
        if image_gallery:
            try:
                # image_gallery is a JSON string of URLs
                import json
                gallery_urls = json.loads(image_gallery) if isinstance(image_gallery, str) else image_gallery
                if isinstance(gallery_urls, list):
                    for url in gallery_urls:
                        try:
                            s3_service.delete_file(url)
                            print(f"Deleted gallery image from S3: {url}")
                        except Exception as e:
                            print(f"Failed to delete gallery image from S3: {url}, Error: {e}")
            except Exception as e:
                print(f"Failed to parse image_gallery: {e}")
    
    # Delete article from database
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

def create_scheduler_settings(db, settings: dict):
    """Create scheduler settings"""
    doc = {
        "is_enabled": settings.get("is_enabled", False),
        "check_frequency_minutes": settings.get("check_frequency_minutes", 5),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    db[SCHEDULER_SETTINGS].insert_one(doc)
    return serialize_doc(doc)

def get_scheduled_articles_for_publishing(db):
    """Get articles that are scheduled and ready to be published"""
    from pytz import timezone
    from datetime import datetime
    
    # Get all scheduled articles
    query = {
        "is_scheduled": True,
        "is_published": False
    }
    
    docs = list(db[ARTICLES].find(query, {"_id": 0}))
    articles_to_publish = []
    
    for doc in docs:
        scheduled_time_str = doc.get("scheduled_publish_at")
        scheduled_timezone = doc.get("scheduled_timezone", "IST")
        
        if not scheduled_time_str:
            continue
        
        # Parse the scheduled time (from datetime-local input it comes as: "2025-12-25T14:30")
        scheduled_time = datetime.fromisoformat(scheduled_time_str.replace("Z", ""))
        
        # Get current time in the article's timezone
        if scheduled_timezone == "IST":
            tz = timezone('Asia/Kolkata')
        elif scheduled_timezone == "EST":
            tz = timezone('America/New_York')
        else:
            tz = timezone('Asia/Kolkata')  # Default to IST
        
        current_time = datetime.now(tz).replace(tzinfo=None)
        
        # Check if it's time to publish (scheduled time has passed)
        if scheduled_time <= current_time:
            articles_to_publish.append(serialize_doc(doc))
    
    return articles_to_publish

def publish_scheduled_article(db, article_id):
    """Publish a scheduled article"""
    # Convert to int if string
    if isinstance(article_id, str):
        article_id = int(article_id)
    
    result = db[ARTICLES].update_one(
        {"id": article_id},
        {
            "$set": {
                "is_scheduled": False,
                "is_published": True,
                "published_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count > 0:
        return db[ARTICLES].find_one({"id": article_id}, {"_id": 0})
    return None

def get_scheduled_galleries_for_publishing(db):
    """Get galleries that are scheduled and ready to be published"""
    from pytz import timezone
    from datetime import datetime
    
    # Get all scheduled galleries
    query = {
        "is_scheduled": True,
        "is_published": False
    }
    
    docs = list(db[GALLERIES].find(query, {"_id": 0}))
    galleries_to_publish = []
    
    for doc in docs:
        scheduled_time_str = doc.get("scheduled_publish_at")
        scheduled_timezone = doc.get("scheduled_timezone", "IST")
        
        if not scheduled_time_str:
            continue
        
        # Parse the scheduled time
        scheduled_time = datetime.fromisoformat(scheduled_time_str.replace("Z", ""))
        
        # Get current time in the gallery's timezone
        if scheduled_timezone == "IST":
            tz = timezone('Asia/Kolkata')
        elif scheduled_timezone == "EST":
            tz = timezone('America/New_York')
        else:
            tz = timezone('Asia/Kolkata')  # Default to IST
        
        current_time = datetime.now(tz).replace(tzinfo=None)
        
        # Check if it's time to publish
        if scheduled_time <= current_time:
            galleries_to_publish.append(serialize_doc(doc))
    
    return galleries_to_publish

def publish_scheduled_gallery(db, gallery_id):
    """Publish a scheduled gallery"""
    result = db[GALLERIES].update_one(
        {"id": gallery_id},
        {
            "$set": {
                "is_scheduled": False,
                "is_published": True,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count > 0:
        return db[GALLERIES].find_one({"id": gallery_id}, {"_id": 0})
    return None

# ==================== RELEASES ====================

def get_theater_release(db, release_id: int):
    """Get single theater release by ID"""
    doc = db[THEATER_RELEASES].find_one({"id": release_id})
    return serialize_doc(doc)

def get_theater_releases(db, language: str = None, skip: int = 0, limit: int = 100):
    """Get theater releases"""
    query = {}
    if language:
        query["language"] = language
    
    docs = list(db[THEATER_RELEASES].find(query).sort("release_date", 1).skip(skip).limit(limit))
    return serialize_doc(docs)

def get_upcoming_theater_releases(db, limit: int = 100):
    """Get upcoming theater releases (from today onwards)"""
    from datetime import date
    today = date.today().isoformat()
    
    docs = list(db[THEATER_RELEASES].find(
        {"release_date": {"$gte": today}}
    ).sort("release_date", 1).limit(limit))
    return serialize_doc(docs)

def get_latest_theater_releases(db, limit: int = 100):
    """Get latest theater releases sorted by updated_at/created_at"""
    docs = list(db[THEATER_RELEASES].find({}).sort([
        ("updated_at", -1),
        ("created_at", -1)
    ]).limit(limit))
    return serialize_doc(docs)

def get_latest_theater_releases_by_state(db, limit: int = 100):
    """Get latest state-targeted theater releases (excluding 'all' state)"""
    query = {
        "states": {"$not": {"$regex": '"all"'}}
    }
    docs = list(db[THEATER_RELEASES].find(query).sort([
        ("updated_at", -1),
        ("created_at", -1)
    ]).limit(limit))
    return serialize_doc(docs)

def get_latest_theater_releases_all_states(db, limit: int = 100):
    """Get latest theater releases with state='all' (Bollywood)"""
    query = {
        "states": {"$regex": '"all"'}
    }
    docs = list(db[THEATER_RELEASES].find(query).sort([
        ("updated_at", -1),
        ("created_at", -1)
    ]).limit(limit))
    return serialize_doc(docs)

def get_this_week_theater_releases(db, limit: int = 100):
    """Get this week's theater releases - kept for backward compatibility"""
    from datetime import date, timedelta
    today = date.today()
    week_end = (today + timedelta(days=7)).isoformat()
    today_str = today.isoformat()
    
    docs = list(db[THEATER_RELEASES].find(
        {"release_date": {"$gte": today_str, "$lte": week_end}}
    ).sort("release_date", 1).limit(limit))
    return serialize_doc(docs)

def get_this_week_theater_releases_by_state(db, state: str = None, limit: int = 100):
    """Get latest theater releases filtered by state (excluding 'all') - shows most recent releases regardless of date"""
    import json
    
    query = {
        # Explicitly exclude 'all' states - only show state-specific releases
        "states": {"$not": {"$regex": '"all"'}}
    }
    
    if state:
        # Match releases that include the user's state (not 'all')
        query["states"]["$regex"] = f'"{state}"'
    
    # Sort by created_at/updated_at descending to show latest releases first
    docs = list(db[THEATER_RELEASES].find(query).sort([("created_at", -1), ("release_date", -1)]).limit(limit))
    return serialize_doc(docs)

def get_upcoming_theater_releases_by_state(db, state: str = None, limit: int = 100):
    """Get latest theater releases filtered by state (excluding 'all') - shows recent releases regardless of date"""
    import json
    
    query = {
        # Explicitly exclude 'all' states - only show state-specific releases
        "states": {"$not": {"$regex": '"all"'}}
    }
    
    if state:
        # Match releases that include the user's state (not 'all')
        query["states"]["$regex"] = f'"{state}"'
    
    # Sort by created_at/updated_at descending to show latest releases first
    # Skip the first 'limit' results since this is for "coming_soon" section
    docs = list(db[THEATER_RELEASES].find(query).sort([("created_at", -1), ("release_date", -1)]).skip(limit).limit(limit))
    return serialize_doc(docs)

def get_this_week_theater_releases_all_states(db, limit: int = 100):
    """Get latest theater releases with state='all' - shows most recent releases regardless of date"""
    query = {
        "states": {"$regex": '"all"'}
    }
    
    # Sort by created_at/updated_at descending to show latest releases first
    docs = list(db[THEATER_RELEASES].find(query).sort([("created_at", -1), ("release_date", -1)]).limit(limit))
    return serialize_doc(docs)

def get_upcoming_theater_releases_all_states(db, limit: int = 100):
    """Get latest theater releases with state='all' - shows recent releases regardless of date"""
    query = {
        "states": {"$regex": '"all"'}
    }
    
    # Sort by created_at/updated_at descending and skip first 'limit' for "coming_soon" section
    docs = list(db[THEATER_RELEASES].find(query).sort([("created_at", -1), ("release_date", -1)]).skip(limit).limit(limit))
    return serialize_doc(docs)

def get_theater_releases_by_language(db, languages: list, limit: int = 100):
    """Get theater releases filtered by language(s) - for state-language mapping"""
    import json
    
    if not languages:
        # If no languages specified, return all releases
        docs = list(db[THEATER_RELEASES].find({}).sort([("release_date", -1), ("created_at", -1)]).limit(limit))
        return serialize_doc(docs)
    
    # Build query to match any of the specified languages
    # Languages are stored as JSON strings like '["Telugu", "Hindi"]'
    language_conditions = []
    for lang in languages:
        language_conditions.append({"languages": {"$regex": f'"{lang}"', "$options": "i"}})
        # Also check original_language field
        language_conditions.append({"original_language": {"$regex": f'^{lang}$', "$options": "i"}})
    
    query = {"$or": language_conditions}
    
    docs = list(db[THEATER_RELEASES].find(query).sort([("release_date", -1), ("created_at", -1)]).limit(limit))
    return serialize_doc(docs)

def get_theater_releases_bollywood(db, limit: int = 100):
    """Get Hindi language theater releases for Bollywood tab"""
    # Hindi releases for Bollywood section
    query = {
        "$or": [
            {"languages": {"$regex": '"Hindi"', "$options": "i"}},
            {"original_language": {"$regex": "^Hindi$", "$options": "i"}}
        ]
    }
    
    docs = list(db[THEATER_RELEASES].find(query).sort([("release_date", -1), ("created_at", -1)]).limit(limit))
    return serialize_doc(docs)

def get_ott_release(db, release_id: int):
    """Get single OTT release by ID"""
    doc = db[OTT_RELEASES].find_one({"id": release_id})
    return serialize_doc(doc)

def get_ott_releases(db, language: str = None, skip: int = 0, limit: int = 100):
    """Get OTT releases"""
    query = {}
    if language:
        query["language"] = language
    
    docs = list(db[OTT_RELEASES].find(query).sort("release_date", 1).skip(skip).limit(limit))
    return serialize_doc(docs)

def get_upcoming_ott_releases(db, limit: int = 100):
    """Get upcoming OTT releases (from today onwards)"""
    from datetime import date
    today = date.today().isoformat()
    
    docs = list(db[OTT_RELEASES].find(
        {"release_date": {"$gte": today}}
    ).sort("release_date", 1).limit(limit))
    return serialize_doc(docs)

def get_latest_ott_releases(db, limit: int = 100):
    """Get latest OTT releases sorted by updated_at/created_at"""
    docs = list(db[OTT_RELEASES].find({}).sort([
        ("updated_at", -1),
        ("created_at", -1)
    ]).limit(limit))
    return serialize_doc(docs)

def get_this_week_ott_releases(db, limit: int = 100):
    """Get this week's OTT releases - kept for backward compatibility"""
    from datetime import date, timedelta
    today = date.today()
    week_end = (today + timedelta(days=7)).isoformat()
    today_str = today.isoformat()
    
    docs = list(db[OTT_RELEASES].find(
        {"release_date": {"$gte": today_str, "$lte": week_end}}
    ).sort("release_date", 1).limit(limit))
    return serialize_doc(docs)

def create_theater_release(db, release):
    """Create theater release"""
    import json
    
    # Convert Pydantic model to dict if needed
    if hasattr(release, 'dict'):
        release_data = release.dict()
    else:
        release_data = release
    
    # Generate new ID
    last_release = db[THEATER_RELEASES].find_one(sort=[("id", -1)])
    new_id = (last_release["id"] + 1) if last_release else 1
    
    # Convert date to string if it's a date object
    release_date = release_data.get("release_date")
    if release_date and hasattr(release_date, 'isoformat'):
        release_date = release_date.isoformat()
    
    # Helper function to ensure array fields are stored as JSON strings
    def ensure_json_string(value, default='[]'):
        if value is None:
            return default
        if isinstance(value, list):
            return json.dumps(value)
        if isinstance(value, str):
            return value
        return default
    
    # Helper function to ensure string fields
    def ensure_string(value, default=''):
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return str(value)
        return str(value) if value else default
    
    release_doc = {
        "id": new_id,
        "movie_name": release_data.get("movie_name"),
        "release_date": release_date,
        "movie_image": release_data.get("movie_image"),
        "youtube_url": release_data.get("youtube_url") or '',
        "states": ensure_json_string(release_data.get("states")),
        "languages": ensure_json_string(release_data.get("languages")),
        "original_language": release_data.get("original_language") or (release_data.get("languages", ['Hindi'])[0] if isinstance(release_data.get("languages"), list) else 'Hindi'),
        "genres": ensure_json_string(release_data.get("genres")),
        "director": ensure_string(release_data.get("director")),
        "producer": ensure_string(release_data.get("producer")),
        "banner": ensure_string(release_data.get("banner")),
        "music_director": ensure_string(release_data.get("music_director")),
        "dop": ensure_string(release_data.get("dop")),
        "editor": ensure_string(release_data.get("editor")),
        "cast": ensure_json_string(release_data.get("cast")),
        "runtime": ensure_string(release_data.get("runtime")),
        "censor_rating": ensure_string(release_data.get("censor_rating")),
        "is_published": release_data.get("is_published", False),
        "status": release_data.get("status", "in_review"),
        "source_url": release_data.get("source_url"),
        "imdb_id": release_data.get("imdb_id"),
        "created_by": ensure_string(release_data.get("created_by"), 'AI Agent'),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db[THEATER_RELEASES].insert_one(release_doc)
    release_doc["_id"] = result.inserted_id
    return serialize_doc(release_doc)

def create_ott_release(db, release):
    """Create OTT release"""
    import json
    
    # Convert Pydantic model to dict if needed
    if hasattr(release, 'dict'):
        release_data = release.dict()
    else:
        release_data = release
    
    # Generate new ID
    last_release = db[OTT_RELEASES].find_one(sort=[("id", -1)])
    new_id = (last_release["id"] + 1) if last_release else 1
    
    # Convert date to string if it's a date object
    release_date = release_data.get("release_date")
    if release_date and hasattr(release_date, 'isoformat'):
        release_date = release_date.isoformat()
    
    # Helper function to ensure array fields are stored as JSON strings
    def ensure_json_string(value, default='[]'):
        if value is None:
            return default
        if isinstance(value, list):
            return json.dumps(value)
        if isinstance(value, str):
            return value
        return default
    
    # Helper function to ensure string fields
    def ensure_string(value, default=''):
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return str(value)
        return str(value) if value else default
    
    release_doc = {
        "id": new_id,
        "movie_name": release_data.get("movie_name"),
        "content_type": release_data.get("content_type"),
        "season": release_data.get("season"),
        "episodes_count": release_data.get("episodes_count"),
        "original_language": release_data.get("original_language"),
        "release_date": release_date,
        "movie_image": release_data.get("movie_image"),
        "youtube_url": release_data.get("youtube_url") or '',
        "ott_platforms": ensure_json_string(release_data.get("ott_platforms")),
        "states": ensure_json_string(release_data.get("states")),
        "languages": ensure_json_string(release_data.get("languages")),
        "genres": ensure_json_string(release_data.get("genres")),
        "director": ensure_string(release_data.get("director")),
        "producer": ensure_string(release_data.get("producer")),
        "banner": ensure_string(release_data.get("banner")),
        "music_director": ensure_string(release_data.get("music_director")),
        "dop": ensure_string(release_data.get("dop")),
        "editor": ensure_string(release_data.get("editor")),
        "cast": ensure_json_string(release_data.get("cast")),
        "runtime": ensure_string(release_data.get("runtime")),
        "censor_rating": ensure_string(release_data.get("censor_rating")),
        "is_published": release_data.get("is_published", False),
        "status": release_data.get("status", "in_review"),
        "source_url": release_data.get("source_url"),
        "release_type": release_data.get("release_type"),
        "synopsis": release_data.get("synopsis"),
        "created_by": ensure_string(release_data.get("created_by"), 'AI Agent'),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = db[OTT_RELEASES].insert_one(release_doc)
    release_doc["_id"] = result.inserted_id
    return serialize_doc(release_doc)

def delete_theater_release(db, release_id: int, s3_service=None):
    """Delete theater release and its images from S3"""
    # Get release to access image URLs
    release = db[THEATER_RELEASES].find_one({"id": release_id}, {"_id": 0})
    
    if release and s3_service and s3_service.is_enabled():
        # Delete movie image
        image_url = release.get("movie_image")
        if image_url:
            try:
                s3_service.delete_file(image_url)
                print(f"Deleted theater release image from S3: {image_url}")
            except Exception as e:
                print(f"Failed to delete theater release image from S3: {image_url}, Error: {e}")
        
        # Delete movie banner
        banner_url = release.get("movie_banner")
        if banner_url:
            try:
                s3_service.delete_file(banner_url)
                print(f"Deleted theater release banner from S3: {banner_url}")
            except Exception as e:
                print(f"Failed to delete theater release banner from S3: {banner_url}, Error: {e}")
    
    # Delete release from database
    result = db[THEATER_RELEASES].delete_one({"id": release_id})
    return result.deleted_count > 0

def delete_ott_release(db, release_id: int, s3_service=None):
    """Delete OTT release and its images from S3"""
    # Get release to access image URLs
    release = db[OTT_RELEASES].find_one({"id": release_id}, {"_id": 0})
    
    if release and s3_service and s3_service.is_enabled():
        # Delete movie image
        image_url = release.get("movie_image")
        if image_url:
            try:
                s3_service.delete_file(image_url)
                print(f"Deleted OTT release image from S3: {image_url}")
            except Exception as e:
                print(f"Failed to delete OTT release image from S3: {image_url}, Error: {e}")
    
    # Delete release from database
    result = db[OTT_RELEASES].delete_one({"id": release_id})
    return result.deleted_count > 0

def update_theater_release(db, release_id: int, release_data):
    """Update theater release"""
    # Convert Pydantic model to dict if needed
    if hasattr(release_data, 'dict'):
        data = release_data.dict(exclude_unset=True)
    else:
        data = release_data
    
    update_doc = {"updated_at": datetime.utcnow()}
    
    # Add all provided fields to update document
    for field in ["movie_name", "release_date", "movie_image", "youtube_url", "states", 
                  "languages", "genres", "director", "producer", "banner", "music_director",
                  "dop", "editor", "cast", "runtime", "censor_rating"]:
        value = data.get(field)
        if value is not None:
            # Convert date to string if it's a date object
            if field == "release_date" and hasattr(value, 'isoformat'):
                value = value.isoformat()
            update_doc[field] = value
    
    result = db[THEATER_RELEASES].update_one(
        {"id": release_id},
        {"$set": update_doc}
    )
    
    if result.modified_count > 0 or result.matched_count > 0:
        return get_theater_release(db, release_id)
    return None

def update_ott_release(db, release_id: int, release_data):
    """Update OTT release"""
    # Convert Pydantic model to dict if needed
    if hasattr(release_data, 'dict'):
        data = release_data.dict(exclude_unset=True)
    else:
        data = release_data
    
    update_doc = {"updated_at": datetime.utcnow()}
    
    # Add all provided fields to update document
    for field in ["movie_name", "content_type", "season", "episodes_count", "original_language", "release_date", "movie_image", "youtube_url", "ott_platforms",
                  "states", "languages", "genres", "director", "producer", "banner",
                  "music_director", "dop", "editor", "cast", "runtime", "censor_rating"]:
        value = data.get(field)
        if value is not None:
            # Convert date to string if it's a date object
            if field == "release_date" and hasattr(value, 'isoformat'):
                value = value.isoformat()
            update_doc[field] = value
    
    result = db[OTT_RELEASES].update_one(
        {"id": release_id},
        {"$set": update_doc}
    )
    
    if result.modified_count > 0 or result.matched_count > 0:
        return get_ott_release(db, release_id)
    return None

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
    """Get AWS S3 configuration (returns full unmasked values)"""
    doc = db['system_settings'].find_one({"type": "aws_config"})
    return serialize_doc(doc) if doc else None

def update_aws_config(db, config: dict):
    """Update AWS S3 configuration - only updates provided fields"""
    # Build update document with only provided fields
    update_fields = {"type": "aws_config", "updated_at": datetime.utcnow()}
    
    if "is_enabled" in config:
        update_fields["is_enabled"] = config["is_enabled"]
    
    if "aws_access_key_id" in config and config["aws_access_key_id"]:
        update_fields["aws_access_key_id"] = config["aws_access_key_id"]
    
    if "aws_secret_access_key" in config and config["aws_secret_access_key"]:
        update_fields["aws_secret_access_key"] = config["aws_secret_access_key"]
    
    if "aws_region" in config:
        update_fields["aws_region"] = config.get("aws_region", "us-east-1")
    
    if "s3_bucket_name" in config:
        update_fields["s3_bucket_name"] = config["s3_bucket_name"]
    
    if "root_folder_path" in config:
        update_fields["root_folder_path"] = config.get("root_folder_path", "")
    
    if "max_file_size_mb" in config:
        update_fields["max_file_size_mb"] = config.get("max_file_size_mb", 10)
    
    db['system_settings'].update_one(
        {"type": "aws_config"},
        {"$set": update_fields},
        upsert=True
    )
    
    return get_aws_config(db)

# ==================== AI API KEYS ====================

def get_ai_api_keys(db):
    """Get AI API keys configuration (returns full unmasked values)"""
    doc = db['system_settings'].find_one({"type": "ai_api_keys"})
    return serialize_doc(doc) if doc else None

def update_ai_api_keys(db, config: dict):
    """Update AI API keys configuration - only updates provided fields"""
    from datetime import datetime
    
    # Build update document with only provided fields
    update_fields = {"type": "ai_api_keys", "updated_at": datetime.utcnow()}
    
    if "openai_api_key" in config and config["openai_api_key"]:
        update_fields["openai_api_key"] = config["openai_api_key"]
    
    if "gemini_api_key" in config and config["gemini_api_key"]:
        update_fields["gemini_api_key"] = config["gemini_api_key"]
    
    if "anthropic_api_key" in config and config["anthropic_api_key"]:
        update_fields["anthropic_api_key"] = config["anthropic_api_key"]
    
    if "youtube_api_key" in config and config["youtube_api_key"]:
        update_fields["youtube_api_key"] = config["youtube_api_key"]
    
    if "openai_default_model" in config:
        update_fields["openai_default_model"] = config.get("openai_default_model")
    
    if "gemini_default_model" in config:
        update_fields["gemini_default_model"] = config.get("gemini_default_model")
    
    if "anthropic_default_model" in config:
        update_fields["anthropic_default_model"] = config.get("anthropic_default_model")
    
    if "default_text_model" in config:
        update_fields["default_text_model"] = config.get("default_text_model")
    
    if "default_image_model" in config:
        update_fields["default_image_model"] = config.get("default_image_model")
    
    db['system_settings'].update_one(
        {"type": "ai_api_keys"},
        {"$set": update_fields},
        upsert=True
    )
    
    return get_ai_api_keys(db)

# ==================== AI AGENTS ====================

def get_all_ai_agents(db):
    """Get all AI agents"""
    agents = list(db['ai_agents'].find({}))
    return [serialize_doc(agent) for agent in agents]

def get_ai_agent(db, agent_id: str):
    """Get a specific AI agent"""
    agent = db['ai_agents'].find_one({"id": agent_id})
    return serialize_doc(agent) if agent else None

def create_ai_agent(db, agent_data: dict):
    """Create a new AI agent"""
    import uuid
    agent_data["id"] = str(uuid.uuid4())
    db['ai_agents'].insert_one(agent_data)
    return serialize_doc(agent_data)

def update_ai_agent(db, agent_id: str, agent_data: dict):
    """Update an AI agent"""
    result = db['ai_agents'].update_one(
        {"id": agent_id},
        {"$set": agent_data}
    )
    if result.modified_count > 0 or result.matched_count > 0:
        return get_ai_agent(db, agent_id)
    return None

def delete_ai_agent(db, agent_id: str):
    """Delete an AI agent"""
    result = db['ai_agents'].delete_one({"id": agent_id})
    return result.deleted_count > 0

def toggle_ai_agent_status(db, agent_id: str):
    """Toggle agent active status"""
    agent = get_ai_agent(db, agent_id)
    if not agent:
        return None
    
    new_status = not agent.get("is_active", True)
    db['ai_agents'].update_one(
        {"id": agent_id},
        {"$set": {"is_active": new_status}}
    )
    return get_ai_agent(db, agent_id)

# ==================== CATEGORY-PROMPT MAPPINGS ====================

# Reference content instruction templates
REFERENCE_CONTENT_WITH_URLS = """If reference URLs are provided below, PRIORITIZE them as your primary source:
1. Visit and thoroughly analyze each reference URL
2. Extract key information, facts, data points, and insights from these sources
3. Use the reference content as the foundation for your article
4. Supplement with web search only for additional context or latest updates
5. Summarize and synthesize information from all reference sources
6. Always cite or reference the source material appropriately

REFERENCE URLs:
{reference_urls}"""

REFERENCE_CONTENT_NO_URLS = """No reference URLs provided. Proceed with standard web search to find the latest content for this category."""

# Split content instruction templates
SPLIT_CONTENT_ENABLED = """
**CONTENT STRUCTURE - SPLIT MODE:**
IMPORTANT: Structure your article into exactly {split_paragraphs} distinct paragraphs, clearly separated by blank lines.
- Each paragraph should be self-contained but flow logically to the next
- Paragraph 1 (Main Content): Lead with the most important/breaking news - this will be displayed prominently
- Remaining paragraphs (Secondary Content): Supporting details, context, quotes, and additional information
- Ensure roughly equal word distribution across paragraphs
- Use clear paragraph breaks (double newlines) between sections
- Format: [Paragraph 1]\\n\\n[Paragraph 2]\\n\\n[Paragraph 3]... (up to {split_paragraphs} paragraphs)
"""

SPLIT_CONTENT_DISABLED = """
**CONTENT STRUCTURE:**
Write as a single cohesive article with natural paragraph flow.
"""

# Web search image instruction templates
WEB_SEARCH_IMAGE_INSTRUCTIONS = """
**IMAGE SEARCH INSTRUCTIONS (Web Search Mode):**
After generating the article content, search the web for a relevant HORIZONTAL image based on these priority rules:

FOR MOVIE/ENTERTAINMENT NEWS:
1. FIRST PRIORITY: Search for official movie poster (horizontal/landscape orientation) of the specific movie mentioned
2. SECOND PRIORITY: Search for lead actor's image from that movie
   - If it's a female-oriented film, prioritize lead actress image
   - Search: "[Movie Name] [Actor/Actress Name] movie still" or "[Movie Name] official photo"
3. THIRD PRIORITY: Search for a recent photo of the main actor/actress (not movie-specific)
   - Search: "[Actor/Actress Name] latest photo" or "[Actor/Actress Name] 2024/2025"
4. FALLBACK: Generic movie-related promotional image

FOR POLITICAL/STATE NEWS:
1. FIRST PRIORITY: Search for image of the main politician/person mentioned in the article
   - Search: "[Politician Name] official photo" or "[Politician Name] recent"
2. SECOND PRIORITY: Search for image of the political event/meeting/rally described
   - Search: "[Event Name] [Location] photo" or "[Political Party] [Event Type]"
3. FALLBACK: Official government/political imagery related to the topic

FOR EVENT NEWS (Accidents, Disasters, Ceremonies, etc.):
1. FIRST PRIORITY: Search for actual image of the specific event mentioned
   - Search: "[Event Type] [Location] [Date]" (e.g., "fire accident Mumbai December 2024")
2. SECOND PRIORITY: Search for related event imagery from news sources
   - Search: "[Event Type] [Location] news photo"
3. FALLBACK: Representative/stock image of similar event type

FOR SPORTS NEWS:
1. FIRST PRIORITY: Search for image of the main player/team mentioned
   - Search: "[Player Name] [Sport] action shot" or "[Team Name] match photo"
2. SECOND PRIORITY: Search for match/tournament imagery
3. FALLBACK: Sports-related generic imagery

FOR OTHER CATEGORIES:
1. Identify the main subject/person/event in the article
2. Search for the most relevant and recent image of that subject
3. Prefer horizontal/landscape orientation images
4. Prefer high-quality, news-worthy images from reputable sources

IMAGE REQUIREMENTS:
- Must be HORIZONTAL/LANDSCAPE orientation (wider than tall)
- High resolution preferred (minimum 800px width)
- Recent/current images preferred over dated ones
- Avoid watermarked or low-quality images
- Prefer images from news agencies or official sources

Return the image search query and selected image URL in this format:
[IMAGE_SEARCH_QUERY]: Your search query here
[IMAGE_URL]: The URL of the selected image
"""

NO_WEB_SEARCH_IMAGE = """"""

def get_reference_content_section(reference_urls: list = None) -> str:
    """Generate the reference content section based on provided URLs"""
    if reference_urls and len(reference_urls) > 0:
        urls_list = "\n".join([f"- {url}" for url in reference_urls])
        return REFERENCE_CONTENT_WITH_URLS.format(reference_urls=urls_list)
    return REFERENCE_CONTENT_NO_URLS

def get_split_content_section(split_content: bool = False, split_paragraphs: int = 2) -> str:
    """Generate the split content instruction section"""
    if split_content:
        return SPLIT_CONTENT_ENABLED.format(split_paragraphs=split_paragraphs)
    return SPLIT_CONTENT_DISABLED

def get_image_search_section(image_option: str = None) -> str:
    """Generate the image search instruction section based on image option"""
    if image_option == 'web_search':
        return WEB_SEARCH_IMAGE_INSTRUCTIONS
    return NO_WEB_SEARCH_IMAGE

DEFAULT_CATEGORY_PROMPTS = {
    "politics": """**REFERENCE ARTICLE CONTENT:**
{reference_content_section}
{split_content_section}
{image_search_section}

**YOUR TASK:** Generate a NEW, original political news article based ENTIRELY on the reference article content provided above.

**INSTRUCTIONS:**
1. Read the reference article content carefully
2. Extract key facts: politician names, party names, events, dates, locations, quotes
3. Write a COMPLETELY NEW article in your own words based on this information
4. DO NOT copy sentences directly - rewrite everything originally
5. Focus on {target_state} political news

**ARTICLE REQUIREMENTS:**
- Write a {word_count} word article
- Create an engaging, SEO-friendly headline that captures the main political development
- Include all key names, parties, and facts from the reference
- Provide context and background for readers
- Maintain objectivity and present facts accurately
- Write for {target_audience}
- Use clear, accessible language while maintaining journalistic standards

**IMPORTANT:** Your article must be based ONLY on the reference content provided. Do not add information that is not in the reference article.""",

    "state-politics": """**LATEST ARTICLE FROM REFERENCE SOURCE:**
{reference_content_section}
{split_content_section}
{image_search_section}

**YOUR TASK:** Generate a NEW, original state political news article based ENTIRELY on the latest article content provided above.

The content above was automatically extracted from the latest published article on the reference news page.

**INSTRUCTIONS:**
1. Read the article content carefully
2. Extract key facts: politician names, party names (TDP, YSRCP, Congress, BJP, BRS, TRS, etc.), events, dates, locations, quotes
3. Write a COMPLETELY NEW article in your own words based on this information
4. DO NOT copy sentences directly - rewrite everything originally
5. Focus on {target_state} state political news (Andhra Pradesh / Telangana)

**ARTICLE REQUIREMENTS:**
- Write a {word_count} word article
- Create an engaging, SEO-friendly headline that captures the main political development
- Include all key politician names, parties, and facts from the reference
- Mention relevant state leaders (CM, Ministers, MLAs, MPs) as referenced
- Provide context and background for readers
- Maintain objectivity and present facts accurately
- Write for {target_audience}
- Use clear, accessible language while maintaining journalistic standards

**IMPORTANT:** Your article must be based ONLY on the reference content provided. Do not add information that is not in the reference article.""",

    "national-politics": """**REFERENCE ARTICLE CONTENT:**
{reference_content_section}
{split_content_section}
{image_search_section}

**YOUR TASK:** Generate a NEW, original national political news article based ENTIRELY on the reference article content provided above.

**INSTRUCTIONS:**
1. Read the reference article content carefully
2. Extract key facts: politician names, party names (BJP, Congress, AAP, etc.), events, dates, locations, quotes
3. Write a COMPLETELY NEW article in your own words based on this information
4. DO NOT copy sentences directly - rewrite everything originally
5. Focus on Indian national political news

**ARTICLE REQUIREMENTS:**
- Write a {word_count} word article
- Create an engaging, SEO-friendly headline that captures the main political development
- Include all key politician names, parties, and facts from the reference
- Mention relevant national leaders (PM, Ministers, MPs) as referenced
- Provide context and background for readers
- Maintain objectivity and present facts accurately
- Write for {target_audience}
- Use clear, accessible language while maintaining journalistic standards

**IMPORTANT:** Your article must be based ONLY on the reference content provided. Do not add information that is not in the reference article.""",

    "movies": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest trending movie news, releases, and entertainment updates {target_state_context}. Your task is to:

1. Identify the most trending movie-related stories from the last 24-48 hours
2. Cover topics like: new releases, box office collections, celebrity news, upcoming films, reviews, controversies
3. Find information from entertainment news sites, box office tracking, and social media trends
4. Include both Bollywood and Hollywood news when relevant

Write a {word_count} word article that:
- Has a catchy, entertainment-focused headline
- Covers the most exciting and newsworthy movie developments
- Includes box office numbers, release dates, or other specific details
- Mentions key actors, directors, and production houses
- Captures the excitement and buzz around the topic
- Is engaging and appeals to movie enthusiasts
- Uses entertaining yet informative language

Make it exciting for movie lovers {target_audience}!""",

    "sports": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest trending sports news and updates {target_state_context}. Your task is to:

1. Find the most recent significant sports stories from the last 24-48 hours
2. Cover various sports: cricket, football, tennis, Olympics, local sports, etc.
3. Include match results, player performances, team news, upcoming events
4. Check trending sports hashtags and discussions

Write a {word_count} word article that:
- Has an energetic, sports-focused headline
- Provides match scores, statistics, and key moments
- Highlights star player performances and achievements
- Includes tournament standings or rankings when relevant
- Captures the excitement and competitive spirit
- Appeals to sports fans with dynamic language
- Mentions upcoming matches or events when applicable

Focus on what's trending and exciting in the sports world {target_audience}!""",

    "fashion": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest fashion trends, style news, and fashion industry updates {target_state_context}. Your task is to:

1. Identify trending fashion stories from the last 24-48 hours
2. Cover: runway shows, celebrity fashion, street style, fashion weeks, designer news, trends
3. Look for what's trending on fashion blogs, social media, and fashion news sites
4. Include both international and local fashion scenes

Write a {word_count} word article that:
- Has a stylish, trend-focused headline
- Describes the latest fashion trends and styles
- Mentions key designers, brands, and fashion influencers
- Includes details about colors, fabrics, patterns, and styling tips
- Features celebrity or influencer fashion when relevant
- Uses vivid, descriptive language about styles and looks
- Appeals to fashion-conscious readers

Make it inspiring and aspirational for fashion enthusiasts {target_audience}!""",

    "health": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest health news, medical breakthroughs, and wellness trends {target_state_context}. Your task is to:

1. Find the most recent significant health stories from the last 24-48 hours
2. Cover: medical research, health advisories, wellness trends, disease outbreaks, health policies
3. Prioritize credible medical sources and peer-reviewed information
4. Include expert opinions and official health organization statements

Write a {word_count} word article that:
- Has a clear, informative headline about the health topic
- Explains medical or health information in accessible language
- Includes relevant statistics, research findings, or expert quotes
- Provides practical advice or actionable information for readers
- Addresses common concerns or questions about the topic
- Maintains accuracy and avoids sensationalism
- Cites credible sources and medical authorities

Focus on reliable, helpful health information for {target_audience}.""",

    "food": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest food trends, culinary news, and restaurant updates {target_state_context}. Your task is to:

1. Identify trending food stories from the last 24-48 hours
2. Cover: new restaurants, food trends, recipes, celebrity chefs, food festivals, culinary innovations
3. Look for viral food content, new dining concepts, and food culture stories
4. Include both local and international culinary news

Write a {word_count} word article that:
- Has a mouth-watering, appetizing headline
- Describes food and flavors in vivid, sensory language
- Includes specific details about dishes, ingredients, and preparation
- Mentions chefs, restaurants, or food personalities
- Captures current food trends and cultural movements
- Appeals to food lovers and culinary enthusiasts
- Provides useful information like locations, prices, or recipes when relevant

Make readers hungry for more {target_audience}!""",

    "ai": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web comprehensively for the absolute latest AI and technology news from the last 24 hours {target_state_context}. Your task is to:

1. Scan major tech news sites, AI research labs, company announcements, and tech forums
2. Identify the most trending AI stories: new models, breakthroughs, products, controversies, regulations
3. Find similar trending articles across the web to understand the full scope
4. Compile information from multiple authoritative tech sources

Write a {word_count} word article that:
- Has a tech-forward, cutting-edge headline
- Explains complex AI concepts in accessible terms for general readers
- Includes specific technical details like model names, capabilities, performance metrics
- Mentions key companies, researchers, or institutions involved
- Discusses implications and potential impact of the development
- Addresses both opportunities and concerns
- Uses current tech terminology appropriately
- Provides context on how this fits into broader AI trends

Focus on what's genuinely new and significant in AI {target_audience}.""",

    "stock-market": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest stock market news, financial trends, and economic developments {target_state_context}. Your task is to:

1. Find the most recent market movements and financial news from the last 24-48 hours
2. Cover: major indices, significant stock movements, IPOs, economic indicators, policy changes
3. Include data from stock exchanges, financial news sites, and market analysis
4. Focus on news affecting {target_audience} markets and investors

Write a {word_count} word article that:
- Has a finance-focused, informative headline
- Includes specific numbers: index points, percentages, valuations
- Explains market movements and the factors driving them
- Mentions key stocks, sectors, or companies making news
- Provides context on economic indicators or policy impacts
- Uses financial terminology appropriately
- Maintains objectivity and avoids giving direct investment advice
- Appeals to investors and business readers

Focus on actionable market intelligence for {target_audience}.""",

    "top-stories": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the most important and trending news stories {target_state_context} from the last 24 hours. Your task is to:

1. Identify the TOP 3-5 most significant news stories currently making headlines
2. Prioritize stories with the highest impact, reach, and public interest
3. Cover a diverse range of topics: politics, society, accidents, achievements, policies, local issues
4. For {target_state_context}, focus specifically on major developments affecting that region
5. Check multiple news sources to verify importance and trending status

Write a {word_count} word article that:
- Has a compelling headline highlighting the most significant story
- Covers multiple top stories in order of importance
- Provides essential details for each story: who, what, when, where, why
- Explains the impact and significance of each development
- Includes relevant quotes from officials or witnesses when available
- Maintains journalistic standards and objectivity
- Uses clear, urgent language appropriate for breaking news
- Connects stories to broader context when relevant

This is for readers wanting to know the most important news in {target_audience} right now!""",

    "trailers": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest movie trailers, teasers, and promotional content released {target_state_context}. Your task is to:

1. Find the newest trailers released in the last 24-48 hours
2. Cover: official trailers, teasers, motion posters, first looks
3. Include both Bollywood and Hollywood releases when relevant
4. Check YouTube trending, social media buzz, and entertainment sites

Write a {word_count} word article that:
- Has an exciting headline about the trailer release
- Describes key moments and highlights from the trailer
- Mentions the cast, director, and production details
- Includes release dates and platform information
- Captures the tone and genre of the film
- Notes any viral moments or social media reactions
- Builds anticipation for the movie
- Appeals to movie enthusiasts eager for new content

Make readers excited to watch the trailer {target_audience}!""",

    "box-office": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web for the latest box office collections, earnings reports, and movie performance data {target_state_context}. Your task is to:

1. Find the most recent box office numbers from the last 24-48 hours
2. Cover: weekend collections, milestone achievements, comparative performance
3. Include both domestic and international numbers when relevant
4. Compare with previous releases and expectations

Write a {word_count} word article that:
- Has a numbers-focused headline about box office performance
- Includes specific collection figures with currency symbols
- Compares opening weekend, week-wise, or total collections
- Mentions screen count and occupancy rates when available
- Discusses whether the film is a hit, flop, or blockbuster
- Includes producer/distributor quotes or trade analyst opinions
- Provides context on budget and break-even points
- Uses industry terminology appropriately

Focus on the business performance of films {target_audience}!""",

    "movie-news": """**REFERENCE ARTICLE CONTENT:**
{reference_content_section}
{split_content_section}
{image_search_section}

**YOUR TASK:** Generate a NEW, original article based ENTIRELY on the reference article content provided above.

**INSTRUCTIONS:**
1. Read the reference article content carefully
2. Extract key facts: movie names, actor names, director names, dates, events, quotes
3. Write a COMPLETELY NEW article in your own words based on this information
4. DO NOT copy sentences directly - rewrite everything originally

**ARTICLE REQUIREMENTS:**
- Write a {word_count} word article
- Create an engaging, SEO-friendly headline that captures the main news
- Focus on {state_language} cinema ({target_state} region)
- Include all key names, titles, and facts from the reference
- Write for {target_audience}
- Make it newsworthy and exciting

**IMPORTANT:** Your article must be based ONLY on the reference content provided. Do not add information that is not in the reference article.""",

    "movie-news-bollywood": """**REFERENCE CONTENT INSTRUCTIONS:**
{reference_content_section}
{split_content_section}
{image_search_section}

Search the web comprehensively for the latest Hindi Bollywood movie news from the last 24-48 hours. Your task is to:

FOCUS: This is specifically about HINDI BOLLYWOOD cinema - the mainstream Hindi film industry based in Mumbai.

1. Search for "Bollywood latest news", "Hindi film industry updates", "Bollywood breaking news"
2. Find the most trending Bollywood stories including:
   - New Hindi movie announcements and muhurat launches
   - Bollywood star casting news and collaborations
   - Shooting schedules and film progress updates
   - First look reveals and character posters
   - Movie trailer launches and music releases
   - Bollywood celebrity news and personal updates
   - Film controversies, debates, and discussions
   - Box office predictions and trade buzz
   - Bollywood fashion and style statements
   - Award show news and nominations
   - OTT platform deals and digital releases
   - Producer-director-actor combinations
   - Bollywood party circuits and events

3. Check major Bollywood news portals: Bollywood Hungama, Pinkvilla, ETimes Bollywood, etc.
4. Look for trending Bollywood hashtags on social media
5. Focus on A-list stars: Khans, Kapoors, Bachchans, and current generation stars

Write a {word_count} word article that:
- Has a catchy, Bollywood-style headline that captures the glamour
- Clearly identifies this as Bollywood/Hindi cinema news
- Covers 2-3 major Bollywood news stories
- Names specific Bollywood actors, directors, producers
- Mentions production houses like Yash Raj, Dharma, T-Series, etc.
- Includes movie titles and working titles
- Captures the glitz, glamour, and drama of Bollywood
- Uses Bollywood-specific terminology (muhurat, mahurat, item number, etc.)
- Includes specific details like shooting locations (Film City, Switzerland, etc.)
- Mentions relevant box office numbers if discussing releases
- References Bollywood awards (Filmfare, IIFA, etc.) when relevant
- Appeals to Hindi cinema and Bollywood fans across India
- Uses an entertaining, gossip-friendly but factual tone

Make it glamorous and exciting for Bollywood enthusiasts! This should feel distinctly different from regional cinema news - focus on the pan-India appeal and Hindi language film industry."""
}

def get_category_prompt_mappings(db):
    """Get category-prompt mappings with defaults"""
    doc = db['system_settings'].find_one({"type": "category_prompt_mappings"})
    if doc:
        mappings = serialize_doc(doc).get("mappings", {})
    else:
        mappings = {}
    
    # Merge with defaults for any missing categories
    for category, default_prompt in DEFAULT_CATEGORY_PROMPTS.items():
        if category not in mappings:
            mappings[category] = default_prompt
    
    return mappings

def update_category_prompt_mappings(db, mappings: dict):
    """Update category-prompt mappings"""
    from datetime import datetime
    
    db['system_settings'].update_one(
        {"type": "category_prompt_mappings"},
        {"$set": {
            "type": "category_prompt_mappings",
            "mappings": mappings,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    return mappings

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
        return DotDict(result).deleted_count > 0
    except:
        return False

def count_users(db):
    """Count total users"""
    return db['users'].count_documents({})


# ==================== TOPICS CRUD ====================

def get_topics(db, category: str = None, language: str = None, search: str = None, skip: int = 0, limit: int = 100):
    """Get topics with optional filtering"""
    query = {}
    
    if category:
        query["category"] = category
    
    if language:
        query["language"] = language
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    topics = list(db[TOPICS].find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit))
    return topics

def get_topic_by_id(db, topic_id: int):
    """Get topic by ID"""
    topic = db[TOPICS].find_one({"id": topic_id}, {"_id": 0})
    return topic

def get_topic_by_slug(db, slug: str):
    """Get topic by slug"""
    topic = db[TOPICS].find_one({"slug": slug}, {"_id": 0})
    return topic

def create_topic(db, topic_data: dict):
    """Create new topic"""
    # Get next ID
    max_topic = db[TOPICS].find_one(sort=[("id", -1)])
    next_id = (max_topic["id"] + 1) if max_topic else 1
    
    topic_doc = {
        "id": next_id,
        "title": topic_data["title"],
        "slug": topic_data["slug"],
        "description": topic_data.get("description"),
        "category": topic_data["category"],
        "language": topic_data.get("language", "en"),
        "image": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    db[TOPICS].insert_one(topic_doc)
    del topic_doc["_id"]
    return topic_doc

def update_topic(db, topic_id: int, topic_data: dict):
    """Update topic"""
    update_fields = {"updated_at": datetime.utcnow()}
    
    if "title" in topic_data:
        update_fields["title"] = topic_data["title"]
    if "slug" in topic_data:
        update_fields["slug"] = topic_data["slug"]
    if "description" in topic_data:
        update_fields["description"] = topic_data["description"]
    if "category" in topic_data:
        update_fields["category"] = topic_data["category"]
    if "language" in topic_data:
        update_fields["language"] = topic_data["language"]
    if "image" in topic_data:
        update_fields["image"] = topic_data["image"]
    
    db[TOPICS].update_one(
        {"id": topic_id},
        {"$set": update_fields}
    )
    
    return get_topic_by_id(db, topic_id)

def delete_topic(db, topic_id: int):
    """Delete topic and remove all associations"""
    # Remove article associations
    db[ARTICLE_TOPICS].delete_many({"topic_id": topic_id})
    
    # Remove gallery associations
    db[GALLERY_TOPICS].delete_many({"topic_id": topic_id})
    
    # Delete topic
    result = db[TOPICS].delete_one({"id": topic_id})
    return result.deleted_count > 0

def count_topic_articles(db, topic_id: int):
    """Count articles associated with a topic"""
    return db[ARTICLE_TOPICS].count_documents({"topic_id": topic_id})

def get_articles_by_topic(db, topic_id: int, skip: int = 0, limit: int = 50):
    """Get articles associated with a topic"""
    # Get article IDs from association table
    associations = list(db[ARTICLE_TOPICS].find({"topic_id": topic_id}, {"_id": 0, "article_id": 1}))
    article_ids = [assoc["article_id"] for assoc in associations]
    
    if not article_ids:
        return []
    
    # Get articles
    articles = list(db[ARTICLES].find(
        {"id": {"$in": article_ids}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit))
    
    return articles

def associate_article_with_topic(db, article_id: int, topic_id: int):
    """Associate an article with a topic"""
    # Check if association already exists
    existing = db[ARTICLE_TOPICS].find_one({
        "article_id": article_id,
        "topic_id": topic_id
    })
    
    if existing:
        return False
    
    db[ARTICLE_TOPICS].insert_one({
        "article_id": article_id,
        "topic_id": topic_id,
        "created_at": datetime.utcnow()
    })
    
    return True

def remove_article_from_topic(db, article_id: int, topic_id: int):
    """Remove association between article and topic"""
    result = db[ARTICLE_TOPICS].delete_one({
        "article_id": article_id,
        "topic_id": topic_id
    })
    
    return result.deleted_count > 0

def get_topics_by_article(db, article_id: int):
    """Get topics associated with an article"""
    # Get topic IDs from association table
    associations = list(db[ARTICLE_TOPICS].find({"article_id": article_id}, {"_id": 0, "topic_id": 1}))
    topic_ids = [assoc["topic_id"] for assoc in associations]
    
    if not topic_ids:
        return []
    
    # Get topics
    topics = list(db[TOPICS].find(
        {"id": {"$in": topic_ids}},
        {"_id": 0}
    ).sort("title", 1))
    
    return topics

# Topic Categories
def get_topic_categories(db):
    """Get all topic categories"""
    categories = list(db[TOPIC_CATEGORIES].find({}, {"_id": 0}).sort("name", 1))
    return categories

def create_topic_category(db, name: str, slug: str):
    """Create new topic category"""
    # Get next ID
    max_cat = db[TOPIC_CATEGORIES].find_one(sort=[("id", -1)])
    next_id = (max_cat["id"] + 1) if max_cat else 1
    
    category_doc = {
        "id": next_id,
        "name": name,
        "slug": slug,
        "created_at": datetime.utcnow()
    }
    
    db[TOPIC_CATEGORIES].insert_one(category_doc)
    del category_doc["_id"]
    return category_doc

# Gallery-Topic Associations
def associate_topic_with_gallery(db, topic_id: int, gallery_id: int):
    """Associate a topic with a gallery"""
    # Check if association already exists
    existing = db[GALLERY_TOPICS].find_one({
        "gallery_id": gallery_id,
        "topic_id": topic_id
    })
    
    if existing:
        return False
    
    db[GALLERY_TOPICS].insert_one({
        "gallery_id": gallery_id,
        "topic_id": topic_id,
        "created_at": datetime.utcnow()
    })
    
    return True

def remove_topic_from_gallery(db, topic_id: int, gallery_id: int):
    """Remove association between topic and gallery"""
    result = db[GALLERY_TOPICS].delete_one({
        "gallery_id": gallery_id,
        "topic_id": topic_id
    })
    
    return result.deleted_count > 0

def get_galleries_by_topic(db, topic_id: int):
    """Get galleries associated with a topic"""
    # Get gallery IDs from association table
    associations = list(db[GALLERY_TOPICS].find({"topic_id": topic_id}, {"_id": 0, "gallery_id": 1}))
    gallery_ids = [assoc["gallery_id"] for assoc in associations]
    
    if not gallery_ids:
        return []
    
    # Get galleries
    galleries = list(db[GALLERIES].find(
        {"id": {"$in": gallery_ids}},
        {"_id": 0}
    ).sort("created_at", -1))
    
    return galleries

def get_topics_by_gallery(db, gallery_id: int):
    """Get topics associated with a gallery"""
    # Get topic IDs from association table
    associations = list(db[GALLERY_TOPICS].find({"gallery_id": gallery_id}, {"_id": 0, "topic_id": 1}))
    topic_ids = [assoc["topic_id"] for assoc in associations]
    
    if not topic_ids:
        return []
    
    # Get topics
    topics = list(db[TOPICS].find(
        {"id": {"$in": topic_ids}},
        {"_id": 0}
    ).sort("title", 1))
    
    return topics

# ==================== OTT PLATFORMS CRUD ====================

def get_ott_platforms(db):
    """Get all OTT platforms"""
    platforms = list(db[OTT_PLATFORMS].find({}, {"_id": 0}).sort("name", 1))
    return platforms

def create_ott_platform(db, platform_data: dict):
    """Create new OTT platform"""
    # Get next ID
    max_platform = db[OTT_PLATFORMS].find_one(sort=[("id", -1)])
    next_id = (max_platform["id"] + 1) if max_platform else 1
    
    platform_doc = {
        "id": next_id,
        "name": platform_data["name"],
        "is_active": platform_data.get("is_active", True),
        "created_at": datetime.utcnow()
    }
    
    db[OTT_PLATFORMS].insert_one(platform_doc)
    del platform_doc["_id"]
    return platform_doc

def update_ott_platform(db, platform_id: int, platform_data: dict):
    """Update OTT platform"""
    update_fields = {}
    
    if "name" in platform_data:
        update_fields["name"] = platform_data["name"]
    if "is_active" in platform_data:
        update_fields["is_active"] = platform_data["is_active"]
    
    db[OTT_PLATFORMS].update_one(
        {"id": platform_id},
        {"$set": update_fields}
    )
    
    platform = db[OTT_PLATFORMS].find_one({"id": platform_id}, {"_id": 0})
    return platform

def delete_ott_platform(db, platform_id: int):
    """Delete OTT platform"""
    result = db[OTT_PLATFORMS].delete_one({"id": platform_id})
    return result.deleted_count > 0

# ==================== GALLERY ENTITIES CRUD ====================

def get_gallery_entities(db, entity_type: str):
    """Get all entities for a specific gallery type"""
    collection_map = {
        "actor": GALLERY_ACTORS,
        "actress": GALLERY_ACTRESSES,
        "events": GALLERY_EVENTS,
        "politics": GALLERY_POLITICS,
        "travel": GALLERY_TRAVEL,
        "others": GALLERY_OTHERS
    }
    
    collection = collection_map.get(entity_type.lower())
    if not collection:
        return []
    
    entities = list(db[collection].find({}, {"_id": 0}).sort("name", 1))
    return entities

def create_gallery_entity(db, entity_type: str, entity_data: dict):
    """Create new gallery entity"""
    collection_map = {
        "actor": GALLERY_ACTORS,
        "actress": GALLERY_ACTRESSES,
        "events": GALLERY_EVENTS,
        "politics": GALLERY_POLITICS,
        "travel": GALLERY_TRAVEL,
        "others": GALLERY_OTHERS
    }
    
    collection = collection_map.get(entity_type.lower())
    if not collection:
        raise ValueError(f"Invalid entity type: {entity_type}")
    
    # Get next ID
    max_entity = db[collection].find_one(sort=[("id", -1)])
    next_id = (max_entity["id"] + 1) if max_entity else 1
    
    # Create folder name (lowercase, replace spaces with underscores)
    folder_name = entity_data["name"].lower().replace(" ", "_").replace("-", "_")
    
    entity_doc = {
        "id": next_id,
        "name": entity_data["name"],
        "folder_name": folder_name,
        "is_active": entity_data.get("is_active", True),
        "created_at": datetime.utcnow()
    }
    
    db[collection].insert_one(entity_doc)
    del entity_doc["_id"]
    return entity_doc

def get_gallery_entity_by_id(db, entity_id: int):
    """Get gallery entity by ID from all collections"""
    collection_map = {
        "actor": GALLERY_ACTORS,
        "actress": GALLERY_ACTRESSES,
        "events": GALLERY_EVENTS,
        "politics": GALLERY_POLITICS,
        "travel": GALLERY_TRAVEL,
        "others": GALLERY_OTHERS
    }
    
    for collection_name in collection_map.values():
        entity = db[collection_name].find_one({"id": entity_id}, {"_id": 0})
        if entity:
            return entity
    return None

def get_gallery_entity_by_name(db, entity_type: str, name: str):
    """Get gallery entity by exact name match"""
    collection_map = {
        "actor": GALLERY_ACTORS,
        "actress": GALLERY_ACTRESSES,
        "events": GALLERY_EVENTS,
        "politics": GALLERY_POLITICS,
        "travel": GALLERY_TRAVEL,
        "others": GALLERY_OTHERS
    }
    
    collection = collection_map.get(entity_type.lower())
    if not collection:
        return None
    
    # Exact case-insensitive match
    entity = db[collection].find_one(
        {"name": {"$regex": f"^{name}$", "$options": "i"}},
        {"_id": 0}
    )
    return entity


def update_gallery_entity(db, entity_id: int, entity_data: dict):
    """Update gallery entity"""
    collection_map = {
        "actor": GALLERY_ACTORS,
        "actress": GALLERY_ACTRESSES,
        "events": GALLERY_EVENTS,
        "politics": GALLERY_POLITICS,
        "travel": GALLERY_TRAVEL,
        "others": GALLERY_OTHERS
    }
    
    # Find which collection the entity is in
    for collection_name in collection_map.values():
        entity = db[collection_name].find_one({"id": entity_id}, {"_id": 0})
        if entity:
            # Update folder name if name changed
            if "name" in entity_data:
                folder_name = entity_data["name"].lower().replace(" ", "_").replace("-", "_")
                entity_data["folder_name"] = folder_name
            
            # Update the entity
            db[collection_name].update_one(
                {"id": entity_id},
                {"$set": entity_data}
            )
            
            # Return updated entity
            updated = db[collection_name].find_one({"id": entity_id}, {"_id": 0})
            return updated
    
    return None

def delete_gallery_entity(db, entity_id: int):
    """Delete gallery entity"""
    collection_map = {
        "actor": GALLERY_ACTORS,
        "actress": GALLERY_ACTRESSES,
        "events": GALLERY_EVENTS,
        "politics": GALLERY_POLITICS,
        "travel": GALLERY_TRAVEL,
        "others": GALLERY_OTHERS
    }
    
    # Find and delete from the correct collection
    for collection_name in collection_map.values():
        result = db[collection_name].delete_one({"id": entity_id})
        if result.deleted_count > 0:
            return True
    
    return False

def get_next_gallery_number(db, category_type: str, entity_name: str):
    """Get the next gallery number for an entity"""
    # Find all galleries for this entity
    galleries = list(db[GALLERIES].find({
        "category_type": category_type,
        "entity_name": entity_name
    }, {"gallery_id": 1, "_id": 0}))
    
    if not galleries:
        return 1
    
    # Extract numbers from gallery_id and find max
    numbers = []
    for g in galleries:
        gallery_id = g.get("gallery_id", "")
        # Try to extract the last number from gallery_id
        parts = gallery_id.split("_")
        if parts:
            try:
                numbers.append(int(parts[-1]))
            except ValueError:
                pass
    
    return max(numbers) + 1 if numbers else 1

# ==================== GALLERIES CRUD ====================

def get_galleries(db, skip: int = 0, limit: int = 100):
    """Get paginated galleries"""
    galleries = list(db[GALLERIES].find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit))
    
    # Parse JSON fields
    for gallery in galleries:
        if "artists" in gallery and isinstance(gallery["artists"], str):
            gallery["artists"] = json.loads(gallery["artists"]) if gallery["artists"] else []
        if "images" in gallery and isinstance(gallery["images"], str):
            gallery["images"] = json.loads(gallery["images"]) if gallery["images"] else []
    
    return galleries

def get_tadka_pics_galleries(db, limit: int = 20):
    """Get latest Tadka Pics enabled galleries"""
    galleries = list(db[GALLERIES].find(
        {
            "gallery_type": "vertical",
            "tadka_pics_enabled": True
        }, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit))
    
    # Parse JSON fields
    for gallery in galleries:
        if "artists" in gallery and isinstance(gallery["artists"], str):
            gallery["artists"] = json.loads(gallery["artists"]) if gallery["artists"] else []
        if "images" in gallery and isinstance(gallery["images"], str):
            gallery["images"] = json.loads(gallery["images"]) if gallery["images"] else []
    
    return galleries

def get_gallery_by_gallery_id(db, gallery_id: str):
    """Get gallery by gallery_id"""
    gallery = db[GALLERIES].find_one({"gallery_id": gallery_id}, {"_id": 0})
    
    if gallery:
        # Parse JSON fields
        if "artists" in gallery and isinstance(gallery["artists"], str):
            gallery["artists"] = json.loads(gallery["artists"]) if gallery["artists"] else []
        if "images" in gallery and isinstance(gallery["images"], str):
            gallery["images"] = json.loads(gallery["images"]) if gallery["images"] else []
    
    return gallery

def get_gallery_by_id(db, id: int):
    """Get gallery by numeric ID"""
    gallery = db[GALLERIES].find_one({"id": id}, {"_id": 0})
    
    if gallery:
        # Parse JSON fields
        if "artists" in gallery and isinstance(gallery["artists"], str):
            gallery["artists"] = json.loads(gallery["artists"]) if gallery["artists"] else []
        if "images" in gallery and isinstance(gallery["images"], str):
            gallery["images"] = json.loads(gallery["images"]) if gallery["images"] else []
    
    return gallery

def create_gallery(db, gallery_data: dict):
    """Create new gallery"""
    # Get next ID
    max_gallery = db[GALLERIES].find_one(sort=[("id", -1)])
    next_id = (max_gallery["id"] + 1) if max_gallery else 1
    
    gallery_doc = {
        "id": next_id,
        "gallery_id": gallery_data["gallery_id"],
        "title": gallery_data["title"],
        "artists": json.dumps(gallery_data["artists"]) if isinstance(gallery_data["artists"], list) else gallery_data["artists"],
        "images": json.dumps(gallery_data["images"]) if isinstance(gallery_data["images"], list) else gallery_data["images"],
        "gallery_type": gallery_data.get("gallery_type", "vertical"),  # horizontal or vertical
        "category_type": gallery_data.get("category_type"),  # Actor, Actress, Events, etc.
        "entity_name": gallery_data.get("entity_name"),  # Selected actor/actress/event name
        "entity_id": gallery_data.get("entity_id"),  # ID of the selected entity
        "folder_path": gallery_data.get("folder_path"),  # Full folder path for images
        "tadka_pics_enabled": gallery_data.get("tadka_pics_enabled", False),  # For Tadka Pics section
        "is_published": gallery_data.get("is_published", True),
        "is_scheduled": gallery_data.get("is_scheduled", False),
        "scheduled_publish_at": gallery_data.get("scheduled_publish_at"),
        "scheduled_timezone": gallery_data.get("scheduled_timezone", "IST"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    db[GALLERIES].insert_one(gallery_doc)
    del gallery_doc["_id"]
    
    # Parse JSON for return
    gallery_doc["artists"] = json.loads(gallery_doc["artists"]) if gallery_doc["artists"] else []
    gallery_doc["images"] = json.loads(gallery_doc["images"]) if gallery_doc["images"] else []
    
    return gallery_doc

def update_gallery(db, gallery_id: str, gallery_data: dict, s3_service=None):
    """Update gallery and delete removed images from S3"""
    update_fields = {"updated_at": datetime.utcnow()}
    
    # If images are being updated, check for removed images and delete from S3
    if "images" in gallery_data and s3_service and s3_service.is_enabled():
        # Get current gallery to compare images
        current_gallery = db[GALLERIES].find_one({"gallery_id": gallery_id}, {"_id": 0})
        
        if current_gallery:
            # Get current image URLs - parse JSON if stored as string
            current_images_raw = current_gallery.get("images", [])
            if isinstance(current_images_raw, str):
                try:
                    current_images = json.loads(current_images_raw)
                except:
                    current_images = []
            else:
                current_images = current_images_raw
            
            current_urls = set()
            for img in current_images:
                if isinstance(img, dict):
                    url = img.get("url")
                    if url:
                        current_urls.add(url)
                elif isinstance(img, str):
                    current_urls.add(img)
            
            # Get new image URLs - these come from the API as a list
            new_images = gallery_data["images"]
            new_urls = set()
            for img in new_images:
                if isinstance(img, dict):
                    url = img.get("url")
                    if url:
                        new_urls.add(url)
                elif isinstance(img, str):
                    new_urls.add(img)
            
            # Find removed images
            removed_urls = current_urls - new_urls
            
            # Delete removed images from S3
            for url in removed_urls:
                try:
                    s3_service.delete_file(url)
                    print(f"Deleted removed image from S3: {url}")
                except Exception as e:
                    print(f"Failed to delete removed image from S3: {url}, Error: {e}")
    
    if "title" in gallery_data:
        update_fields["title"] = gallery_data["title"]
    if "artists" in gallery_data:
        update_fields["artists"] = json.dumps(gallery_data["artists"]) if isinstance(gallery_data["artists"], list) else gallery_data["artists"]
    if "images" in gallery_data:
        update_fields["images"] = json.dumps(gallery_data["images"]) if isinstance(gallery_data["images"], list) else gallery_data["images"]
    if "gallery_type" in gallery_data:
        update_fields["gallery_type"] = gallery_data["gallery_type"]
    if "category_type" in gallery_data:
        update_fields["category_type"] = gallery_data["category_type"]
    if "entity_name" in gallery_data:
        update_fields["entity_name"] = gallery_data["entity_name"]
    if "entity_id" in gallery_data:
        update_fields["entity_id"] = gallery_data["entity_id"]
    if "folder_path" in gallery_data:
        update_fields["folder_path"] = gallery_data["folder_path"]
    if "tadka_pics_enabled" in gallery_data:
        update_fields["tadka_pics_enabled"] = gallery_data["tadka_pics_enabled"]
    if "is_published" in gallery_data:
        update_fields["is_published"] = gallery_data["is_published"]
    if "is_scheduled" in gallery_data:
        update_fields["is_scheduled"] = gallery_data["is_scheduled"]
    if "scheduled_publish_at" in gallery_data:
        update_fields["scheduled_publish_at"] = gallery_data["scheduled_publish_at"]
    if "scheduled_timezone" in gallery_data:
        update_fields["scheduled_timezone"] = gallery_data["scheduled_timezone"]
    
    db[GALLERIES].update_one(
        {"gallery_id": gallery_id},
        {"$set": update_fields}
    )
    
    return get_gallery_by_gallery_id(db, gallery_id)

def delete_gallery(db, gallery_id: str, s3_service=None):
    """Delete gallery, remove all associations, and delete images from S3"""
    # Get full gallery document to access images
    gallery = db[GALLERIES].find_one({"gallery_id": gallery_id}, {"_id": 0})
    
    if gallery:
        # Delete images from S3 if service is available
        if s3_service and s3_service.is_enabled():
            images_raw = gallery.get("images", [])
            # Parse JSON if stored as string
            if isinstance(images_raw, str):
                try:
                    images = json.loads(images_raw)
                except:
                    images = []
            else:
                images = images_raw
                
            for image in images:
                # Handle both dict and string formats
                if isinstance(image, dict):
                    image_url = image.get("url")
                elif isinstance(image, str):
                    image_url = image
                else:
                    image_url = None
                    
                if image_url:
                    try:
                        s3_service.delete_file(image_url)
                        print(f"Deleted image from S3: {image_url}")
                    except Exception as e:
                        print(f"Failed to delete image from S3: {image_url}, Error: {e}")
        
        # Remove topic associations
        db[GALLERY_TOPICS].delete_many({"gallery_id": gallery.get("id")})
    
    # Delete gallery from database
    result = db[GALLERIES].delete_one({"gallery_id": gallery_id})
    return result.deleted_count > 0


# ===========================
# TOP STORIES MANAGEMENT
# ===========================

def manage_top_stories(db, article_id: str, content_type: str, states_json: str, published_at: datetime, is_top_story: bool):
    """
    Manage top stories collection - maintain 3 posts + 1 movie review per state/national
    
    Args:
        article_id: The article ID
        content_type: 'post' or 'movie_review'
        states_json: JSON string of states (empty array = ALL/National)
        published_at: Publication datetime
        is_top_story: Whether this article should be a top story
    """
    # Parse states
    try:
        states = json.loads(states_json) if states_json else []
    except:
        states = []
    
    # Normalize 'all' to 'ALL' and determine if national or state-specific
    if states and any(s.lower() == 'all' for s in states):
        target_states = ['ALL']
    elif not states or len(states) == 0:
        target_states = ['ALL']
    else:
        target_states = states
    
    for state in target_states:
        if is_top_story:
            # Add/update top story
            if content_type == 'movie_review':
                # Only one movie review per state - replace existing
                db['top_stories'].delete_many({
                    'state': state,
                    'content_type': 'movie_review'
                })
                
                db['top_stories'].insert_one({
                    'article_id': article_id,
                    'state': state,
                    'content_type': 'movie_review',
                    'published_at': published_at,
                    'created_at': datetime.utcnow()
                })
            else:
                # Regular post - maintain 3 maximum
                # Count existing posts for this state
                existing_count = db['top_stories'].count_documents({
                    'state': state,
                    'content_type': 'post'
                })
                
                if existing_count >= 3:
                    # Remove oldest post
                    oldest = db['top_stories'].find_one(
                        {'state': state, 'content_type': 'post'},
                        sort=[('published_at', 1)]
                    )
                    if oldest:
                        db['top_stories'].delete_one({'_id': oldest['_id']})
                        # Update the removed article's is_top_story flag
                        db[ARTICLES].update_one(
                            {'id': oldest['article_id']},
                            {'$set': {'is_top_story': False}}
                        )
                
                # Add new top story
                db['top_stories'].insert_one({
                    'article_id': article_id,
                    'state': state,
                    'content_type': 'post',
                    'published_at': published_at,
                    'created_at': datetime.utcnow()
                })
        else:
            # Remove from top stories if unchecked
            db['top_stories'].delete_many({
                'article_id': article_id,
                'state': state
            })

def get_top_stories_for_states(db, states: List[str], limit: int = 4):
    """
    Get top stories based on is_top_story checkbox
    
    Args:
        states: List of state codes (e.g., ['ts', 'ap'] or ['ALL'] for national)
        limit: Maximum number of articles to return (default 4)
    
    Returns:
        List of article objects where is_top_story is True
    """
    # Build query based on states
    if 'ALL' in states:
        # National top stories - get articles where:
        # 1. states is empty array: '[]'
        # 2. states contains 'all' (case insensitive): '["all"]', '["ALL"]', etc.
        query = {
            'is_top_story': True,
            'is_published': True,
            '$or': [
                {'states': '[]'},  # Empty states array means national
                {'states': ''},    # Empty string also means national
                {'states': {'$regex': r'\[\s*"all"\s*\]', '$options': 'i'}},  # ["all"] or ["ALL"]
                {'states': {'$regex': r'"all"', '$options': 'i'}}  # Contains "all" anywhere in the array
            ]
        }
    else:
        # State-specific top stories
        # Match articles where states JSON array contains any of the requested states
        # e.g., '["ts","ap"]' should match if we request 'ts' or 'ap'
        state_patterns = [f'"{state.lower()}"' for state in states]
        query = {
            'is_top_story': True,
            'is_published': True,
            'states': {'$regex': '|'.join(state_patterns), '$options': 'i'}
        }
    
    # Fetch articles
    articles = list(db[ARTICLES].find(
        query,
        {'_id': 0}
    ).sort('published_at', -1).limit(limit))
    
    return articles


# ==================== Grouped Posts Operations ====================

def create_or_update_grouped_post(db, group_title: str, category: str, post_id: int):
    """Create or update a grouped post entry
    
    Args:
        group_title: Movie/Event name (e.g., "Champion", "Shambhala")
        category: Article category (e.g., "events-interviews")
        post_id: Article ID to add to the group
    
    Returns:
        Created/updated grouped post document
    """
    from datetime import datetime, timezone
    
    # Check if group already exists
    existing = db[GROUPED_POSTS].find_one({
        "group_title": group_title,
        "category": category
    })
    
    if existing:
        # Update existing group
        post_ids = existing.get('post_ids', [])
        if post_id not in post_ids:
            post_ids.append(post_id)
        
        # Update representative to latest post
        db[GROUPED_POSTS].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "post_ids": post_ids,
                    "representative_post_id": post_id,  # Always use latest post
                    "posts_count": len(post_ids),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        return db[GROUPED_POSTS].find_one({"_id": existing["_id"]})
    else:
        # Create new group
        group_data = {
            "group_title": group_title,
            "category": category,
            "post_ids": [post_id],
            "representative_post_id": post_id,
            "posts_count": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        result = db[GROUPED_POSTS].insert_one(group_data)
        group_data['_id'] = result.inserted_id
        return group_data

def get_all_grouped_posts(db, skip: int = 0, limit: int = 100):
    """Get all grouped posts with representative article data"""
    groups = list(
        db[GROUPED_POSTS].find()
        .sort("updated_at", -1)
        .skip(skip)
        .limit(limit)
    )
    
    # Enrich with representative post data
    for group in groups:
        rep_id = group.get('representative_post_id')
        if rep_id:
            rep_article = db[ARTICLES].find_one({"id": rep_id})
            group['representative_post'] = serialize_doc(rep_article)
    
    return serialize_doc(groups)

def get_grouped_post_by_id(db, group_id: str):
    """Get a specific grouped post with all articles"""
    from bson import ObjectId
    
    # Try to find by id field first (UUID), then by _id (ObjectId)
    group = db[GROUPED_POSTS].find_one({"id": group_id})
    
    if not group:
        # Try with ObjectId format
        try:
            group = db[GROUPED_POSTS].find_one({"_id": ObjectId(group_id)})
        except:
            pass
    
    if not group:
        return None
    
    # Get all articles in this group
    post_ids = group.get('post_ids', [])
    articles = list(db[ARTICLES].find({"id": {"$in": post_ids}}).sort("published_at", -1))
    group['articles'] = serialize_doc(articles)
    
    return serialize_doc(group)

def delete_grouped_post(db, group_id: str):
    """Delete a grouped post and all associated articles"""
    from bson import ObjectId
    
    # First, get the grouped post to find associated article IDs
    # Try by id field first (UUID), then by _id (ObjectId)
    group = db[GROUPED_POSTS].find_one({"id": group_id})
    
    if not group:
        try:
            group = db[GROUPED_POSTS].find_one({"_id": ObjectId(group_id)})
        except:
            pass
    
    if not group:
        print(f"❌ Group {group_id} not found")
        return False
    
    # Get the post IDs associated with this group
    post_ids = group.get('post_ids', [])
    print(f"🗑️ Group has {len(post_ids)} post IDs to delete: {post_ids}")
    print(f"🔍 Post IDs type: {[type(pid) for pid in post_ids[:3]]}")  # Check first 3 types
    
    # Ensure post_ids are integers (they should be, but let's be explicit)
    post_ids_int = []
    for pid in post_ids:
        try:
            post_ids_int.append(int(pid))
        except (ValueError, TypeError) as e:
            print(f"⚠️ Could not convert post_id {pid} to int: {e}")
    
    print(f"🔍 Converted to int IDs: {post_ids_int}")
    
    # Delete all associated articles
    if post_ids_int:
        # Check if articles exist before deleting
        existing_articles = list(db[ARTICLES].find({"id": {"$in": post_ids_int}}, {"id": 1, "title": 1}))
        print(f"🔍 Found {len(existing_articles)} articles in database matching these IDs")
        for article in existing_articles:
            print(f"   - ID {article.get('id')}: {article.get('title', 'No title')[:50]}")
        
        # Perform delete
        delete_result = db[ARTICLES].delete_many({"id": {"$in": post_ids_int}})
        print(f"✅ Deleted {delete_result.deleted_count} articles from database")
        
        if delete_result.deleted_count < len(existing_articles):
            print(f"⚠️ Warning: Expected to delete {len(existing_articles)} but only deleted {delete_result.deleted_count}")
        
        if delete_result.deleted_count == 0 and len(post_ids_int) > 0:
            print(f"❌ ERROR: No articles were deleted even though we have {len(post_ids_int)} post IDs!")
            print(f"   This usually means a type mismatch or the articles don't exist")
    else:
        print(f"⚠️ No post_ids found in group or all conversions failed")
    
    # Delete the grouped post itself
    if 'id' in group:
        # UUID-based group
        result = db[GROUPED_POSTS].delete_one({"id": group_id})
    else:
        # ObjectId-based group
        try:
            result = db[GROUPED_POSTS].delete_one({"_id": ObjectId(group_id)})
        except:
            print(f"❌ Failed to delete group with ObjectId: {group_id}")
            return False
    
    print(f"{'✅' if result.deleted_count > 0 else '❌'} Grouped post deletion: {result.deleted_count} group deleted")
    
    return result.deleted_count > 0

def update_grouped_post_title(db, group_id: str, group_title: str):
    """Update a grouped post's title"""
    from bson import ObjectId
    from datetime import datetime, timezone
    
    # Try by id field first (UUID), then by _id (ObjectId)
    group = db[GROUPED_POSTS].find_one({"id": group_id})
    
    if group:
        # UUID-based group
        result = db[GROUPED_POSTS].update_one(
            {"id": group_id},
            {
                "$set": {
                    "group_title": group_title,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    else:
        # Try ObjectId-based group
        try:
            result = db[GROUPED_POSTS].update_one(
                {"_id": ObjectId(group_id)},
                {
                    "$set": {
                        "group_title": group_title,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
        except:
            return False
    
    return result.modified_count > 0

def find_matching_grouped_post(db, movie_name: str, category: str, lookback_days: int = 2, new_post_title: str = None):
    """Find a matching grouped post using liberal fuzzy matching and common word detection
    
    Args:
        movie_name: Extracted movie/event name
        category: Article category
        lookback_days: Days to look back for matches
        new_post_title: Full title of the new post being created (for word matching)
    
    Returns:
        Matching grouped post or None
    """
    from datetime import datetime, timedelta, timezone
    import re
    
    def normalize_name(name):
        """Normalize for comparison"""
        normalized = ' '.join(name.lower().strip().split())
        # Remove special characters
        normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
        # Handle spelling variations
        normalized = re.sub(r'shyambhala', 'shambhala', normalized)
        normalized = re.sub(r'shyambala', 'shambhala', normalized)
        normalized = re.sub(r'vrushabha', 'vrushabha', normalized)
        normalized = re.sub(r'vrusshabha', 'vrushabha', normalized)
        normalized = re.sub(r'rowdyjanardhana', 'rowdyjanardhan', normalized)
        normalized = re.sub(r'rowdy\s*janardhana', 'rowdyjanardhan', normalized)
        # Remove common suffixes
        normalized = re.sub(r'\s+movie$', '', normalized)
        normalized = re.sub(r'\s+film$', '', normalized)
        return normalized.strip()
    
    def calculate_similarity(str1, str2):
        """Calculate similarity ratio"""
        s1 = normalize_name(str1)
        s2 = normalize_name(str2)
        
        if s1 == s2:
            return 1.0
        
        # Substring match
        if s1 in s2 or s2 in s1:
            shorter = min(len(s1), len(s2))
            longer = max(len(s1), len(s2))
            if shorter >= 4:
                return shorter / longer
        
        # Character-level similarity
        set1 = set(s1)
        set2 = set(s2)
        if not set1 or not set2:
            return 0.0
        
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        return intersection / union if union > 0 else 0.0
    
    def extract_significant_words(title):
        """Extract significant words from title (excluding common words)"""
        if not title:
            return set()
        
        # Normalize and lowercase
        title_lower = title.lower()
        # Remove special characters and emojis
        title_clean = re.sub(r'[^\w\s]', ' ', title_lower)
        words = title_clean.split()
        
        # Common words to ignore (stopwords + common video terms)
        stopwords = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
            'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
            'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
            'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
            'very', 'says', 'said', 'about', 'their', 'his', 'her', 'its', 'our', 'your',
            # Video-specific terms
            'video', 'full', 'official', 'movie', 'film', 'trailer', 'teaser', 'song', 'interview',
            'event', 'press', 'meet', 'release', 'pre', 'audio', 'launch', 'success', 'team',
            'exclusive', 'first', 'look', 'glimpse', 'motion', 'poster', 'promo', 'promotion',
            'speech', 'talk', 'shares', 'share', 'experience', 'fun', 'emotional', 'super', 'cute'
        }
        
        # Keep only significant words (3+ chars, not stopwords, not numbers)
        significant_words = {
            word for word in words 
            if len(word) >= 3 and word not in stopwords and not word.isdigit()
        }
        
        return significant_words
    
    def check_common_words_in_group(group, new_title):
        """Check if new title has common significant words with posts in the group"""
        if not new_title:
            return 0
        
        new_words = extract_significant_words(new_title)
        if not new_words:
            return 0
        
        print(f"   🔍 New title words: {new_words}")
        
        # Get all post titles in this group
        post_ids = group.get('post_ids', [])
        if not post_ids:
            return 0
        
        # Fetch articles in this group
        articles = list(db[ARTICLES].find({"id": {"$in": post_ids}}, {"title": 1}))
        
        max_common_ratio = 0
        for article in articles:
            article_title = article.get('title', '')
            article_words = extract_significant_words(article_title)
            
            if not article_words:
                continue
            
            # Calculate common word ratio
            common_words = new_words.intersection(article_words)
            if common_words:
                # Ratio based on the smaller set
                smaller_set_size = min(len(new_words), len(article_words))
                common_ratio = len(common_words) / smaller_set_size if smaller_set_size > 0 else 0
                max_common_ratio = max(max_common_ratio, common_ratio)
                
                # Log for debugging
                print(f"   🔗 Compared with: {article_title[:60]}")
                print(f"      Article words: {article_words}")
                print(f"      Common words: {common_words} (ratio: {common_ratio:.2f})")
                
                # If we find a strong match, log it prominently
                if common_ratio >= 0.3:
                    print(f"   ✨ Strong match found! Common words: {list(common_words)}")
        
        return max_common_ratio
    
    # Get groups from the lookback period
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    
    groups = list(db[GROUPED_POSTS].find({
        "category": category,
        "updated_at": {"$gte": cutoff_time}
    }))
    
    # Find best matching group
    best_match = None
    best_similarity = 0.0
    best_word_match_ratio = 0.0
    
    print(f"🔍 Checking {len(groups)} groups within {lookback_days} days for matches...")
    
    for group in groups:
        group_title = group.get('group_title', '')
        
        # Check title similarity
        similarity = calculate_similarity(movie_name, group_title)
        
        # Check common words if new_post_title is provided
        word_match_ratio = 0
        if new_post_title:
            print(f"\n   Checking group: '{group_title}'")
            word_match_ratio = check_common_words_in_group(group, new_post_title)
            print(f"   Title similarity: {similarity:.2f}, Word match: {word_match_ratio:.2f}")
        
        # Use whichever score is higher
        combined_score = max(similarity, word_match_ratio)
        
        if combined_score > best_similarity:
            best_similarity = combined_score
            best_word_match_ratio = word_match_ratio
            best_match = group
    
    # Return if similarity is above threshold (65%) OR word match ratio is decent (30%+)
    # Lowered from 40% to 30% for better matching
    if best_match and (best_similarity >= 0.65 or best_word_match_ratio >= 0.30):
        if best_word_match_ratio >= 0.30:
            print(f"   ✅ Matched by common words (ratio: {best_word_match_ratio:.2f}) to group: '{best_match.get('group_title')}'")
        else:
            print(f"   ✅ Matched by title similarity (ratio: {best_similarity:.2f}) to group: '{best_match.get('group_title')}'")
        return serialize_doc(best_match)
    
    print(f"   ❌ No match found. Best scores - Title: {best_similarity:.2f}, Words: {best_word_match_ratio:.2f}")
    return None


