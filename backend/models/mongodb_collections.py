"""
MongoDB Collection Definitions for Tadka CMS
No ORM models needed - MongoDB is schemaless
Collections are accessed directly via database instance
"""

# Collection names as constants
CATEGORIES = "categories"
ARTICLES = "articles"
SCHEDULER_SETTINGS = "scheduler_settings"
RELATED_ARTICLES_CONFIG = "related_articles_config"
MOVIE_REVIEWS = "movie_reviews"
FEATURED_IMAGES = "featured_images"
THEATER_RELEASES = "theater_releases"
OTT_RELEASES = "ott_releases"
TOPICS = "topics"
TOPIC_CATEGORIES = "topic_categories"
ARTICLE_TOPICS = "article_topics"
GALLERIES = "galleries"
GALLERY_TOPICS = "gallery_topics"

def create_indexes(db):
    """
    Create indexes for MongoDB collections to optimize queries
    """
    try:
        # Categories indexes
        db[CATEGORIES].create_index("name", unique=True)
        db[CATEGORIES].create_index("slug", unique=True)
        
        # Articles indexes
        db[ARTICLES].create_index("slug", unique=True)
        db[ARTICLES].create_index("category")
        db[ARTICLES].create_index("language")
        db[ARTICLES].create_index("is_published")
        db[ARTICLES].create_index("published_at")
        db[ARTICLES].create_index("created_at")
        
        # Skip text search index for now due to language field conflicts
        # The application will work without it, using regex-based search instead
        # TODO: Implement proper text search with language mapping
        print("ℹ️ Skipping text search index (using regex search instead)")
        
        # Galleries indexes (use gallery_id instead of slug)
        db[GALLERIES].create_index("gallery_id", unique=True)
        db[GALLERIES].create_index("created_at")
        
        # Topics indexes
        db[TOPICS].create_index("slug", unique=True)
        db[TOPICS].create_index("category")
        
        # Theater/OTT releases indexes
        db[THEATER_RELEASES].create_index("release_date")
        db[OTT_RELEASES].create_index("release_date")
        
        print("✅ MongoDB indexes created successfully")
    except Exception as e:
        # Raise the exception so server.py can catch and handle it
        raise e
