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
    youtube_url: str = ""  # YouTube trailer URL
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
        elif 'pinkvilla' in url.lower():
            review_data = self._parse_pinkvilla(soup, url)
        elif 'bollywoodhungama' in url.lower():
            review_data = self._parse_bollywoodhungama(soup, url)
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
        elif 'pinkvilla' in url_lower:
            return 'Pinkvilla'
        elif 'bollywoodhungama' in url_lower:
            return 'BollywoodHungama'
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
        
        # Extract runtime, genre, release date from movie info line
        # Format: "02 Hrs 14 Mins  |  Social Drama  |  25-12-2025"
        for p in article.find_all('p'):
            p_text = p.get_text(strip=True)
            # Check if this line has the movie info format
            if 'hrs' in p_text.lower() and '|' in p_text:
                parts = [part.strip() for part in p_text.split('|')]
                if len(parts) >= 3:
                    # First part: runtime
                    data.runtime = parts[0].strip()
                    # Second part: genre
                    data.genre = parts[1].strip()
                    # Third part: release date
                    data.release_date = parts[2].strip()
                    break
        
        # Extract cast, director etc from bold labels
        # New format uses "Cast - ", "Director - ", etc.
        for p in article.find_all('p'):
            strong = p.find('strong')
            if not strong:
                continue
            
            label_text = strong.get_text(strip=True).lower()
            # Get the full paragraph text and extract content after the strong tag
            full_p_text = p.get_text(strip=True)
            
            # Remove the strong tag text and any leading dash/spaces
            if strong.get_text(strip=True) in full_p_text:
                content = full_p_text.replace(strong.get_text(strip=True), '').strip()
                content = content.lstrip('-–').strip()
                
                if 'cast' in label_text and content:
                    data.cast = content
                elif 'director' in label_text and 'music' not in label_text and content:
                    data.director = content
                elif 'producer' in label_text and content:
                    data.producer = content
                elif 'music' in label_text and content:
                    data.music_director = content
                elif 'banner' in label_text and content:
                    data.banner = content
        
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
        
        # Also check for positives/negatives in paragraph format (not as <ol>/<ul>)
        for p in article.find_all('p'):
            p_text = p.get_text(strip=True)
            
            # Check if this paragraph has <strong>Positives:</strong> or <strong>Negatives:</strong>
            strong_tag = p.find('strong')
            if strong_tag:
                strong_text = strong_tag.get_text(strip=True).lower()
                
                if 'positive' in strong_text:
                    # Get text after the strong tag in this paragraph
                    content_after_strong = p.get_text(strip=True).replace(strong_tag.get_text(strip=True), '').strip()
                    if content_after_strong:
                        data.what_works = content_after_strong
                    else:
                        # Check next paragraph(s) for numbered content
                        next_p = p.find_next_sibling('p')
                        if next_p:
                            next_text = next_p.get_text(strip=True)
                            # Check if it contains numbered items like "1.⁠ ⁠Item" or "1. Item"
                            if next_text and (next_text[0].isdigit() or '1.' in next_text or '⁠' in next_text):
                                data.what_works = next_text
                
                elif 'negative' in strong_text:
                    content_after_strong = p.get_text(strip=True).replace(strong_tag.get_text(strip=True), '').strip()
                    if content_after_strong:
                        data.what_doesnt_work = content_after_strong
                    else:
                        next_p = p.find_next_sibling('p')
                        if next_p:
                            next_text = next_p.get_text(strip=True)
                            if next_text and (next_text[0].isdigit() or '1.' in next_text or '⁠' in next_text):
                                data.what_doesnt_work = next_text
        
        # Poster image
        img = article.find('img', class_='wp-post-image') or article.find('img')
        if img:
            data.poster_image = img.get('src', '')
        
        data.full_review_text = full_text
        
        return data
    
    def _parse_pinkvilla(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """
        Parse movie review from Pinkvilla.com
        Extracts data from JSON-LD structured data and HTML content
        """
        import json
        import re
        
        data = MovieReviewData()
        
        # Extract JSON-LD structured data
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        article_body_text = ""
        
        for script in json_ld_scripts:
            try:
                json_data = json.loads(script.string)
                
                # Look for NewsArticle with articleBody
                if isinstance(json_data, dict) and json_data.get('@type') == 'NewsArticle':
                    article_body_text = json_data.get('articleBody', '')
                
                # Look for Review schema
                if isinstance(json_data, dict) and json_data.get('@type') == 'Review':
                    # Extract movie name
                    item_reviewed = json_data.get('itemReviewed', {})
                    if item_reviewed.get('@type') == 'Movie':
                        data.movie_name = item_reviewed.get('name', '')
                        
                        # Extract director
                        director_info = item_reviewed.get('director', {})
                        if isinstance(director_info, dict):
                            data.director = director_info.get('name', '')
                        
                        # Extract cast (comes as list or string)
                        actors = item_reviewed.get('actor', [])
                        if isinstance(actors, list) and len(actors) > 0:
                            data.cast = actors[0] if isinstance(actors[0], str) else ''
                        elif isinstance(actors, str):
                            data.cast = actors
                    
                    # Extract rating
                    review_rating = json_data.get('reviewRating', {})
                    if review_rating:
                        rating_value = review_rating.get('ratingValue', '0')
                        data.rating = float(rating_value) if rating_value else 0
                        data.rating_scale = float(review_rating.get('bestRating', 5))
                        
            except (json.JSONDecodeError, ValueError) as e:
                continue
        
        # If we have articleBody from JSON-LD, parse it
        if article_body_text:
            # Parse articleBody line by line
            lines = article_body_text.split('\n')
            current_section = None
            section_content = []
            youtube_video_id = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Extract YouTube video ID (format: YEv0zokK140 - 11 characters)
                # It appears before "Performances:" in the text
                if not youtube_video_id and 'performances:' in line.lower():
                    # Look for YouTube ID pattern (11 alphanumeric characters)
                    import re
                    match = re.search(r'([A-Za-z0-9_-]{11})(?:Performances:)', line)
                    if match:
                        youtube_video_id = match.group(1)
                        print(f"   🎬 Found YouTube trailer ID: {youtube_video_id}")
                
                # Check for section headers (case-insensitive, handle embedded text)
                line_lower = line.lower()
                
                # Check if line contains section header (even if concatenated with other text)
                if 'plot:' in line_lower:
                    if current_section and section_content:
                        self._assign_section_content(data, current_section, section_content)
                    current_section = 'plot'
                    section_content = []
                elif 'what works:' in line_lower:
                    if current_section and section_content:
                        self._assign_section_content(data, current_section, section_content)
                    current_section = 'what_works'
                    section_content = []
                elif 'what doesn' in line_lower and ':' in line:
                    if current_section and section_content:
                        self._assign_section_content(data, current_section, section_content)
                    current_section = 'what_doesnt'
                    section_content = []
                elif 'performances:' in line_lower:
                    if current_section and section_content:
                        self._assign_section_content(data, current_section, section_content)
                    current_section = 'performances'
                    section_content = []
                    # Extract text after "Performances:" if on same line
                    perf_idx = line_lower.index('performances:')
                    remaining = line[perf_idx + len('Performances:'):].strip()
                    if remaining:
                        section_content.append(remaining)
                elif 'final verdict' in line_lower:
                    if current_section and section_content:
                        self._assign_section_content(data, current_section, section_content)
                    current_section = 'verdict'
                    section_content = []
                elif "here's a look" in line_lower or 'watch the trailer' in line_lower:
                    # Skip trailer section - don't change current section
                    continue
                else:
                    # Add content to current section
                    if current_section:
                        section_content.append(line)
            
            # Assign last section
            if current_section and section_content:
                self._assign_section_content(data, current_section, section_content)
            
            # Set YouTube trailer URL and poster image if found
            if youtube_video_id:
                data.youtube_url = f"https://www.youtube.com/watch?v={youtube_video_id}"
                # Use high-quality YouTube thumbnail as poster image
                data.poster_image = f"https://img.youtube.com/vi/{youtube_video_id}/maxresdefault.jpg"
                print(f"   🎥 YouTube URL: {data.youtube_url}")
                print(f"   🖼️  Poster Image: {data.poster_image}")
        
        data.full_review_text = article_body_text
        return data
    
    def _assign_section_content(self, data: MovieReviewData, section: str, content: list):
        """Helper to assign parsed content to MovieReviewData"""
        text = '\n\n'.join(content)
        if section == 'plot':
            data.story_plot = text
        elif section == 'what_works':
            data.what_works = text
        elif section == 'what_doesnt':
            data.what_doesnt_work = text
        elif section == 'performances':
            data.performances = text
        elif section == 'verdict':
            data.final_verdict = text
    
    def _parse_bollywoodhungama(self, soup: BeautifulSoup, url: str) -> MovieReviewData:
        """
        Parse movie review from BollywoodHungama.com
        
        Bollywood Hungama section mapping:
        1. "Movie Review Synopsis:" → story_plot (Main Plot)
        2. "Movie Story Review:" → story_review_text (for LLM to extract what works/doesn't work)
        3. "Movie Review Performances:" → performances
        4. "music and other technical aspects:" → technical_aspects
        5. "Movie Review Conclusion:" → final_verdict
        """
        import json
        import re
        
        data = MovieReviewData()
        
        # Extract JSON-LD structured data for basic movie info
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        
        for script in json_ld_scripts:
            try:
                json_data = json.loads(script.string)
                
                # Look for Review schema
                if isinstance(json_data, dict) and json_data.get('@type') == 'Review':
                    print(f"   📋 Found Review JSON-LD schema")
                    
                    # Extract movie name from itemReviewed
                    item_reviewed = json_data.get('itemReviewed', {})
                    if item_reviewed.get('@type') == 'Movie':
                        data.movie_name = item_reviewed.get('name', '')
                        
                        # Extract director
                        directors = item_reviewed.get('director', [])
                        if isinstance(directors, list) and len(directors) > 0:
                            # Remove duplicates
                            director_names = list(set([d.get('name', '') for d in directors if isinstance(d, dict) and d.get('name')]))
                            data.director = ', '.join(director_names)
                        elif isinstance(directors, dict):
                            data.director = directors.get('name', '')
                        
                        # Extract actors
                        actors = item_reviewed.get('actor', [])
                        if isinstance(actors, list) and len(actors) > 0:
                            actor_names = [a.get('name', '') for a in actors if isinstance(a, dict)]
                            data.cast = ', '.join(actor_names)
                        elif isinstance(actors, dict):
                            data.cast = actors.get('name', '')
                        
                        # Extract poster image
                        data.poster_image = item_reviewed.get('image', '')
                    
                    # Extract rating
                    review_rating = json_data.get('reviewRating', {})
                    if review_rating:
                        rating_value = review_rating.get('ratingValue', '0')
                        data.rating = float(rating_value) if rating_value else 0
                        best_rating = review_rating.get('bestRating', '5')
                        data.rating_scale = float(best_rating) if best_rating else 5.0
                    
                    print(f"   ✅ Extracted from Review schema: {data.movie_name}, Rating: {data.rating}/{data.rating_scale}")
                    
            except (json.JSONDecodeError, ValueError) as e:
                continue
        
        # If movie name not found from JSON-LD, try from meta description
        if not data.movie_name:
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc:
                desc_content = meta_desc.get('content', '')
                match = re.search(r'^(.+?)\s+Movie Review', desc_content)
                if match:
                    data.movie_name = match.group(1).strip()
        
        # Extract more cast details from meta description if not found
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            desc_content = meta_desc.get('content', '')
            
            # Extract Star Cast (full list)
            cast_match = re.search(r'Star Cast[:\s]*([^D]+?)(?:Director|$)', desc_content)
            if cast_match:
                data.cast = cast_match.group(1).strip().rstrip(',')
        
        # Get article content for section extraction
        article = soup.find('article') or soup.find('main') or soup.find('div', class_='entry-content')
        if article:
            data.full_review_text = article.get_text()
        else:
            data.full_review_text = soup.get_text()
        
        # Extract sections from article HTML content
        article_html = str(article) if article else str(soup)
        
        # Section patterns for Bollywood Hungama - they use <strong> tags for section headers
        # Pattern: <strong>Movie Name Movie Review Synopsis:</strong><br />...content...
        # We look for keywords like "Review Synopsis", "Story Review", "Review Performances", etc.
        # Note: There's often a <br /> tag after </strong>
        
        # 1. Synopsis → story_plot (Main Plot)
        # Pattern: "Review Synopsis:" followed by content until next <strong> or <p><strong>
        synopsis_match = re.search(
            r'Review\s+Synopsis[:\s]*</strong>(?:\s*<br\s*/?>)?\s*(.+?)(?=<p>\s*<strong>|<strong>|$)',
            article_html, re.IGNORECASE | re.DOTALL
        )
        if synopsis_match:
            synopsis_html = synopsis_match.group(1)
            # Remove HTML tags to get plain text
            synopsis_text = re.sub(r'<[^>]+>', ' ', synopsis_html)
            synopsis_text = re.sub(r'\s+', ' ', synopsis_text).strip()
            data.story_plot = synopsis_text
            print(f"   📖 Extracted Synopsis: {len(data.story_plot)} chars")
        
        # 2. Story Review → for extracting what works/doesn't work (store as raw text)
        # Pattern: "Story Review:" followed by content until "Review Performances" or iframe (trailer)
        # Story Review spans multiple paragraphs in Bollywood Hungama
        story_review_match = re.search(
            r'Story\s+Review[:\s]*</strong>(?:\s*<br\s*/?>)?\s*(.+?)(?=Review\s+Performances|<p>\s*<span[^>]*underline|<iframe|$)',
            article_html, re.IGNORECASE | re.DOTALL
        )
        story_review_text = ""
        if story_review_match:
            story_review_html = story_review_match.group(1)
            story_review_text = re.sub(r'<[^>]+>', ' ', story_review_html)
            story_review_text = re.sub(r'\s+', ' ', story_review_text).strip()
            # Store raw text for LLM processing later
            data.what_works = f"[STORY_REVIEW_RAW]{story_review_text}[/STORY_REVIEW_RAW]"
            print(f"   📝 Extracted Story Review for analysis: {len(story_review_text)} chars")
        
        # 3. Performances → performances
        # Pattern: "Review Performances:" followed by content until next <strong> or <p><strong>
        performances_match = re.search(
            r'Review\s+Performances[:\s]*</strong>(?:\s*<br\s*/?>)?\s*(.+?)(?=<p>\s*<strong>|<strong>|$)',
            article_html, re.IGNORECASE | re.DOTALL
        )
        if performances_match:
            performances_html = performances_match.group(1)
            performances_text = re.sub(r'<[^>]+>', ' ', performances_html)
            performances_text = re.sub(r'\s+', ' ', performances_text).strip()
            data.performances = performances_text
            print(f"   🎭 Extracted Performances: {len(data.performances)} chars")
        
        # 4. Technical Aspects → technical_aspects
        # Pattern: "music and other technical aspects:" or "technical aspects:"
        technical_match = re.search(
            r'(?:music\s+and\s+other\s+)?technical\s+aspects[:\s]*</strong>(?:\s*<br\s*/?>)?\s*(.+?)(?=<p>\s*<strong>|<strong>|$)',
            article_html, re.IGNORECASE | re.DOTALL
        )
        if technical_match:
            technical_html = technical_match.group(1)
            technical_text = re.sub(r'<[^>]+>', ' ', technical_html)
            technical_text = re.sub(r'\s+', ' ', technical_text).strip()
            data.technical_aspects = technical_text
            print(f"   🎬 Extracted Technical Aspects: {len(data.technical_aspects)} chars")
        
        # 5. Conclusion → final_verdict
        # Pattern: "Review Conclusion:" followed by content until end or next section
        conclusion_match = re.search(
            r'Review\s+Conclusion[:\s]*(?:</strong>)?(?:\s*<br\s*/?>)?\s*</strong>(?:\s*<br\s*/?>)?\s*(.+?)(?=<p>\s*<strong>|<strong>|<div|<style|$)',
            article_html, re.IGNORECASE | re.DOTALL
        )
        if not conclusion_match:
            # Try alternate pattern - sometimes Conclusion is at the very end
            conclusion_match = re.search(
                r'Review\s+Conclusion[:\s]*</strong>(?:\s*<br\s*/?>)?\s*(.+?)(?=<style|<div\s+class|</p>\s*</div>|$)',
                article_html, re.IGNORECASE | re.DOTALL
            )
        if conclusion_match:
            conclusion_html = conclusion_match.group(1)
            conclusion_text = re.sub(r'<[^>]+>', ' ', conclusion_html)
            conclusion_text = re.sub(r'\s+', ' ', conclusion_text).strip()
            data.final_verdict = conclusion_text
            print(f"   ✅ Extracted Conclusion: {len(data.final_verdict)} chars")
        
        # If we didn't find sections, fall back to full text parsing
        if not data.story_plot:
            # Try to extract from full_review_text
            full_text = data.full_review_text
            synopsis_text_match = re.search(
                r'Synopsis[:\s]*(.+?)(?:Story Review|Performances|$)',
                full_text, re.IGNORECASE | re.DOTALL
            )
            if synopsis_text_match:
                data.story_plot = synopsis_text_match.group(1).strip()[:2000]
        
        print(f"   📝 Bollywood Hungama parsed: {data.movie_name}, Rating: {data.rating}/{data.rating_scale}")
        print(f"      Sections: Synopsis={bool(data.story_plot)}, StoryReview={bool(data.what_works)}, Performances={bool(data.performances)}, Technical={bool(data.technical_aspects)}, Verdict={bool(data.final_verdict)}")
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
