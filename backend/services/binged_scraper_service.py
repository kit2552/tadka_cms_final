"""
Binged.com Scraper Service
Specialized scraper for fetching OTT releases from binged.com
"""

import httpx
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
import re
import uuid


class BingedScraperService:
    """Service for fetching OTT release data from binged.com"""
    
    BASE_URL = "https://www.binged.com/streaming-premiere-dates/"
    
    # Language mapping for URL parameters
    LANGUAGE_MAP = {
        'Hindi': 'Hindi',
        'Telugu': 'Telugu',
        'Tamil': 'Tamil',
        'Malayalam': 'Malayalam',
        'Kannada': 'Kannada',
        'Bengali': 'Bengali',
        'Marathi': 'Marathi',
        'Punjabi': 'Punjabi',
        'English': 'English',
        'Gujarati': 'Gujarati',
        'Bhojpuri': 'Bhojpuri',
        'Korean': 'Korean',
        'Japanese': 'Japanese',
        'Spanish': 'Spanish',
        'German': 'German',
        'French': 'French',
    }
    
    # OTT Platform mapping
    OTT_PLATFORM_MAP = {
        'netflix': 'Netflix',
        'amazon': 'Amazon Prime Video',
        'prime': 'Amazon Prime Video',
        'hotstar': 'JioHotstar',
        'jiohotstar': 'JioHotstar',
        'zee5': 'Zee5',
        'sonyliv': 'SonyLIV',
        'sony liv': 'SonyLIV',
        'aha': 'Aha',
        'aha video': 'Aha',
        'mx player': 'MX Player',
        'voot': 'Voot',
        'jio cinema': 'JioCinema',
        'jiocinema': 'JioCinema',
        'apple tv': 'Apple TV+',
        'lionsgate': 'Lionsgate Play',
        'sun nxt': 'Sun NXT',
        'hoichoi': 'Hoichoi',
        'alt balaji': 'ALT Balaji',
        'ullu': 'ULLU',
        'discovery': 'Discovery+',
        'mubi': 'Mubi',
        'crunchyroll': 'Crunchyroll',
        'youtube': 'YouTube',
    }
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
        }
    
    def _build_url(self, language: str, mode: str = 'streaming-now', page: int = 1) -> str:
        """Build binged.com URL with filters"""
        url = f"{self.BASE_URL}?language[]={language}&mode={mode}"
        if page > 1:
            url += f"&paged={page}"
        return url
    
    def _extract_runtime_minutes(self, runtime_str: str) -> Optional[int]:
        """Extract runtime in minutes from string like '2h 7m' or '1h 30m'"""
        if not runtime_str:
            return None
        
        hours = 0
        minutes = 0
        
        hour_match = re.search(r'(\d+)\s*h', runtime_str, re.I)
        min_match = re.search(r'(\d+)\s*m', runtime_str, re.I)
        
        if hour_match:
            hours = int(hour_match.group(1))
        if min_match:
            minutes = int(min_match.group(1))
        
        total = hours * 60 + minutes
        return total if total > 0 else None
    
    def _extract_youtube_url(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract YouTube trailer URL from page"""
        # Look for YouTube embeds
        youtube_patterns = [
            r'(https?://(?:www\.)?youtube\.com/embed/[\w-]+)',
            r'(https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+)',
            r'(https?://youtu\.be/[\w-]+)',
        ]
        
        html_str = str(soup)
        for pattern in youtube_patterns:
            match = re.search(pattern, html_str)
            if match:
                return match.group(1)
        
        # Look for trailer links
        trailer_links = soup.find_all('a', href=re.compile(r'youtube\.com|youtu\.be', re.I))
        if trailer_links:
            return trailer_links[0].get('href')
        
        return None
    
    def _normalize_platform(self, platform_text: str) -> str:
        """Normalize OTT platform name"""
        platform_lower = platform_text.lower().strip()
        
        for key, value in self.OTT_PLATFORM_MAP.items():
            if key in platform_lower:
                return value
        
        # Return cleaned original if no match
        return platform_text.strip()
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date string to ISO format"""
        if not date_str:
            return None
        
        # Try various date formats
        formats = [
            '%d %b %Y',  # 31 Dec 2025
            '%d %B %Y',  # 31 December 2025
            '%Y-%m-%d',
            '%d/%m/%Y',
        ]
        
        date_str = date_str.strip()
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        return None
    
    async def fetch_releases_list(
        self, 
        language: str, 
        mode: str = 'streaming-now',
        limit: int = 20
    ) -> List[Dict]:
        """Fetch list of releases from binged.com listing page"""
        releases = []
        page = 1
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                while len(releases) < limit:
                    url = self._build_url(language, mode, page)
                    print(f"   📄 Fetching page {page}: {url}")
                    
                    response = await client.get(url, headers=self.headers)
                    
                    if response.status_code != 200:
                        print(f"   ❌ Failed to fetch page {page}: HTTP {response.status_code}")
                        break
                    
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Find release links - look for links matching the pattern
                    release_links = soup.find_all('a', href=re.compile(
                        r'/streaming-premiere-dates/[a-z0-9][a-z0-9-]+-(?:movie|web-series|streaming-online-watch)'
                    ))
                    
                    if not release_links:
                        # Try alternate pattern
                        release_links = soup.find_all('a', href=re.compile(
                            r'/streaming-premiere-dates/[a-z0-9-]+-streaming-online-watch'
                        ))
                    
                    # Deduplicate and filter
                    seen_urls = set()
                    page_releases = []
                    
                    for link in release_links:
                        href = link.get('href', '')
                        
                        # Skip if already seen or is the base page
                        if href in seen_urls or href.rstrip('/') == self.BASE_URL.rstrip('/'):
                            continue
                        
                        # Skip filter URLs
                        if '?mode=' in href or '?language' in href:
                            continue
                        
                        seen_urls.add(href)
                        
                        # Make absolute URL
                        if not href.startswith('http'):
                            href = f"https://www.binged.com{href}"
                        
                        title = link.get_text(strip=True)
                        if title and len(title) > 2:
                            page_releases.append({
                                'url': href,
                                'title': title
                            })
                    
                    if not page_releases:
                        print(f"   📭 No more releases found on page {page}")
                        break
                    
                    releases.extend(page_releases)
                    print(f"   ✅ Found {len(page_releases)} releases on page {page}")
                    
                    if len(releases) >= limit:
                        break
                    
                    page += 1
                    await asyncio.sleep(0.5)  # Rate limiting
                
        except Exception as e:
            print(f"   ❌ Error fetching releases list: {e}")
        
        return releases[:limit]
    
    async def fetch_release_details(self, url: str) -> Optional[Dict]:
        """Fetch detailed information for a single release"""
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=self.headers)
                
                if response.status_code != 200:
                    print(f"      ❌ Failed to fetch details: HTTP {response.status_code}")
                    return None
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Extract movie name from h1
                h1 = soup.find('h1')
                movie_name = h1.get_text(strip=True) if h1 else None
                
                # Extract poster image
                poster_img = soup.find('img', src=re.compile(r'bingeddata\.s3\.amazonaws\.com'))
                poster_url = poster_img.get('src') if poster_img else None
                
                # Extract meta description for synopsis
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                synopsis = meta_desc.get('content') if meta_desc else None
                
                # Extract year, runtime, rating from the info line (2025 | Film | 15 | 2h 7m)
                year = None
                runtime = None
                censor_rating = None
                content_type = 'movie'
                
                # Look for the info text pattern
                info_text = soup.get_text()
                
                # Extract year
                year_match = re.search(r'\b(20[0-9]{2})\b', info_text)
                if year_match:
                    year = year_match.group(1)
                
                # Extract runtime
                runtime_match = re.search(r'(\d+h\s*\d*m?)', info_text, re.I)
                if runtime_match:
                    runtime = self._extract_runtime_minutes(runtime_match.group(1))
                
                # Extract genres
                genres = []
                genre_links = soup.find_all('a', href=re.compile(r'\?genre='))
                for g in genre_links:
                    genre_text = g.get_text(strip=True)
                    if genre_text and genre_text not in genres:
                        genres.append(genre_text)
                
                # Extract languages - look for specific language section near genres
                languages = []
                
                # Look for language text near the genres/info section
                # Pattern: "Drama Mystery Malayalam, Tamil, Telugu, Kannada, Hindi"
                genre_links = soup.find_all('a', href=re.compile(r'\?genre='))
                if genre_links:
                    last_genre = genre_links[-1]
                    # Get the parent and look for language text after genres
                    parent = last_genre.parent
                    if parent:
                        parent_text = parent.get_text()
                        # Extract languages after the last genre
                        for lang in self.LANGUAGE_MAP.keys():
                            if re.search(rf'\b{lang}\b', parent_text, re.I):
                                if lang not in languages:
                                    languages.append(lang)
                
                # Also check the title for language hints
                if title_text:
                    title_str = title_text.get_text()
                    for lang in ['Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada', 'Bengali', 'Marathi']:
                        if lang.lower() in title_str.lower() and lang not in languages:
                            languages.append(lang)
                
                # Extract OTT platforms - look for specific streaming date section
                ott_platforms = []
                
                # Look for the streaming date section which contains the actual platform
                streaming_section = soup.find(string=re.compile(r'Streaming Date', re.I))
                if streaming_section:
                    parent = streaming_section.find_parent(['div', 'section', 'a'])
                    if parent:
                        # Look for platform logo in this section
                        platform_img = parent.find('img')
                        if platform_img:
                            alt = platform_img.get('alt', '')
                            platform = self._normalize_platform(alt)
                            if platform and platform not in ott_platforms:
                                ott_platforms.append(platform)
                        # Also check text content
                        section_text = parent.get_text()
                        for key, value in self.OTT_PLATFORM_MAP.items():
                            if re.search(rf'\b{key}\b', section_text, re.I) and value not in ott_platforms:
                                ott_platforms.append(value)
                
                # Also look for platform in title or near the poster
                title_text = soup.find('title')
                if title_text:
                    title_str = title_text.get_text()
                    for key, value in self.OTT_PLATFORM_MAP.items():
                        if re.search(rf'\b{key}\b', title_str, re.I) and value not in ott_platforms:
                            ott_platforms.append(value)
                
                # Extract streaming/release date
                release_date = None
                date_match = re.search(r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})', info_text, re.I)
                if date_match:
                    release_date = self._parse_date(date_match.group(1))
                
                # Extract director
                director = None
                director_section = soup.find(string=re.compile(r'Directed by:', re.I))
                if director_section:
                    parent = director_section.parent
                    if parent:
                        director_link = parent.find_next('a')
                        if director_link:
                            director = director_link.get_text(strip=True)
                
                # Extract cast
                cast = []
                cast_section = soup.find(string=re.compile(r'Starring:|Top Cast', re.I))
                if cast_section:
                    parent = cast_section.parent
                    if parent:
                        next_elem = parent.find_next(['div', 'section'])
                        if next_elem:
                            cast_links = next_elem.find_all('a', href=re.compile(r'/person/'))
                            for c in cast_links[:10]:  # Limit to 10 cast members
                                cast_name = c.get_text(strip=True)
                                if cast_name and cast_name not in cast:
                                    cast.append(cast_name)
                
                # Extract YouTube trailer
                youtube_url = self._extract_youtube_url(soup)
                
                # Determine content type
                if 'web-series' in url.lower() or 'season' in (movie_name or '').lower():
                    content_type = 'web_series'
                elif 'Tv show' in info_text:
                    content_type = 'tv_show'
                elif 'Documentary' in info_text:
                    content_type = 'documentary'
                
                return {
                    'movie_name': movie_name,
                    'content_type': content_type,
                    'year': year,
                    'release_date': release_date,
                    'runtime': runtime,
                    'censor_rating': censor_rating,
                    'genres': genres,
                    'languages': languages if languages else ['English'],
                    'ott_platforms': ott_platforms,
                    'director': director,
                    'cast': cast,
                    'synopsis': synopsis,
                    'poster_url': poster_url,
                    'youtube_url': youtube_url,
                    'source_url': url,
                }
                
        except Exception as e:
            print(f"      ❌ Error fetching release details: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def fetch_ott_releases(
        self,
        language: str,
        streaming_now: bool = True,
        streaming_soon: bool = False,
        limit: int = 20
    ) -> List[Dict]:
        """
        Main method to fetch OTT releases with full details
        
        Args:
            language: Language filter (Hindi, Telugu, Tamil, etc.)
            streaming_now: Include currently streaming releases
            streaming_soon: Include upcoming releases
            limit: Maximum number of releases to fetch
        
        Returns:
            List of release dictionaries with full details
        """
        all_releases = []
        
        print(f"\n🎬 Fetching OTT releases for {language}")
        
        # Fetch from streaming-now
        if streaming_now:
            print(f"\n📺 Fetching 'Streaming Now' releases...")
            now_list = await self.fetch_releases_list(language, 'streaming-now', limit)
            
            for i, release in enumerate(now_list[:limit], 1):
                print(f"   [{i}/{len(now_list)}] Fetching details for: {release['title']}")
                details = await self.fetch_release_details(release['url'])
                if details:
                    details['release_type'] = 'streaming_now'
                    all_releases.append(details)
                await asyncio.sleep(0.3)  # Rate limiting
        
        # Fetch from streaming-soon if requested and we haven't reached limit
        if streaming_soon and len(all_releases) < limit:
            remaining = limit - len(all_releases)
            print(f"\n📅 Fetching 'Streaming Soon' releases...")
            soon_list = await self.fetch_releases_list(language, 'streaming-soon', remaining)
            
            for i, release in enumerate(soon_list[:remaining], 1):
                print(f"   [{i}/{len(soon_list)}] Fetching details for: {release['title']}")
                details = await self.fetch_release_details(release['url'])
                if details:
                    details['release_type'] = 'streaming_soon'
                    all_releases.append(details)
                await asyncio.sleep(0.3)  # Rate limiting
        
        print(f"\n✅ Total releases fetched: {len(all_releases)}")
        return all_releases[:limit]


# Singleton instance
binged_scraper = BingedScraperService()
