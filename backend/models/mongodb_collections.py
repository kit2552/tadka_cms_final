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
OTT_PLATFORMS = "ott_platforms"
GALLERY_ACTORS = "gallery_actors"
GALLERY_ACTRESSES = "gallery_actresses"
GALLERY_EVENTS = "gallery_events"
GALLERY_POLITICS = "gallery_politics"
GALLERY_TRAVEL = "gallery_travel"
GALLERY_OTHERS = "gallery_others"
GROUPED_POSTS = "grouped_posts"  # New collection for post aggregation

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
        
        # Text search index with multilingual support
        # Note: Using 'article_language' instead of 'language' to avoid conflicts
        # This supports all languages including Hindi, Telugu, Tamil, etc.
        try:
            db[ARTICLES].create_index(
                [("title", "text"), ("content", "text")],
                name="article_text_search",
                default_language="none"  # Treats all languages uniformly
            )
            print("✅ Text search index created for multilingual content")
        except Exception as e:
            print(f"ℹ️ Text search index already exists or skipped: {e}")
        
        # Galleries indexes (use gallery_id instead of slug)
        db[GALLERIES].create_index("gallery_id", unique=True)
        db[GALLERIES].create_index("created_at")
        
        # Topics indexes
        db[TOPICS].create_index("slug", unique=True)
        db[TOPICS].create_index("category")
        
        # Theater/OTT releases indexes
        db[THEATER_RELEASES].create_index("release_date")
        db[OTT_RELEASES].create_index("release_date")
        
        # Grouped posts indexes
        db[GROUPED_POSTS].create_index("group_title")
        db[GROUPED_POSTS].create_index("category")
        db[GROUPED_POSTS].create_index("created_at")
        db[GROUPED_POSTS].create_index([("group_title", 1), ("category", 1)], unique=True)
        
        print("✅ MongoDB indexes created successfully")
    except Exception as e:
        # Raise the exception so server.py can catch and handle it
        raise e
