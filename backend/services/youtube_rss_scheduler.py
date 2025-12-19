"""
YouTube RSS Scheduler Service
Runs RSS feed fetching at configured intervals using APScheduler
"""

import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone
from database import db

class YouTubeRSSScheduler:
    """Scheduler for YouTube RSS feed fetching"""
    
    JOB_ID = "youtube_rss_fetch"
    
    def __init__(self):
        self.scheduler = None
        self.is_initialized = False
    
    def initialize(self):
        """Initialize the scheduler on application startup"""
        if self.is_initialized:
            return
        
        # Check if scheduler should be enabled from config
        config = db.system_settings.find_one({"setting_key": "youtube_rss_config"})
        
        if config and config.get("enabled", False):
            frequency_hours = config.get("frequency_hours", 1)
            self.start_scheduler(frequency_hours)
            print(f"📺 YouTube RSS Scheduler initialized - running every {frequency_hours} hour(s)")
        else:
            print("📺 YouTube RSS Scheduler disabled (enable in Settings)")
        
        self.is_initialized = True
    
    def start_scheduler(self, frequency_hours: int = 1):
        """Start or restart the scheduler with given frequency"""
        # Stop existing scheduler if running
        self.stop_scheduler()
        
        # Create new scheduler
        self.scheduler = AsyncIOScheduler()
        
        # Add job
        self.scheduler.add_job(
            self._run_fetch,
            trigger=IntervalTrigger(hours=frequency_hours),
            id=self.JOB_ID,
            name="YouTube RSS Feed Fetch",
            replace_existing=True
        )
        
        self.scheduler.start()
        print(f"✅ YouTube RSS Scheduler started - interval: {frequency_hours} hour(s)")
        
        # Update config
        db.system_settings.update_one(
            {"setting_key": "youtube_rss_config"},
            {"$set": {
                "enabled": True,
                "frequency_hours": frequency_hours,
                "scheduler_started_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            self.scheduler = None
            print("⏹️ YouTube RSS Scheduler stopped")
    
    async def _run_fetch(self):
        """Execute RSS fetch job"""
        from services.youtube_rss_service import youtube_rss_service
        
        print(f"\n⏰ Scheduled RSS fetch starting at {datetime.now(timezone.utc).isoformat()}")
        
        try:
            result = await youtube_rss_service.fetch_all_channels()
            
            # Update last fetch and next fetch times
            config = db.system_settings.find_one({"setting_key": "youtube_rss_config"})
            frequency_hours = config.get("frequency_hours", 1) if config else 1
            
            from datetime import timedelta
            db.system_settings.update_one(
                {"setting_key": "youtube_rss_config"},
                {"$set": {
                    "last_fetch": datetime.now(timezone.utc),
                    "next_fetch": datetime.now(timezone.utc) + timedelta(hours=frequency_hours),
                    "last_fetch_result": {
                        "success": result.get("success"),
                        "new_videos": result.get("new_videos", 0),
                        "channels_fetched": result.get("channels_fetched", 0)
                    }
                }}
            )
            
            print(f"✅ Scheduled RSS fetch complete: {result.get('new_videos', 0)} new videos")
            
        except Exception as e:
            print(f"❌ Scheduled RSS fetch error: {e}")
            import traceback
            traceback.print_exc()
    
    def get_next_run_time(self):
        """Get the next scheduled run time"""
        if self.scheduler and self.scheduler.running:
            job = self.scheduler.get_job(self.JOB_ID)
            if job:
                return job.next_run_time
        return None
    
    def is_running(self) -> bool:
        """Check if scheduler is running"""
        return self.scheduler is not None and self.scheduler.running


# Singleton instance
youtube_rss_scheduler = YouTubeRSSScheduler()
