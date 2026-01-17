"""
Movie Review Scraper Service
Generic scraper for extracting movie review data from various websites
Supports: greatandhra.com, gulte.com, and other Telugu/Hindi movie review sites
"""

import httpx
from bs4 import BeautifulSoup
import re
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class MovieReviewData:
    """Data class for scraped movie review"""
    movie_name: str = ""
    rating: float = 0.0
    rating_scale: float = 5.0  # e.g., 5 for x/5, 10 for x/10
    normalized_rating: float = 0.0  # Rating normalized to 5-point scale
    
    # Movie details
    cast: str = ""
    director: str = ""
    producer: str = ""
    music_director: str = ""
    dop: str = ""
    editor: str = ""
    genre: str = ""
    runtime: str = ""
    release_date: str = ""
    banner: str = ""
    
    # Review sections
    story_plot: str = ""
    performances: str = ""
    what_works: str = ""
    what_doesnt_work: str = ""
    technical_aspects: str = ""
    final_verdict: str = ""
    quick_verdict: str = ""
    
    # Meta
    source_url: str = ""
    source_name: str = ""
    poster_image: str = ""
    reviewer: str = ""
    review_date: str = ""
    
    # Raw content for LLM processing
    full_review_text: str = ""


class MovieReviewScraper:
    """Generic movie review scraper that works with multiple sites"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    
    async def scrape_review(self, url: str) -> MovieReviewData:
        """
        Scrape a movie review from any supported URL
        Auto-detects the source and uses appropriate parsing strategy
        """
        print(f"🎬 Scraping review from: {url}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                html = response.text
        except Exception as e:
            print(f"❌ Error fetching URL: {e}")
            raise Exception(f"Failed to fetch review page: {str(e)}")
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Detect source and parse accordingly
        source_name = self._detect_source(url)
        print(f"   📰 Detected source: {source_name}")
        
        if 'greatandhra' in url.lower():
            review_data = self._parse_greatandhra(soup, url)
        elif 'gulte' in url.lower():
            review_data = self._parse_gulte(soup, url)
        elif 'idlebrain' in url.lower():
            review_data = self._parse_idlebrain(soup, url)
        elif '123telugu' in url.lower():
            review_data = self._parse_123telugu(soup, url)
        elif 'telugumirchi' in url.lower():
            review_data = self._parse_telugumirchi(soup, url)
        else:
            # Generic fallback parser
            review_data = self._parse_generic(soup, url)
        
        review_data.source_url = url
        review_data.source_name = source_name
        
        # Normalize rating to 5-point scale
        if review_data.rating > 0 and review_data.rating_scale > 0:
            review_data.normalized_rating = (review_data.rating / review_data.rating_scale) * 5
        
        print(f"   ✅ Scraped: {review_data.movie_name} - Rating: {review_data.rating}/{review_data.rating_scale}")
        return review_data
    
    def _detect_source(self, url: str) -> str:
        """Detect the source website from URL"""
        url_lower = url.lower()
        if 'greatandhra' in url_lower:
            return 'GreatAndhra'
        elif 'gulte' in url_lower:
            return 'Gulte'
        elif 'idlebrain' in url_lower:
            return 'IdleBrain'
        elif '123telugu' in url_lower:
            return '123Telugu'
        elif 'telugumirchi' in url_lower:
            return 'TeluguMirchi'
        elif 'mirchi9' in url_lower:
            return 'Mirchi9'
        elif 'tupaki' in url_lower:
            return 'Tupaki'
        elif 'sakshipost' in url_lower:
            return 'SakshiPost'
        else:
            # Extract domain name
            import urllib.parse
            parsed = urllib.parse.urlparse(url)
            return parsed.netloc.replace('www.', '').split('.')[0].title()
    
    def _extract_rating(self, text: str) -> tuple:
        """Extract rating from text like '2.5/5', '3/5', '7/10' etc."""
        patterns = [
            r'(\d+(?:\.\d+)?)\s*/\s*(\d+)',  # x/y format
            r'Rating[:\s]*(\d+(?:\.\d+)?)\s*/\s*(\d+)',  # Rating: x/y
            r'(\d+(?:\.\d+)?)\s*out\s*of\s*(\d+)',  # x out of y
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                rating = float(match.group(1))
                scale = float(match.group(2))
                return rating, scale
        
        return 0.0, 5.0
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        if not text:
            return ""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove leading/trailing whitespace
        text = text.strip()
        return text
    
    def _parse_greatandhra(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """Parse movie review from greatandhra.com"""
        data = MovieReviewData()
        
        # Get article content
        article = soup.find('article') or soup.find('div', class_='article-content') or soup
        
        # Movie name from title
        title_tag = soup.find('h1') or soup.find('title')
        if title_tag:
            title_text = title_tag.get_text(strip=True)
            # Extract movie name - usually before "Review" or "Movie Review"
            movie_match = re.search(r"['\"]?(.+?)['\"]?\s*(?:Movie\s*)?Review", title_text, re.IGNORECASE)
            if movie_match:
                data.movie_name = movie_match.group(1).strip().strip("'\"")
            else:
                data.movie_name = title_text.split('|')[0].strip()
        
        # Rating - look for bold text with rating
        full_text = article.get_text()
        rating_match = re.search(r'Rating[:\s]*(\d+(?:\.\d+)?)\s*/\s*(\d+)', full_text, re.IGNORECASE)
        if rating_match:
            data.rating = float(rating_match.group(1))
            data.rating_scale = float(rating_match.group(2))
        else:
            # Try to find rating in any format
            data.rating, data.rating_scale = self._extract_rating(full_text)
        
        # Extract movie details from bold labels
        bold_tags = article.find_all(['b', 'strong'])
        for bold in bold_tags:
            label = bold.get_text(strip=True).lower().rstrip(':')
            # Get the next sibling text
            next_text = ""
            next_sibling = bold.next_sibling
            if next_sibling:
                if hasattr(next_sibling, 'get_text'):
                    next_text = next_sibling.get_text(strip=True)
                else:
                    next_text = str(next_sibling).strip().lstrip(':').strip()
            
            # Handle concatenated labels like "movie: namerating:2/5banner"
            if 'banner' in label:
                # Check if banner is at the end of a concatenated label
                if label.endswith('banner') and len(label) > 10:
                    data.banner = next_text
                elif label == 'banner':
                    data.banner = next_text
            elif 'cast' in label:
                data.cast = next_text
            elif ('written' in label and 'direction' in label) or label == 'written and direction':
                # "Written and Direction" or "Written & Direction"
                data.director = next_text
            elif label == 'direction' or label == 'director':
                data.director = next_text
            elif 'producer' in label and 'co-producer' not in label and 'creative' not in label:
                data.producer = next_text
            elif 'music' in label:
                data.music_director = next_text
            elif label == 'dop' or 'cinematograph' in label:
                data.dop = next_text
            elif label == 'editor':
                data.editor = next_text
            elif label == 'banner':
                data.banner = next_text
            elif 'release' in label:
                data.release_date = next_text
        
        # Extract review sections
        paragraphs = article.find_all('p')
        current_section = None
        section_content = {}
        
        for p in paragraphs:
            text = p.get_text(strip=True)
            text_lower = text.lower()
            
            # Check for section headers
            if 'story:' in text_lower or text_lower.startswith('story'):
                current_section = 'story'
                text = re.sub(r'^story[:\s]*', '', text, flags=re.IGNORECASE)
            elif 'performance' in text_lower or "artistes'" in text_lower:
                current_section = 'performances'
                text = re.sub(r"^(?:artistes'?\s*)?performances?[:\s]*", '', text, flags=re.IGNORECASE)
            elif 'technical' in text_lower:
                current_section = 'technical'
                text = re.sub(r'^technical\s*(?:excellence|aspects)?[:\s]*', '', text, flags=re.IGNORECASE)
            elif 'highlight' in text_lower or 'what works' in text_lower or 'positives' in text_lower:
                current_section = 'positives'
            elif 'drawback' in text_lower or "what doesn't" in text_lower or 'negatives' in text_lower:
                current_section = 'negatives'
            elif 'analysis' in text_lower or 'verdict' in text_lower:
                current_section = 'verdict'
            elif 'bottom-line' in text_lower or 'bottomline' in text_lower:
                data.quick_verdict = text.split(':', 1)[-1].strip() if ':' in text else text
                continue
            
            if current_section and text:
                if current_section not in section_content:
                    section_content[current_section] = []
                section_content[current_section].append(text)
        
        # Assign sections
        data.story_plot = ' '.join(section_content.get('story', []))
        data.performances = ' '.join(section_content.get('performances', []))
        data.technical_aspects = ' '.join(section_content.get('technical', []))
        data.what_works = ' '.join(section_content.get('positives', []))
        data.what_doesnt_work = ' '.join(section_content.get('negatives', []))
        data.final_verdict = ' '.join(section_content.get('verdict', []))
        
        # Extract highlights/drawbacks from lists
        for ul in article.find_all('ul'):
            prev_elem = ul.find_previous(['p', 'h3', 'h4', 'strong', 'b'])
            if prev_elem:
                prev_text = prev_elem.get_text(strip=True).lower()
                items = [li.get_text(strip=True) for li in ul.find_all('li')]
                if 'highlight' in prev_text or 'positive' in prev_text or 'works' in prev_text:
                    data.what_works = '\n'.join(items)
                elif 'drawback' in prev_text or 'negative' in prev_text or "doesn't" in prev_text:
                    data.what_doesnt_work = '\n'.join(items)
        
        # Get poster image
        img = article.find('img')
        if img:
            data.poster_image = img.get('src', '')
        
        # Full review text for LLM
        data.full_review_text = full_text
        
        return data
    
    def _parse_gulte(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """Parse movie review from gulte.com"""
        data = MovieReviewData()
        
        # Movie name from h1
        h1 = soup.find('h1')
        if h1:
            title_text = h1.get_text(strip=True)
            # Remove "Review" suffix
            data.movie_name = re.sub(r'\s*Review\s*$', '', title_text, flags=re.IGNORECASE).strip()
        
        # Rating - gulte uses ### 3/5 format
        rating_div = soup.find('h3')
        if rating_div:
            rating_text = rating_div.get_text(strip=True)
            data.rating, data.rating_scale = self._extract_rating(rating_text)
        
        # Get article body
        article = soup.find('article') or soup.find('div', class_='entry-content') or soup
        
        # Look for movie info in the header area
        full_text = article.get_text()
        
        # Extract cast, director etc from bold labels
        for strong in article.find_all(['strong', 'b']):
            label_text = strong.get_text(strip=True).lower()
            next_text = ""
            next_sibling = strong.next_sibling
            if next_sibling:
                next_text = str(next_sibling).strip().lstrip('-–').strip()
            
            if 'cast' in label_text:
                data.cast = next_text
            elif 'director' in label_text and 'music' not in label_text:
                data.director = next_text
            elif 'producer' in label_text:
                data.producer = next_text
            elif 'music' in label_text:
                data.music_director = next_text
            elif 'banner' in label_text:
                data.banner = next_text
        
        # Parse sections
        paragraphs = article.find_all('p')
        current_section = None
        section_content = {}
        
        for p in paragraphs:
            text = p.get_text(strip=True)
            text_lower = text.lower()
            
            # Check for section markers
            if 'what is it about' in text_lower or text_lower.startswith('story'):
                current_section = 'story'
                continue
            elif 'performance' in text_lower:
                current_section = 'performances'
                continue
            elif 'technical' in text_lower:
                current_section = 'technical'
                continue
            elif 'positive' in text_lower:
                current_section = 'positives'
                continue
            elif 'negative' in text_lower:
                current_section = 'negatives'
                continue
            elif 'analysis' in text_lower:
                current_section = 'verdict'
                continue
            elif 'final verdict' in text_lower:
                data.quick_verdict = text.split('–')[-1].strip() if '–' in text else text
                continue
            
            if current_section and text and len(text) > 20:
                if current_section not in section_content:
                    section_content[current_section] = []
                section_content[current_section].append(text)
        
        # Assign sections
        data.story_plot = ' '.join(section_content.get('story', []))
        data.performances = ' '.join(section_content.get('performances', []))
        data.technical_aspects = ' '.join(section_content.get('technical', []))
        data.what_works = ' '.join(section_content.get('positives', []))
        data.what_doesnt_work = ' '.join(section_content.get('negatives', []))
        data.final_verdict = ' '.join(section_content.get('verdict', []))
        
        # Extract positives/negatives from numbered lists
        for ol in article.find_all('ol'):
            prev = ol.find_previous(['p', 'strong'])
            if prev:
                prev_text = prev.get_text(strip=True).lower()
                items = [li.get_text(strip=True) for li in ol.find_all('li')]
                if 'positive' in prev_text:
                    data.what_works = '\n'.join(items)
                elif 'negative' in prev_text:
                    data.what_doesnt_work = '\n'.join(items)
        
        # Poster image
        img = article.find('img', class_='wp-post-image') or article.find('img')
        if img:
            data.poster_image = img.get('src', '')
        
        data.full_review_text = full_text
        
        return data
    
    def _parse_idlebrain(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """Parse movie review from idlebrain.com"""
        data = MovieReviewData()
        # Idlebrain has a more structured table format
        # Implement similar parsing logic
        data.full_review_text = soup.get_text()
        return self._parse_generic(soup, url)
    
    def _parse_123telugu(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """Parse movie review from 123telugu.com"""
        data = MovieReviewData()
        data.full_review_text = soup.get_text()
        return self._parse_generic(soup, url)
    
    def _parse_telugumirchi(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """Parse movie review from telugumirchi.com"""
        data = MovieReviewData()
        data.full_review_text = soup.get_text()
        return self._parse_generic(soup, url)
    
    def _parse_generic(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """Generic parser for unknown review sites"""
        data = MovieReviewData()
        
        # Get title
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
            data.movie_name = re.sub(r'\s*(Movie\s*)?Review.*$', '', title, flags=re.IGNORECASE).strip()
        
        # Get full text
        article = soup.find('article') or soup.find('main') or soup.find('div', class_=re.compile(r'content|article|post'))
        if not article:
            article = soup.find('body')
        
        full_text = article.get_text() if article else soup.get_text()
        data.full_review_text = full_text
        
        # Try to extract rating
        data.rating, data.rating_scale = self._extract_rating(full_text)
        
        # Try to extract common fields using regex
        cast_match = re.search(r'Cast[:\s]*([^\n]+)', full_text, re.IGNORECASE)
        if cast_match:
            data.cast = cast_match.group(1).strip()
        
        director_match = re.search(r'Director[:\s]*([^\n]+)', full_text, re.IGNORECASE)
        if director_match:
            data.director = director_match.group(1).strip()
        
        # Get first image as poster
        img = article.find('img') if article else soup.find('img')
        if img:
            data.poster_image = img.get('src', '')
        
        return data


# Singleton instance
movie_review_scraper = MovieReviewScraper()
