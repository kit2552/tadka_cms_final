"""
Cricket Schedules Scraper Service
Scrapes cricket match schedules from BBC Sport and ESPN Cricinfo
"""
import re
import httpx
import trafilatura
from bs4 import BeautifulSoup
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional


class CricketSchedulesScraper:
    """Scraper for cricket match schedules from various sources"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    
    async def scrape_bbc_schedules(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        Scrape cricket schedules from BBC Sport
        
        Args:
            days: Number of days to scrape (1-30)
            
        Returns:
            List of schedule dictionaries
        """
        schedules = []
        base_url = "https://www.bbc.com/sport/cricket/scores-fixtures"
        
        print(f"🏏 BBC Scraper: Fetching schedules for {days} days...")
        
        today = datetime.now(timezone.utc).date()
        
        for day_offset in range(days):
            target_date = today + timedelta(days=day_offset)
            date_str = target_date.strftime("%Y-%m-%d")
            url = f"{base_url}/{date_str}"
            
            print(f"   📅 Fetching {date_str}...")
            
            try:
                downloaded = trafilatura.fetch_url(url)
                if not downloaded:
                    print(f"   ❌ Failed to download {url}")
                    continue
                
                soup = BeautifulSoup(downloaded, 'html.parser')
                day_schedules = self._parse_bbc_page(soup, date_str)
                
                print(f"   ✅ Found {len(day_schedules)} matches for {date_str}")
                schedules.extend(day_schedules)
                
            except Exception as e:
                print(f"   ❌ Error scraping {date_str}: {e}")
                continue
        
        print(f"🏏 BBC Scraper: Total {len(schedules)} matches found")
        return schedules
    
    def _parse_bbc_page(self, soup: BeautifulSoup, date_str: str) -> List[Dict[str, Any]]:
        """Parse BBC Sport fixtures page"""
        schedules = []
        
        # Get full page text for regex parsing
        page_text = soup.get_text()
        
        # Find tournament sections
        # BBC typically has sections like "Men's International Twenty20 Match"
        tournament_patterns = [
            r"(Men's International (?:Twenty20|T20|ODI|Test|One Day)[^A-Z]*)",
            r"(Women's International (?:Twenty20|T20|ODI|Test|One Day)[^A-Z]*)",
            r"((?:IPL|Big Bash|PSL|CPL|SA20|The Hundred)[^A-Z]*)",
            r"((?:County|Domestic|Premier League|Super Smash)[^A-Z]*)",
        ]
        
        # Find all match entries with vs pattern
        # Pattern: Team1 vs Team2, [scheduled] HH:MM or result
        match_pattern = r'([A-Za-z][A-Za-z\s\-\']+?)\s+vs\s+([A-Za-z][A-Za-z\s\-\']+?),?\s*(?:scheduled\s*)?(\d{1,2}:\d{2})?'
        
        matches = re.findall(match_pattern, page_text)
        
        current_tournament = "International Cricket"
        
        for match in matches:
            team1, team2, time_str = match
            team1 = team1.strip()
            team2 = team2.strip()
            
            # Skip invalid team names
            if len(team1) < 3 or len(team2) < 3:
                continue
            if team1.lower() in ['match', 'series', 'league', 'cup']:
                continue
            
            # Determine match type from context
            match_type = self._detect_match_type(team1, team2, page_text)
            
            # Parse time (BBC shows local UK time, need to handle timezone)
            match_time = time_str if time_str else "00:00"
            
            # Create match datetime in UTC (BBC times are usually UK time)
            try:
                dt_str = f"{date_str}T{match_time}:00"
                # Assume UK time (GMT/BST) and convert to UTC
                match_datetime = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
            except:
                match_datetime = datetime.fromisoformat(f"{date_str}T00:00:00").replace(tzinfo=timezone.utc)
            
            schedule = {
                "team1": team1,
                "team2": team2,
                "match_type": match_type,
                "tournament": current_tournament,
                "venue": None,  # BBC doesn't always show venue
                "match_date": date_str,
                "match_time": match_time,
                "match_datetime_utc": match_datetime,
                "status": "scheduled",
                "source": "bbc",
                "source_url": f"https://www.bbc.com/sport/cricket/scores-fixtures/{date_str}"
            }
            
            schedules.append(schedule)
        
        return schedules
    
    def _detect_match_type(self, team1: str, team2: str, context: str) -> str:
        """Detect match type from teams and context"""
        context_lower = context.lower()
        
        if 'test' in context_lower:
            return "Test"
        elif 't20' in context_lower or 'twenty20' in context_lower:
            return "T20"
        elif 'odi' in context_lower or 'one day' in context_lower:
            return "ODI"
        elif 'ipl' in context_lower:
            return "T20 (IPL)"
        elif 'big bash' in context_lower:
            return "T20 (BBL)"
        elif 'psl' in context_lower:
            return "T20 (PSL)"
        elif 'sa20' in context_lower:
            return "T20 (SA20)"
        elif 'hundred' in context_lower:
            return "T20 (The Hundred)"
        elif 'premier league' in context_lower:
            return "T20 (Domestic)"
        else:
            return "T20"  # Default to T20 as most common
    
    async def scrape_espn_cricinfo_schedules(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        Scrape cricket schedules from ESPN Cricinfo RSS feed
        
        ESPN Cricinfo blocks direct scraping but we can try their API/RSS
        
        Args:
            days: Number of days to scrape
            
        Returns:
            List of schedule dictionaries
        """
        schedules = []
        
        print(f"🏏 ESPN Cricinfo Scraper: Attempting to fetch schedules...")
        
        # ESPN Cricinfo has an API endpoint for matches
        # Try their JSON API
        try:
            api_url = "https://hs-consumer-api.espncricinfo.com/v1/pages/matches/current"
            
            with httpx.Client(timeout=30, headers=self.headers) as client:
                response = client.get(api_url)
                
                if response.status_code == 200:
                    data = response.json()
                    schedules = self._parse_espn_api_response(data, days)
                    print(f"✅ ESPN Cricinfo: Found {len(schedules)} matches")
                else:
                    print(f"❌ ESPN Cricinfo API returned {response.status_code}")
                    # Fallback to RSS
                    schedules = await self._scrape_espn_rss()
                    
        except Exception as e:
            print(f"❌ ESPN Cricinfo scraper error: {e}")
            # Try RSS as fallback
            try:
                schedules = await self._scrape_espn_rss()
            except:
                pass
        
        return schedules
    
    def _parse_espn_api_response(self, data: dict, days: int) -> List[Dict[str, Any]]:
        """Parse ESPN Cricinfo API response"""
        schedules = []
        
        try:
            matches = data.get("content", {}).get("matches", {})
            
            for match_type, match_list in matches.items():
                if not isinstance(match_list, list):
                    continue
                    
                for match in match_list:
                    try:
                        # Extract match details
                        team1 = match.get("teams", [{}])[0].get("team", {}).get("name", "TBA")
                        team2 = match.get("teams", [{}])[1].get("team", {}).get("name", "TBA") if len(match.get("teams", [])) > 1 else "TBA"
                        
                        # Get match time
                        start_time = match.get("startTime", "")
                        if start_time:
                            match_datetime = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                        else:
                            continue
                        
                        # Check if within requested days
                        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                        max_date = today + timedelta(days=days)
                        
                        if match_datetime < today or match_datetime >= max_date:
                            continue
                        
                        schedule = {
                            "match_id": str(match.get("objectId", "")),
                            "team1": team1,
                            "team2": team2,
                            "match_type": match.get("format", "T20"),
                            "tournament": match.get("series", {}).get("name", ""),
                            "venue": match.get("ground", {}).get("name", ""),
                            "match_date": match_datetime.strftime("%Y-%m-%d"),
                            "match_time": match_datetime.strftime("%H:%M"),
                            "match_datetime_utc": match_datetime,
                            "status": match.get("state", "scheduled").lower(),
                            "source": "espn-cricinfo",
                            "source_url": f"https://www.espncricinfo.com/series/{match.get('series', {}).get('slug', '')}"
                        }
                        
                        schedules.append(schedule)
                        
                    except Exception as e:
                        continue
                        
        except Exception as e:
            print(f"Error parsing ESPN API: {e}")
        
        return schedules
    
    async def _scrape_espn_rss(self) -> List[Dict[str, Any]]:
        """Fallback: Scrape from ESPN RSS feed"""
        schedules = []
        
        try:
            rss_url = "https://www.espncricinfo.com/rss/content/story/feeds/0.xml"
            
            with httpx.Client(timeout=30) as client:
                response = client.get(rss_url)
                if response.status_code == 200:
                    # Parse RSS for any schedule-related content
                    # This is a fallback and may not provide schedule data
                    print("   ℹ️ ESPN RSS fallback used - limited schedule data")
                    
        except Exception as e:
            print(f"   ❌ ESPN RSS fallback error: {e}")
        
        return schedules


# Singleton instance
cricket_schedules_scraper = CricketSchedulesScraper()
