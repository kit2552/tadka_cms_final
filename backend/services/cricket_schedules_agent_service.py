"""
Cricket Schedules Agent Service
Runs the cricket schedules scraper and saves data to database
"""
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from database import db
import crud


class CricketSchedulesAgentService:
    """Service to run cricket schedules scraping agent"""
    
    async def run_agent(self, agent_id: str) -> Dict[str, Any]:
        """
        Run the cricket schedules agent
        
        Args:
            agent_id: ID of the agent to run
            
        Returns:
            Result dictionary with success status and details
        """
        from services.cricket_schedules_scraper import cricket_schedules_scraper
        
        # Get agent configuration
        agent = crud.get_ai_agent(db, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        
        try:
            # Get agent settings
            source = agent.get('schedule_source', 'bbc')
            days = agent.get('schedule_days', 7)
            fetch_mode = agent.get('fetch_mode', 'full')
            
            print(f"\n{'='*60}")
            print(f"🏏 Cricket Schedules Agent Started")
            print(f"   Source: {source}")
            print(f"   Days: {days}")
            print(f"   Fetch Mode: {fetch_mode}")
            print(f"{'='*60}\n")
            
            # Adjust days for "next" mode (fetch only 1 day to maintain window)
            if fetch_mode == 'next':
                # Get the latest schedule date in DB
                latest = db.cricket_schedules.find_one(
                    {"source": source},
                    sort=[("match_datetime_utc", -1)]
                )
                
                if latest:
                    latest_date = latest.get("match_datetime_utc")
                    if latest_date:
                        # Calculate how many days we need to fetch
                        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                        days_in_db = (latest_date.replace(tzinfo=timezone.utc) - today).days
                        
                        if days_in_db >= days:
                            print(f"   ℹ️ Already have {days_in_db} days of schedules, fetching 1 more day")
                            days = 1
                        else:
                            days = days - days_in_db
                            print(f"   ℹ️ Have {days_in_db} days, fetching {days} more days")
            
            # Scrape schedules based on source
            schedules = []
            
            if source == 'bbc':
                schedules = await cricket_schedules_scraper.scrape_bbc_schedules(days)
            elif source == 'espn-cricinfo':
                schedules = await cricket_schedules_scraper.scrape_espn_cricinfo_schedules(days)
            else:
                raise ValueError(f"Unknown source: {source}")
            
            if not schedules:
                return {
                    'success': False,
                    'message': f'No schedules found from {source}',
                    'created': 0,
                    'updated': 0
                }
            
            # Save schedules to database
            created_count = 0
            updated_count = 0
            
            for schedule in schedules:
                # Check if schedule already exists
                existing = db.cricket_schedules.find_one({
                    "team1": schedule["team1"],
                    "team2": schedule["team2"],
                    "match_date": schedule["match_date"],
                    "source": schedule["source"]
                })
                
                if existing:
                    # Update existing schedule
                    schedule["updated_at"] = datetime.now(timezone.utc)
                    db.cricket_schedules.update_one(
                        {"_id": existing["_id"]},
                        {"$set": schedule}
                    )
                    updated_count += 1
                else:
                    # Create new schedule
                    schedule["created_at"] = datetime.now(timezone.utc)
                    schedule["updated_at"] = datetime.now(timezone.utc)
                    db.cricket_schedules.insert_one(schedule)
                    created_count += 1
            
            # Clean up old schedules (older than today)
            today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            deleted = db.cricket_schedules.delete_many({
                "match_datetime_utc": {"$lt": today}
            })
            
            print(f"\n{'='*60}")
            print(f"🏏 Cricket Schedules Agent Completed")
            print(f"   Created: {created_count}")
            print(f"   Updated: {updated_count}")
            print(f"   Deleted (old): {deleted.deleted_count}")
            print(f"{'='*60}\n")
            
            return {
                'success': True,
                'message': f'Schedules synced successfully from {source}',
                'created': created_count,
                'updated': updated_count,
                'deleted': deleted.deleted_count,
                'total_schedules': created_count + updated_count
            }
            
        except Exception as e:
            print(f"❌ Cricket Schedules Agent Error: {e}")
            return {
                'success': False,
                'message': str(e),
                'created': 0,
                'updated': 0
            }


# Singleton instance
cricket_schedules_agent = CricketSchedulesAgentService()
