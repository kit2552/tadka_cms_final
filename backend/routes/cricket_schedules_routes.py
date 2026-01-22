"""
Cricket Schedules API Routes
Handles CRUD operations for cricket match schedules
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import crud

router = APIRouter(prefix="/api/cricket-schedules", tags=["cricket-schedules"])

# Get database reference
from database import db

# Pydantic models for Cricket Schedules
class CricketScheduleCreate(BaseModel):
    match_id: Optional[str] = None  # External match ID from source
    team1: str
    team2: str
    match_type: str  # T20, ODI, Test, etc.
    tournament: Optional[str] = None  # Tournament/Series name
    venue: Optional[str] = None
    match_date: str  # ISO format date string (UTC)
    match_time: Optional[str] = None  # Time in HH:MM format (UTC)
    match_datetime_utc: Optional[datetime] = None  # Full datetime in UTC
    status: str = "scheduled"  # scheduled, live, completed, cancelled
    result: Optional[str] = None  # Match result if completed
    team1_score: Optional[str] = None
    team2_score: Optional[str] = None
    source: str = "bbc"  # bbc, espn-cricinfo
    source_url: Optional[str] = None

class CricketScheduleResponse(BaseModel):
    id: str
    match_id: Optional[str] = None
    team1: str
    team2: str
    match_type: str
    tournament: Optional[str] = None
    venue: Optional[str] = None
    match_date: str
    match_time: Optional[str] = None
    match_datetime_utc: Optional[str] = None
    status: str
    result: Optional[str] = None
    team1_score: Optional[str] = None
    team2_score: Optional[str] = None
    source: str
    source_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

def serialize_schedule(schedule: dict) -> dict:
    """Serialize MongoDB document to response format"""
    if not schedule:
        return None
    
    result = {
        "id": str(schedule.get("_id", "")),
        "match_id": schedule.get("match_id"),
        "team1": schedule.get("team1", ""),
        "team2": schedule.get("team2", ""),
        "match_type": schedule.get("match_type", ""),
        "tournament": schedule.get("tournament"),
        "venue": schedule.get("venue"),
        "match_date": schedule.get("match_date", ""),
        "match_time": schedule.get("match_time"),
        "match_datetime_utc": schedule.get("match_datetime_utc").isoformat() if schedule.get("match_datetime_utc") else None,
        "status": schedule.get("status", "scheduled"),
        "result": schedule.get("result"),
        "team1_score": schedule.get("team1_score"),
        "team2_score": schedule.get("team2_score"),
        "source": schedule.get("source", ""),
        "source_url": schedule.get("source_url"),
        "created_at": schedule.get("created_at").isoformat() if schedule.get("created_at") else None,
        "updated_at": schedule.get("updated_at").isoformat() if schedule.get("updated_at") else None,
    }
    return result


@router.get("")
async def get_schedules(
    days: int = Query(default=7, ge=1, le=30, description="Number of days to fetch"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    source: Optional[str] = Query(default=None, description="Filter by source"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500)
):
    """Get cricket schedules for the next N days"""
    try:
        # Calculate date range
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = today + timedelta(days=days)
        
        # Build query
        query = {
            "match_datetime_utc": {
                "$gte": today,
                "$lt": end_date
            }
        }
        
        if status:
            query["status"] = status
        if source:
            query["source"] = source
        
        # Fetch schedules sorted by match datetime
        schedules = list(
            db.cricket_schedules
            .find(query)
            .sort("match_datetime_utc", 1)
            .skip(skip)
            .limit(limit)
        )
        
        total = db.cricket_schedules.count_documents(query)
        
        return {
            "schedules": [serialize_schedule(s) for s in schedules],
            "total": total,
            "days": days
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/today-tomorrow")
async def get_today_tomorrow_schedules():
    """Get schedules for today and tomorrow only (for homepage display)"""
    try:
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        day_after_tomorrow = today + timedelta(days=2)
        
        query = {
            "match_datetime_utc": {
                "$gte": today,
                "$lt": day_after_tomorrow
            }
        }
        
        schedules = list(
            db.cricket_schedules
            .find(query)
            .sort("match_datetime_utc", 1)
            .limit(50)
        )
        
        # Group by date
        today_schedules = []
        tomorrow_schedules = []
        tomorrow = today + timedelta(days=1)
        
        for s in schedules:
            match_dt = s.get("match_datetime_utc")
            if match_dt:
                if match_dt < tomorrow:
                    today_schedules.append(serialize_schedule(s))
                else:
                    tomorrow_schedules.append(serialize_schedule(s))
        
        return {
            "today": today_schedules,
            "tomorrow": tomorrow_schedules,
            "today_date": today.strftime("%Y-%m-%d"),
            "tomorrow_date": tomorrow.strftime("%Y-%m-%d")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_schedules(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    sort_order: str = Query(default="asc", description="Sort by date: asc or desc")
):
    """Get all cricket schedules (for CMS management)"""
    try:
        sort_dir = 1 if sort_order == "asc" else -1
        
        schedules = list(
            db.cricket_schedules
            .find({})
            .sort("match_datetime_utc", sort_dir)
            .skip(skip)
            .limit(limit)
        )
        
        total = db.cricket_schedules.count_documents({})
        
        return {
            "schedules": [serialize_schedule(s) for s in schedules],
            "total": total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: str):
    """Get a specific schedule by ID"""
    try:
        schedule = db.cricket_schedules.find_one({"_id": ObjectId(schedule_id)})
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return serialize_schedule(schedule)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_schedule(schedule: CricketScheduleCreate):
    """Create a new cricket schedule"""
    try:
        schedule_dict = schedule.model_dump()
        schedule_dict["created_at"] = datetime.now(timezone.utc)
        schedule_dict["updated_at"] = datetime.now(timezone.utc)
        
        # Parse match_datetime_utc if not provided
        if not schedule_dict.get("match_datetime_utc") and schedule_dict.get("match_date"):
            try:
                date_str = schedule_dict["match_date"]
                time_str = schedule_dict.get("match_time", "00:00")
                dt_str = f"{date_str}T{time_str}:00"
                schedule_dict["match_datetime_utc"] = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
            except:
                pass
        
        result = db.cricket_schedules.insert_one(schedule_dict)
        schedule_dict["_id"] = result.inserted_id
        
        return serialize_schedule(schedule_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk")
async def create_bulk_schedules(schedules: List[CricketScheduleCreate]):
    """Create multiple cricket schedules (used by scraper agent)"""
    try:
        created = []
        updated = []
        
        for schedule in schedules:
            schedule_dict = schedule.model_dump()
            
            # Parse match_datetime_utc if not provided
            if not schedule_dict.get("match_datetime_utc") and schedule_dict.get("match_date"):
                try:
                    date_str = schedule_dict["match_date"]
                    time_str = schedule_dict.get("match_time", "00:00")
                    dt_str = f"{date_str}T{time_str}:00"
                    schedule_dict["match_datetime_utc"] = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
                except:
                    pass
            
            # Check if schedule already exists (by teams, date, and source)
            existing = db.cricket_schedules.find_one({
                "team1": schedule_dict["team1"],
                "team2": schedule_dict["team2"],
                "match_date": schedule_dict["match_date"],
                "source": schedule_dict["source"]
            })
            
            if existing:
                # Update existing schedule
                schedule_dict["updated_at"] = datetime.now(timezone.utc)
                db.cricket_schedules.update_one(
                    {"_id": existing["_id"]},
                    {"$set": schedule_dict}
                )
                schedule_dict["_id"] = existing["_id"]
                updated.append(serialize_schedule(schedule_dict))
            else:
                # Create new schedule
                schedule_dict["created_at"] = datetime.now(timezone.utc)
                schedule_dict["updated_at"] = datetime.now(timezone.utc)
                result = db.cricket_schedules.insert_one(schedule_dict)
                schedule_dict["_id"] = result.inserted_id
                created.append(serialize_schedule(schedule_dict))
        
        return {
            "created": len(created),
            "updated": len(updated),
            "schedules": created + updated
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{schedule_id}")
async def update_schedule(schedule_id: str, schedule: CricketScheduleCreate):
    """Update an existing cricket schedule"""
    try:
        schedule_dict = schedule.model_dump()
        schedule_dict["updated_at"] = datetime.now(timezone.utc)
        
        # Parse match_datetime_utc if not provided
        if not schedule_dict.get("match_datetime_utc") and schedule_dict.get("match_date"):
            try:
                date_str = schedule_dict["match_date"]
                time_str = schedule_dict.get("match_time", "00:00")
                dt_str = f"{date_str}T{time_str}:00"
                schedule_dict["match_datetime_utc"] = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
            except:
                pass
        
        result = db.cricket_schedules.update_one(
            {"_id": ObjectId(schedule_id)},
            {"$set": schedule_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        updated = db.cricket_schedules.find_one({"_id": ObjectId(schedule_id)})
        return serialize_schedule(updated)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete a cricket schedule"""
    try:
        result = db.cricket_schedules.delete_one({"_id": ObjectId(schedule_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return {"message": "Schedule deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/old")
async def clear_old_schedules():
    """Delete schedules older than today"""
    try:
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = db.cricket_schedules.delete_many({
            "match_datetime_utc": {"$lt": today}
        })
        return {"deleted": result.deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
