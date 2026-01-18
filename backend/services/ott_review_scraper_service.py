"""
OTT Review Scraper Service
Scrapes OTT movie and web series reviews from binged.com/category/reviews/
"""
import httpx
from bs4 import BeautifulSoup
from dataclasses import dataclass, field
from typing import List, Optional, Dict
import re
import json
import asyncio


@dataclass
class OTTReviewData:
    """Data structure for OTT review information"""
    title: str = ""
    content_type: str = ""  # 'movie' or 'webseries'
    rating: float = 0.0
    rating_scale: float = 5.0
    
    # Review sections (binged.com structure)
    story_synopsis: str = ""  # "What Is the Story About?"
    performances: str = ""  # "Performances?"
    analysis: str = ""  # "Analysis"
    technical_aspects: str = ""  # "Music and Other Departments?"
    other_artists: str = ""  # "Other Artists?"
    highlights: str = ""  # "Highlights?" - What Works
    drawbacks: str = ""  # "Drawbacks?" - What Doesn't Work
    verdict: str = ""  # "Did I Enjoy It?" + "Will You Recommend It?"
    bottom_line: str = ""  # BOTTOM LINE tagline
    
    # Full review content (fallback)
    review_content: str = ""
    
    # Source info
    source_url: str = ""
    source_name: str = "Binged"
    binged_detail_url: str = ""  # URL to the movie/series detail page on binged
    
    # Movie/Series info (to be filled from OTT releases data)
    cast: str = ""
    director: str = ""
    platforms: List[str] = field(default_factory=list)  # OTT platforms
    languages: List[str] = field(default_factory=list)  # Available languages
    original_language: str = ""  # Original language of the content
    runtime: str = ""
    genre: str = ""
    release_date: str = ""
    poster_image: str = ""
    youtube_url: str = ""
    synopsis: str = ""


class OTTReviewScraper:
    """Scraper for OTT reviews from binged.com"""
    
    BASE_URL = "https://www.binged.com"
    REVIEWS_URL = "https://www.binged.com/category/reviews/"
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'Referer': 'https://www.binged.com/',
        }
    
    async def get_review_links(self, max_links: int = 10, page: int = 1) -> List[Dict]:
        """
        Get review article links from binged.com reviews listing page
        
        Returns list of dicts with 'url' and 'title' keys
        """
        url = f"{self.REVIEWS_URL}page/{page}/" if page > 1 else self.REVIEWS_URL
        print(f"🔍 Fetching OTT review links from {url}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, http2=True) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                review_links = []
                
                # Find review article links - binged.com uses specific patterns
                # Look for links to /reviews/ URLs
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '')
                    
                    # Review URLs contain /reviews/ in the path
                    if '/reviews/' in href and href != self.REVIEWS_URL:
                        if href.startswith('/'):
                            full_url = self.BASE_URL + href
                        elif href.startswith('http'):
                            full_url = href
                        else:
                            continue
                        
                        # Skip category and pagination URLs
                        if '/category/' in full_url or '/page/' in full_url:
                            continue
                        
                        # Get title from link text or parent
                        title = link.get_text(strip=True)
                        
                        # Skip if already have this URL
                        if any(r['url'] == full_url for r in review_links):
                            continue
                        
                        # Skip very short or empty titles
                        if title and len(title) > 5:
                            review_links.append({
                                'url': full_url,
                                'title': title
                            })
                            print(f"   ✅ Found: {title[:50]}...")
                            
                            if len(review_links) >= max_links:
                                break
                
                print(f"   📋 Found {len(review_links)} review links")
                return review_links[:max_links]
                
        except Exception as e:
            print(f"   ❌ Error fetching review links: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    async def scrape_review(self, url: str) -> OTTReviewData:
        """
        Scrape a single OTT review from binged.com
        Extracts structured sections like Story, Performances, Analysis, etc.
        """
        print(f"🎬 Scraping OTT review from: {url}")
        
        data = OTTReviewData()
        data.source_url = url
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, http2=True) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Extract title from h1
                title_elem = soup.find('h1')
                if title_elem:
                    data.title = title_elem.get_text(strip=True)
                    # Clean title - remove common suffixes
                    data.title = re.sub(r'\s*Review$', '', data.title, flags=re.IGNORECASE)
                    print(f"   📝 Title: {data.title}")
                
                # Detect content type from title or URL
                url_lower = url.lower()
                title_lower = (data.title or '').lower()
                if any(kw in title_lower or kw in url_lower for kw in ['web series', 'web-series', 'series review', 'season', 'webseries']):
                    data.content_type = 'webseries'
                else:
                    data.content_type = 'movie'
                print(f"   📺 Content Type: {data.content_type}")
                
                # Extract rating - look for the rating display
                rating_div = soup.find('div', string=re.compile(r'^\s*\d+\s*/\s*\d+\s*$'))
                if rating_div:
                    match = re.search(r'(\d+(?:\.\d+)?)\s*/\s*(\d+)', rating_div.get_text())
                    if match:
                        data.rating = float(match.group(1))
                        data.rating_scale = float(match.group(2))
                
                # Also try structured data
                if data.rating == 0:
                    script_tags = soup.find_all('script', type='application/ld+json')
                    for script in script_tags:
                        try:
                            json_data = json.loads(script.string)
                            if isinstance(json_data, dict):
                                if 'reviewRating' in json_data:
                                    rating_obj = json_data['reviewRating']
                                    data.rating = float(rating_obj.get('ratingValue', 0))
                                    data.rating_scale = float(rating_obj.get('bestRating', 5))
                                elif '@graph' in json_data:
                                    for item in json_data['@graph']:
                                        if item.get('@type') == 'Review' and 'reviewRating' in item:
                                            rating_obj = item['reviewRating']
                                            data.rating = float(rating_obj.get('ratingValue', 0))
                                            data.rating_scale = float(rating_obj.get('bestRating', 5))
                        except (json.JSONDecodeError, TypeError, ValueError):
                            continue
                
                # Fallback: search in page text
                if data.rating == 0:
                    page_text = soup.get_text()
                    match = re.search(r'Rating[:\s]*(\d+(?:\.\d+)?)\s*/\s*(\d+)', page_text, re.IGNORECASE)
                    if match:
                        data.rating = float(match.group(1))
                        data.rating_scale = float(match.group(2))
                
                print(f"   ⭐ Rating: {data.rating}/{data.rating_scale}")
                
                # Extract BOTTOM LINE tagline
                bottom_line_elem = soup.find(string=re.compile(r'BOTTOM LINE', re.IGNORECASE))
                if bottom_line_elem:
                    parent = bottom_line_elem.find_parent()
                    if parent:
                        # Get the next text element
                        next_elem = parent.find_next_sibling()
                        if next_elem:
                            data.bottom_line = next_elem.get_text(strip=True)
                        else:
                            # Try getting text after "BOTTOM LINE:"
                            full_text = parent.get_text(strip=True)
                            match = re.search(r'BOTTOM LINE[:\s]*(.+)', full_text, re.IGNORECASE)
                            if match:
                                data.bottom_line = match.group(1).strip()
                
                print(f"   📌 Bottom Line: {data.bottom_line[:50] if data.bottom_line else 'None'}...")
                
                # Find article content
                article = soup.find('article') or soup.find('div', class_=re.compile(r'entry-content|post-content|article-content', re.I))
                
                if article:
                    # Extract sections by h3 headers (binged.com uses h3 for section headers)
                    sections = self._extract_sections(article)
                    
                    # Map sections to data fields
                    data.story_synopsis = sections.get('story', '') or sections.get('synopsis', '') or sections.get('what is the story about', '')
                    data.performances = sections.get('performances', '') or sections.get('performance', '')
                    data.analysis = sections.get('analysis', '')
                    data.technical_aspects = sections.get('music and other departments', '') or sections.get('technical', '') or sections.get('music', '')
                    data.other_artists = sections.get('other artists', '')
                    data.highlights = sections.get('highlights', '') or sections.get('what works', '') or sections.get('positives', '')
                    data.drawbacks = sections.get('drawbacks', '') or sections.get('what doesn\'t work', '') or sections.get('negatives', '')
                    
                    # Verdict combines multiple sections
                    verdict_parts = []
                    if sections.get('did i enjoy it', ''):
                        verdict_parts.append(sections['did i enjoy it'])
                    if sections.get('will you recommend it', ''):
                        verdict_parts.append(sections['will you recommend it'])
                    if sections.get('verdict', ''):
                        verdict_parts.append(sections['verdict'])
                    if sections.get('final thoughts', ''):
                        verdict_parts.append(sections['final thoughts'])
                    data.verdict = '\n\n'.join(verdict_parts)
                    
                    # Build full review content from all paragraphs
                    paragraphs = article.find_all('p')
                    content_parts = []
                    for p in paragraphs:
                        text = p.get_text(strip=True)
                        if text and len(text) > 30 and not any(skip in text.lower() for skip in ['share', 'follow', 'subscribe', 'we are hiring', 'interested candidates']):
                            content_parts.append(text)
                    data.review_content = '\n\n'.join(content_parts)
                    
                    print(f"   📄 Sections extracted:")
                    print(f"      Story: {len(data.story_synopsis)} chars")
                    print(f"      Performances: {len(data.performances)} chars")
                    print(f"      Analysis: {len(data.analysis)} chars")
                    print(f"      Technical: {len(data.technical_aspects)} chars")
                    print(f"      Highlights: {len(data.highlights)} chars")
                    print(f"      Drawbacks: {len(data.drawbacks)} chars")
                    print(f"      Verdict: {len(data.verdict)} chars")
                
                # Try to find link to the movie/series detail page on binged
                detail_link = soup.find('a', href=re.compile(r'/streaming-premiere-dates/.*-streaming-online', re.I))
                if detail_link:
                    data.binged_detail_url = detail_link.get('href', '')
                    if data.binged_detail_url.startswith('/'):
                        data.binged_detail_url = self.BASE_URL + data.binged_detail_url
                    print(f"   🔗 Detail URL: {data.binged_detail_url}")
                
                # Extract poster/featured image
                img = soup.find('img', class_=re.compile(r'featured|poster|main|wp-post-image', re.I))
                if img:
                    data.poster_image = img.get('src', '') or img.get('data-src', '')
                
                # Extract YouTube trailer URL if present
                youtube_iframe = soup.find('iframe', src=re.compile(r'youtube\.com|youtu\.be'))
                if youtube_iframe:
                    src = youtube_iframe.get('src', '')
                    video_id_match = re.search(r'(?:embed/|v=)([a-zA-Z0-9_-]+)', src)
                    if video_id_match:
                        data.youtube_url = f"https://www.youtube.com/watch?v={video_id_match.group(1)}"
                
                # Also look for YouTube links in content
                if not data.youtube_url:
                    youtube_link = soup.find('a', href=re.compile(r'youtube\.com/watch|youtu\.be'))
                    if youtube_link:
                        data.youtube_url = youtube_link.get('href', '')
                
                return data
                
        except Exception as e:
            print(f"   ❌ Error scraping review: {str(e)}")
            import traceback
            traceback.print_exc()
            data.title = self._extract_title_from_url(url)
            return data
    
    def _extract_sections(self, article) -> Dict[str, str]:
        """Extract content sections from the article based on h3 headers"""
        sections = {}
        
        # Find all h3 headers
        headers = article.find_all('h3')
        
        for header in headers:
            header_text = header.get_text(strip=True).lower()
            # Remove question marks and clean up
            header_text = re.sub(r'\?+$', '', header_text).strip()
            
            # Get all content until next h3 or end
            content_parts = []
            for sibling in header.find_next_siblings():
                if sibling.name == 'h3':
                    break
                if sibling.name == 'p':
                    text = sibling.get_text(strip=True)
                    if text and len(text) > 10:
                        content_parts.append(text)
                elif sibling.name == 'ul':
                    # Handle bullet lists (highlights/drawbacks)
                    for li in sibling.find_all('li'):
                        text = li.get_text(strip=True)
                        if text:
                            content_parts.append(f"• {text}")
            
            if content_parts:
                sections[header_text] = '\n\n'.join(content_parts)
        
        return sections
    
    def _extract_title_from_url(self, url: str) -> str:
        """Extract title from URL as fallback"""
        slug = url.rstrip('/').split('/')[-1]
        slug = re.sub(r'-review.*$', '', slug, flags=re.IGNORECASE)
        slug = re.sub(r'-web-series.*$', '', slug, flags=re.IGNORECASE)
        slug = re.sub(r'-movie.*$', '', slug, flags=re.IGNORECASE)
        slug = re.sub(r'-ott.*$', '', slug, flags=re.IGNORECASE)
        return slug.replace('-', ' ').title()


# Singleton instance
ott_review_scraper = OTTReviewScraper()
