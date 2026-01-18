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
    review_content: str = ""
    verdict: str = ""
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
                
                # Find review article links - they typically have a specific pattern
                # Looking for article cards with links to reviews
                for article in soup.find_all(['article', 'div'], class_=re.compile(r'post|article|entry|card', re.I)):
                    link = article.find('a', href=True)
                    if not link:
                        continue
                    
                    href = link.get('href', '')
                    
                    # Review URLs typically contain these patterns
                    if not any(pattern in href.lower() for pattern in ['review', '/reviews/']):
                        # Also check title link if exists
                        title_link = article.find('a', class_=re.compile(r'title|heading', re.I), href=True)
                        if title_link:
                            href = title_link.get('href', '')
                    
                    # Skip if not a review link
                    if not href or 'binged.com' not in href and not href.startswith('/'):
                        continue
                    
                    # Make absolute URL
                    if href.startswith('/'):
                        full_url = self.BASE_URL + href
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        continue
                    
                    # Extract title
                    title_elem = article.find(['h2', 'h3', 'h4', 'a'], class_=re.compile(r'title|heading', re.I))
                    title = title_elem.get_text(strip=True) if title_elem else ''
                    
                    if not title:
                        title = link.get_text(strip=True)
                    
                    # Skip duplicates and non-review pages
                    if any(r['url'] == full_url for r in review_links):
                        continue
                    
                    # Skip category pages
                    if '/category/' in full_url and full_url != self.REVIEWS_URL:
                        continue
                    
                    review_links.append({
                        'url': full_url,
                        'title': title
                    })
                    print(f"   ✅ Found: {title[:50]}...")
                    
                    if len(review_links) >= max_links:
                        break
                
                # If no articles found with class-based search, try direct link search
                if not review_links:
                    for link in soup.find_all('a', href=True):
                        href = link.get('href', '')
                        
                        # Look for review links
                        if '-review' in href.lower() or '/review/' in href.lower():
                            if href.startswith('/'):
                                full_url = self.BASE_URL + href
                            elif href.startswith('http'):
                                full_url = href
                            else:
                                continue
                            
                            title = link.get_text(strip=True)
                            
                            if any(r['url'] == full_url for r in review_links):
                                continue
                            
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
                    # Clean title - remove common prefixes/suffixes
                    data.title = re.sub(r'^Review:\s*', '', data.title, flags=re.IGNORECASE)
                    data.title = re.sub(r'\s*Review$', '', data.title, flags=re.IGNORECASE)
                    data.title = re.sub(r'\s*\(\d{4}\)\s*$', '', data.title)  # Remove year at end
                    print(f"   📝 Title: {data.title}")
                
                # Detect content type from title or URL
                url_lower = url.lower()
                title_lower = (data.title or '').lower()
                if any(kw in title_lower or kw in url_lower for kw in ['web series', 'web-series', 'series review', 'season']):
                    data.content_type = 'webseries'
                else:
                    data.content_type = 'movie'
                print(f"   📺 Content Type: {data.content_type}")
                
                # Extract rating - look for various patterns
                rating_patterns = [
                    r'(\d+(?:\.\d+)?)\s*/\s*(\d+)',  # "3.5/5" format
                    r'Rating[:\s]*(\d+(?:\.\d+)?)\s*/\s*(\d+)',  # "Rating: 3.5/5"
                    r'Rating[:\s]*(\d+(?:\.\d+)?)',  # "Rating: 3.5"
                    r'(\d+(?:\.\d+)?)\s*stars?',  # "3.5 stars"
                ]
                
                # Look for rating in structured data
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
                
                # If no rating from JSON-LD, try text patterns
                if data.rating == 0:
                    # Check article content for rating
                    article = soup.find('article') or soup.find('div', class_=re.compile(r'content|entry|post', re.I))
                    if article:
                        text = article.get_text()
                        for pattern in rating_patterns:
                            match = re.search(pattern, text, re.IGNORECASE)
                            if match:
                                data.rating = float(match.group(1))
                                if len(match.groups()) > 1:
                                    data.rating_scale = float(match.group(2))
                                break
                    
                    # Also check full page text
                    if data.rating == 0:
                        page_text = soup.get_text()
                        for pattern in rating_patterns:
                            match = re.search(pattern, page_text, re.IGNORECASE)
                            if match:
                                data.rating = float(match.group(1))
                                if len(match.groups()) > 1:
                                    data.rating_scale = float(match.group(2))
                                break
                
                print(f"   ⭐ Rating: {data.rating}/{data.rating_scale}")
                
                # Extract review content from article body
                article = soup.find('article') or soup.find('div', class_=re.compile(r'entry-content|post-content|article-content|content', re.I))
                if article:
                    # Get all paragraphs
                    paragraphs = article.find_all('p')
                    content_parts = []
                    for p in paragraphs:
                        text = p.get_text(strip=True)
                        # Skip short paragraphs, author info, etc.
                        if text and len(text) > 50 and not any(skip in text.lower() for skip in ['share', 'follow', 'subscribe', 'comment']):
                            content_parts.append(text)
                    
                    data.review_content = '\n\n'.join(content_parts)
                    print(f"   📄 Review content: {len(data.review_content)} chars")
                
                # Extract verdict - look for specific sections
                verdict_selectors = [
                    ('div', re.compile(r'verdict|conclusion|final', re.I)),
                    ('p', re.compile(r'verdict|conclusion', re.I)),
                    ('h2', re.compile(r'verdict|conclusion|final\s*word', re.I)),
                ]
                
                for tag, pattern in verdict_selectors:
                    verdict_header = soup.find(tag, string=pattern)
                    if verdict_header:
                        next_p = verdict_header.find_next('p')
                        if next_p:
                            data.verdict = next_p.get_text(strip=True)
                            break
                
                # If no verdict found, use last substantial paragraph
                if not data.verdict and content_parts:
                    data.verdict = content_parts[-1] if content_parts else ""
                
                # Try to find link to the movie/series detail page on binged
                detail_link = soup.find('a', href=re.compile(r'/streaming-premiere-dates/[a-z0-9-]+-streaming-online', re.I))
                if detail_link:
                    data.binged_detail_url = detail_link.get('href', '')
                    if data.binged_detail_url.startswith('/'):
                        data.binged_detail_url = self.BASE_URL + data.binged_detail_url
                    print(f"   🔗 Detail URL: {data.binged_detail_url}")
                
                # Extract poster/featured image
                img = soup.find('img', class_=re.compile(r'featured|poster|main|wp-post-image', re.I))
                if img:
                    data.poster_image = img.get('src', '') or img.get('data-src', '')
                
                return data
                
        except Exception as e:
            print(f"   ❌ Error scraping review: {str(e)}")
            import traceback
            traceback.print_exc()
            data.title = self._extract_title_from_url(url)
            return data
    
    def _extract_title_from_url(self, url: str) -> str:
        """Extract title from URL as fallback"""
        # Get the last part of the URL path
        slug = url.rstrip('/').split('/')[-1]
        # Remove common suffixes
        slug = re.sub(r'-review.*$', '', slug, flags=re.IGNORECASE)
        slug = re.sub(r'-web-series.*$', '', slug, flags=re.IGNORECASE)
        slug = re.sub(r'-movie.*$', '', slug, flags=re.IGNORECASE)
        slug = re.sub(r'-ott.*$', '', slug, flags=re.IGNORECASE)
        # Convert dashes to spaces and title case
        return slug.replace('-', ' ').title()


# Singleton instance
ott_review_scraper = OTTReviewScraper()
