"""
MongoDB CRUD Operations for Tadka CMS
Replaces SQLAlchemy ORM queries with MongoDB queries
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
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
            # Map article_language to language for API response
            if key == 'article_language':
                result['language'] = value or 'en'
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
    """Get articles by category slug, excluding top stories"""
    docs = list(
        db[ARTICLES]
        .find({
            "category": category_slug,
            "is_published": True,
            "is_top_story": {"$ne": True}  # Exclude articles marked as top stories
        })
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return serialize_doc(docs)

def get_articles_by_states(db, category_slug: str, state_codes: List[str], skip: int = 0, limit: int = 100):
    """Get articles filtered by category and state codes, excluding top stories"""
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
    query = {"article_language": language}
    
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
    query = {"article_language": language}
    
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
        "article_language": article.get("article_language", "en"),
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
        "is_top_story": article.get("is_top_story", False),
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
        "movie_language": article.get("movie_language"),
        "platform": article.get("platform"),
        "ott_platform": article.get("ott_platform"),
        # Social media embed fields
        "social_media_type": article.get("social_media_type"),
        "social_media_embed": _clean_twitter_embed(article.get("social_media_embed")),
        "view_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "published_at": article.get("published_at") or datetime.utcnow()
    }
    
    result = db[ARTICLES].insert_one(article_doc)
    article_doc["_id"] = result.inserted_id
    
    # Manage top stories if is_top_story is True
    if article.get("is_top_story", False):
        manage_top_stories(
            db,
            str(new_id),
            article.get("content_type", "post"),
            article.get("states", "[]"),
            article_doc.get("published_at", datetime.utcnow()),
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
        "title", "short_title", "content", "content_secondary", "summary", "author", 
        "states", "category", "content_type", "image", "image_gallery", 
        "gallery_id", "youtube_url", "tags", "artists", "movie_rating",
        "is_featured", "is_top_story", "is_published", "is_scheduled", "scheduled_publish_at",
        "seo_title", "seo_description", "seo_keywords",
        "aeo_title", "aeo_description", "aeo_keywords", "faqs",
        "author_credentials", "sources", "fact_checked_by", "last_reviewed_date",
        "review_quick_verdict", "review_plot_summary", "review_performances",
        "review_what_works", "review_what_doesnt_work", "review_technical_aspects",
        "review_final_verdict", "review_cast", "review_director", "review_producer",
        "review_music_director", "review_dop", "review_genre", "review_runtime", "movie_language",
        "censor_rating", "release_date", "platform", "ott_content_type", "ott_platforms",
        "comments_enabled", "review_comments_enabled", "social_media_type", "social_media_embed"
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
        article_obj = db[ARTICLES].find_one({"id": article_id})
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
    est = timezone('America/New_York')
    current_time_est = datetime.now(est).replace(tzinfo=None)
    
    query = {
        "is_scheduled": True,
        "is_published": False,
        "scheduled_publish_at": {"$lte": current_time_est}
    }
    
    docs = list(db[ARTICLES].find(query, {"_id": 0}))
    return [serialize_doc(doc) for doc in docs]

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


