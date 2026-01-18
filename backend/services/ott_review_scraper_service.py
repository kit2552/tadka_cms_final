"""
OTT Review Scraper Service
Scrapes OTT movie and web series reviews from binged.com
"""
import httpx
from bs4 import BeautifulSoup
from dataclasses import dataclass, field
from typing import List, Optional
import re
import json


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
    
    # Movie/Series info (to be filled from OTT releases data)
    cast: str = ""
    director: str = ""
    platform: str = ""
    language: str = ""
    runtime: str = ""
    genre: str = ""
    release_date: str = ""
    poster_image: str = ""
    youtube_url: str = ""


class OTTReviewScraper:
    """Scraper for OTT reviews from binged.com"""
    
    BASE_URL = "https://www.binged.com"
    REVIEWS_URL = "https://www.binged.com/category/reviews/"
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
            'Referer': 'https://www.binged.com/',
        }
    
    async def get_review_links(self, max_links: int = 10) -> List[str]:
        """
        Get review article links from binged.com reviews listing page
        """
        print(f"🔍 Fetching OTT review links from {self.REVIEWS_URL}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(self.REVIEWS_URL, headers=self.headers)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                review_links = []
                
                # Find review article links
                # Binged uses article cards with links to individual reviews
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '')
                    
                    # Review URLs typically contain '-review' in the path
                    if '/review/' in href or '-review' in href:
                        # Make absolute URL
                        if href.startswith('/'):
                            full_url = self.BASE_URL + href
                        elif href.startswith('http'):
                            full_url = href
                        else:
                            continue
                        
                        # Avoid duplicates
                        if full_url not in review_links:
                            review_links.append(full_url)
                            print(f"   ✅ Found: {full_url.split('/')[-1][:50]}...")
                            
                            if len(review_links) >= max_links:
                                break
                
                print(f"   📋 Found {len(review_links)} review links")
                return review_links[:max_links]
                
        except Exception as e:
            print(f"   ❌ Error fetching review links: {str(e)}")
            return []
    
    async def scrape_review(self, url: str) -> OTTReviewData:
        """
        Scrape a single OTT review from binged.com
        """
        print(f"🎬 Scraping OTT review from: {url}")
        
        data = OTTReviewData()
        data.source_url = url
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Extract title
                title_elem = soup.find('h1')
                if title_elem:
                    data.title = title_elem.get_text(strip=True)
                    # Clean title - remove "Review:" prefix
                    data.title = re.sub(r'^Review:\s*', '', data.title, flags=re.IGNORECASE)
                    print(f"   📝 Title: {data.title}")
                
                # Detect content type from title or URL
                url_lower = url.lower()
                title_lower = data.title.lower()
                if 'web series' in title_lower or 'web-series' in url_lower or 'series' in title_lower:
                    data.content_type = 'webseries'
                else:
                    data.content_type = 'movie'
                print(f"   📺 Content Type: {data.content_type}")
                
                # Extract rating
                # Look for rating in various formats
                rating_patterns = [
                    r'(\d+(?:\.\d+)?)\s*/\s*(\d+)',  # "3.5/5" format
                    r'Rating[:\s]*(\d+(?:\.\d+)?)',  # "Rating: 3.5" format
                ]
                
                # Check meta tags first
                for meta in soup.find_all('meta'):
                    content = meta.get('content', '')
                    for pattern in rating_patterns:
                        match = re.search(pattern, content)
                        if match:
                            data.rating = float(match.group(1))
                            if len(match.groups()) > 1:
                                data.rating_scale = float(match.group(2))
                            break
                
                # Check article content for rating
                if data.rating == 0:
                    article = soup.find('article') or soup.find('div', class_='content')
                    if article:
                        text = article.get_text()
                        for pattern in rating_patterns:
                            match = re.search(pattern, text)
                            if match:
                                data.rating = float(match.group(1))
                                if len(match.groups()) > 1:
                                    data.rating_scale = float(match.group(2))
                                break
                
                print(f"   ⭐ Rating: {data.rating}/{data.rating_scale}")
                
                # Extract review content
                article = soup.find('article') or soup.find('div', class_='entry-content') or soup.find('div', class_='content')
                if article:
                    # Get all paragraphs
                    paragraphs = article.find_all('p')
                    content_parts = []
                    for p in paragraphs:
                        text = p.get_text(strip=True)
                        if text and len(text) > 50:  # Skip short paragraphs
                            content_parts.append(text)
                    
                    data.review_content = '\n\n'.join(content_parts)
                    print(f"   📄 Review content: {len(data.review_content)} chars")
                
                # Extract verdict (usually the last paragraph or a specific section)
                verdict_elem = soup.find(['div', 'p'], class_=re.compile(r'verdict|conclusion|final', re.I))
                if verdict_elem:
                    data.verdict = verdict_elem.get_text(strip=True)
                elif content_parts:
                    # Use last paragraph as verdict
                    data.verdict = content_parts[-1] if content_parts else ""
                
                # Extract poster image
                img = soup.find('img', class_=re.compile(r'featured|poster|main', re.I))
                if img:
                    data.poster_image = img.get('src', '')
                
                return data
                
        except Exception as e:
            print(f"   ❌ Error scraping review: {str(e)}")
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
        # Convert dashes to spaces and title case
        return slug.replace('-', ' ').title()


# Singleton instance
ott_review_scraper = OTTReviewScraper()
