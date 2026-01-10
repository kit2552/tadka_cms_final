"""
IMDb Scraper Service
Scrapes theater release information from IMDb for Indian movies
"""

import re
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from datetime import datetime


class IMDbScraperService:
    """Service to scrape movie release data from IMDb"""
    
    # Language mapping
    LANGUAGE_MAP = {
        'Hindi': 'Hindi',
        'Telugu': 'Telugu',
        'Tamil': 'Tamil',
        'Malayalam': 'Malayalam',
        'Kannada': 'Kannada',
        'Bengali': 'Bengali',
        'Marathi': 'Marathi',
        'Gujarati': 'Gujarati',
        'Punjabi': 'Punjabi',
        'Odia': 'Odia',
        'English': 'English',
        'Korean': 'Korean',
        'Japanese': 'Japanese',
        'Spanish': 'Spanish',
        'French': 'French',
        'German': 'German',
    }
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        }
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date string to ISO format"""
        if not date_str:
            return None
        
        # Clean up the date string
        date_str = date_str.strip()
        
        # Try various date formats
        formats = [
            '%B %d, %Y',  # January 15, 2025
            '%b %d, %Y',  # Jan 15, 2025
            '%d %B %Y',   # 15 January 2025
            '%d %b %Y',   # 15 Jan 2025
            '%Y-%m-%d',   # 2025-01-15
            '%d/%m/%Y',   # 15/01/2025
            '%m/%d/%Y',   # 01/15/2025
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        return None
    
    def _extract_runtime_minutes(self, runtime_str: str) -> Optional[int]:
        """Extract runtime in minutes from string like '2h 7m' or '127 min'"""
        if not runtime_str:
            return None
        
        hours = 0
        minutes = 0
        
        # Try "Xh Ym" format
        hour_match = re.search(r'(\d+)\s*h', runtime_str, re.I)
        min_match = re.search(r'(\d+)\s*m', runtime_str, re.I)
        
        if hour_match:
            hours = int(hour_match.group(1))
        if min_match:
            minutes = int(min_match.group(1))
        
        # Try "X min" format
        if hours == 0 and minutes == 0:
            min_only = re.search(r'(\d+)\s*min', runtime_str, re.I)
            if min_only:
                minutes = int(min_only.group(1))
        
        total = hours * 60 + minutes
        return total if total > 0 else None

    async def fetch_calendar_releases(self, url: str, limit: int = 20, include_english: bool = True) -> List[Dict]:
        """Fetch releases from IMDb calendar page"""
        releases = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                print(f"   📄 Fetching IMDb calendar: {url}")
                
                response = await client.get(url, headers=self.headers)
                
                if response.status_code != 200:
                    print(f"   ❌ Failed to fetch: HTTP {response.status_code}")
                    return releases
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                date_pattern = r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}'
                seen_ids = set()
                
                # IMDb calendar page has articles, each containing a date header and movie links
                for article in soup.find_all('article'):
                    if len(releases) >= limit:
                        break
                    
                    article_text = article.get_text()
                    date_match = re.search(date_pattern, article_text)
                    
                    if date_match:
                        release_date = self._parse_date(date_match.group(0))
                        
                        # Find all movie links in this article
                        movie_links = article.find_all('a', href=re.compile(r'/title/tt\d+'))
                        
                        for link in movie_links:
                            if len(releases) >= limit:
                                break
                            
                            href = link.get('href', '')
                            title = link.get_text(strip=True)
                            
                            # Skip empty titles
                            if not title or len(title) < 2:
                                continue
                            
                            # Extract IMDb ID
                            imdb_match = re.search(r'(tt\d+)', href)
                            if not imdb_match:
                                continue
                            
                            imdb_id = imdb_match.group(1)
                            
                            # Skip duplicates
                            if imdb_id in seen_ids:
                                continue
                            
                            seen_ids.add(imdb_id)
                            
                            releases.append({
                                'title': title,
                                'imdb_id': imdb_id,
                                'imdb_url': f'https://www.imdb.com/title/{imdb_id}/',
                                'release_date': release_date
                            })
                            print(f"      📅 {title}: {release_date}")
                
                print(f"   ✅ Found {len(releases)} releases from calendar")
                
        except Exception as e:
            print(f"   ❌ Error fetching calendar: {e}")
            import traceback
            traceback.print_exc()
        
        return releases

    async def fetch_search_releases(self, url: str, limit: int = 20, include_english: bool = True) -> List[Dict]:
        """Fetch releases from IMDb search page"""
        releases = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                print(f"   📄 Fetching IMDb search: {url}")
                
                response = await client.get(url, headers=self.headers)
                
                if response.status_code != 200:
                    print(f"   ❌ Failed to fetch: HTTP {response.status_code}")
                    return releases
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find movie entries - IMDb search results
                movie_items = soup.find_all('a', href=re.compile(r'/title/tt\d+'))
                
                seen_ids = set()
                
                for item in movie_items:
                    if len(releases) >= limit:
                        break
                    
                    href = item.get('href', '')
                    
                    # Extract IMDb ID
                    imdb_match = re.search(r'(tt\d+)', href)
                    if not imdb_match:
                        continue
                    
                    imdb_id = imdb_match.group(1)
                    
                    # Skip if already seen
                    if imdb_id in seen_ids:
                        continue
                    
                    seen_ids.add(imdb_id)
                    
                    # Get title text
                    title = item.get_text(strip=True)
                    
                    # Skip navigation/empty titles
                    if not title or len(title) < 2:
                        continue
                    if title.lower() in ['imdb', 'menu', 'all', 'watchlist', 'see full cast']:
                        continue
                    
                    releases.append({
                        'title': title,
                        'imdb_id': imdb_id,
                        'imdb_url': f'https://www.imdb.com/title/{imdb_id}/'
                    })
                
                print(f"   ✅ Found {len(releases)} releases from search")
                
        except Exception as e:
            print(f"   ❌ Error fetching search: {e}")
        
        return releases

    async def fetch_movie_details(self, imdb_url: str, include_english: bool = True) -> Optional[Dict]:
        """Fetch detailed movie information from IMDb movie page"""
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(imdb_url, headers=self.headers)
                
                if response.status_code != 200:
                    print(f"      ❌ Failed to fetch details: HTTP {response.status_code}")
                    return None
                
                soup = BeautifulSoup(response.text, 'html.parser')
                html_str = str(soup)
                
                # Extract movie name from title tag or h1
                movie_name = None
                title_tag = soup.find('title')
                if title_tag:
                    title_text = title_tag.get_text(strip=True)
                    # Remove " - IMDb" suffix
                    movie_name = re.sub(r'\s*[-–]\s*IMDb.*$', '', title_text).strip()
                    # Remove year in parentheses for cleaner title
                    movie_name = re.sub(r'\s*\(\d{4}\)\s*$', '', movie_name).strip()
                
                if not movie_name:
                    h1 = soup.find('h1')
                    if h1:
                        movie_name = h1.get_text(strip=True)
                
                # Extract year
                year = None
                year_match = re.search(r'\((\d{4})\)', html_str)
                if year_match:
                    year = int(year_match.group(1))
                
                # Extract release date - try multiple methods
                release_date = None
                date_pattern = r'(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}'
                
                # Method 1: Look for "Release date" or "Releases" text
                for search_text in ['Release date', 'Releases', 'Release Date']:
                    release_info = soup.find(string=re.compile(search_text, re.I))
                    if release_info:
                        # Get parent and siblings to find the actual date
                        parent = release_info.find_parent()
                        if parent:
                            # Search in parent and its parent for dates
                            for _ in range(3):
                                if parent:
                                    parent_text = parent.get_text()
                                    date_match = re.search(date_pattern, parent_text, re.I)
                                    if date_match:
                                        release_date = self._parse_date(date_match.group(0))
                                        if release_date:
                                            break
                                    parent = parent.find_parent()
                        if release_date:
                            break
                
                # Method 2: Look for data-testid attribute for release date
                if not release_date:
                    release_containers = soup.find_all(['li', 'div', 'span'], {'data-testid': re.compile(r'release', re.I)})
                    for container in release_containers:
                        container_text = container.get_text()
                        date_match = re.search(date_pattern, container_text, re.I)
                        if date_match:
                            release_date = self._parse_date(date_match.group(0))
                            if release_date:
                                break
                
                # Method 3: Look for "Coming soon" or upcoming section
                if not release_date:
                    upcoming_section = soup.find(string=re.compile(r'Coming soon|Upcoming|In theaters', re.I))
                    if upcoming_section:
                        parent = upcoming_section.find_parent()
                        if parent:
                            for _ in range(3):
                                if parent:
                                    parent_text = parent.get_text()
                                    date_match = re.search(date_pattern, parent_text, re.I)
                                    if date_match:
                                        release_date = self._parse_date(date_match.group(0))
                                        if release_date:
                                            break
                                    parent = parent.find_parent()
                
                # Method 4: Search entire page for a release date near India/IN
                if not release_date:
                    # Look for dates near "India" text
                    india_refs = soup.find_all(string=re.compile(r'\bIndia\b|\bIN\b', re.I))
                    for ref in india_refs[:5]:
                        parent = ref.find_parent()
                        if parent:
                            for _ in range(3):
                                if parent:
                                    parent_text = parent.get_text()
                                    date_match = re.search(date_pattern, parent_text, re.I)
                                    if date_match:
                                        release_date = self._parse_date(date_match.group(0))
                                        if release_date:
                                            break
                                    parent = parent.find_parent()
                        if release_date:
                            break
                
                # If no release date found, try to get from year
                if not release_date and year:
                    release_date = f"{year}-01-01"
                
                # Extract languages
                languages = []
                lang_section = soup.find(string=re.compile(r'Language', re.I))
                if lang_section:
                    parent = lang_section.find_parent()
                    if parent:
                        lang_links = parent.find_all('a', href=re.compile(r'/search/title.*language'))
                        for link in lang_links:
                            lang = link.get_text(strip=True)
                            if lang in self.LANGUAGE_MAP:
                                languages.append(lang)
                
                # Also look for language in data-testid sections
                if not languages:
                    lang_containers = soup.find_all('li', {'data-testid': re.compile(r'language', re.I)})
                    for container in lang_containers:
                        links = container.find_all('a')
                        for link in links:
                            lang = link.get_text(strip=True)
                            if lang in self.LANGUAGE_MAP and lang not in languages:
                                languages.append(lang)
                
                # Check movie title for language hints (Indian films often have language in title)
                if not languages and movie_name:
                    title_lower = movie_name.lower()
                    if 'telugu' in title_lower:
                        languages = ['Telugu']
                    elif 'tamil' in title_lower:
                        languages = ['Tamil']
                    elif 'malayalam' in title_lower:
                        languages = ['Malayalam']
                    elif 'kannada' in title_lower:
                        languages = ['Kannada']
                    elif 'hindi' in title_lower:
                        languages = ['Hindi']
                    elif 'bengali' in title_lower or 'bangla' in title_lower:
                        languages = ['Bengali']
                    elif 'marathi' in title_lower:
                        languages = ['Marathi']
                
                # Filter English if needed
                if not include_english and languages == ['English']:
                    return None
                
                # Default to Hindi if no language found (Indian releases)
                if not languages:
                    languages = ['Hindi']
                
                # Extract genres - try multiple methods
                genres = []
                
                # Method 1: Look for chip elements with genre text
                chips = soup.find_all(['span', 'a'], class_=re.compile(r'chip|ipc-chip', re.I))
                common_genres = ['Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 
                                 'Documentary', 'Drama', 'Family', 'Fantasy', 'Horror', 'Musical',
                                 'Mystery', 'Romance', 'Sci-Fi', 'Sport', 'Thriller', 'War', 'Western',
                                 'History', 'Music', 'News', 'Reality-TV', 'Talk-Show']
                for chip in chips:
                    chip_text = chip.get_text(strip=True)
                    if chip_text in common_genres and chip_text not in genres:
                        genres.append(chip_text)
                
                # Method 2: Look for genre links
                if not genres:
                    genre_links = soup.find_all('a', href=re.compile(r'/search/title.*genres'))
                    for link in genre_links:
                        genre = link.get_text(strip=True)
                        if genre and genre not in genres and len(genre) < 20 and genre.lower() not in ['imdb', 'menu']:
                            genres.append(genre)
                
                # Method 3: Look in storyline section
                if not genres:
                    storyline = soup.find(['div', 'section'], {'data-testid': re.compile(r'storyline', re.I)})
                    if storyline:
                        for genre in common_genres:
                            if re.search(rf'\b{genre}\b', storyline.get_text(), re.I) and genre not in genres:
                                genres.append(genre)
                
                # Dedupe while preserving order
                genres = list(dict.fromkeys(genres))
                
                # Extract director - try multiple methods
                director = None
                
                # Method 1: Look for Director label
                director_section = soup.find('li', {'data-testid': re.compile(r'director', re.I)})
                if director_section:
                    director_link = director_section.find('a', href=re.compile(r'/name/nm\d+'))
                    if director_link:
                        director = director_link.get_text(strip=True)
                
                # Method 2: Look for "Director" or "Directors" text
                if not director:
                    for text in ['Director', 'Directors']:
                        director_label = soup.find(string=re.compile(rf'^{text}s?$', re.I))
                        if director_label:
                            parent = director_label.find_parent()
                            if parent:
                                # Go up a few levels to find the container
                                for _ in range(3):
                                    if parent.parent:
                                        parent = parent.parent
                                    director_link = parent.find('a', href=re.compile(r'/name/nm\d+'))
                                    if director_link:
                                        director = director_link.get_text(strip=True)
                                        break
                            if director:
                                break
                
                # Method 3: Look in credits section
                if not director:
                    credits = soup.find_all('a', href=re.compile(r'/name/nm\d+'))
                    for credit in credits[:20]:
                        # Check if this name appears near "Director" text
                        parent = credit.find_parent()
                        if parent and re.search(r'director', parent.get_text(), re.I):
                            director = credit.get_text(strip=True)
                            break
                
                # Extract cast
                cast = []
                cast_section = soup.find_all('a', href=re.compile(r'/name/nm\d+'))
                for link in cast_section[:15]:  # Limit to first 15 names
                    name = link.get_text(strip=True)
                    if name and len(name) > 2 and name not in cast:
                        # Skip if it's the director
                        if name != director:
                            cast.append(name)
                    if len(cast) >= 10:
                        break
                
                # Extract runtime
                runtime = None
                runtime_match = re.search(r'(\d+h\s*\d*m|\d+\s*min)', html_str, re.I)
                if runtime_match:
                    runtime = self._extract_runtime_minutes(runtime_match.group(1))
                
                # Extract IMDb ID
                imdb_id = None
                imdb_match = re.search(r'(tt\d+)', imdb_url)
                if imdb_match:
                    imdb_id = imdb_match.group(1)
                
                return {
                    'movie_name': movie_name,
                    'year': year,
                    'release_date': release_date,
                    'runtime': runtime,
                    'genres': genres,
                    'languages': languages,
                    'original_language': languages[0] if languages else 'Hindi',
                    'director': director,
                    'cast': cast,
                    'imdb_id': imdb_id,
                    'source_url': imdb_url,
                }
                
        except Exception as e:
            print(f"      ❌ Error fetching movie details: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def fetch_theater_releases(
        self,
        reference_urls: List[str],
        limit: int = 20,
        include_english: bool = True
    ) -> List[Dict]:
        """Fetch theater releases from provided IMDb URLs"""
        all_releases = []
        
        print(f"\n🎬 Fetching theater releases from {len(reference_urls)} URL(s)")
        
        for url_item in reference_urls:
            # Handle both string URLs and dict format {url: "...", url_type: "..."}
            if isinstance(url_item, dict):
                url = url_item.get('url', '')
            else:
                url = url_item
            
            if not url or not str(url).strip():
                continue
            
            url = str(url).strip()
            
            # Determine URL type and fetch accordingly
            if 'calendar' in url.lower():
                releases = await self.fetch_calendar_releases(url, limit, include_english)
            elif 'search' in url.lower():
                releases = await self.fetch_search_releases(url, limit, include_english)
            else:
                # Default to search behavior
                releases = await self.fetch_search_releases(url, limit, include_english)
            
            all_releases.extend(releases)
        
        # Remove duplicates by IMDb ID
        seen_ids = set()
        unique_releases = []
        for release in all_releases:
            imdb_id = release.get('imdb_id')
            if imdb_id and imdb_id not in seen_ids:
                seen_ids.add(imdb_id)
                unique_releases.append(release)
        
        # Limit total results
        unique_releases = unique_releases[:limit]
        
        print(f"\n📥 Fetching details for {len(unique_releases)} movies...")
        
        # Fetch detailed info for each release
        detailed_releases = []
        for i, release in enumerate(unique_releases, 1):
            print(f"   [{i}/{len(unique_releases)}] Fetching details for: {release.get('title', 'Unknown')}")
            
            details = await self.fetch_movie_details(release['imdb_url'], include_english)
            
            if details:
                # Skip English-only if not including English
                if not include_english:
                    langs = details.get('languages', [])
                    if langs == ['English']:
                        print(f"      ⏭️ Skipping English-only movie")
                        continue
                
                # Use release date from calendar if details page didn't find it
                # or if the calendar date looks more accurate (not just year-01-01)
                calendar_date = release.get('release_date')
                details_date = details.get('release_date')
                
                if calendar_date:
                    # Calendar date is more reliable - use it
                    details['release_date'] = calendar_date
                    print(f"      📅 Using calendar date: {calendar_date}")
                elif details_date and details_date.endswith('-01-01'):
                    # Details date is just year fallback, try to keep it
                    print(f"      📅 Using fallback date: {details_date}")
                
                detailed_releases.append(details)
                print(f"      ✅ Got details: {details.get('movie_name')} | Release: {details.get('release_date')}")
            else:
                print(f"      ⚠️ Could not fetch details")
        
        print(f"\n✅ Total releases fetched: {len(detailed_releases)}")
        return detailed_releases


# Singleton instance
imdb_scraper = IMDbScraperService()
