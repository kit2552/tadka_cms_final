"""
Release Scraper Service
Fetches OTT/Theater release data from RSS feeds and websites
"""

import httpx
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from database import db
import re
import uuid
from bs4 import BeautifulSoup

# Collection names
RELEASE_SOURCES = "release_sources"
RELEASE_FEED_ITEMS = "release_feed_items"


class ReleaseScraperService:
    """Service for fetching release data from RSS feeds and websites"""
    
    # Language detection patterns
    LANGUAGE_PATTERNS = {
        'Telugu': [r'\btelugu\b', r'\btollywood\b', r'తెలుగు'],
        'Hindi': [r'\bhindi\b', r'\bbollywood\b', r'हिंदी', r'हिन्दी'],
        'Tamil': [r'\btamil\b', r'\bkollywood\b', r'தமிழ்'],
        'Kannada': [r'\bkannada\b', r'\bsandalwood\b', r'ಕನ್ನಡ'],
        'Malayalam': [r'\bmalayalam\b', r'\bmollywood\b', r'മലയാളം'],
        'Bengali': [r'\bbengali\b', r'\bbangla\b', r'বাংলা'],
        'Marathi': [r'\bmarathi\b', r'मराठी'],
        'Punjabi': [r'\bpunjabi\b', r'ਪੰਜਾਬੀ'],
        'English': [r'\benglish\b', r'\bhollywood\b'],
        'Korean': [r'\bkorean\b', r'\bk-drama\b', r'\bkdrama\b'],
        'Spanish': [r'\bspanish\b', r'\blatino\b'],
        'Japanese': [r'\bjapanese\b', r'\banime\b'],
    }
    
    # Content type detection patterns
    CONTENT_TYPE_PATTERNS = {
        'web_series': [r'\bseason\s*\d+', r'\bweb\s*series\b', r'\bseries\b', r'\bepisode', r'\bs\d+\s*e\d+'],
        'documentary': [r'\bdocumentary\b', r'\bdocu-series\b', r'\bdocuseries\b'],
        'tv_show': [r'\btv\s*show\b', r'\breality\s*show\b', r'\bgame\s*show\b'],
        'movie': [r'\bmovie\b', r'\bfilm\b', r'\bcinema\b'],
        'ott': [r'\bott\b', r'\bstreaming\b', r'\bnetflix\b', r'\bprime\s*video\b', r'\bhotstar\b', r'\bjiohotstar\b', r'\bzee5\b', r'\bsonyliv\b', r'\baha\b'],
        'theater': [r'\btheater\b', r'\btheatre\b', r'\btheatrical\b', r'\bbox\s*office\b', r'\bcinema\s*release\b']
    }
    
    # OTT Platform patterns
    OTT_PLATFORMS = {
        'Netflix': [r'\bnetflix\b'],
        'Amazon Prime Video': [r'\bprime\s*video\b', r'\bamazon\s*prime\b'],
        'JioHotstar': [r'\bjiohotstar\b', r'\bhotstar\b', r'\bdisney\+?\s*hotstar\b'],
        'Zee5': [r'\bzee5\b', r'\bzee\s*5\b'],
        'SonyLIV': [r'\bsonyliv\b', r'\bsony\s*liv\b'],
        'Aha': [r'\baha\b', r'\baha\s*video\b'],
        'MX Player': [r'\bmx\s*player\b'],
        'Voot': [r'\bvoot\b'],
        'Apple TV+': [r'\bapple\s*tv\b'],
        'Lionsgate Play': [r'\blionsgate\b'],
        'JioCinema': [r'\bjiocinema\b', r'\bjio\s*cinema\b'],
        'Sun NXT': [r'\bsun\s*nxt\b'],
        'Crunchyroll': [r'\bcrunchyroll\b'],
    }
    
    def __init__(self):
        self.is_running = False
    
    def _detect_languages(self, text: str) -> List[str]:
        """Detect all languages mentioned in text"""
        text_lower = text.lower()
        detected = []
        
        for lang, patterns in self.LANGUAGE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    if lang not in detected:
                        detected.append(lang)
                    break
        
        return detected if detected else ['English']  # Default to English
    
    def _detect_content_type(self, text: str, url: str = "") -> str:
        """Detect content type from text and URL"""
        text_lower = text.lower()
        url_lower = url.lower()
        combined = f"{text_lower} {url_lower}"
        
        # Check URL patterns first (more reliable)
        if '/web-series' in url_lower or 'web-series' in url_lower:
            return 'web_series'
        if '/movies' in url_lower or '/movie' in url_lower:
            return 'movie'
        if '/documentary' in url_lower:
            return 'documentary'
        if '/tv-show' in url_lower or '/tv-shows' in url_lower:
            return 'tv_show'
        
        # Check for season indicators (strong web series signal)
        if re.search(r'\bseason\s*\d+', combined, re.IGNORECASE):
            return 'web_series'
        
        # Check content patterns
        for ctype, patterns in self.CONTENT_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, combined, re.IGNORECASE):
                    if ctype in ['ott', 'theater']:
                        continue  # These are release types, not content types
                    return ctype
        
        return 'movie'  # Default to movie
    
    def _detect_release_type(self, text: str, url: str = "") -> str:
        """Detect if it's OTT or Theater release"""
        text_lower = text.lower()
        url_lower = url.lower()
        combined = f"{text_lower} {url_lower}"
        
        # Check for OTT patterns
        ott_patterns = [
            r'\bott\b', r'\bstreaming\b', r'\bnow\s*streaming\b',
            r'\bavailable\s*on\b', r'\bwatch\s*on\b', r'\bstreams\s*on\b'
        ]
        for pattern in ott_patterns:
            if re.search(pattern, combined, re.IGNORECASE):
                return 'ott'
        
        # Check for OTT platform names
        for platform, patterns in self.OTT_PLATFORMS.items():
            for pattern in patterns:
                if re.search(pattern, combined, re.IGNORECASE):
                    return 'ott'
        
        # Check for theater patterns
        theater_patterns = [
            r'\btheater\b', r'\btheatre\b', r'\btheatrical\b',
            r'\bbox\s*office\b', r'\bcinema\s*release\b', r'\breleasing\s*in\s*theaters\b'
        ]
        for pattern in theater_patterns:
            if re.search(pattern, combined, re.IGNORECASE):
                return 'theater'
        
        return 'ott'  # Default to OTT
    
    def _detect_ott_platforms(self, text: str) -> List[str]:
        """Detect OTT platforms mentioned in text"""
        text_lower = text.lower()
        detected = []
        
        for platform, patterns in self.OTT_PLATFORMS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    if platform not in detected:
                        detected.append(platform)
                    break
        
        return detected
    
    def _extract_youtube_url(self, text: str, html: str = "") -> Optional[str]:
        """Extract YouTube URL from text or HTML"""
        combined = f"{text} {html}"
        
        # YouTube URL patterns
        patterns = [
            r'(https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+)',
            r'(https?://youtu\.be/[\w-]+)',
            r'(https?://(?:www\.)?youtube\.com/embed/[\w-]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, combined)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_date(self, text: str) -> Optional[str]:
        """Extract release date from text"""
        # Common date patterns
        patterns = [
            r'(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*(\d{4})',
            r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})\s*,?\s*(\d{4})',
            r'(\d{4})-(\d{2})-(\d{2})',
            r'(\d{1,2})/(\d{1,2})/(\d{4})'
        ]
        
        month_map = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        }
        
        text_lower = text.lower()
        
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                groups = match.groups()
                try:
                    if pattern.startswith(r'(\d{1,2})'):
                        day = groups[0].zfill(2)
                        month = month_map.get(groups[1][:3], '01')
                        year = groups[2]
                    elif pattern.startswith(r'(jan'):
                        month = month_map.get(groups[0][:3], '01')
                        day = groups[1].zfill(2)
                        year = groups[2]
                    elif pattern.startswith(r'(\d{4})'):
                        year, month, day = groups
                    else:
                        month, day, year = groups
                        month = month.zfill(2)
                        day = day.zfill(2)
                    
                    return f"{year}-{month}-{day}"
                except:
                    continue
        
        return None
    
    def _normalize_movie_name(self, name: str) -> str:
        """Normalize movie name for duplicate detection"""
        # Remove special characters and extra spaces
        normalized = re.sub(r'[^\w\s]', '', name.lower())
        normalized = ' '.join(normalized.split())
        return normalized
    
    def _create_unique_key(self, movie_name: str, content_type: str) -> str:
        """Create unique key for duplicate detection"""
        normalized_name = self._normalize_movie_name(movie_name)
        return f"{normalized_name}:{content_type}"
    
    def _item_exists(self, movie_name: str, content_type: str) -> bool:
        """Check if item already exists in the database"""
        unique_key = self._create_unique_key(movie_name, content_type)
        existing = db[RELEASE_FEED_ITEMS].find_one({"unique_key": unique_key})
        return existing is not None
    
    async def fetch_rss_feed(self, source: Dict) -> List[Dict]:
        """Fetch items from RSS feed"""
        url = source.get('source_url')
        content_filter = source.get('content_filter', 'auto_detect')
        language_filter = source.get('language_filter', 'all')
        
        items = []
        
        # Browser-like headers to avoid 403 errors
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code != 200:
                    print(f"❌ RSS fetch failed for {source['source_name']}: HTTP {response.status_code}")
                    return []
                
                # Parse RSS XML
                root = ET.fromstring(response.text)
                
                # Handle different RSS formats
                channel = root.find('channel')
                if channel is not None:
                    entries = channel.findall('item')
                else:
                    # Atom format
                    ns = {'atom': 'http://www.w3.org/2005/Atom'}
                    entries = root.findall('atom:entry', ns)
                
                for entry in entries:
                    try:
                        # Extract data based on RSS format
                        if channel is not None:
                            title = entry.findtext('title', '')
                            link = entry.findtext('link', '')
                            description = entry.findtext('description', '')
                            pub_date = entry.findtext('pubDate', '')
                        else:
                            title = entry.findtext('atom:title', '', ns)
                            link_elem = entry.find('atom:link', ns)
                            link = link_elem.get('href', '') if link_elem is not None else ''
                            description = entry.findtext('atom:summary', '', ns) or entry.findtext('atom:content', '', ns)
                            pub_date = entry.findtext('atom:published', '', ns)
                        
                        if not title:
                            continue
                        
                        # Clean HTML from description
                        if description:
                            soup = BeautifulSoup(description, 'html.parser')
                            description = soup.get_text(separator=' ', strip=True)
                        
                        combined_text = f"{title} {description}"
                        
                        # Detect languages
                        languages = self._detect_languages(combined_text)
                        
                        # Apply language filter
                        if language_filter != 'all':
                            if language_filter not in languages:
                                continue
                        
                        # Detect content type
                        if content_filter == 'auto_detect':
                            content_type = self._detect_content_type(combined_text, link)
                        else:
                            content_type = content_filter.replace('_only', '')
                        
                        # Detect release type
                        release_type = self._detect_release_type(combined_text, link)
                        
                        # Apply content filter
                        if content_filter != 'auto_detect':
                            filter_type = content_filter.replace('_only', '')
                            if filter_type in ['ott', 'theater']:
                                if release_type != filter_type:
                                    continue
                            elif content_type != filter_type:
                                continue
                        
                        # Detect OTT platforms
                        ott_platforms = self._detect_ott_platforms(combined_text)
                        
                        # Extract release date
                        release_date = self._extract_date(combined_text) or self._extract_date(pub_date)
                        
                        # Extract movie name from title (clean up common suffixes)
                        movie_name = re.sub(
                            r'\s*(OTT|Release|Date|Now|Streaming|Available|When|Where|Watch|Online|Season\s*\d+).*$',
                            '', title, flags=re.IGNORECASE
                        ).strip()
                        movie_name = re.sub(r'\s*[:\-|]\s*$', '', movie_name).strip()
                        
                        if not movie_name:
                            movie_name = title[:100]
                        
                        # Create unique key
                        unique_key = self._create_unique_key(movie_name, content_type)
                        
                        # Check for duplicates
                        if self._item_exists(movie_name, content_type):
                            continue
                        
                        item = {
                            'id': str(uuid.uuid4()),
                            'source_id': source.get('id'),
                            'source_name': source.get('source_name'),
                            'unique_key': unique_key,
                            'movie_name': movie_name,
                            'original_title': title,
                            'description': description[:2000] if description else '',
                            'source_url': link,
                            'content_type': content_type,
                            'release_type': release_type,
                            'languages': languages,
                            'ott_platforms': ott_platforms,
                            'release_date': release_date,
                            'youtube_url': self._extract_youtube_url(combined_text),
                            'thumbnail': None,
                            'cast': [],
                            'director': None,
                            'producer': None,
                            'is_used': False,
                            'is_skipped': False,
                            'fetched_at': datetime.now(timezone.utc),
                            'raw_data': {
                                'title': title,
                                'link': link,
                                'pub_date': pub_date
                            }
                        }
                        
                        items.append(item)
                        
                    except Exception as e:
                        print(f"   ⚠️ Error parsing RSS entry: {e}")
                        continue
                
                print(f"   ✅ {source['source_name']}: {len(items)} new items from RSS")
                return items
                
        except Exception as e:
            print(f"❌ RSS error for {source['source_name']}: {e}")
            return []
    
    async def fetch_website(self, source: Dict) -> List[Dict]:
        """Fetch items from website scraping"""
        url = source.get('source_url')
        content_filter = source.get('content_filter', 'auto_detect')
        language_filter = source.get('language_filter', 'all')
        
        items = []
        
        # Browser-like headers to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code != 200:
                    print(f"❌ Website fetch failed for {source['source_name']}: HTTP {response.status_code}")
                    return []
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Debug: Print page title to verify fetch
                page_title = soup.find('title')
                print(f"   📄 Page title: {page_title.get_text() if page_title else 'N/A'}")
                
                # Try to find article/item containers (common patterns)
                article_selectors = [
                    'article',
                    '.article',
                    '.post',
                    '.item',
                    '.card',
                    '.movie-item',
                    '.release-item',
                    '.content-item',
                    '[class*="movie"]',
                    '[class*="release"]',
                    'li[class*="item"]',
                    '.entry',
                    '.post-item',
                    '.grid-item'
                ]
                
                articles = []
                for selector in article_selectors:
                    found = soup.select(selector)
                    if found and len(found) > 3:  # At least 3 items to be considered a list
                        articles = found
                        break
                
                if not articles:
                    # Fallback: Look for links with movie-like patterns
                    articles = soup.find_all('a', href=re.compile(r'(movie|series|film|release|watch|stream)', re.I))
                
                for article in articles[:50]:  # Limit to 50 items
                    try:
                        # Extract title and link
                        if article.name == 'a':
                            title_elem = article
                            link = article.get('href', '')
                        else:
                            title_elem = article.find(['h1', 'h2', 'h3', 'h4', 'a'])
                            link_elem = article.find('a')
                            link = link_elem.get('href', '') if link_elem else ''
                        
                        title = title_elem.get_text(strip=True) if title_elem else ''
                        
                        if not title or len(title) < 3:
                            continue
                        
                        # Make link absolute
                        if link and not link.startswith('http'):
                            from urllib.parse import urljoin
                            link = urljoin(url, link)
                        
                        # Extract description
                        desc_elem = article.find(['p', '.description', '.summary', '.excerpt'])
                        description = desc_elem.get_text(strip=True) if desc_elem else ''
                        
                        # Extract thumbnail
                        img_elem = article.find('img')
                        thumbnail = img_elem.get('src') or img_elem.get('data-src') if img_elem else None
                        if thumbnail and not thumbnail.startswith('http'):
                            from urllib.parse import urljoin
                            thumbnail = urljoin(url, thumbnail)
                        
                        combined_text = f"{title} {description}"
                        
                        # Detect languages
                        languages = self._detect_languages(combined_text)
                        
                        # Apply language filter
                        if language_filter != 'all':
                            if language_filter not in languages:
                                continue
                        
                        # Detect content type
                        if content_filter == 'auto_detect':
                            content_type = self._detect_content_type(combined_text, link)
                        else:
                            content_type = content_filter.replace('_only', '')
                        
                        # Detect release type
                        release_type = self._detect_release_type(combined_text, link)
                        
                        # Apply content filter
                        if content_filter != 'auto_detect':
                            filter_type = content_filter.replace('_only', '')
                            if filter_type in ['ott', 'theater']:
                                if release_type != filter_type:
                                    continue
                            elif content_type != filter_type:
                                continue
                        
                        # Detect OTT platforms
                        ott_platforms = self._detect_ott_platforms(combined_text)
                        
                        # Extract release date
                        date_elem = article.find(['time', '.date', '.release-date', '[datetime]'])
                        date_text = date_elem.get_text(strip=True) if date_elem else combined_text
                        release_date = self._extract_date(date_text)
                        
                        # Extract movie name
                        movie_name = re.sub(
                            r'\s*(OTT|Release|Date|Now|Streaming|Available|When|Where|Watch|Online|Season\s*\d+).*$',
                            '', title, flags=re.IGNORECASE
                        ).strip()
                        movie_name = re.sub(r'\s*[:\-|]\s*$', '', movie_name).strip()
                        
                        if not movie_name:
                            movie_name = title[:100]
                        
                        # Create unique key
                        unique_key = self._create_unique_key(movie_name, content_type)
                        
                        # Check for duplicates
                        if self._item_exists(movie_name, content_type):
                            continue
                        
                        item = {
                            'id': str(uuid.uuid4()),
                            'source_id': source.get('id'),
                            'source_name': source.get('source_name'),
                            'unique_key': unique_key,
                            'movie_name': movie_name,
                            'original_title': title,
                            'description': description[:2000] if description else '',
                            'source_url': link,
                            'content_type': content_type,
                            'release_type': release_type,
                            'languages': languages,
                            'ott_platforms': ott_platforms,
                            'release_date': release_date,
                            'youtube_url': None,
                            'thumbnail': thumbnail,
                            'cast': [],
                            'director': None,
                            'producer': None,
                            'is_used': False,
                            'is_skipped': False,
                            'fetched_at': datetime.now(timezone.utc),
                            'raw_data': {
                                'title': title,
                                'link': link
                            }
                        }
                        
                        items.append(item)
                        
                    except Exception as e:
                        print(f"   ⚠️ Error parsing article: {e}")
                        continue
                
                print(f"   ✅ {source['source_name']}: {len(items)} new items from website")
                return items
                
        except Exception as e:
            print(f"❌ Website error for {source['source_name']}: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def scrape_article_details(self, item: Dict) -> Dict:
        """Scrape full article to get more details (trailer, cast, etc.)"""
        url = item.get('source_url')
        if not url:
            return item
        
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                response = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })
                
                if response.status_code != 200:
                    return item
                
                soup = BeautifulSoup(response.text, 'html.parser')
                html_text = response.text
                
                # Extract YouTube URL
                if not item.get('youtube_url'):
                    # Look for YouTube embeds or links
                    youtube_url = self._extract_youtube_url('', html_text)
                    if youtube_url:
                        item['youtube_url'] = youtube_url
                
                # Extract thumbnail if not found
                if not item.get('thumbnail'):
                    og_image = soup.find('meta', property='og:image')
                    if og_image:
                        item['thumbnail'] = og_image.get('content')
                
                # Try to extract more details from article content
                article_body = soup.find(['article', '.article-content', '.post-content', '.entry-content'])
                if article_body:
                    body_text = article_body.get_text(separator=' ', strip=True)
                    
                    # Update description if empty
                    if not item.get('description'):
                        item['description'] = body_text[:2000]
                    
                    # Detect more languages
                    more_languages = self._detect_languages(body_text)
                    for lang in more_languages:
                        if lang not in item['languages']:
                            item['languages'].append(lang)
                    
                    # Detect more OTT platforms
                    more_platforms = self._detect_ott_platforms(body_text)
                    for platform in more_platforms:
                        if platform not in item['ott_platforms']:
                            item['ott_platforms'].append(platform)
                    
                    # Try to extract release date if not found
                    if not item.get('release_date'):
                        item['release_date'] = self._extract_date(body_text)
                
                return item
                
        except Exception as e:
            print(f"   ⚠️ Error scraping article details: {e}")
            return item
    
    async def fetch_source(self, source: Dict) -> Dict:
        """Fetch items from a single source"""
        source_type = source.get('source_type', 'rss')
        
        print(f"\n🔄 Fetching: {source['source_name']} ({source_type})")
        
        if source_type == 'rss':
            items = await self.fetch_rss_feed(source)
        else:
            items = await self.fetch_website(source)
        
        # Scrape article details for each item
        enriched_items = []
        for item in items[:20]:  # Limit to 20 for detail scraping (avoid rate limiting)
            enriched = await self.scrape_article_details(item)
            enriched_items.append(enriched)
            await asyncio.sleep(0.5)  # Rate limiting
        
        # Add remaining items without enrichment
        enriched_items.extend(items[20:])
        
        # Store items in database
        new_count = 0
        for item in enriched_items:
            try:
                # Double-check for duplicates before inserting
                existing = db[RELEASE_FEED_ITEMS].find_one({"unique_key": item['unique_key']})
                if not existing:
                    db[RELEASE_FEED_ITEMS].insert_one(item)
                    new_count += 1
            except Exception as e:
                print(f"   ⚠️ Error storing item: {e}")
        
        # Update source last_fetch
        db[RELEASE_SOURCES].update_one(
            {"id": source['id']},
            {"$set": {"last_fetch": datetime.now(timezone.utc)}}
        )
        
        return {
            "source_name": source['source_name'],
            "total_fetched": len(items),
            "new_items": new_count
        }
    
    async def fetch_all_sources(self) -> Dict:
        """Fetch all active sources"""
        if self.is_running:
            return {"success": False, "message": "Fetch already running"}
        
        self.is_running = True
        print("\n🔄 Starting Release Sources Fetch...")
        
        try:
            sources = list(db[RELEASE_SOURCES].find({"is_active": True}))
            
            if not sources:
                return {"success": False, "message": "No active sources found"}
            
            results = []
            total_new = 0
            
            for source in sources:
                result = await self.fetch_source(source)
                results.append(result)
                total_new += result['new_items']
                await asyncio.sleep(1)  # Rate limiting between sources
            
            return {
                "success": True,
                "sources_fetched": len(sources),
                "total_new_items": total_new,
                "results": results
            }
            
        except Exception as e:
            print(f"❌ Fetch error: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": str(e)}
        finally:
            self.is_running = False


# Singleton instance
release_scraper_service = ReleaseScraperService()
