"""
Data Migration Script: SQLite to MongoDB
Migrates all data from SQLite backup to MongoDB
"""
import json
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import os

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DATABASE_NAME = "tadka_cms"

client = MongoClient(MONGO_URL)
db = client[DATABASE_NAME]

def parse_datetime(date_str):
    """Parse datetime string to datetime object"""
    if not date_str:
        return None
    try:
        # Try parsing with microseconds
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        try:
            # Try without microseconds
            return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
        except:
            return None

def parse_date(date_str):
    """Parse date string to datetime object"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except:
        return None

def migrate_categories(data):
    """Migrate categories collection"""
    print("\n📁 Migrating Categories...")
    collection = db['categories']
    collection.delete_many({})  # Clear existing
    
    categories = data['tables'].get('categories', [])
    for cat in categories:
        doc = {
            '_id': ObjectId(),
            'name': cat['name'],
            'slug': cat['slug'],
            'description': cat.get('description'),
            'created_at': parse_datetime(cat.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(categories)} categories")

def migrate_articles(data):
    """Migrate articles collection"""
    print("\n📰 Migrating Articles...")
    collection = db['articles']
    collection.delete_many({})  # Clear existing
    
    articles = data['tables'].get('articles', [])
    for article in articles:
        doc = {
            '_id': ObjectId(),
            'id': article['id'],  # Keep original integer ID
            'title': article['title'],
            'short_title': article.get('short_title'),
            'slug': article['slug'],
            'content': article.get('content'),
            'summary': article.get('summary'),
            'author': article.get('author'),
            'language': article.get('language', 'en'),
            'states': article.get('states'),
            'category': article.get('category'),
            'content_type': article.get('content_type', 'post'),
            'image': article.get('image'),
            'image_gallery': article.get('image_gallery'),
            'gallery_id': article.get('gallery_id'),
            'youtube_url': article.get('youtube_url'),
            'tags': article.get('tags'),
            'artists': article.get('artists'),
            'movie_rating': article.get('movie_rating'),
            'is_featured': bool(article.get('is_featured', 0)),
            'is_published': bool(article.get('is_published', 1)),
            'is_scheduled': bool(article.get('is_scheduled', 0)),
            'scheduled_publish_at': parse_datetime(article.get('scheduled_publish_at')),
            'original_article_id': article.get('original_article_id'),
            'seo_title': article.get('seo_title'),
            'seo_description': article.get('seo_description'),
            'seo_keywords': article.get('seo_keywords'),
            # Movie review fields
            'review_quick_verdict': article.get('review_quick_verdict'),
            'review_plot_summary': article.get('review_plot_summary'),
            'review_performances': article.get('review_performances'),
            'review_what_works': article.get('review_what_works'),
            'review_what_doesnt_work': article.get('review_what_doesnt_work'),
            'review_technical_aspects': article.get('review_technical_aspects'),
            'review_final_verdict': article.get('review_final_verdict'),
            'review_cast': article.get('review_cast'),
            'review_director': article.get('review_director'),
            'review_genre': article.get('review_genre'),
            'review_runtime': article.get('review_runtime'),
            'view_count': article.get('view_count', 0),
            'created_at': parse_datetime(article.get('created_at')) or datetime.utcnow(),
            'updated_at': parse_datetime(article.get('updated_at')) or datetime.utcnow(),
            'published_at': parse_datetime(article.get('published_at'))
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(articles)} articles")

def migrate_scheduler_settings(data):
    """Migrate scheduler settings"""
    print("\n⏰ Migrating Scheduler Settings...")
    collection = db['scheduler_settings']
    collection.delete_many({})  # Clear existing
    
    settings = data['tables'].get('scheduler_settings', [])
    for setting in settings:
        doc = {
            '_id': ObjectId(),
            'id': setting['id'],
            'is_enabled': bool(setting.get('is_enabled', 0)),
            'check_frequency_minutes': setting.get('check_frequency_minutes', 5),
            'created_at': parse_datetime(setting.get('created_at')) or datetime.utcnow(),
            'updated_at': parse_datetime(setting.get('updated_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(settings)} scheduler settings")

def migrate_related_articles_config(data):
    """Migrate related articles configuration"""
    print("\n🔗 Migrating Related Articles Config...")
    collection = db['related_articles_config']
    collection.delete_many({})  # Clear existing
    
    configs = data['tables'].get('related_articles_config', [])
    for config in configs:
        doc = {
            '_id': ObjectId(),
            'id': config['id'],
            'page_slug': config['page_slug'],
            'categories': config.get('categories'),
            'article_count': config.get('article_count', 5),
            'created_at': parse_datetime(config.get('created_at')) or datetime.utcnow(),
            'updated_at': parse_datetime(config.get('updated_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(configs)} related articles configs")

def migrate_movie_reviews(data):
    """Migrate movie reviews"""
    print("\n🎬 Migrating Movie Reviews...")
    collection = db['movie_reviews']
    collection.delete_many({})  # Clear existing
    
    reviews = data['tables'].get('movie_review', [])
    for review in reviews:
        doc = {
            '_id': ObjectId(),
            'id': review['id'],
            'title': review.get('title'),
            'rating': review.get('rating'),
            'genre': review.get('genre'),
            'director': review.get('director'),
            'cast': review.get('cast'),
            'created_at': parse_datetime(review.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(reviews)} movie reviews")

def migrate_featured_images(data):
    """Migrate featured images"""
    print("\n🖼️ Migrating Featured Images...")
    collection = db['featured_images']
    collection.delete_many({})  # Clear existing
    
    images = data['tables'].get('featured_images', [])
    for img in images:
        doc = {
            '_id': ObjectId(),
            'id': img['id'],
            'category': img.get('category'),
            'image_url': img.get('image_url'),
            'created_at': parse_datetime(img.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(images)} featured images")

def migrate_theater_releases(data):
    """Migrate theater releases"""
    print("\n🎭 Migrating Theater Releases...")
    collection = db['theater_releases']
    collection.delete_many({})  # Clear existing
    
    releases = data['tables'].get('theater_releases', [])
    for release in releases:
        doc = {
            '_id': ObjectId(),
            'id': release['id'],
            'movie_name': release.get('movie_name'),
            'release_date': parse_date(release.get('release_date')),
            'language': release.get('language'),
            'movie_image': release.get('movie_image'),
            'movie_banner': release.get('movie_banner'),
            'created_at': parse_datetime(release.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(releases)} theater releases")

def migrate_ott_releases(data):
    """Migrate OTT releases"""
    print("\n📺 Migrating OTT Releases...")
    collection = db['ott_releases']
    collection.delete_many({})  # Clear existing
    
    releases = data['tables'].get('ott_releases', [])
    for release in releases:
        doc = {
            '_id': ObjectId(),
            'id': release['id'],
            'movie_name': release.get('movie_name'),
            'release_date': parse_date(release.get('release_date')),
            'language': release.get('language'),
            'ott_platform': release.get('platform'),
            'movie_image': release.get('movie_image'),
            'created_at': parse_datetime(release.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(releases)} OTT releases")

def migrate_topics(data):
    """Migrate topics"""
    print("\n🏷️ Migrating Topics...")
    collection = db['topics']
    collection.delete_many({})  # Clear existing
    
    topics = data['tables'].get('topics', [])
    for topic in topics:
        doc = {
            '_id': ObjectId(),
            'id': topic['id'],
            'name': topic.get('name'),
            'slug': topic.get('slug'),
            'language': topic.get('language', 'en'),
            'created_at': parse_datetime(topic.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(topics)} topics")

def migrate_topic_categories(data):
    """Migrate topic categories"""
    print("\n📂 Migrating Topic Categories...")
    collection = db['topic_categories']
    collection.delete_many({})  # Clear existing
    
    categories = data['tables'].get('topic_categories', [])
    for cat in categories:
        doc = {
            '_id': ObjectId(),
            'id': cat['id'],
            'name': cat.get('name'),
            'language': cat.get('language', 'en'),
            'created_at': parse_datetime(cat.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(categories)} topic categories")

def migrate_article_topics(data):
    """Migrate article-topic associations"""
    print("\n🔗 Migrating Article-Topic Associations...")
    collection = db['article_topics']
    collection.delete_many({})  # Clear existing
    
    associations = data['tables'].get('article_topics', [])
    for assoc in associations:
        doc = {
            '_id': ObjectId(),
            'article_id': assoc['article_id'],
            'topic_id': assoc['topic_id']
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(associations)} article-topic associations")

def migrate_galleries(data):
    """Migrate galleries"""
    print("\n🖼️ Migrating Galleries...")
    collection = db['galleries']
    collection.delete_many({})  # Clear existing
    
    galleries = data['tables'].get('galleries', [])
    for gallery in galleries:
        doc = {
            '_id': ObjectId(),
            'id': gallery['id'],
            'title': gallery.get('title'),
            'slug': gallery.get('slug'),
            'category': gallery.get('category'),
            'images': gallery.get('images'),
            'created_at': parse_datetime(gallery.get('created_at')) or datetime.utcnow()
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(galleries)} galleries")

def migrate_gallery_topics(data):
    """Migrate gallery-topic associations"""
    print("\n🔗 Migrating Gallery-Topic Associations...")
    collection = db['gallery_topics']
    collection.delete_many({})  # Clear existing
    
    associations = data['tables'].get('gallery_topics', [])
    for assoc in associations:
        doc = {
            '_id': ObjectId(),
            'gallery_id': assoc['gallery_id'],
            'topic_id': assoc['topic_id']
        }
        collection.insert_one(doc)
    
    print(f"  ✅ Migrated {len(associations)} gallery-topic associations")

def verify_migration(data):
    """Verify migration was successful"""
    print("\n🔍 Verifying Migration...")
    
    issues = []
    
    # Check each collection
    for table_name, records in data['tables'].items():
        expected_count = len(records)
        actual_count = db[table_name].count_documents({})
        
        if expected_count != actual_count:
            issues.append(f"  ⚠️ {table_name}: Expected {expected_count}, got {actual_count}")
        else:
            print(f"  ✅ {table_name}: {actual_count} documents")
    
    if issues:
        print("\n⚠️ Migration Issues Found:")
        for issue in issues:
            print(issue)
        return False
    
    print("\n✅ Migration verification passed!")
    return True

def main():
    """Main migration function"""
    print("="*60)
    print("🚀 Starting SQLite to MongoDB Migration")
    print("="*60)
    
    # Load SQLite backup
    print("\n📖 Loading SQLite backup...")
    with open('sqlite_backup.json', 'r') as f:
        data = json.load(f)
    
    backup_time = data['backup_timestamp']
    print(f"  ✅ Loaded backup from: {backup_time}")
    print(f"  📊 Total tables: {len(data['tables'])}")
    
    # Run migrations
    try:
        migrate_categories(data)
        migrate_articles(data)
        migrate_scheduler_settings(data)
        migrate_related_articles_config(data)
        migrate_movie_reviews(data)
        migrate_featured_images(data)
        migrate_theater_releases(data)
        migrate_ott_releases(data)
        migrate_topics(data)
        migrate_topic_categories(data)
        migrate_article_topics(data)
        migrate_galleries(data)
        migrate_gallery_topics(data)
        
        # Verify migration
        success = verify_migration(data)
        
        if success:
            print("\n" + "="*60)
            print("✅ Migration completed successfully!")
            print("="*60)
            print(f"\n📊 Database: {DATABASE_NAME}")
            print(f"🔗 Connection: {MONGO_URL}")
            print("\n🎉 All data has been migrated to MongoDB!")
        else:
            print("\n" + "="*60)
            print("⚠️ Migration completed with warnings")
            print("="*60)
            
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    main()
