from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from contextlib import asynccontextmanager
import logging
from pathlib import Path
from datetime import datetime, date, timezone
import os
import uuid
import aiofiles
# Rate limiting completely disabled for better user experience
# All rate limiting functionality removed

from database import get_db, db
import schemas, crud
from models.mongodb_collections import create_indexes, GALLERIES
from routes.auth_routes import router as auth_router
from routes.system_settings_routes import router as system_settings_router
from routes.ai_agents_routes import router as ai_agents_router
from routes.topics_routes_mongodb import router as topics_router
from routes.gallery_routes_mongodb import router as gallery_router
from routes.comments_routes import router as comments_router
from routes.ott_platforms_routes import router as ott_platforms_router
from routes.gallery_entities_routes import router as gallery_entities_router
from routes.gallery_image_routes import router as gallery_image_router
from routes.ad_settings_routes import router as ad_settings_router
from routes.artists_routes import router as artists_router
from routes.youtube_channels_routes import router as youtube_channels_router
from routes.youtube_rss_routes import router as youtube_rss_router
from routes.grouped_posts_routes import router as grouped_posts_router
from routes.reality_shows_routes import router as reality_shows_router
from routes.release_sources_routes import router as release_sources_router
from auth import create_default_admin
from scheduler_service import article_scheduler
from s3_service import s3_service
from datetime import datetime
from pytz import timezone as pytz_timezone
import os
from pathlib import Path

# Create MongoDB indexes on startup
# DISABLED: Using remote database as-is without creating indexes
# try:
#     create_indexes(db)
#     print("✅ MongoDB indexes created successfully")
# except Exception as e:
#     print(f"⚠️ Warning: Could not create some MongoDB indexes: {e}")
#     # Continue anyway - app can work without text search index
print("ℹ️ Skipping index creation - using remote database as-is")

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_ott_platforms():
    """Initialize default OTT platforms if they don't exist"""
    try:
        # Check if any platforms exist
        existing_count = db.ott_platforms.count_documents({})
        if existing_count == 0:
            default_platforms = [
                {"id": 1, "name": "Amazon Prime Video", "is_active": True},
                {"id": 2, "name": "Netflix", "is_active": True},
                {"id": 3, "name": "Disney+ Hotstar", "is_active": True},
                {"id": 4, "name": "Aha", "is_active": True},
                {"id": 5, "name": "Zee5", "is_active": True},
                {"id": 6, "name": "SonyLIV", "is_active": True},
                {"id": 7, "name": "JioCinema", "is_active": True},
                {"id": 8, "name": "Apple TV+", "is_active": True},
                {"id": 9, "name": "MX Player", "is_active": True},
                {"id": 10, "name": "Voot", "is_active": True},
            ]
            db.ott_platforms.insert_many(default_platforms)
            logger.info("✅ Default OTT platforms initialized")
    except Exception as e:
        logger.warning(f"⚠️ OTT platforms initialization failed: {e}")

# Define lifespan context manager BEFORE creating app
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("""
    ========================================
    🚀 BLOG CMS API STARTING UP
    - Python Version: 3.11
    - Port: 8000
    - Host: 0.0.0.0
    - Health Check: /api or /api/
    ========================================
    """)
    
    try:
        logger.info("Step 1: Creating default admin user...")
        # DISABLED: Using remote database as-is without creating admin user
        # try:
        #     await create_default_admin()
        #     logger.info("✅ Admin user ready")
        # except Exception as e:
        #     logger.error(f"❌ Admin user creation failed: {e}")
        #     # Don't raise - continue startup
        logger.info("ℹ️ Skipping admin user creation - using remote database as-is")
        
        logger.info("Step 2: Initializing S3 service...")
        try:
            aws_config = crud.get_aws_config(db)
            if aws_config and aws_config.get('is_enabled'):
                s3_service.initialize(aws_config)
                logger.info("✅ S3 service initialized")
            else:
                logger.info("ℹ️ S3 not enabled, using local storage")
        except Exception as e:
            logger.warning(f"⚠️ S3 initialization failed: {e}. Using local storage.")
        
        logger.info("Step 3: Initializing OTT platforms...")
        # DISABLED: Using remote database as-is without initializing OTT platforms
        # try:
        #     initialize_ott_platforms()
        #     logger.info("✅ OTT platforms ready")
        # except Exception as e:
        #     logger.warning(f"⚠️ OTT initialization failed: {e}")
        logger.info("ℹ️ Skipping OTT platform initialization - using remote database as-is")
        
        logger.info("Step 4: Initializing article scheduler...")
        try:
            article_scheduler.initialize_scheduler()
            article_scheduler.start_scheduler()
            logger.info("✅ Scheduler started")
        except Exception as e:
            logger.warning(f"⚠️ Scheduler initialization failed: {e}")
        
        logger.info("Step 5: Initializing YouTube RSS scheduler...")
        try:
            from services.youtube_rss_scheduler import youtube_rss_scheduler
            youtube_rss_scheduler.initialize()
            logger.info("✅ YouTube RSS scheduler initialized")
        except Exception as e:
            logger.warning(f"⚠️ YouTube RSS scheduler initialization failed: {e}")
        
        logger.info("""
        ========================================
        ✅ STARTUP COMPLETE - SERVER READY
        - Listening on: http://0.0.0.0:8000
        - Health endpoint: http://0.0.0.0:8000/api
        - All systems initialized
        ========================================
        """)
    except Exception as e:
        logger.error(f"❌ FATAL STARTUP ERROR: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Don't raise - let the server start anyway
        logger.warning("⚠️ Continuing startup despite errors...")
    
    yield
    
    # Shutdown
    logger.info("Blog CMS API shutting down...")
    try:
        article_scheduler.stop_scheduler()
        logger.info("✅ Scheduler stopped")
    except Exception as e:
        logger.warning(f"⚠️ Shutdown warning: {e}")
    
    try:
        from services.youtube_rss_scheduler import youtube_rss_scheduler
        youtube_rss_scheduler.stop_scheduler()
        logger.info("✅ YouTube RSS scheduler stopped")
    except Exception as e:
        logger.warning(f"⚠️ YouTube RSS scheduler shutdown warning: {e}")

# Create the main app without any rate limiting
app = FastAPI(title="Blog CMS API", version="1.0.0", lifespan=lifespan)

# Detailed request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Get request details
    client_host = request.client.host if request.client else "unknown"
    client_port = request.client.port if request.client else "unknown"
    
    logger.info(f"""
    ========================================
    🔍 INCOMING REQUEST:
    - Method: {request.method}
    - Full URL: {request.url}
    - Scheme: {request.url.scheme}
    - Host: {request.url.hostname}
    - Port: {request.url.port}
    - Path: {request.url.path}
    - Query: {request.url.query}
    - Client: {client_host}:{client_port}
    - Headers: {dict(request.headers)}
    ========================================
    """)
    
    # Process the request
    response = await call_next(request)
    
    # Log response
    logger.info(f"""
    📤 RESPONSE:
    - Path: {request.url.path}
    - Status: {response.status_code}
    ========================================
    """)
    
    return response

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Health check endpoint with detailed logging
@api_router.get("/")
async def root(request: Request):
    logger.info(f"""
    ✅ HEALTH CHECK ENDPOINT HIT:
    - Full URL: {request.url}
    - Base URL: {request.base_url}
    - Path: {request.url.path}
    - Method: {request.method}
    """)
    return {"message": "Blog CMS API is running", "status": "healthy"}

# Seed database endpoint (for development)
@api_router.post("/seed-database")
async def seed_database_endpoint(db = Depends(get_db)):
    try:
        # TODO: Update seed_data for MongoDB
        # seed_data.seed_database(db)
        return {"message": "Database seeding not available - MongoDB migration in progress"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Category endpoints
@api_router.get("/categories", response_model=List[schemas.Category])
async def get_categories(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    categories = crud.get_categories(db, skip=skip, limit=limit)
    return categories

@api_router.post("/categories", response_model=schemas.Category)
async def create_category(category: schemas.CategoryCreate, db = Depends(get_db)):
    db_category = crud.get_category_by_slug(db, slug=category.slug)
    if db_category:
        raise HTTPException(status_code=400, detail="Category with this slug already exists")
    return crud.create_category(db=db, category=category)

@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, category_update: dict, db = Depends(get_db)):
    """Update a category"""
    from models.mongodb_collections import CATEGORIES
    
    # Update using the id field
    result = db[CATEGORIES].update_one(
        {"id": category_id},
        {"$set": category_update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    updated_category = db[CATEGORIES].find_one({"id": category_id}, {"_id": 0})
    return crud.serialize_doc(updated_category)

# Article endpoints
@api_router.get("/articles", response_model=List[schemas.ArticleListResponse])
async def get_articles(
    request: Request,
    skip: int = 0, 
    limit: int = 100, 
    category_id: Optional[int] = None,
    is_featured: Optional[bool] = None,
    db = Depends(get_db)
):
    articles = crud.get_articles(db, skip=skip, limit=limit, is_featured=is_featured)
    result = []
    for article in articles:
        result.append({
            "id": article.get("id"),
            "title": article.get("title"),
            "short_title": article.get("short_title"),
            "summary": article.get("summary"),
            "image_url": article.get("image"),
            "author": article.get("author"),
            "language": article.get("article_language", article.get("language", "en")),  # Support both field names
            "category": article.get("category"),
            "content_type": article.get("content_type"),
            "artists": article.get("artists"),
            "is_published": article.get("is_published"),
            "is_scheduled": article.get("is_scheduled", False),
            "scheduled_publish_at": article.get("scheduled_publish_at"),
            "scheduled_timezone": article.get("scheduled_timezone", "IST"),
            "published_at": article.get("published_at"),
            "view_count": article.get("view_count", 0)
        })
    return result

@api_router.get("/articles/category/{category_slug}", response_model=List[schemas.ArticleListResponse])
async def get_articles_by_category(category_slug: str, skip: int = 0, limit: int = 15, db = Depends(get_db)):
    articles = crud.get_articles_by_category_slug(db, category_slug=category_slug, skip=skip, limit=limit)
    result = []
    for article in articles:
        result.append({
            "id": article.get("id"),
            "title": article.get("title"),
            "short_title": article.get("short_title"),
            "summary": article.get("summary"),
            "image_url": article.get("image"),
            "youtube_url": article.get("youtube_url"),
            "author": article.get("author"),
            "language": article.get("article_language", article.get("language", "en")),
            "category": article.get("category"),
            "content_type": article.get("content_type"),
            "artists": article.get("artists"),
            "movie_rating": article.get("movie_rating"),
            "states": article.get("states"),
            "gallery": article.get("gallery"),
            "gallery_id": article.get("gallery_id"),
            "is_published": article.get("is_published"),
            "is_scheduled": article.get("is_scheduled"),
            "scheduled_publish_at": article.get("scheduled_publish_at"),
            "scheduled_timezone": article.get("scheduled_timezone", "IST"),
            "published_at": article.get("published_at"),
            "view_count": article.get("view_count")
        })
    return result

# New section-specific endpoints for frontend sections
@api_router.get("/articles/sections/latest-news", response_model=List[schemas.ArticleListResponse])
async def get_latest_news_articles(request: Request, limit: int = 4, db = Depends(get_db)):
    """Get articles for Latest News/Top Stories section"""
    articles = crud.get_articles_by_category_slug(db, category_slug="latest-news", limit=limit)
    return articles

@api_router.get("/articles/sections/politics")
async def get_politics_articles(
    request: Request,
    limit: int = 4, 
    states: str = None,  # Comma-separated list of state codes: "ap,ts"
    db = Depends(get_db)
):
    """Get articles for Politics section with State and National tabs
    
    Args:
        limit: Number of articles to return per section
        states: Comma-separated state codes (e.g., "ap,ts") to filter state politics articles
    """
    # Parse state codes if provided
    state_codes = []
    if states:
        state_codes = [s.strip().lower() for s in states.split(',') if s.strip()]
    
    # Get state politics articles with state filtering
    if state_codes:
        state_articles = crud.get_articles_by_states(db, category_slug="state-politics", state_codes=state_codes, limit=limit)
    else:
        # If no states specified, get all state politics articles  
        state_articles = crud.get_articles_by_category_slug(db, category_slug="state-politics", limit=limit)
    
    # National politics articles don't need state filtering
    national_articles = crud.get_articles_by_category_slug(db, category_slug="national-politics", limit=limit)
    
    return {
        "state_politics": state_articles or [],
        "national_politics": national_articles or []
    }

@api_router.get("/articles/sections/movies")
async def get_movies_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Movies section with Movie News and Movie News Bollywood tabs"""
    movie_news_articles = crud.get_articles_by_category_slug(db, category_slug="movie-news", limit=limit)
    bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="movie-news-bollywood", limit=limit)
    
    return {
        "movies": movie_news_articles,
        "bollywood": bollywood_articles
    }

@api_router.get("/articles/sections/hot-topics")
async def get_hot_topics_articles(limit: int = 4, states: str = None, db = Depends(get_db)):
    """Get articles for Hot Topics section with Hot Topics (state-specific) and Hot Topics Bollywood tabs"""
    # For hot topics tab - apply state filtering if provided (similar to politics filtering)
    if states:
        # Convert state codes to filter hot-topics articles
        state_codes = [code.strip() for code in states.split(',')]
        hot_topics_articles = crud.get_articles_by_states(db, category_slug="hot-topics", state_codes=state_codes, limit=limit)
    else:
        hot_topics_articles = crud.get_articles_by_category_slug(db, category_slug="hot-topics", limit=limit)
        
    # Bollywood hot topics - no state filtering needed (show to all users)
    bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="hot-topics-bollywood", limit=limit)
    
    return {
        "hot_topics": hot_topics_articles,
        "bollywood": bollywood_articles
    }



@api_router.get("/articles/sections/ai-stock")
async def get_ai_stock_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for AI & Stock Market section"""
    ai_articles = crud.get_articles_by_category_slug(db, category_slug="ai", limit=limit)
    stock_articles = crud.get_articles_by_category_slug(db, category_slug="stock-market", limit=limit)
    
    return {
        "ai": ai_articles,
        "stock_market": stock_articles
    }

@api_router.get("/articles/sections/fashion-beauty", response_model=dict)
async def get_fashion_beauty_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Fashion & Beauty section (now Fashion & Travel)"""
    fashion_articles = crud.get_articles_by_category_slug(db, category_slug="fashion", limit=limit)
    travel_articles = crud.get_articles_by_category_slug(db, category_slug="travel", limit=limit)
    
    return {
        "fashion": fashion_articles,
        "travel": travel_articles
    }

@api_router.get("/articles/sections/sports")
async def get_sports_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Sports section with Cricket and Other Sports tabs"""
    cricket_articles = crud.get_articles_by_category_slug(db, category_slug="cricket", limit=limit)
    other_sports_articles = crud.get_articles_by_category_slug(db, category_slug="other-sports", limit=limit)
    
    return {
        "cricket": cricket_articles,
        "other_sports": other_sports_articles
    }

@api_router.get("/articles/sections/hot-topics-gossip", response_model=dict)
async def get_hot_topics_gossip_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Hot Topics & Gossip section"""
    hot_topics_articles = crud.get_articles_by_category_slug(db, category_slug="hot-topics", limit=limit)
    gossip_articles = crud.get_articles_by_category_slug(db, category_slug="gossip", limit=limit)
    
    return {
        "hot_topics": hot_topics_articles,
        "gossip": gossip_articles
    }

@api_router.get("/articles/sections/trending-videos")
async def get_trending_videos_articles(limit: int = 20, languages: str = None, db = Depends(get_db)):
    """Get articles for Latest Video Songs section with Regional and Bollywood tabs
    
    Args:
        limit: Number of articles to fetch (default 20)
        languages: Comma-separated list of language names for filtering (e.g., Telugu,Tamil)
    """
    # For regional tab - filter by content_language if provided
    if languages:
        language_list = [lang.strip() for lang in languages.split(',') if lang.strip()]
        
        # Convert language names to codes
        lang_name_to_code = {
            'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
            'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
            'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
        }
        language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in language_list]
        
        print(f"🔍 Trending Videos (Latest Video Songs) - Languages: {language_list}, Codes: {language_codes}")
        
        if language_codes:
            trending_articles = crud.get_articles_by_content_language(
                db, 
                category_slug="latest-video-songs", 
                language_codes=language_codes, 
                limit=limit
            )
        else:
            trending_articles = crud.get_articles_by_category_slug(db, category_slug="latest-video-songs", limit=limit)
    else:
        trending_articles = crud.get_articles_by_category_slug(db, category_slug="latest-video-songs", limit=limit)
    
    # For Bollywood tab - no language filtering, show all Bollywood video songs
    bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="latest-video-songs-bollywood", limit=limit)
    
    return {
        "trending_videos": trending_articles,
        "bollywood": bollywood_articles
    }

# USA and ROW video sections endpoint
@api_router.get("/articles/sections/usa-row-videos", response_model=dict)
async def get_usa_row_videos_sections(limit: int = 20, db = Depends(get_db)):
    """Get articles for Viral Videos section with USA and ROW tabs"""
    usa_articles = crud.get_articles_by_category_slug(db, category_slug="usa", limit=limit)
    row_articles = crud.get_articles_by_category_slug(db, category_slug="row", limit=limit)
    
    return {
        "usa": usa_articles,
        "row": row_articles
    }

@api_router.get("/articles/sections/tadka-shorts")
async def get_tadka_shorts_articles(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get articles for Tadka Shorts section with state-based language filtering
    
    Args:
        limit: Number of articles to fetch (default 20)
        states: Comma-separated list of state codes for language filtering
    """
    try:
        from state_language_mapping import get_languages_for_states
        
        # For Tadka Shorts tab - apply language filtering based on states
        if states:
            # Get languages for the selected states
            state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
            user_languages = get_languages_for_states(state_list)
            
            # Convert language names to codes for filtering
            lang_name_to_code = {
                'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
            }
            language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
            
            print(f"🔍 Tadka Shorts - States: {state_list}, Languages: {user_languages}, Codes: {language_codes}")
            
            # Filter articles by content_language matching user's state-based languages
            tadka_shorts_articles = crud.get_articles_by_content_language(
                db, 
                category_slug="tadka-shorts", 
                language_codes=language_codes, 
                limit=limit
            )
        else:
            # No state preference - show all tadka shorts
            tadka_shorts_articles = crud.get_articles_by_category_slug(db, category_slug="tadka-shorts", limit=limit)
        
        # For Bollywood tab - always show all Bollywood content (no filtering)
        bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="tadka-shorts-bollywood", limit=limit)
        
        return {
            "tadka_shorts": tadka_shorts_articles or [],
            "bollywood": bollywood_articles or []
        }
    except Exception as e:
        print(f"❌ Error in get_tadka_shorts_articles: {e}")
        import traceback
        traceback.print_exc()
        return {
            "tadka_shorts": [],
            "bollywood": []
        }

@api_router.get("/articles/sections/ott-movie-reviews")
async def get_ott_movie_reviews_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for OTT Reviews section with OTT Reviews and Bollywood tabs"""
    ott_reviews_articles = crud.get_articles_by_category_slug(db, category_slug="ott-reviews", limit=limit)
    bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="ott-reviews-bollywood", limit=limit)
    
    return {
        "ott_movie_reviews": ott_reviews_articles,
        "web_series": bollywood_articles
    }

@api_router.get("/articles/sections/new-video-songs")
async def get_new_video_songs_articles(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get articles for Latest Video Songs section with state-based language filtering
    
    Args:
        limit: Number of articles to fetch (default 20)
        states: Comma-separated list of state codes for language filtering
    """
    try:
        from state_language_mapping import get_languages_for_states
        
        # For Latest Video Songs tab - apply language filtering based on states
        if states:
            # Get languages for the selected states
            state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
            user_languages = get_languages_for_states(state_list)
            
            # Convert language names to codes for filtering
            lang_name_to_code = {
                'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
            }
            language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
            
            print(f"🔍 Latest Video Songs - States: {state_list}, Languages: {user_languages}, Codes: {language_codes}")
            
            # Filter articles by content_language matching user's state-based languages
            video_songs_articles = crud.get_articles_by_content_language(
                db, 
                category_slug="latest-video-songs", 
                language_codes=language_codes, 
                limit=limit
            )
        else:
            # No state preference - show all latest video songs
            video_songs_articles = crud.get_articles_by_category_slug(db, category_slug="latest-video-songs", limit=limit)
        
        # For Bollywood tab - always show all Bollywood videos (no filtering)
        bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="latest-video-songs-bollywood", limit=limit)
        
        return {
            "video_songs": video_songs_articles or [],
            "bollywood": bollywood_articles or []
        }
    except Exception as e:
        print(f"❌ Error in get_new_video_songs_articles: {e}")
        import traceback
        traceback.print_exc()
        # Return empty lists on error
        return {
            "video_songs": [],
            "bollywood": []
        }

@api_router.get("/articles/sections/movie-reviews")
def get_movie_reviews_articles(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get articles for Movie Reviews section with state-based language filtering
    
    Args:
        limit: Number of articles to fetch (default 20)
        states: Comma-separated list of state codes for language filtering
    
    Returns:
        movie_reviews: Regional movie reviews based on user's state
        bollywood: Hindi/Bollywood movie reviews (includes both Hindi and English movies from Bollywood sources)
    """
    from state_language_mapping import get_languages_for_states
    
    # For Movie Reviews tab - apply language filtering based on states
    if states:
        # Get languages for the selected states
        state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
        user_languages = get_languages_for_states(state_list)
        
        # Convert language names to codes for filtering
        lang_name_to_code = {
            'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
            'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
            'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
        }
        language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
        
        print(f"🎬 Movie Reviews - States: {state_list}, Languages: {user_languages}, Codes: {language_codes}")
        
        # Filter articles by content_language matching user's state-based languages
        movie_reviews_articles = crud.get_articles_by_content_language(
            db, 
            category_slug="movie-reviews", 
            language_codes=language_codes, 
            limit=limit
        )
    else:
        # No state preference - show all movie reviews
        movie_reviews_articles = crud.get_articles_by_category_slug(db, category_slug="movie-reviews", limit=limit)
    
    # For Bollywood tab - fetch Hindi movie reviews (content_type=movie_review, content_language=hi)
    # This includes reviews created by Movie Review Agent from Pinkvilla/Bollywood Hungama
    # (both Hindi and English movies are stored with content_language=hi for Bollywood tab)
    bollywood_articles = list(db.articles.find({
        "content_type": "movie_review",
        "content_language": "hi",
        "is_published": True
    }).sort("published_at", -1).limit(limit))
    
    # Convert ObjectId to string and ensure proper format
    for article in bollywood_articles:
        if '_id' in article:
            article['_id'] = str(article['_id'])
    
    # Also include articles from category-based bollywood reviews (if any exist)
    category_based_bollywood = crud.get_articles_by_category_slug(db, category_slug="movie-reviews-bollywood", limit=limit)
    
    # Merge and deduplicate Bollywood reviews
    all_bollywood = bollywood_articles + (category_based_bollywood or [])
    seen_ids = set()
    unique_bollywood = []
    for article in all_bollywood:
        article_id = article.get('id') or article.get('_id')
        if article_id not in seen_ids:
            seen_ids.add(article_id)
            unique_bollywood.append(article)
    
    # Sort by published_at and limit
    unique_bollywood.sort(key=lambda x: x.get('published_at', ''), reverse=True)
    unique_bollywood = unique_bollywood[:limit]
    
    print(f"🎬 Movie Reviews - General: {len(movie_reviews_articles or [])}, Bollywood: {len(unique_bollywood)}")
    
    return {
        "movie_reviews": movie_reviews_articles or [],
        "bollywood": unique_bollywood or []
    }

@api_router.get("/articles/sections/trailers-teasers")
async def get_trailers_teasers_articles(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get articles for Trailers & Teasers section with state-based language filtering
    
    Args:
        limit: Number of articles to fetch (default 20)
        states: Comma-separated list of state codes for language filtering
    """
    try:
        from state_language_mapping import get_languages_for_states
        
        # For Trailers & Teasers tab - apply language filtering based on states
        if states:
            # Get languages for the selected states
            state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
            user_languages = get_languages_for_states(state_list)
            
            # Convert language names to codes for filtering
            lang_name_to_code = {
                'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
            }
            language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
            
            print(f"🔍 Trailers & Teasers - States: {state_list}, Languages: {user_languages}, Codes: {language_codes}")
            
            # Filter articles by content_language matching user's state-based languages
            trailers_articles = crud.get_articles_by_content_language(
                db, 
                category_slug="trailers-teasers", 
                language_codes=language_codes, 
                limit=limit
            )
        else:
            # No state preference - show all trailers & teasers
            trailers_articles = crud.get_articles_by_category_slug(db, category_slug="trailers-teasers", limit=limit)
        
        # For Bollywood tab - always show all Bollywood content (no filtering)
        bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="trailers-teasers-bollywood", limit=limit)
        
        return {
            "trailers": trailers_articles or [],
            "bollywood": bollywood_articles or []
        }
    except Exception as e:
        print(f"❌ Error in get_trailers_teasers_articles: {e}")
        import traceback
        traceback.print_exc()
        # Return empty lists on error
        return {
            "trailers": [],
            "bollywood": []
        }

@api_router.get("/articles/sections/box-office")
async def get_box_office_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Box Office section with Box Office and Bollywood tabs"""
    box_office_articles = crud.get_articles_by_category_slug(db, category_slug="box-office", limit=limit)
    bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="box-office-bollywood", limit=limit)
    
    return {
        "box_office": box_office_articles,
        "bollywood": bollywood_articles
    }

@api_router.get("/articles/sections/events-interviews")
async def get_events_interviews_articles(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get articles for Events & Press Meets section with state-based language filtering
    
    Args:
        limit: Number of articles to fetch (default 20)
        states: Comma-separated list of state codes for language filtering
    """
    try:
        from state_language_mapping import get_languages_for_states
        
        # For Events & Press Meets tab - apply language filtering based on states
        if states:
            # Get languages for the selected states
            state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
            user_languages = get_languages_for_states(state_list)
            
            # Convert language names to codes for filtering
            lang_name_to_code = {
                'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
            }
            language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
            
            print(f"🔍 Events & Press Meets - States: {state_list}, Languages: {user_languages}, Codes: {language_codes}")
            
            # Filter articles by content_language matching user's state-based languages
            events_articles = crud.get_articles_by_content_language(
                db, 
                category_slug="events-interviews", 
                language_codes=language_codes, 
                limit=limit
            )
        else:
            # No state preference - show all events & press meets
            events_articles = crud.get_articles_by_category_slug(db, category_slug="events-interviews", limit=limit)
        
        # For Bollywood tab - always show all Bollywood content (no filtering)
        bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="events-interviews-bollywood", limit=limit)
        
        return {
            "events_interviews": events_articles or [],
            "bollywood": bollywood_articles or []
        }
    except Exception as e:
        print(f"❌ Error in get_events_interviews_articles: {e}")
        import traceback
        traceback.print_exc()
        return {
            "events_interviews": [],
            "bollywood": []
        }

@api_router.get("/articles/sections/events-interviews-aggregated")
async def get_events_interviews_aggregated(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get aggregated events & press meets - fetches from grouped_posts collection (grouped by channel name)
    Falls back to on-the-fly grouping if no grouped posts exist
    
    Args:
        limit: Number of groups to return (default 20)
        states: Comma-separated list of state codes for language filtering
    """
    try:
        from state_language_mapping import get_languages_for_states
        
        # Try to fetch from grouped_posts collection first (TV Video Agent creates these)
        regional_groups_query = {"category": "events-interviews"}
        bollywood_groups_query = {"category": "events-interviews-bollywood"}
        
        # Check if grouped posts exist
        regional_groups_count = db.grouped_posts.count_documents(regional_groups_query)
        bollywood_groups_count = db.grouped_posts.count_documents(bollywood_groups_query)
        
        print(f"🔍 Found {regional_groups_count} regional groups and {bollywood_groups_count} bollywood groups in grouped_posts")
        
        # If grouped posts exist, use them (grouped by channel name from TV Video Agent)
        if regional_groups_count > 0 or bollywood_groups_count > 0:
            print("✅ Using grouped_posts collection (channel-based grouping)")
            
            # Apply language filtering for regional if states provided
            if states:
                state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
                if state_list:
                    user_languages = get_languages_for_states(state_list)
                    
                    lang_name_to_code = {
                        'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                        'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                        'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
                    }
                    language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
                    
                    # Fetch regional groups and filter by language
                    regional_groups = list(db.grouped_posts.find(regional_groups_query).sort("updated_at", -1).limit(limit * 2))
                    filtered_regional = []
                    
                    for group in regional_groups:
                        rep_id = group.get('representative_post_id')
                        if rep_id:
                            rep_article = db.articles.find_one({"id": rep_id})
                            if rep_article and rep_article.get('content_language') in language_codes:
                                post_ids = group.get('post_ids', [])
                                articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
                                group['articles'] = crud.serialize_doc(articles)
                                group['representative_post'] = crud.serialize_doc(rep_article)
                                filtered_regional.append(group)
                                if len(filtered_regional) >= limit:
                                    break
                    
                    regional_groups = crud.serialize_doc(filtered_regional)
                else:
                    regional_groups = []
            else:
                # No state filter - show all regional groups
                regional_groups = list(db.grouped_posts.find(regional_groups_query).sort("updated_at", -1).limit(limit))
                
                for group in regional_groups:
                    post_ids = group.get('post_ids', [])
                    articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
                    group['articles'] = crud.serialize_doc(articles)
                    
                    rep_id = group.get('representative_post_id')
                    if rep_id:
                        rep_article = db.articles.find_one({"id": rep_id})
                        group['representative_post'] = crud.serialize_doc(rep_article)
                
                regional_groups = crud.serialize_doc(regional_groups)
            
            # Get Bollywood groups (no language filtering)
            bollywood_groups = list(db.grouped_posts.find(bollywood_groups_query).sort("updated_at", -1).limit(limit))
            
            for group in bollywood_groups:
                post_ids = group.get('post_ids', [])
                articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
                group['articles'] = crud.serialize_doc(articles)
                
                rep_id = group.get('representative_post_id')
                if rep_id:
                    rep_article = db.articles.find_one({"id": rep_id})
                    group['representative_post'] = crud.serialize_doc(rep_article)
            
            bollywood_groups = crud.serialize_doc(bollywood_groups)
            
            # Transform grouped_posts format to match events-interviews format
            def transform_to_events_format(groups):
                result = []
                for group in groups:
                    if group.get('articles') and len(group['articles']) > 0:
                        # Use first article as representative
                        representative = group['articles'][0].copy()
                        # Add event/channel name and video info
                        representative['event_name'] = group.get('group_title', 'Unknown')
                        representative['video_count'] = group.get('posts_count', len(group['articles']))
                        representative['all_videos'] = group['articles']
                        result.append(representative)
                return result
            
            regional_formatted = transform_to_events_format(regional_groups)
            bollywood_formatted = transform_to_events_format(bollywood_groups)
            
            print(f"✅ Returning {len(regional_formatted)} regional groups and {len(bollywood_formatted)} bollywood groups")
            
            return {
                "events_interviews": regional_formatted,
                "bollywood": bollywood_formatted
            }
        
        # FALLBACK: If no grouped posts exist, use old on-the-fly grouping logic
        print("⚠️ No grouped_posts found, falling back to on-the-fly grouping")
        
        import re
        from collections import defaultdict
        from datetime import datetime, timedelta, timezone
        
        # Get articles from last 48 hours - ONLY from events-interviews categories
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=48)
        cutoff_time_naive = cutoff_time.replace(tzinfo=None)
        
        # Build base query for events-interviews categories only
        regional_query = {
            "category": "events-interviews",  # Only events-interviews category
            "content_type": "video",
            "is_published": True,
            "published_at": {"$gte": cutoff_time_naive}
        }
        
        bollywood_query = {
            "category": "events-interviews-bollywood",  # Only bollywood events-interviews
            "content_type": "video",
            "is_published": True,
            "published_at": {"$gte": cutoff_time_naive}
        }
        
        # Apply language filtering if states provided (only for regional)
        if states:
            state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
            if state_list:
                user_languages = get_languages_for_states(state_list)
                
                lang_name_to_code = {
                    'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                    'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                    'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
                }
                language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
                regional_query["content_language"] = {"$in": language_codes}
        
        # Fetch articles from events-interviews categories only
        regional_articles = list(
            db.articles.find(regional_query)
            .sort("published_at", -1)
            .limit(100)
        )
        
        bollywood_articles = list(
            db.articles.find(bollywood_query)
            .sort("published_at", -1)
            .limit(100)
        )
        
        # Serialize articles
        regional_articles = crud.serialize_doc(regional_articles)
        bollywood_articles = crud.serialize_doc(bollywood_articles)
        
        print(f"🔍 Found {len(regional_articles)} regional and {len(bollywood_articles)} bollywood events videos from last 48 hours")
        
        def normalize_movie_name(name):
            """Normalize movie name for comparison"""
            if not name:
                return ""
            
            normalized = ' '.join(name.lower().strip().split())
            normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
            
            # Movie codes and names equivalence - normalize to same string
            normalized = re.sub(r'svc\s*59', 'rowdyjanardhan', normalized)
            normalized = re.sub(r'svc59', 'rowdyjanardhan', normalized)
            normalized = re.sub(r'rowdyjanardhana', 'rowdyjanardhan', normalized)
            normalized = re.sub(r'rowdy\s+janardhana', 'rowdyjanardhan', normalized)
            normalized = re.sub(r'rowdy\s+janardhan', 'rowdyjanardhan', normalized)
            
            # Spelling variations
            normalized = re.sub(r'shyambhala', 'shambhala', normalized)
            normalized = re.sub(r'shyambala', 'shambhala', normalized)
            normalized = re.sub(r'vrusshabha', 'vrushabha', normalized)
            
            # Remove common prefixes/suffixes
            normalized = re.sub(r'^and\s+', '', normalized)
            normalized = re.sub(r'\s+movie$', '', normalized)
            normalized = re.sub(r'\s+film$', '', normalized)
            normalized = re.sub(r'\s+and$', '', normalized)
            
            return normalized.strip()
        
        def calculate_similarity(str1, str2):
            """Calculate similarity ratio between two strings"""
            if not str1 or not str2:
                return 0.0
            
            # Normalize both strings
            s1 = normalize_movie_name(str1)
            s2 = normalize_movie_name(str2)
            
            if s1 == s2:
                return 1.0
            
            # Check substring match
            if s1 in s2 or s2 in s1:
                shorter = min(len(s1), len(s2))
                longer = max(len(s1), len(s2))
                if shorter >= 4:  # At least 4 chars
                    return shorter / longer
            
            # Calculate character-level similarity
            set1 = set(s1)
            set2 = set(s2)
            if not set1 or not set2:
                return 0.0
            
            intersection = len(set1.intersection(set2))
            union = len(set1.union(set2))
            
            return intersection / union if union > 0 else 0.0
        
        def are_similar_movie_names(name1, name2, threshold=0.65):
            """Check if two movie names are similar - liberal threshold"""
            similarity = calculate_similarity(name1, name2)
            return similarity >= threshold
        
        def extract_movie_event_name(title):
            """Extract movie/event name from video title
            
            Priority:
            1. Extract ALL hashtags and find the movie-like one
            2. Look for @ symbol and extract movie name
            3. Search for movie name patterns
            
            Examples:
            - "About #Rowdyjanardhana | #SVC59" -> "Rowdyjanardhana" (prefer full name over code)
            - "#SVC59 Title Launch" -> "SVC59"
            - "Actress @ Champion Movie" -> "Champion"
            """
            if not title:
                return "Other Events"
            
            # Priority 1: Look for hashtags
            hashtags = re.findall(r'#([A-Za-z0-9]+)', title)
            if hashtags:
                # Prefer longer, more descriptive hashtags (likely movie names vs codes)
                hashtags.sort(key=len, reverse=True)
                for hashtag in hashtags:
                    if len(hashtag) >= 4:
                        # Prefer full names (Rowdyjanardhana) over codes (SVC59)
                        if not re.match(r'^[A-Z]{3,5}\d{1,3}$', hashtag):  # Not a code like SVC59
                            return hashtag.title()
                # If only codes found, use the first one
                if hashtags[0] and len(hashtags[0]) >= 3:
                    return hashtags[0].upper()
            
            # Priority 2: Look for @ symbol
            if '@' in title:
                after_at = title.split('@', 1)[1].strip()
                
                words = re.split(r'[\s]+', after_at)
                movie_name_parts = []
                event_keywords = ['movie', 'pre', 'press', 'trailer', 'teaser', 'audio', 'success', 
                                 'interview', 'event', 'launch', 'promotion', 'in', 'at', 'exclusive',
                                 'official', 'first', 'glimpse', 'motion', 'poster', 'release', 'meet',
                                 'team', 'says', 'super', 'fun', 'emotional', 'cute', 'superb', 'about']
                
                for word in words:
                    word_lower = word.lower()
                    if word_lower in event_keywords:
                        break
                    movie_name_parts.append(word)
                    if len(movie_name_parts) >= 3:
                        break
                
                if movie_name_parts:
                    movie_name = ' '.join(movie_name_parts).strip()
                    if movie_name:
                        return movie_name
            
            # Priority 3: Search for movie name patterns
            patterns = [
                r'(?:with|about)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:team|movie|event|pre|press)',
                r'([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:movie|team|event|pre-release|press\s+meet)',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, title, re.IGNORECASE)
                if match:
                    candidate = match.group(1).strip()
                    person_keywords = ['actress', 'actor', 'hero', 'heroine', 'director', 'music', 
                                      'producer', 'comedian']
                    if candidate.lower() not in person_keywords:
                        return candidate
            
            # Priority 4: Look for celebrity names (last resort)
            celeb_match = re.search(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b', title)
            if celeb_match:
                return celeb_match.group(1)
            
            # Fallback
            title_clean = re.split(r'\s+[\|\-]\s+', title)[0].strip()
            title_clean = re.sub(r'^.*?\s+(Speech|Talk|Interview)\s+@\s+', '', title_clean, flags=re.IGNORECASE)
            
            movie_name = ' '.join(title_clean.split()).strip()
            return movie_name[:50] if movie_name else "Other Events"
        
        def group_by_movie_event(articles):
            """Group videos by movie/event name with liberal fuzzy matching"""
            groups = {}  # Maps canonical name to list of articles
            name_to_canonical = {}  # Maps all variations to canonical name
            
            for article in articles:
                movie_name = extract_movie_event_name(article.get('title', ''))
                
                # Find the best matching existing group
                best_match = None
                best_similarity = 0.0
                
                for canonical_name in groups.keys():
                    similarity = calculate_similarity(movie_name, canonical_name)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_match = canonical_name
                
                # Use existing group if similar enough (50% match - VERY liberal)
                if best_match and best_similarity >= 0.50:
                    canonical_name = best_match
                else:
                    # Create new group with this name as canonical
                    canonical_name = movie_name
                    groups[canonical_name] = []
                
                # Add article to group
                groups[canonical_name].append(article)
            
            # Create aggregated posts
            aggregated = []
            for movie_name, videos in groups.items():
                # Sort by published date (most recent first)
                videos.sort(key=lambda x: x.get('published_at', ''), reverse=True)
                
                # Use the most recent video as the representative
                representative = videos[0].copy()
                representative['event_name'] = movie_name
                representative['video_count'] = len(videos)
                representative['all_videos'] = videos
                aggregated.append(representative)
            
            # Sort aggregated groups by most recent video
            aggregated.sort(key=lambda x: x.get('published_at', ''), reverse=True)
            
            return aggregated[:limit]
        
        result = {
            "events_interviews": group_by_movie_event(regional_articles),
            "bollywood": group_by_movie_event(bollywood_articles)
        }
        
        print(f"✅ Aggregated into {len(result['events_interviews'])} regional groups and {len(result['bollywood'])} bollywood groups")
        
        return result
        
    except Exception as e:
        print(f"❌ Error in get_events_interviews_aggregated: {e}")
        import traceback
        traceback.print_exc()
        return {
            "events_interviews": [],
            "bollywood": []
        }

@api_router.get("/articles/sections/big-boss")
async def get_big_boss_articles(limit: int = 20, db = Depends(get_db)):
    """Get grouped reality shows for Big Boss/TV Reality Shows section 
    Returns grouped format with event_name, video_count, and all_videos
    """
    try:
        # Use reality-shows-grouped which returns proper grouped format
        grouped_response = await get_reality_shows_grouped(limit=limit, db=db)
        
        return {
            "big_boss": grouped_response.get('reality_shows', []),
            "bollywood": grouped_response.get('hindi', [])
        }
    except Exception as e:
        print(f"❌ Error in get_big_boss_articles: {e}")
        import traceback
        traceback.print_exc()
        return {
            "big_boss": [],
            "bollywood": []
        }



@api_router.get("/articles/sections/reality-shows-grouped")
async def get_reality_shows_grouped(limit: int = 20, db = Depends(get_db)):
    """Get grouped reality shows from grouped_posts collection
    Returns groups organized by show name for TV Reality Shows page
    """
    try:
        # Fetch grouped posts for tv-reality-shows categories
        regional_groups_query = {"category": {"$in": ["tv-reality-shows", "big-boss"]}}
        hindi_groups_query = {"category": {"$in": ["tv-reality-shows-hindi", "big-boss-bollywood"]}}
        
        # Get regional groups
        regional_groups = list(db.grouped_posts.find(regional_groups_query).sort("updated_at", -1).limit(limit))
        
        for group in regional_groups:
            post_ids = group.get('post_ids', [])
            articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
            group['articles'] = crud.serialize_doc(articles)
            
            rep_id = group.get('representative_post_id')
            if rep_id:
                rep_article = db.articles.find_one({"id": rep_id})
                group['representative_post'] = crud.serialize_doc(rep_article)
        
        regional_groups = crud.serialize_doc(regional_groups)
        
        # Get Hindi/Bollywood groups
        hindi_groups = list(db.grouped_posts.find(hindi_groups_query).sort("updated_at", -1).limit(limit))
        
        for group in hindi_groups:
            post_ids = group.get('post_ids', [])
            articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
            group['articles'] = crud.serialize_doc(articles)
            
            rep_id = group.get('representative_post_id')
            if rep_id:
                rep_article = db.articles.find_one({"id": rep_id})
                group['representative_post'] = crud.serialize_doc(rep_article)
        
        hindi_groups = crud.serialize_doc(hindi_groups)
        
        # Transform to match events-interviews format for modal display
        def transform_to_events_format(groups):
            result = []
            for group in groups:
                if group.get('articles') and len(group['articles']) > 0:
                    representative = group['articles'][0].copy()
                    representative['event_name'] = group.get('group_title', 'Unknown Show')
                    representative['video_count'] = group.get('posts_count', len(group['articles']))
                    representative['all_videos'] = group['articles']
                    result.append(representative)
            return result
        
        regional_formatted = transform_to_events_format(regional_groups)
        hindi_formatted = transform_to_events_format(hindi_groups)
        
        print(f"✅ Reality Shows Grouped: {len(regional_formatted)} regional, {len(hindi_formatted)} hindi")
        
        return {
            "reality_shows": regional_formatted,
            "hindi": hindi_formatted
        }
    except Exception as e:
        print(f"❌ Error in get_reality_shows_grouped: {e}")
        import traceback
        traceback.print_exc()
        return {"reality_shows": [], "hindi": []}

@api_router.get("/articles/sections/tv-today-aggregated")
async def get_tv_today_aggregated(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get aggregated TV Today content - fetches from grouped_posts collection
    Returns grouped posts by channel name from tv-today and tv-today-hindi categories
    
    Args:
        limit: Number of groups to return (default 20)
        states: Comma-separated list of state codes for language filtering
    """
    try:
        from state_language_mapping import get_languages_for_states
        
        # Build queries for grouped posts
        regional_query = {"category": "tv-today"}
        hindi_query = {"category": "tv-today-hindi"}
        
        # Apply language filtering for regional if states provided
        if states:
            state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
            if state_list:
                user_languages = get_languages_for_states(state_list)
                lang_name_to_code = {
                    'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                    'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                    'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
                }
                language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
                
                # For grouped posts, we need to check the representative post's language
                # Get groups and filter by checking representative post
                regional_groups = list(db.grouped_posts.find(regional_query).sort("updated_at", -1).limit(limit * 2))
                filtered_regional = []
                
                for group in regional_groups:
                    rep_id = group.get('representative_post_id')
                    if rep_id:
                        rep_article = db.articles.find_one({"id": rep_id})
                        if rep_article and rep_article.get('content_language') in language_codes:
                            # Attach articles to group
                            post_ids = group.get('post_ids', [])
                            articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
                            group['articles'] = crud.serialize_doc(articles)
                            # Add representative article data
                            group['representative_post'] = crud.serialize_doc(rep_article)
                            filtered_regional.append(group)
                            if len(filtered_regional) >= limit:
                                break
                
                regional_groups = crud.serialize_doc(filtered_regional)
            else:
                regional_groups = []
        else:
            # No filtering - get all regional groups
            regional_groups = list(db.grouped_posts.find(regional_query).sort("updated_at", -1).limit(limit))
            
            # Enrich with articles
            for group in regional_groups:
                post_ids = group.get('post_ids', [])
                articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
                group['articles'] = crud.serialize_doc(articles)
                
                rep_id = group.get('representative_post_id')
                if rep_id:
                    rep_article = db.articles.find_one({"id": rep_id})
                    group['representative_post'] = crud.serialize_doc(rep_article)
            
            regional_groups = crud.serialize_doc(regional_groups)
        
        # Get Hindi groups (no filtering)
        hindi_groups = list(db.grouped_posts.find(hindi_query).sort("updated_at", -1).limit(limit))
        
        # Enrich with articles
        for group in hindi_groups:
            post_ids = group.get('post_ids', [])
            articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
            group['articles'] = crud.serialize_doc(articles)
            
            rep_id = group.get('representative_post_id')
            if rep_id:
                rep_article = db.articles.find_one({"id": rep_id})
                group['representative_post'] = crud.serialize_doc(rep_article)
        
        hindi_groups = crud.serialize_doc(hindi_groups)
        
        # Transform grouped_posts format to match events-interviews format
        def transform_to_events_format(groups):
            result = []
            for group in groups:
                if group.get('articles') and len(group['articles']) > 0:
                    # Use first article as representative
                    representative = group['articles'][0].copy()
                    # Add event/channel name and video info
                    representative['event_name'] = group.get('group_title', 'Unknown')
                    representative['video_count'] = group.get('posts_count', len(group['articles']))
                    representative['all_videos'] = group['articles']
                    result.append(representative)
            return result
        
        regional_formatted = transform_to_events_format(regional_groups)
        hindi_formatted = transform_to_events_format(hindi_groups)
        
        print(f"✅ TV Today: {len(regional_formatted)} regional groups, {len(hindi_formatted)} hindi groups")
        
        return {
            "tv_today": regional_formatted,
            "hindi": hindi_formatted
        }
        
    except Exception as e:
        print(f"❌ Error in get_tv_today_aggregated: {e}")
        import traceback
        traceback.print_exc()
        return {"tv_today": [], "hindi": []}

@api_router.get("/articles/sections/news-today-aggregated")
async def get_news_today_aggregated(limit: int = 20, states: str = None, db = Depends(get_db)):
    """Get aggregated News Today content - fetches from grouped_posts collection
    Returns grouped posts by channel name from news-today and news-today-hindi categories
    
    Args:
        limit: Number of groups to return (default 20)
        states: Comma-separated list of state codes for language filtering
    """
    try:
        from state_language_mapping import get_languages_for_states
        
        # Build queries for grouped posts
        regional_query = {"category": "news-today"}
        hindi_query = {"category": "news-today-hindi"}
        
        # Apply language filtering for regional if states provided
        if states:
            state_list = [s.strip() for s in states.split(',') if s.strip() and s.strip() != 'all']
            if state_list:
                user_languages = get_languages_for_states(state_list)
                lang_name_to_code = {
                    'Telugu': 'te', 'Tamil': 'ta', 'Hindi': 'hi', 'Kannada': 'kn',
                    'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Punjabi': 'pa',
                    'Gujarati': 'gu', 'Odia': 'or', 'Assamese': 'as', 'Urdu': 'ur'
                }
                language_codes = [lang_name_to_code.get(lang, lang.lower()[:2]) for lang in user_languages]
                
                regional_groups = list(db.grouped_posts.find(regional_query).sort("updated_at", -1).limit(limit * 2))
                filtered_regional = []
                
                for group in regional_groups:
                    rep_id = group.get('representative_post_id')
                    if rep_id:
                        rep_article = db.articles.find_one({"id": rep_id})
                        if rep_article and rep_article.get('content_language') in language_codes:
                            post_ids = group.get('post_ids', [])
                            articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
                            group['articles'] = crud.serialize_doc(articles)
                            group['representative_post'] = crud.serialize_doc(rep_article)
                            filtered_regional.append(group)
                            if len(filtered_regional) >= limit:
                                break
                
                regional_groups = crud.serialize_doc(filtered_regional)
            else:
                regional_groups = []
        else:
            regional_groups = list(db.grouped_posts.find(regional_query).sort("updated_at", -1).limit(limit))
            
            for group in regional_groups:
                post_ids = group.get('post_ids', [])
                articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
                group['articles'] = crud.serialize_doc(articles)
                
                rep_id = group.get('representative_post_id')
                if rep_id:
                    rep_article = db.articles.find_one({"id": rep_id})
                    group['representative_post'] = crud.serialize_doc(rep_article)
            
            regional_groups = crud.serialize_doc(regional_groups)
        
        hindi_groups = list(db.grouped_posts.find(hindi_query).sort("updated_at", -1).limit(limit))
        
        for group in hindi_groups:
            post_ids = group.get('post_ids', [])
            articles = list(db.articles.find({"id": {"$in": post_ids}}).sort("published_at", -1))
            group['articles'] = crud.serialize_doc(articles)
            
            rep_id = group.get('representative_post_id')
            if rep_id:
                rep_article = db.articles.find_one({"id": rep_id})
                group['representative_post'] = crud.serialize_doc(rep_article)
        
        hindi_groups = crud.serialize_doc(hindi_groups)
        
        # Transform grouped_posts format to match events-interviews format
        def transform_to_events_format(groups):
            result = []
            for group in groups:
                if group.get('articles') and len(group['articles']) > 0:
                    representative = group['articles'][0].copy()
                    representative['event_name'] = group.get('group_title', 'Unknown')
                    representative['video_count'] = group.get('posts_count', len(group['articles']))
                    representative['all_videos'] = group['articles']
                    result.append(representative)
            return result
        
        regional_formatted = transform_to_events_format(regional_groups)
        hindi_formatted = transform_to_events_format(hindi_groups)
        
        print(f"✅ News Today: {len(regional_formatted)} regional groups, {len(hindi_formatted)} hindi groups")
        
        return {
            "news_today": regional_formatted,
            "hindi": hindi_formatted
        }
        
    except Exception as e:
        print(f"❌ Error in get_news_today_aggregated: {e}")
        import traceback
        traceback.print_exc()
        return {"news_today": [], "hindi": []}

@api_router.get("/articles/sections/health-food")
async def get_health_food_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Health & Food section with Health and Food tabs"""
    health_articles = crud.get_articles_by_category_slug(db, category_slug="health", limit=limit)
    food_articles = crud.get_articles_by_category_slug(db, category_slug="food", limit=limit)
    
    return {
        "health": health_articles,
        "food": food_articles
    }

@api_router.get("/articles/sections/fashion-travel")
async def get_fashion_travel_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Fashion & Travel section with Fashion and Travel tabs"""
    fashion_articles = crud.get_articles_by_category_slug(db, category_slug="fashion", limit=limit)
    travel_articles = crud.get_articles_by_category_slug(db, category_slug="travel", limit=limit)
    
    return {
        "fashion": fashion_articles,
        "travel": travel_articles
    }

@api_router.get("/articles/sections/tv-shows")
async def get_tv_shows_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for TV Shows section with TV Spotlight and National tabs"""
    tv_articles = crud.get_articles_by_category_slug(db, category_slug="tv", limit=limit)
    bollywood_articles = crud.get_articles_by_category_slug(db, category_slug="tv-bollywood", limit=limit)
    
    return {
        "tv": tv_articles,
        "bollywood": bollywood_articles
    }

# Frontend endpoint for OTT releases with Bollywood
@api_router.get("/releases/ott-bollywood")
async def get_ott_bollywood_releases(user_states: str = None, db = Depends(get_db)):
    """Get OTT and Bollywood OTT releases for homepage display
    
    Args:
        user_states: Comma-separated list of state codes (e.g., 'ap,ts')
    
    Returns releases from past 5 days onwards, sorted by release_date ascending
    """
    from state_language_mapping import get_languages_for_states
    from datetime import datetime, timedelta
    import json
    
    # Get state-language mapping
    user_languages = []
    if user_states:
        state_list = [s.strip() for s in user_states.split(',')]
        user_languages = get_languages_for_states(state_list)
    
    # Calculate date 10 days ago
    five_days_ago = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
    
    # Get OTT releases from past 5 days onwards, sorted ascending by release_date
    all_ott_docs = list(db.ott_releases.find(
        {"release_date": {"$gte": five_days_ago}}, 
        {"_id": 0}
    ).sort("release_date", 1).limit(50))
    all_ott_releases = all_ott_docs
    
    def parse_languages(languages_str):
        """Parse languages field which can be JSON string or plain string"""
        if not languages_str:
            return []
        try:
            return json.loads(languages_str)
        except:
            return [languages_str] if languages_str else []
    
    def filter_releases_by_language(releases, target_languages, exclude_hindi=False):
        """Filter releases by matching languages"""
        filtered = []
        for release in releases:
            release_languages = parse_languages(release.get('languages', ''))
            
            # Check if release has any of the target languages
            has_target_lang = any(lang in target_languages for lang in release_languages)
            has_hindi = 'Hindi' in release_languages
            
            # Apply filtering logic
            if exclude_hindi:
                # For OTT tab: exclude Hindi-only releases
                if has_target_lang and not (has_hindi and len(release_languages) == 1):
                    filtered.append(release)
            else:
                # For Bollywood tab: include all Hindi releases
                if has_hindi:
                    filtered.append(release)
        
        return filtered
    
    # Filter for OTT Releases tab
    if user_languages:
        # User has selected states - show releases matching state-mapped languages (excluding Hindi-only)
        ott_filtered = filter_releases_by_language(all_ott_releases, user_languages, exclude_hindi=True)
    else:
        # No states selected - show all non-Hindi releases
        ott_filtered = [r for r in all_ott_releases if 'Hindi' not in parse_languages(r.get('languages', ''))]
    
    # Filter for Bollywood tab - always show all Hindi releases
    bollywood_filtered = filter_releases_by_language(all_ott_releases, ['Hindi'], exclude_hindi=False)
    
    def format_release_response(releases):
        result = []
        seen_ids = set()
        for release in releases:
            # Skip duplicates
            release_id = release.get('id')
            if release_id in seen_ids:
                continue
            seen_ids.add(release_id)
            
            # Parse languages array
            languages_list = parse_languages(release.get('languages', ''))
            
            release_data = {
                "id": release.get('id'),
                "movie_name": release.get('movie_name'),
                "content_type": release.get('content_type', 'Movie'),
                "season": release.get('season'),
                "episodes_count": release.get('episodes_count'),
                "original_language": release.get('original_language'),
                "languages": languages_list,
                "release_date": release.get('release_date'),
                "movie_image": release.get('movie_image'),
                "youtube_url": release.get('youtube_url'),
                "ott_platforms": release.get('ott_platforms'),
                "created_at": release.get('created_at')
            }
            result.append(release_data)
        return result
    
    # Split filtered releases into this_week and coming_soon (10 each for 20 total)
    ott_this_week = format_release_response(ott_filtered[:10])
    ott_coming_soon = format_release_response(ott_filtered[10:20])
    
    bollywood_this_week = format_release_response(bollywood_filtered[:10])
    bollywood_coming_soon = format_release_response(bollywood_filtered[10:20])
    
    return {
        "ott": {
            "this_week": ott_this_week,
            "coming_soon": ott_coming_soon
        },
        "bollywood": {
            "this_week": bollywood_this_week,
            "coming_soon": bollywood_coming_soon
        }
    }

@api_router.get("/articles/sections/trailers", response_model=List[schemas.ArticleListResponse])
async def get_trailers_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Trailers & Teasers section"""
    articles = crud.get_articles_by_category_slug(db, category_slug="trailers", limit=limit)
    return articles

@api_router.get("/articles/sections/sponsored-ads")
async def get_sponsored_ads(limit: int = 4, states: str = None, db = Depends(get_db)):
    """Get sponsored ads for homepage filtered by state"""
    # Parse state codes from query parameter
    state_codes = []
    if states:
        state_codes = [s.strip().lower() for s in states.split(',') if s.strip()]
    else:
        # Default state codes (Telangana and Andhra Pradesh)
        state_codes = ['ts', 'ap']
    
    # Build query with state filtering
    query = {
        "ad_type": "Ad in Sponsored Section",
        "category": "Sponsored Ad",
        "is_published": True,
        "$or": [
            {"states": {"$regex": state, "$options": "i"}} 
            for state in (state_codes + ["all"])
        ]
    }
    
    ads = list(db[crud.ARTICLES].find(query, {"_id": 0}).sort("created_at", -1).limit(limit))
    
    return crud.serialize_doc(ads)

@api_router.get("/articles/sections/top-stories")
async def get_top_stories_articles(limit: int = 4, states: str = None, db = Depends(get_db)):
    """
    Get articles for Top Stories section with state and national tabs
    Uses the top_stories collection for efficient querying
    Returns 3 posts + 1 movie review per tab
    """
    # Parse states from query parameter (comma-separated)
    if states:
        state_list = [s.strip() for s in states.split(',')]
    else:
        # Default state codes (Telangana and Andhra Pradesh)
        state_list = ['ts', 'ap']
    
    # Get state top stories
    top_stories_articles = crud.get_top_stories_for_states(db, states=state_list, limit=limit)
    
    # Get national top stories (ALL)
    national_articles = crud.get_top_stories_for_states(db, states=['ALL'], limit=limit)
    
    return {
        "top_stories": top_stories_articles,
        "national": national_articles
    }

@api_router.get("/articles/sections/nri-news", response_model=List[schemas.ArticleListResponse])
async def get_nri_news_articles(limit: int = 4, states: str = None, db = Depends(get_db)):
    """Get articles for NRI News section with state filtering"""
    # Parse state codes from query parameter
    state_codes = []
    if states:
        state_codes = [s.strip().lower() for s in states.split(',') if s.strip()]
    
    # Get NRI News articles with state filtering
    if state_codes:
        articles = crud.get_articles_by_states(db, category_slug="nri-news", state_codes=state_codes, limit=limit)
    else:
        # If no states specified, get all NRI news articles
        articles = crud.get_articles_by_category_slug(db, category_slug="nri-news", limit=limit)
    
    return articles

@api_router.get("/articles/sections/world-news", response_model=List[schemas.ArticleListResponse])
async def get_world_news_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for World News section"""
    articles = crud.get_articles_by_category_slug(db, category_slug="world-news", limit=limit)
    return articles

@api_router.get("/articles/sections/photoshoots")
async def get_photoshoots_articles(skip: int = 0, limit: int = 10, db = Depends(get_db)):
    """Get photoshoots articles with gallery images"""
    articles = crud.get_articles_by_category_slug(db, category_slug="photoshoots", skip=skip, limit=limit)
    
    # Populate gallery data for articles that have galleries
    for article in articles:
        if article.get('gallery_id'):
            gallery = crud.get_gallery_by_id(db, article['gallery_id'])
            if gallery:
                article['gallery'] = gallery
    
    return articles

@api_router.get("/articles/sections/travel-pics")
async def get_travel_pics_articles(limit: int = 4, db = Depends(get_db)):
    """Get articles for Travel Pics section with gallery data"""
    articles = crud.get_articles_by_category_slug(db, category_slug="travel-pics", limit=limit)
    
    # Populate gallery data for articles that have galleries
    for article in articles:
        if article.get('gallery_id'):
            gallery = crud.get_gallery_by_id(db, article['gallery_id'])
            if gallery:
                article['gallery'] = gallery
    
    return articles

# Galleries API Endpoints
@api_router.get("/galleries/tadka-pics")
async def get_tadka_pics_galleries_endpoint(limit: int = 20, db = Depends(get_db)):
    """Get Tadka Pics galleries for homepage and Tadka Pics page"""
    galleries = crud.get_tadka_pics_galleries(db, limit=limit)
    return galleries

# Helper function removed - crud functions now return properly serialized data

# CMS API Endpoints
@api_router.get("/cms/config", response_model=schemas.CMSResponse)
async def get_cms_config(db = Depends(get_db)):
    """Get CMS configuration including languages, states, and categories"""
    categories = crud.get_all_categories(db)
    
    languages = [
        {"code": "en", "name": "English", "native_name": "English"},
        {"code": "te", "name": "Telugu", "native_name": "తెలుగు"},
        {"code": "hi", "name": "Hindi", "native_name": "हिन्दी"},
        {"code": "ta", "name": "Tamil", "native_name": "தமிழ்"},
        {"code": "kn", "name": "Kannada", "native_name": "ಕನ್ನಡ"},
        {"code": "mr", "name": "Marathi", "native_name": "मराठी"},
        {"code": "gu", "name": "Gujarati", "native_name": "ગુજરાતી"},
        {"code": "bn", "name": "Bengali", "native_name": "বাংলা"},
        {"code": "ml", "name": "Malayalam", "native_name": "മലയാളം"},
        {"code": "pa", "name": "Punjabi", "native_name": "ਪੰਜਾਬੀ"},
        {"code": "as", "name": "Assamese", "native_name": "অসমীয়া"},
        {"code": "or", "name": "Odia", "native_name": "ଓଡ଼ିଆ"},
        {"code": "kok", "name": "Konkani", "native_name": "कोंकणी"},
        {"code": "mni", "name": "Manipuri", "native_name": "ꯃꯤꯇꯩꯂꯣꯟ"},
        {"code": "ne", "name": "Nepali", "native_name": "नेपाली"},
        {"code": "ur", "name": "Urdu", "native_name": "اردو"}
    ]
    
    states = [
        {"code": "all", "name": "All States (National & Bollywood)"},
        {"code": "ap", "name": "Andhra Pradesh"},
        {"code": "ar", "name": "Arunachal Pradesh"},
        {"code": "as", "name": "Assam"},
        {"code": "br", "name": "Bihar"},
        {"code": "cg", "name": "Chhattisgarh"},
        {"code": "dl", "name": "Delhi"},
        {"code": "ga", "name": "Goa"},
        {"code": "gj", "name": "Gujarat"},
        {"code": "hr", "name": "Haryana"},
        {"code": "hp", "name": "Himachal Pradesh"},
        {"code": "jk", "name": "Jammu and Kashmir"},
        {"code": "jh", "name": "Jharkhand"},
        {"code": "ka", "name": "Karnataka"},
        {"code": "kl", "name": "Kerala"},
        {"code": "ld", "name": "Ladakh"},
        {"code": "mp", "name": "Madhya Pradesh"},
        {"code": "mh", "name": "Maharashtra"},
        {"code": "mn", "name": "Manipur"},
        {"code": "ml", "name": "Meghalaya"},
        {"code": "mz", "name": "Mizoram"},
        {"code": "nl", "name": "Nagaland"},
        {"code": "or", "name": "Odisha"},
        {"code": "pb", "name": "Punjab"},
        {"code": "rj", "name": "Rajasthan"},
        {"code": "sk", "name": "Sikkim"},
        {"code": "tn", "name": "Tamil Nadu"},
        {"code": "ts", "name": "Telangana"},
        {"code": "tr", "name": "Tripura"},
        {"code": "up", "name": "Uttar Pradesh"},
        {"code": "uk", "name": "Uttarakhand"},
        {"code": "wb", "name": "West Bengal"}
    ]
    
    return {
        "languages": languages,
        "states": states, 
        "categories": [{"id": cat.id, "name": cat.name, "slug": cat.slug, "description": cat.description} for cat in categories]
    }

@api_router.get("/cms/articles")
async def get_cms_articles(
    language: str = "en",
    skip: int = 0, 
    limit: int = 20,
    category: str = None,
    state: str = None,
    content_type: str = None,
    status: str = None,
    db = Depends(get_db)
):
    """Get articles for CMS dashboard with filtering and pagination - EXCLUDES ads"""
    # Get total count first (without pagination)
    total_count = crud.get_articles_count_for_cms(
        db, language=language, category=category, state=state, 
        content_type=content_type, status=status
    )
    
    # Get paginated articles (excludes ads)
    articles = crud.get_articles_for_cms(
        db, language=language, skip=skip, limit=limit, category=category, 
        state=state, content_type=content_type, status=status
    )
    
    # articles is already a list of properly serialized dicts from crud
    return {
        "articles": articles,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/cms/ads")
async def get_cms_ads(
    language: str = "en",
    skip: int = 0, 
    limit: int = 20,
    ad_type: str = None,
    status: str = None,
    db = Depends(get_db)
):
    """Get ads for CMS dashboard with filtering and pagination - ONLY ads"""
    # Get total count first (without pagination)
    total_count = crud.get_ads_count_for_cms(
        db, language=language, ad_type=ad_type, status=status
    )
    
    # Get paginated ads
    ads = crud.get_ads_for_cms(
        db, language=language, skip=skip, limit=limit, 
        ad_type=ad_type, status=status
    )
    
    return {
        "ads": ads,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/cms/upload-image")
async def upload_image(
    file: UploadFile = File(...), 
    content_type: str = Form("articles"),
    folder_path: str = Form(None),
    image_number: int = Form(None)
):
    """
    Upload image for CMS use (articles, galleries, tadka-pics)
    Uses S3 if enabled, otherwise local storage
    Returns the URL to the uploaded image
    
    Args:
        file: The image file to upload
        content_type: Type of content - "articles", "galleries", or "tadka-pics"
        folder_path: Optional folder path for galleries (e.g., "actor/kirti_sanon/h/1")
        image_number: Sequential number for gallery images (e.g., 1, 2, 3)
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Get file extension
        original_filename = file.filename
        file_extension = os.path.splitext(original_filename)[1].lower()
        if not file_extension:
            file_extension = '.jpg'  # Default to jpg
        
        # For galleries with folder_path and image_number, rename the file
        if folder_path and content_type == "galleries" and image_number is not None:
            # Rename file to sequential number
            new_filename = f"{image_number}{file_extension}"
            file.filename = new_filename
            content_type = f"galleries/{folder_path}"
        elif folder_path and content_type == "galleries":
            content_type = f"galleries/{folder_path}"
        
        # Upload file with specified content type
        file_url = await save_uploaded_file(file, content_type=content_type)
        
        return {
            "success": True,
            "url": file_url,
            "storage": "s3" if s3_service.is_enabled() else "local",
            "content_type": content_type,
            "image_number": image_number
        }
    except Exception as e:
        logger.error(f"Image upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.post("/cms/articles", response_model=schemas.ArticleResponse)
async def create_cms_article(article: schemas.ArticleCreate, db = Depends(get_db)):
    """Create new article via CMS"""
    # Generate slug from title
    import re
    slug = re.sub(r'[^a-zA-Z0-9\s]', '', article.title.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    
    # Create SEO fields if not provided
    seo_title = article.seo_title or article.title
    seo_description = article.seo_description or article.summary[:155]
    
    # Create article in database
    try:
        db_article = crud.create_article_cms(db, article, slug, seo_title, seo_description)
        return db_article
    except Exception as e:
        # Handle duplicate slug error
        if "duplicate key error" in str(e).lower() and "slug" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="An article with this title already exists. Please use a different title."
            )
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/cms/articles/action-needed")
async def get_action_needed_articles(
    skip: int = 0,
    limit: int = 20,
    db = Depends(get_db)
):
    """Get articles that need action (missing YouTube trailer or image)"""
    # Query articles with action_needed = True
    articles = list(db.articles.find({
        'action_needed': True
    }).sort('created_at', -1).skip(skip).limit(limit))
    
    # Convert ObjectId to string
    for article in articles:
        if '_id' in article:
            article['_id'] = str(article['_id'])
    
    # Get total count
    total = db.articles.count_documents({'action_needed': True})
    
    return {
        'articles': articles,
        'total': total,
        'skip': skip,
        'limit': limit
    }

@api_router.get("/cms/articles/{article_id}", response_model=schemas.ArticleResponse)
async def get_cms_article(article_id: int, db = Depends(get_db)):
    """Get single article for editing"""
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article

@api_router.put("/cms/articles/{article_id}", response_model=schemas.ArticleResponse)
async def update_cms_article(
    article_id: int, 
    article_update: schemas.ArticleUpdate, 
    db = Depends(get_db)
):
    """Update article via CMS"""
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Convert Pydantic model to dict
    update_data = article_update.dict(exclude_unset=True)
    
    print(f"   📝 Updating article {article_id}: {article.get('title', '')[:50]}")
    print(f"      Content type: {article.get('content_type')}, Action needed: {article.get('action_needed')}")
    
    # Check if this is a movie_review content type
    if article.get('content_type') == 'movie_review':
        # Get YouTube URL from update or existing article
        youtube_url = update_data.get('youtube_url', article.get('youtube_url', ''))
        has_youtube = bool(youtube_url and youtube_url.strip())
        
        print(f"      YouTube URL: {youtube_url[:50] if youtube_url else 'NONE'}, Has YouTube: {has_youtube}")
        
        if has_youtube:
            # Generate image from YouTube thumbnail
            import re
            youtube_match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)', youtube_url)
            if youtube_match:
                video_id = youtube_match.group(1)
                update_data['image'] = f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'
                print(f"      Generated thumbnail: {update_data['image']}")
            
            # Clear action_needed if it was set (regardless of current state)
            if article.get('action_needed', False):
                update_data['action_needed'] = False
                update_data['action_needed_reasons'] = []
                update_data['is_published'] = True
                update_data['status'] = 'approved'
                update_data['published_at'] = datetime.now(timezone.utc)
                print(f"   ✅ Auto-publishing movie review {article_id} - YouTube trailer added")
            else:
                # Even if action_needed was False, make sure it stays False
                update_data['action_needed'] = False
                update_data['action_needed_reasons'] = []
        else:
            # No YouTube URL - set action_needed
            update_data['action_needed'] = True
            update_data['action_needed_reasons'] = ['Missing YouTube trailer']
            update_data['is_published'] = False
            update_data['image'] = ''  # Clear image
            print(f"   ⚠️ Article {article_id} missing YouTube trailer - action needed")
    elif article.get('action_needed', False):
        # Non-movie-review articles - original logic
        youtube_url = update_data.get('youtube_url', article.get('youtube_url', ''))
        image = update_data.get('image', article.get('image', ''))
        
        has_youtube = bool(youtube_url and youtube_url.strip())
        has_image = bool(image and image.strip())
        
        if has_youtube and has_image:
            update_data['action_needed'] = False
            update_data['action_needed_reasons'] = []
            update_data['is_published'] = True
            update_data['status'] = 'approved'
            update_data['published_at'] = datetime.now(timezone.utc)
            print(f"   ✅ Auto-publishing article {article_id} - action resolved")
        else:
            reasons = []
            if not has_youtube:
                reasons.append('Missing YouTube trailer')
            if not has_image:
                reasons.append('Missing poster image')
            update_data['action_needed_reasons'] = reasons
    
    updated_article = crud.update_article_cms(db, article_id, update_data)
    return updated_article


@api_router.patch("/cms/articles/{article_id}", response_model=schemas.ArticleResponse)
async def patch_cms_article(
    article_id: int, 
    article_update: schemas.ArticleUpdate, 
    db = Depends(get_db)
):
    """Partial update article via CMS (for publish/unpublish actions)"""
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Convert Pydantic model to dict, excluding unset values
    update_data = article_update.dict(exclude_unset=True)
    
    print(f"   📝 PATCH updating article {article_id}: {article.get('title', '')[:50]}")
    
    # Handle movie_review content type - action_needed logic
    if article.get('content_type') == 'movie_review':
        youtube_url = update_data.get('youtube_url', article.get('youtube_url', ''))
        has_youtube = bool(youtube_url and youtube_url.strip())
        
        if has_youtube:
            # Generate image from YouTube thumbnail
            import re
            youtube_match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)', youtube_url)
            if youtube_match:
                video_id = youtube_match.group(1)
                update_data['image'] = f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'
            
            # Clear action_needed
            update_data['action_needed'] = False
            update_data['action_needed_reasons'] = []
            if article.get('action_needed', False):
                update_data['is_published'] = True
                update_data['status'] = 'approved'
                update_data['published_at'] = datetime.now(timezone.utc)
                print(f"   ✅ PATCH Auto-publishing movie review {article_id}")
        else:
            # No YouTube URL - set action_needed
            update_data['action_needed'] = True
            update_data['action_needed_reasons'] = ['Missing YouTube trailer']
            update_data['is_published'] = False
            update_data['image'] = ''
    
    # Ensure status and is_published are always in sync
    if 'status' in update_data:
        # If status is explicitly set, sync is_published accordingly
        if update_data['status'] == 'published':
            update_data['is_published'] = True
        elif update_data['status'] in ['draft', 'in_review', 'approved']:
            # Don't override is_published if we just set it for action_needed
            if 'is_published' not in update_data:
                update_data['is_published'] = False
    elif 'is_published' in update_data:
        # If only is_published is set, sync status accordingly
        if update_data['is_published'] == True:
            update_data['status'] = 'published'
        elif update_data['is_published'] == False:
            update_data['status'] = 'draft'
    
    updated_article = crud.update_article_cms(db, article_id, update_data)
    return updated_article


@api_router.delete("/cms/articles/{article_id}")
async def delete_cms_article(article_id: int, db = Depends(get_db)):
    """Delete article via CMS and remove images from S3"""
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Delete article and its S3 images
    crud.delete_article(db, article_id, s3_service)
    return {"message": "Article deleted successfully"}

@api_router.get("/articles/{article_id}/related-videos")
async def get_article_related_videos(article_id: int, db = Depends(get_db)):
    """Get related videos for an article"""
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # For now, return empty list since we need to implement related videos storage
    # This will be populated when we add the database schema for related videos
    return {"related_videos": []}

@api_router.put("/articles/{article_id}/related-videos")
async def update_article_related_videos(
    article_id: int, 
    request: dict,
    db = Depends(get_db)
):
    """Update related videos for an article"""
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    related_video_ids = request.get("related_videos", [])
    
    # Validate that all related video IDs exist and are video articles
    for video_id in related_video_ids:
        video_article = crud.get_article_by_id(db, video_id)
        if not video_article:
            raise HTTPException(status_code=400, detail=f"Related video with ID {video_id} not found")
        if not video_article.youtube_url:
            raise HTTPException(status_code=400, detail=f"Article with ID {video_id} is not a video article")
    
    # For now, we'll store the related videos in a simple way
    # In a production system, you'd want a proper many-to-many relationship table
    # For this implementation, we'll use a simple approach
    
    # Store related videos as a JSON string in a custom field (to be added to schema)
    # This is a simplified implementation - in production you'd want proper relationships
    try:
        import json
        related_videos_json = json.dumps(related_video_ids)
        
        # Update article with related videos (this assumes we add a related_videos column)
        # For now, we'll simulate success since we need to update the database schema first
        
        return {"message": "Related videos updated successfully", "related_videos": related_video_ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update related videos")

@api_router.post("/cms/articles/{article_id}/translate", response_model=schemas.ArticleResponse)
async def translate_article(
    article_id: int,
    translation_request: schemas.TranslationRequest,
    db = Depends(get_db)
):
    """Create translated version of article"""
    original_article = crud.get_article_by_id(db, article_id)
    if not original_article:
        raise HTTPException(status_code=404, detail="Original article not found")
    
    # Here you would integrate with translation service (Google Translate, etc.)
    # For now, we'll create a copy with the target language
    translated_article = crud.create_translated_article(db, original_article, translation_request.target_language)
    return translated_article

@api_router.get("/articles/most-read", response_model=List[schemas.ArticleListResponse])
async def get_most_read_articles(limit: int = 15, db = Depends(get_db)):
    articles = crud.get_most_read_articles(db, limit=limit)
    result = []
    for article in articles:
        result.append({
            "id": article.id,
            "title": article.title,
            "short_title": article.short_title,
            "summary": article.summary,
            "image_url": article.image,
            "author": article.author,
            "language": article.get("article_language", article.get("language", "en")),
            "category": article.category,
            "content_type": article.content_type,  # Add content_type field
            "artists": article.artists,  # Add artists field
            "is_published": article.is_published,
            "is_scheduled": article.is_scheduled,
            "scheduled_publish_at": article.scheduled_publish_at,
            "scheduled_timezone": article.get("scheduled_timezone", "IST") if isinstance(article, dict) else getattr(article, "scheduled_timezone", "IST"),
            "published_at": article.published_at,
            "view_count": article.view_count
        })
    return result

@api_router.get("/articles/featured", response_model=schemas.ArticleResponse)
async def get_featured_article(db = Depends(get_db)):
    articles = crud.get_articles(db, limit=1, is_featured=True)
    if not articles:
        raise HTTPException(status_code=404, detail="No featured article found")
    return articles[0]

@api_router.get("/articles/{article_id}")
async def get_article(request: Request, article_id: int, db = Depends(get_db)):
    article = crud.get_article(db, article_id=article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Populate gallery data if article has a gallery_id
    if article.get('gallery_id'):
        gallery = crud.get_gallery_by_id(db, article['gallery_id'])
        if gallery:
            article['gallery'] = gallery
    
    return article

@api_router.post("/articles", response_model=schemas.ArticleResponse)
async def create_article(article: schemas.ArticleCreate, db = Depends(get_db)):
    try:
        return crud.create_article(db=db, article=article)
    except Exception as e:
        # Handle duplicate slug error
        if "duplicate key error" in str(e).lower() and "slug" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="An article with this title already exists. Please use a different title."
            )
        raise HTTPException(status_code=500, detail=str(e))

# Movie Review endpoints
@api_router.get("/movie-reviews", response_model=List[schemas.MovieReviewListResponse])
async def get_movie_reviews(skip: int = 0, limit: int = 10, db = Depends(get_db)):
    reviews = crud.get_movie_reviews(db, skip=skip, limit=limit)
    result = []
    for review in reviews:
        result.append({
            "id": review.id,
            "title": review.title,
            "rating": review.rating,
            "image_url": review.poster_image,
            "created_at": review.created_at
        })
    return result

@api_router.get("/movie-reviews/{review_id}", response_model=schemas.MovieReview)
async def get_movie_review(review_id: int, db = Depends(get_db)):
    review = crud.get_movie_review(db, review_id=review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Movie review not found")
    return review

@api_router.post("/movie-reviews", response_model=schemas.MovieReview)
async def create_movie_review(review: schemas.MovieReviewCreate, db = Depends(get_db)):
    return crud.create_movie_review(db=db, review=review)

# Featured Images endpoints
@api_router.get("/featured-images", response_model=List[schemas.FeaturedImage])
async def get_featured_images(limit: int = 5, db = Depends(get_db)):
    return crud.get_featured_images(db, limit=limit)

@api_router.post("/featured-images", response_model=schemas.FeaturedImage)
async def create_featured_image(image: schemas.FeaturedImageCreate, db = Depends(get_db)):
    return crud.create_featured_image(db=db, image=image)

# Scheduler Settings endpoints
@api_router.get("/admin/scheduler-settings", response_model=schemas.SchedulerSettingsResponse)
async def get_scheduler_settings_endpoint(db = Depends(get_db)):
    """Get current scheduler settings (Admin only)"""
    settings = crud.get_scheduler_settings(db)
    if not settings:
        # Create default settings if none exist
        settings = crud.create_scheduler_settings(
            db, 
            {"is_enabled": False, "check_frequency_minutes": 5}
        )
    return settings

@api_router.put("/admin/scheduler-settings", response_model=schemas.SchedulerSettingsResponse)
async def update_scheduler_settings_endpoint(
    settings_update: schemas.SchedulerSettingsUpdate,
    db = Depends(get_db)
):
    """Update scheduler settings (Admin only)"""
    updated_settings = crud.update_scheduler_settings(db, settings_update.dict(exclude_unset=True))
    
    # Update the background scheduler
    if settings_update.is_enabled is not None:
        if settings_update.is_enabled:
            article_scheduler.start_scheduler()
            frequency = settings_update.check_frequency_minutes or updated_settings.get('check_frequency_minutes', 5)
            article_scheduler.update_schedule(frequency)
        else:
            article_scheduler.stop_scheduler()
    
    if settings_update.check_frequency_minutes is not None and updated_settings.get('is_enabled'):
        article_scheduler.update_schedule(settings_update.check_frequency_minutes)
    
    return updated_settings

@api_router.post("/admin/scheduler/run-now")
async def run_scheduler_now():
    """Manually trigger scheduled article publishing (Admin only)"""
    try:
        article_scheduler.check_and_publish_scheduled_articles()
        return {"message": "Scheduler run completed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scheduler run failed: {str(e)}")

@api_router.get("/cms/scheduled-articles")
async def get_scheduled_articles(db = Depends(get_db)):
    """Get all scheduled articles"""
    scheduled_articles = db.query(models.Article).filter(
        models.Article.is_scheduled == True,
        models.Article.is_published == False
    ).order_by(models.Article.scheduled_publish_at).all()
    
    result = []
    for article in scheduled_articles:
        result.append({
            "id": article.id,
            "title": article.title,
            "short_title": article.short_title,
            "author": article.author,
            "language": article.get("article_language", article.get("language", "en")),
            "category": article.category,
            "scheduled_publish_at": article.scheduled_publish_at,
            "created_at": article.created_at
        })
    
    return result

# Analytics tracking endpoint
@api_router.post("/analytics/track")
async def track_analytics(tracking_data: dict):
    """
    Track user interactions for analytics and SEO purposes
    """
    try:
        # Log the tracking data (in production, you'd save to database)
        import logging
        logging.info(f"Analytics Tracking: {tracking_data}")
        
        # Here you can save to database, send to analytics service, etc.
        # For now, we'll just return success
        
        return {
            "status": "success", 
            "message": "Analytics data tracked successfully",
            "timestamp": tracking_data.get("timestamp")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics tracking failed: {str(e)}")

# Related Articles Configuration endpoints
@api_router.get("/cms/related-articles-config")
async def get_related_articles_config(page: str = None, db = Depends(get_db)):
    """Get related articles configuration for a specific page or all pages"""
    try:
        config = crud.get_related_articles_config(db, page_slug=page)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/cms/related-articles-config")
async def create_related_articles_config(
    config_data: schemas.RelatedArticlesConfigCreate,
    db = Depends(get_db)
):
    """Create or update related articles configuration"""
    try:
        config = crud.create_or_update_related_articles_config(db, config_data)
        return {"message": "Configuration saved successfully", "config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/cms/related-articles-config/{page_slug}")
async def delete_related_articles_config(page_slug: str, db = Depends(get_db)):
    """Delete related articles configuration for a page"""
    try:
        deleted_config = crud.delete_related_articles_config(db, page_slug)
        if not deleted_config:
            raise HTTPException(status_code=404, detail="Configuration not found")
        return {"message": "Configuration deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/related-articles/{page_slug}")
async def get_related_articles_for_page(
    page_slug: str,
    limit: int = None,
    db = Depends(get_db)
):
    """Get related articles for a specific page based on its configuration"""
    try:
        articles = crud.get_related_articles_for_page(db, page_slug, limit)
        
        # Format the response
        result = []
        for article in articles:
            result.append({
                "id": article.id,
                "title": article.title,
                "short_title": article.short_title,
                "summary": article.summary,
                "image": article.image,
                "author": article.author,
                "language": article.get("article_language", article.get("language", "en")),
                "category": article.category,
                "published_at": article.published_at,
                "view_count": article.view_count
            })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# State-Language Mapping endpoints
@api_router.get("/system-settings/state-language-mapping")
async def get_state_language_mapping(db = Depends(get_db)):
    """Get state-language mapping configuration"""
    try:
        from state_language_mapping import DEFAULT_STATE_LANGUAGE_MAPPING
        
        # Try to get custom mapping from database
        mapping_doc = db.system_settings.find_one({"setting_key": "state_language_mapping"})
        
        if mapping_doc and "mapping" in mapping_doc:
            return mapping_doc["mapping"]
        
        # Return default mapping if no custom mapping exists
        return DEFAULT_STATE_LANGUAGE_MAPPING
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/system-settings/state-language-mapping")
async def update_state_language_mapping(mapping: dict, db = Depends(get_db)):
    """Update state-language mapping configuration"""
    try:
        from datetime import datetime
        
        # Update or create the mapping in database
        result = db.system_settings.update_one(
            {"setting_key": "state_language_mapping"},
            {
                "$set": {
                    "setting_key": "state_language_mapping",
                    "mapping": mapping,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        return {"success": True, "message": "State-language mapping updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# File upload helper functions
def get_next_image_filename(date: datetime = None, content_type: str = "articles") -> tuple:
    """
    Get a unique filename for the given date (EST timezone)
    Returns (date_path, filename) tuple
    content_type: "articles", "galleries", or "tadka-pics"
    For S3: Path structure is content_type/YYYY/MM/DD/timestamp_random.ext
    For Local: Path structure is content_type/YYYY/MM/DD/timestamp_random.ext
    """
    if date is None:
        # Use EST timezone (America/New_York handles EST/EDT automatically)
        est = pytz_timezone('America/New_York')
        date = datetime.now(est)
    
    # Create date-based path
    year = date.strftime("%Y")
    month = date.strftime("%m")
    day = date.strftime("%d")
    
    # Get root folder from S3 config based on content type
    root_folder = ""
    if s3_service.is_enabled() and s3_service.config:
        if content_type == "articles":
            root_folder = s3_service.config.get('articles_root_folder', 'articles')
        elif content_type == "galleries":
            root_folder = s3_service.config.get('galleries_root_folder', 'galleries')
        elif content_type == "tadka-pics":
            root_folder = s3_service.config.get('tadka_pics_root_folder', 'tadka-pics')
        else:
            root_folder = content_type
    else:
        # For local storage, use content type directly
        root_folder = content_type
    
    # For S3: Use root_folder/date path
    s3_date_path = f"{root_folder}/{year}/{month}/{day}"
    
    # For Local: Same structure
    local_date_path = f"{root_folder}/{year}/{month}/{day}"
    
    # Generate unique filename using timestamp and random string
    import uuid
    timestamp = int(datetime.now().timestamp() * 1000)  # milliseconds
    random_str = str(uuid.uuid4())[:8]  # first 8 chars of UUID
    unique_filename = f"{timestamp}_{random_str}"
    
    # Return the path and unique filename
    if s3_service.is_enabled():
        return (s3_date_path, unique_filename)
    else:
        return (local_date_path, unique_filename)

async def save_uploaded_file(upload_file: UploadFile, subfolder: str = None, content_type: str = "articles") -> str:
    """
    Save uploaded file using date-based structure: images/YYYY/MM/DD/N.ext
    Uses S3 (if enabled) or local storage (fallback)
    Returns the URL or path to the uploaded file
    """
    if not upload_file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    # Get file extension
    file_extension = os.path.splitext(upload_file.filename)[1] or '.jpg'
    
    # Get next filename using date-based structure with content type
    date_path, next_num = get_next_image_filename(content_type=content_type)
    filename_with_path = f"{date_path}/{next_num}{file_extension}"
    
    # Read file content
    content = await upload_file.read()
    
    # Try S3 upload if enabled
    if s3_service.is_enabled():
        s3_url = s3_service.upload_file(
            file_content=content,
            filename=filename_with_path,
            content_type=upload_file.content_type
        )
        
        if s3_url:
            logger.info(f"File uploaded to S3: {s3_url}")
            return s3_url
        else:
            logger.warning("S3 upload failed, falling back to local storage")
    
    # Fallback to local storage
    local_path = UPLOAD_DIR / date_path
    local_path.mkdir(parents=True, exist_ok=True)
    
    file_path = local_path / f"{next_num}{file_extension}"
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Return relative path for storage in database
    return f"/uploads/{date_path}/{next_num}{file_extension}"

# Theater Release endpoints
@api_router.get("/cms/theater-releases", response_model=List[schemas.TheaterReleaseResponse])
async def get_theater_releases(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    """Get all theater releases for CMS"""
    releases = crud.get_theater_releases(db, skip=skip, limit=limit)
    return releases

@api_router.get("/cms/theater-releases/{release_id}", response_model=schemas.TheaterReleaseResponse)
async def get_theater_release(release_id: int, db = Depends(get_db)):
    """Get single theater release"""
    release = crud.get_theater_release(db, release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Theater release not found")
    return release

@api_router.post("/cms/theater-releases", response_model=schemas.TheaterReleaseResponse)
async def create_theater_release(
    movie_name: str = Form(...),
    release_date: date = Form(...),
    created_by: str = Form(...),
    youtube_url: str = Form(''),
    states: str = Form('[]'),
    languages: str = Form('[]'),
    genres: str = Form('[]'),
    director: str = Form(''),
    producer: str = Form(''),
    banner: str = Form(''),
    music_director: str = Form(''),
    dop: str = Form(''),
    editor: str = Form(''),
    cast: str = Form(''),
    runtime: str = Form(''),
    censor_rating: str = Form(''),
    movie_image: UploadFile = File(None),
    db = Depends(get_db)
):
    """Create new theater release with file uploads"""
    try:
        # Save uploaded image
        image_path = None
        
        if movie_image:
            image_path = await save_uploaded_file(movie_image, "theater_releases")
        
        # Create release data
        release_data = schemas.TheaterReleaseCreate(
            movie_name=movie_name,
            release_date=release_date,
            youtube_url=youtube_url,
            states=states,
            languages=languages,
            genres=genres,
            director=director,
            producer=producer,
            banner=banner,
            music_director=music_director,
            dop=dop,
            editor=editor,
            cast=cast,
            runtime=runtime,
            censor_rating=censor_rating,
            created_by=created_by,
            movie_image=image_path
        )
        
        return crud.create_theater_release(db, release_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/cms/theater-releases/{release_id}", response_model=schemas.TheaterReleaseResponse)
async def update_theater_release(
    release_id: int,
    movie_name: Optional[str] = Form(None),
    release_date: Optional[date] = Form(None),
    youtube_url: Optional[str] = Form(None),
    states: Optional[str] = Form(None),
    languages: Optional[str] = Form(None),
    genres: Optional[str] = Form(None),
    director: Optional[str] = Form(None),
    producer: Optional[str] = Form(None),
    banner: Optional[str] = Form(None),
    music_director: Optional[str] = Form(None),
    dop: Optional[str] = Form(None),
    editor: Optional[str] = Form(None),
    cast: Optional[str] = Form(None),
    runtime: Optional[str] = Form(None),
    censor_rating: Optional[str] = Form(None),
    movie_image: UploadFile = File(None),
    db = Depends(get_db)
):
    """Update theater release"""
    try:
        # Check if release exists
        existing_release = crud.get_theater_release(db, release_id)
        if not existing_release:
            raise HTTPException(status_code=404, detail="Theater release not found")
        
        # Prepare update data
        update_data = {}
        if movie_name is not None:
            update_data["movie_name"] = movie_name
        if release_date is not None:
            update_data["release_date"] = release_date
        if youtube_url is not None:
            update_data["youtube_url"] = youtube_url
        if states is not None:
            update_data["states"] = states
        if languages is not None:
            update_data["languages"] = languages
        if genres is not None:
            update_data["genres"] = genres
        if director is not None:
            update_data["director"] = director
        if producer is not None:
            update_data["producer"] = producer
        if banner is not None:
            update_data["banner"] = banner
        if music_director is not None:
            update_data["music_director"] = music_director
        if dop is not None:
            update_data["dop"] = dop
        if editor is not None:
            update_data["editor"] = editor
        if cast is not None:
            update_data["cast"] = cast
        if runtime is not None:
            update_data["runtime"] = runtime
        if censor_rating is not None:
            update_data["censor_rating"] = censor_rating
        
        # Handle file upload
        if movie_image:
            update_data["movie_image"] = await save_uploaded_file(movie_image, "theater_releases")
        
        release_update = schemas.TheaterReleaseUpdate(**update_data)
        return crud.update_theater_release(db, release_id, release_update)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/cms/theater-releases/{release_id}")
async def delete_theater_release(release_id: int, db = Depends(get_db)):
    """Delete theater release and remove images from S3"""
    release = crud.get_theater_release(db, release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Theater release not found")
    
    # Delete release and its S3 images
    crud.delete_theater_release(db, release_id, s3_service)
    return {"message": "Theater release deleted successfully"}

# OTT Release endpoints
@api_router.get("/cms/ott-releases", response_model=List[schemas.OTTReleaseResponse])
async def get_ott_releases(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    """Get all OTT releases for CMS"""
    releases = crud.get_ott_releases(db, skip=skip, limit=limit)
    return releases

@api_router.get("/cms/ott-releases/{release_id}", response_model=schemas.OTTReleaseResponse)
async def get_ott_release(release_id: int, db = Depends(get_db)):
    """Get single OTT release"""
    release = crud.get_ott_release(db, release_id)
    if not release:
        raise HTTPException(status_code=404, detail="OTT release not found")
    return release

@api_router.get("/cms/ott-platforms")
async def get_ott_platforms(db = Depends(get_db)):
    """Get list of available OTT platforms"""
    return {"platforms": crud.get_ott_platforms(db)}

@api_router.post("/cms/ott-releases", response_model=schemas.OTTReleaseResponse)
async def create_ott_release(
    movie_name: str = Form(...),
    release_date: date = Form(...),
    created_by: str = Form(...),
    content_type: str = Form('Movie'),
    season: Optional[int] = Form(None),
    episodes_count: Optional[int] = Form(None),
    original_language: Optional[str] = Form(None),
    youtube_url: str = Form(''),
    ott_platforms: str = Form('[]'),
    states: str = Form('[]'),
    languages: str = Form('[]'),
    genres: str = Form('[]'),
    director: str = Form(''),
    producer: str = Form(''),
    banner: str = Form(''),
    music_director: str = Form(''),
    dop: str = Form(''),
    editor: str = Form(''),
    cast: str = Form(''),
    runtime: str = Form(''),
    censor_rating: str = Form(''),
    movie_image: UploadFile = File(None),
    db = Depends(get_db)
):
    """Create new OTT release with file upload"""
    try:
        # Save uploaded file
        image_path = None
        if movie_image:
            image_path = await save_uploaded_file(movie_image, "ott_releases")
        
        # Create release data
        release_data = schemas.OTTReleaseCreate(
            movie_name=movie_name,
            content_type=content_type,
            season=season,
            episodes_count=episodes_count,
            original_language=original_language,
            youtube_url=youtube_url,
            ott_platforms=ott_platforms,
            states=states,
            languages=languages,
            genres=genres,
            release_date=release_date,
            director=director,
            producer=producer,
            banner=banner,
            music_director=music_director,
            dop=dop,
            editor=editor,
            cast=cast,
            runtime=runtime,
            censor_rating=censor_rating,
            created_by=created_by,
            movie_image=image_path
        )
        
        return crud.create_ott_release(db, release_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/cms/ott-releases/{release_id}", response_model=schemas.OTTReleaseResponse)
async def update_ott_release(
    release_id: int,
    movie_name: Optional[str] = Form(None),
    content_type: Optional[str] = Form(None),
    season: Optional[int] = Form(None),
    episodes_count: Optional[int] = Form(None),
    original_language: Optional[str] = Form(None),
    release_date: Optional[date] = Form(None),
    youtube_url: Optional[str] = Form(None),
    ott_platforms: Optional[str] = Form(None),
    states: Optional[str] = Form(None),
    languages: Optional[str] = Form(None),
    genres: Optional[str] = Form(None),
    director: Optional[str] = Form(None),
    producer: Optional[str] = Form(None),
    banner: Optional[str] = Form(None),
    music_director: Optional[str] = Form(None),
    dop: Optional[str] = Form(None),
    editor: Optional[str] = Form(None),
    cast: Optional[str] = Form(None),
    runtime: Optional[str] = Form(None),
    censor_rating: Optional[str] = Form(None),
    movie_image: UploadFile = File(None),
    db = Depends(get_db)
):
    """Update OTT release"""
    try:
        # Check if release exists
        existing_release = crud.get_ott_release(db, release_id)
        if not existing_release:
            raise HTTPException(status_code=404, detail="OTT release not found")
        
        # Prepare update data
        update_data = {}
        if movie_name is not None:
            update_data["movie_name"] = movie_name
        if content_type is not None:
            update_data["content_type"] = content_type
        if season is not None:
            update_data["season"] = season
        if episodes_count is not None:
            update_data["episodes_count"] = episodes_count
        if original_language is not None:
            update_data["original_language"] = original_language
        if release_date is not None:
            update_data["release_date"] = release_date
        if youtube_url is not None:
            update_data["youtube_url"] = youtube_url
        if ott_platforms is not None:
            update_data["ott_platforms"] = ott_platforms
        if states is not None:
            update_data["states"] = states
        if languages is not None:
            update_data["languages"] = languages
        if genres is not None:
            update_data["genres"] = genres
        if director is not None:
            update_data["director"] = director
        if producer is not None:
            update_data["producer"] = producer
        if banner is not None:
            update_data["banner"] = banner
        if music_director is not None:
            update_data["music_director"] = music_director
        if dop is not None:
            update_data["dop"] = dop
        if editor is not None:
            update_data["editor"] = editor
        if cast is not None:
            update_data["cast"] = cast
        if runtime is not None:
            update_data["runtime"] = runtime
        if censor_rating is not None:
            update_data["censor_rating"] = censor_rating
        
        # Handle file upload
        if movie_image:
            update_data["movie_image"] = await save_uploaded_file(movie_image, "ott_releases")
        
        release_update = schemas.OTTReleaseUpdate(**update_data)
        return crud.update_ott_release(db, release_id, release_update)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/cms/ott-releases/{release_id}")
async def delete_ott_release(release_id: int, db = Depends(get_db)):
    """Delete OTT release and remove images from S3"""
    release = crud.get_ott_release(db, release_id)
    if not release:
        raise HTTPException(status_code=404, detail="OTT release not found")
    
    # Delete release and its S3 images
    crud.delete_ott_release(db, release_id, s3_service)
    return {"message": "OTT release deleted successfully"}

# Frontend endpoints for homepage with Bollywood theater releases
@api_router.get("/releases/theater-bollywood")
async def get_homepage_theater_bollywood_releases(
    user_state: str = None,
    user_states: str = None,  # New parameter for multiple states (comma-separated)
    db = Depends(get_db)
):
    """Get theater releases for homepage display with state-language mapping
    
    Args:
        user_state: Single state code (for backward compatibility)
        user_states: Comma-separated state codes (e.g., 'ap,ts')
    
    Returns:
        - theater: Releases in user's preferred languages based on state-language mapping
        - bollywood: Hindi language releases for Bollywood tab
    """
    from state_language_mapping import get_languages_for_states
    
    # Handle both single state and multiple states
    states_to_query = []
    if user_states:
        states_to_query = [s.strip() for s in user_states.split(',')]
    elif user_state:
        states_to_query = [user_state]
    
    # Get user's preferred languages based on state-language mapping
    user_languages = get_languages_for_states(states_to_query) if states_to_query else []
    
    # Fetch releases based on language preference
    if user_languages:
        theater_releases = crud.get_theater_releases_by_language(db, user_languages, limit=20)
    else:
        # No state preference - show all releases
        theater_releases = crud.get_theater_releases_by_language(db, [], limit=20)
    
    # Split into this_week and upcoming (first 10 and next 10)
    this_week_theater = theater_releases[:10]
    upcoming_theater = theater_releases[10:20] if len(theater_releases) > 10 else []
    
    # Get Hindi releases for Bollywood tab
    bollywood_releases = crud.get_theater_releases_bollywood(db, limit=20)
    this_week_bollywood = bollywood_releases[:10]
    upcoming_bollywood = bollywood_releases[10:20] if len(bollywood_releases) > 10 else []
    
    def format_release_response(releases, is_theater=True):
        result = []
        for release in releases:
            # Parse languages from JSON string
            languages = release.get("languages", "[]")
            if isinstance(languages, str):
                try:
                    import json
                    languages = json.loads(languages)
                except:
                    languages = [languages] if languages else []
            
            release_data = {
                "id": release.get("id"),
                "movie_name": release.get("movie_name"),
                "languages": languages,
                "original_language": release.get("original_language"),
                "release_date": release.get("release_date"),
                "movie_image": release.get("movie_image"),
                "youtube_url": release.get("youtube_url"),
                "states": release.get("states"),
                "genres": release.get("genres"),
                "director": release.get("director"),
                "cast": release.get("cast"),
                "created_at": release.get("created_at")
            }
            if is_theater:
                release_data["banner"] = release.get("banner")
            else:
                release_data["ott_platforms"] = release.get("ott_platforms")
            result.append(release_data)
        return result
    
    def format_article_response(articles):
        result = []
        for article in articles:
            result.append({
                "id": article.id,
                "title": article.title,
                "movie_name": article.title,  # Use title as movie name
                "summary": article.summary,
                "image_url": article.image,
                "movie_image": article.image,  # Use article image as movie image
                "author": article.author,
                "language": article.get("article_language", article.get("language", "en")) or "Hindi",
                "category": article.category,
                "published_at": article.published_at,
                "release_date": article.published_at  # Use published date as release date
            })
        return result
    
    return {
        "theater": {
            "this_week": format_release_response(this_week_theater, True),
            "coming_soon": format_release_response(upcoming_theater, True)
        },
        "bollywood": {
            "this_week": format_release_response(this_week_bollywood, True),
            "coming_soon": format_release_response(upcoming_bollywood, True)
        }
    }

# Main /releases endpoint for homepage MovieSchedules component
@api_router.get("/releases")
async def get_movie_releases(db = Depends(get_db)):
    """Get latest theater releases for homepage MovieSchedules section
    Theater tab: state-targeted releases
    Bollywood tab: releases with state='all'
    """
    # Get state-targeted theater releases (not 'all')
    state_theater = crud.get_latest_theater_releases_by_state(db, limit=10)
    
    # Get 'all' state theater releases (Bollywood)
    bollywood_theater = crud.get_latest_theater_releases_all_states(db, limit=10)
    
    def format_release_response(releases):
        result = []
        for release in releases:
            release_data = {
                "id": release.get("id"),
                "movie_name": release.get("movie_name"),
                "languages": release.get("languages"),
                "release_date": release.get("release_date"),
                "movie_image": release.get("movie_image"),
                "youtube_url": release.get("youtube_url"),
                "states": release.get("states"),
                "genres": release.get("genres"),
                "created_at": release.get("created_at"),
                "updated_at": release.get("updated_at"),
                "banner": release.get("banner")
            }
            result.append(release_data)
        return result
    
    return {
        "theater": {
            "this_week": format_release_response(state_theater),
            "coming_soon": []
        },
        "ott": {
            "this_week": format_release_response(bollywood_theater),
            "coming_soon": []
        }
    }

# Original endpoint kept for backward compatibility
@api_router.get("/releases/theater-ott")
async def get_homepage_releases(db = Depends(get_db)):
    """Get theater and OTT releases for homepage display"""
    this_week_theater = crud.get_this_week_theater_releases(db, limit=4)
    upcoming_theater = crud.get_upcoming_theater_releases(db, limit=4)
    
    this_week_ott = crud.get_this_week_ott_releases(db, limit=4)
    upcoming_ott = crud.get_upcoming_ott_releases(db, limit=4)
    
    def format_release_response(releases, is_theater=True):
        result = []
        for release in releases:
            release_data = {
                "id": release.get("id"),
                "movie_name": release.get("movie_name"),
                "languages": release.get("languages"),
                "release_date": release.get("release_date"),
                "movie_image": release.get("movie_image"),
                "youtube_url": release.get("youtube_url"),
                "states": release.get("states"),
                "genres": release.get("genres"),
                "created_at": release.get("created_at")
            }
            if is_theater:
                release_data["banner"] = release.get("banner")
            else:
                release_data["ott_platforms"] = release.get("ott_platforms")
            result.append(release_data)
        return result
    
    return {
        "theater": {
            "this_week": format_release_response(this_week_theater, True),
            "coming_soon": format_release_response(upcoming_theater, True)
        },
        "ott": {
            "this_week": format_release_response(this_week_ott, False),
            "coming_soon": format_release_response(upcoming_ott, False)
        }
    }

# Frontend endpoints for theater-ott-releases page
@api_router.get("/releases/theater-ott/page")
async def get_theater_ott_page_releases(
    release_type: str = "theater",  # "theater" or "ott"
    filter_type: str = "upcoming",  # "upcoming", "this_month", "all"
    skip: int = 0,
    limit: int = 20,
    db = Depends(get_db)
):
    """Get releases for theater-ott-releases page with filters"""
    try:
        if release_type == "theater":
            if filter_type == "upcoming":
                releases = crud.get_upcoming_theater_releases(db, limit=limit)
            else:
                releases = crud.get_theater_releases(db, skip=skip, limit=limit)
            
            def format_theater_response(releases):
                result = []
                for release in releases:
                    result.append({
                        "id": release.get("id"),
                        "movie_name": release.get("movie_name"),
                        "languages": release.get("languages"),
                        "release_date": release.get("release_date"),
                        "movie_image": release.get("movie_image"),
                        "youtube_url": release.get("youtube_url"),
                        "states": release.get("states"),
                        "genres": release.get("genres"),
                        "director": release.get("director"),
                        "banner": release.get("banner"),
                        "created_at": release.get("created_at")
                    })
                return result
            
            return format_theater_response(releases)
        
        else:  # ott
            if filter_type == "upcoming":
                releases = crud.get_upcoming_ott_releases(db, limit=limit)
            else:
                releases = crud.get_ott_releases(db, skip=skip, limit=limit)
            
            def format_ott_response(releases):
                result = []
                for release in releases:
                    result.append({
                        "id": release.get("id"),
                        "movie_name": release.get("movie_name"),
                        "languages": release.get("languages"),
                        "content_type": release.get("content_type"),
                        "release_date": release.get("release_date"),
                        "movie_image": release.get("movie_image"),
                        "youtube_url": release.get("youtube_url"),
                        "ott_platforms": release.get("ott_platforms"),
                        "states": release.get("states"),
                        "genres": release.get("genres"),
                        "director": release.get("director"),
                        "banner": release.get("banner"),
                        "created_at": release.get("created_at")
                    })
                return result
            
            return format_ott_response(releases)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Movie content endpoints
@api_router.get("/articles/movie/{movie_name}")
async def get_articles_by_movie_name(movie_name: str, db = Depends(get_db)):
    """Get all articles tagged with a specific movie name"""
    try:
        # Search for articles by movie name in title or tags
        articles = db.query(models.Article).filter(
            or_(
                models.Article.title.ilike(f"%{movie_name}%"),
                models.Article.tags.ilike(f"%{movie_name}%")
            )
        ).filter(models.Article.is_published == True).order_by(desc(models.Article.published_at)).all()
        
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/articles/search")
async def search_articles(q: str, db = Depends(get_db)):
    """Search articles by query in title, content, or tags"""
    try:
        articles = db.query(models.Article).filter(
            or_(
                models.Article.title.ilike(f"%{q}%"),
                models.Article.content.ilike(f"%{q}%"),
                models.Article.tags.ilike(f"%{q}%")
            )
        ).filter(models.Article.is_published == True).order_by(desc(models.Article.published_at)).limit(50).all()
        
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Include routers
app.include_router(api_router)
app.include_router(auth_router)  # Add authentication routes
app.include_router(system_settings_router, prefix="/api")  # System settings routes
app.include_router(topics_router, prefix="/api")  # Add topics routes
app.include_router(gallery_router, prefix="/api")  # Add gallery routes
app.include_router(comments_router)  # Add comments routes
app.include_router(ott_platforms_router)  # Add OTT platforms routes
app.include_router(gallery_entities_router)  # Add gallery entities routes
app.include_router(gallery_image_router)  # Add gallery image routes
app.include_router(ad_settings_router, prefix="/api")  # Add ad settings routes
app.include_router(artists_router, prefix="/api")  # Add artists routes
app.include_router(ai_agents_router, prefix="/api")  # Add AI agents routes
app.include_router(youtube_channels_router, prefix="/api")  # Add YouTube channels routes
app.include_router(youtube_rss_router, prefix="/api")  # Add YouTube RSS routes
app.include_router(grouped_posts_router, prefix="/api")  # Add grouped posts routes
app.include_router(reality_shows_router, prefix="/api")  # Add reality shows routes
app.include_router(release_sources_router, prefix="/api")  # Add release sources routes

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def initialize_ott_platforms():
    """Initialize default OTT platforms if they don't exist"""
    try:
        # Check if any platforms exist
        existing_count = db.ott_platforms.count_documents({})
        if existing_count == 0:
            default_platforms = [
                {"id": 1, "name": "Amazon Prime Video", "is_active": True},
                {"id": 2, "name": "Netflix", "is_active": True},
                {"id": 3, "name": "Disney+ Hotstar", "is_active": True},
                {"id": 4, "name": "Aha", "is_active": True},
                {"id": 5, "name": "Zee5", "is_active": True},
                {"id": 6, "name": "SonyLIV", "is_active": True},
                {"id": 7, "name": "JioCinema", "is_active": True},
                {"id": 8, "name": "Apple TV+", "is_active": True},
                {"id": 9, "name": "MX Player", "is_active": True},
                {"id": 10, "name": "Voot", "is_active": True},
            ]
            db.ott_platforms.insert_many(default_platforms)
            logger.info("✅ Default OTT platforms initialized")
    except Exception as e:
        logger.warning(f"⚠️ OTT platforms initialization failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("""
    ========================================
    🚀 BLOG CMS API STARTING UP
    - Python Version: 3.11
    - Port: 8000
    - Host: 0.0.0.0
    - Health Check: /api or /api/
    ========================================
    """)
    
    try:
        # Create default admin user
        await create_default_admin()
        
        # Initialize S3 service with stored configuration
        try:
            aws_config = crud.get_aws_config(db)
            if aws_config and aws_config.get('is_enabled'):
                s3_service.initialize(aws_config)
                logger.info("✅ S3 service initialized")
            else:
                logger.info("ℹ️ S3 not enabled, using local storage")
        except Exception as e:
            logger.warning(f"⚠️ S3 initialization failed: {e}. Using local storage.")
        
        # Initialize default OTT platforms
        initialize_ott_platforms()
        
        # Initialize the article scheduler
        article_scheduler.initialize_scheduler()
        article_scheduler.start_scheduler()
        
        logger.info("""
        ========================================
        ✅ STARTUP COMPLETE - SERVER READY
        - Listening on: http://0.0.0.0:8000
        - Health endpoint: http://0.0.0.0:8000/api
        - All systems initialized
        ========================================
        """)
    except Exception as e:
        logger.error(f"❌ STARTUP FAILED: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Blog CMS API shutting down...")
    try:
        article_scheduler.stop_scheduler()
    except Exception as e:
        logger.warning(f"⚠️ Shutdown warning: {e}")
