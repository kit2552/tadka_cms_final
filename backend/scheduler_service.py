import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from pytz import timezone
from database import db
import crud

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ArticleSchedulerService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.job_id = "publish_scheduled_articles"
        self.est = timezone('America/New_York')
        
    def check_and_publish_scheduled_articles(self):
        """Check for scheduled articles and galleries that need to be published"""
        try:
            # Get scheduler settings
            settings = crud.get_scheduler_settings(db)
            
            # If scheduler is disabled, return
            if not settings or not settings.get('is_enabled'):
                logger.info("Scheduler is disabled, skipping scheduled content check")
                return
            
            # Get articles ready for publishing
            scheduled_articles = crud.get_scheduled_articles_for_publishing(db)
            
            # Get galleries ready for publishing
            scheduled_galleries = crud.get_scheduled_galleries_for_publishing(db)
            
            if not scheduled_articles and not scheduled_galleries:
                logger.info("No scheduled content ready for publishing")
                return
            
            # Publish each scheduled article
            published_articles = 0
            for article in scheduled_articles:
                try:
                    crud.publish_scheduled_article(db, article.get('id'))
                    published_articles += 1
                    logger.info(f"Published scheduled article: {article.get('title')} (ID: {article.get('id')})")
                except Exception as e:
                    logger.error(f"Failed to publish scheduled article {article.get('id')}: {str(e)}")
            
            # Publish each scheduled gallery
            published_galleries = 0
            for gallery in scheduled_galleries:
                try:
                    crud.publish_scheduled_gallery(db, gallery.get('id'))
                    published_galleries += 1
                    logger.info(f"Published scheduled gallery: {gallery.get('title')} (ID: {gallery.get('id')})")
                except Exception as e:
                    logger.error(f"Failed to publish scheduled gallery {gallery.get('id')}: {str(e)}")
            
            logger.info(f"Published {published_articles} scheduled articles and {published_galleries} scheduled galleries")
            
        except Exception as e:
            logger.error(f"Error in scheduled content check: {str(e)}")
    
    def start_scheduler(self):
        """Start the background scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Article scheduler started")
    
    def stop_scheduler(self):
        """Stop the background scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Article scheduler stopped")
    
    def update_schedule(self, frequency_minutes: int):
        """Update the scheduler frequency"""
        try:
            # Remove existing job if it exists
            if self.scheduler.get_job(self.job_id):
                self.scheduler.remove_job(self.job_id)
            
            # Add new job with updated frequency
            self.scheduler.add_job(
                func=self.check_and_publish_scheduled_articles,
                trigger=IntervalTrigger(minutes=frequency_minutes),
                id=self.job_id,
                name="Check and publish scheduled articles",
                replace_existing=True
            )
            
            logger.info(f"Scheduler frequency updated to {frequency_minutes} minutes")
            
        except Exception as e:
            logger.error(f"Failed to update scheduler frequency: {str(e)}")
    
    def initialize_scheduler(self):
        """Initialize scheduler with settings from database"""
        try:
            settings = crud.get_scheduler_settings(db)
            
            if not settings:
                # Create default settings if none exist
                default_settings = crud.create_scheduler_settings(
                    db, 
                    {"is_enabled": False, "check_frequency_minutes": 5}
                )
                settings = default_settings
            
            # Set up the scheduler job
            if settings.get('is_enabled'):
                self.update_schedule(settings.get('check_frequency_minutes'))
                logger.info(f"Scheduler initialized with {settings.get('check_frequency_minutes')} minute frequency")
            else:
                logger.info("Scheduler initialized but disabled")
                
        except Exception as e:
            logger.error(f"Failed to initialize scheduler: {str(e)}")

# Global scheduler instance
article_scheduler = ArticleSchedulerService()