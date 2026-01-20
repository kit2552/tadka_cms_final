"""
AI Agent Runner Service
Handles execution of AI agents to generate content using OpenAI, Gemini, or Anthropic
"""
import os
import re
import uuid
import httpx
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
from openai import OpenAI
from database import db
import crud


class AgentRunnerService:
    """Service to run AI agents and generate content"""
    
    def __init__(self):
        self.client = None
        self.model = None
        self.provider = None  # 'openai', 'gemini', or 'anthropic'
    
    def _initialize_ai_client(self):
        """Initialize the appropriate AI client based on selected model"""
        ai_config = crud.get_ai_api_keys(db)
        if not ai_config:
            raise ValueError("AI API keys not configured. Please add them in System Settings > API Keys.")
        
        # Get the selected model
        self.model = ai_config.get('default_text_model') or 'gpt-4o'
        self.image_model = ai_config.get('default_image_model') or 'dall-e-3'
        self.ai_config = ai_config
        
        # Determine provider based on model name
        model_lower = self.model.lower()
        
        if 'gemini' in model_lower or 'imagen' in model_lower:
            self.provider = 'gemini'
            if not ai_config.get('gemini_api_key'):
                raise ValueError("Gemini API key not configured. Please add it in System Settings > API Keys.")
            import google.generativeai as genai
            genai.configure(api_key=ai_config['gemini_api_key'])
            self.client = genai.GenerativeModel(self.model)
            
        elif 'claude' in model_lower or 'sonnet' in model_lower or 'opus' in model_lower or 'haiku' in model_lower:
            self.provider = 'anthropic'
            if not ai_config.get('anthropic_api_key'):
                raise ValueError("Anthropic API key not configured. Please add it in System Settings > API Keys.")
            import anthropic
            self.client = anthropic.Anthropic(api_key=ai_config['anthropic_api_key'])
            
        else:
            # Default to OpenAI
            self.provider = 'openai'
            if not ai_config.get('openai_api_key'):
                raise ValueError("OpenAI API key not configured. Please add it in System Settings > API Keys.")
            self.client = OpenAI(api_key=ai_config['openai_api_key'])
        
        print(f"Initialized {self.provider} client with model: {self.model}")
        return self.client

    def _chat_completion(self, system_prompt: str, user_prompt: str, max_tokens: int = 20000) -> str:
        """Universal chat completion that works with OpenAI, Gemini, and Anthropic"""
        try:
            if self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_completion_tokens=max_tokens
                )
                return response.choices[0].message.content.strip()
                
            elif self.provider == 'gemini':
                # Gemini combines system and user prompts
                full_prompt = f"{system_prompt}\n\n{user_prompt}"
                response = self.client.generate_content(full_prompt)
                return response.text.strip()
                
            elif self.provider == 'anthropic':
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ]
                )
                return response.content[0].text.strip()
                
        except Exception as e:
            raise Exception(f"Chat completion failed ({self.provider}): {str(e)}")
    
    def _get_category_prompt(self, category_slug: str) -> str:
        """Get the prompt template for a category"""
        mappings = crud.get_category_prompt_mappings(db)
        if mappings and category_slug in mappings:
            return mappings[category_slug]
        
        # Default prompt if no mapping exists - includes placeholder for reference content
        return f"""Write a comprehensive news article about {category_slug}.

{{reference_content_section}}

**ARTICLE REQUIREMENTS:**
- Has an engaging headline
- Provides context and background
- Is well-structured and informative
- Uses clear, accessible language
- Based ONLY on the provided reference content (do NOT search the web)

{{split_content_section}}"""

    def _get_state_language(self, target_state: str) -> str:
        """Get the regional language based on target state"""
        state_language_map = {
            'Telangana': 'Telugu',
            'Andhra Pradesh': 'Telugu',
            'Tamil Nadu': 'Tamil',
            'Karnataka': 'Kannada',
            'Kerala': 'Malayalam',
            'Gujarat': 'Gujarati',
            'Maharashtra': 'Marathi',
            'Punjab': 'Punjabi',
            'West Bengal': 'Bengali',
            'Odisha': 'Odia',
            'Assam': 'Assamese',
            'All States': 'Hindi',
            'All': 'Hindi'
        }
        return state_language_map.get(target_state, 'Hindi')
    
    def _get_states_for_language(self, language: str) -> list:
        """Get list of states associated with a language"""
        language_state_map = {
            'Telugu': ['Telangana', 'Andhra Pradesh'],
            'Tamil': ['Tamil Nadu'],
            'Kannada': ['Karnataka'],
            'Malayalam': ['Kerala'],
            'Hindi': ['Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan', 'Bihar', 'Jharkhand', 'Uttarakhand', 'Chhattisgarh', 'Haryana', 'Delhi', 'Himachal Pradesh'],
            'Marathi': ['Maharashtra'],
            'Gujarati': ['Gujarat'],
            'Bengali': ['West Bengal'],
            'Punjabi': ['Punjab'],
            'Odia': ['Odisha'],
            'English': [],  # English shown to all states
        }
        return language_state_map.get(language, [])

    async def _fetch_reference_content(self, reference_urls: list, category: str = "", scraper_website: str = "") -> tuple:
        """Fetch and extract main article content from reference URLs using trafilatura
        For listing pages, finds the latest article first and fetches THAT article's content.
        
        Args:
            reference_urls: List of URL items. Can be:
                - strings (old format): ["https://example.com"]
                - objects (new format): [{"url": "https://...", "url_type": "listing"}]
            category: Category slug for additional context
            scraper_website: Force use of specific website scraper (greatandhra, gulte, etc.)
            
        Returns: (content_text, original_title, youtube_url)
        """
        if not reference_urls:
            return "", "", None
        
        fetched_content = []
        original_title = ""
        found_youtube_url = None  # Track YouTube URL from raw HTML
        
        for url_item in reference_urls:
            # Handle both old format (string) and new format (object)
            if isinstance(url_item, str):
                url = url_item
                url_type = 'auto'  # Default to auto-detect for old format
            elif isinstance(url_item, dict):
                url = url_item.get('url', '')
                url_type = url_item.get('url_type', 'auto')
            else:
                continue
            
            if not url:
                continue
                
            try:
                import trafilatura
                from urllib.parse import urljoin
                import re
                
                print(f"\n{'='*60}")
                print(f"📌 Processing URL: {url}")
                print(f"📌 URL Type setting: {url_type}")
                print(f"{'='*60}")
                
                # Download the webpage
                downloaded = trafilatura.fetch_url(url)
                
                if not downloaded:
                    fetched_content.append(f"**Could not download page from {url}**")
                    print(f"❌ Failed to download {url}")
                    continue
                
                # Determine if this is a listing page based on url_type setting
                if url_type == 'listing':
                    is_listing_page = True
                    print(f"🔧 User specified: LISTING PAGE")
                elif url_type == 'direct':
                    is_listing_page = False
                    print(f"🔧 User specified: DIRECT ARTICLE")
                else:
                    # Auto-detect: Check if URL has an article ID pattern
                    has_article_id = bool(re.search(r'/\d{5,}|[-/]\d{5,}', url))
                    
                    # Categories that typically use listing pages
                    listing_categories = ['politics', 'state-politics', 'national-politics', 'sports', 
                                         'business', 'technology', 'state-news', 'movie-news', 'andhra-news',
                                         'telangana-news', 'national-news', 'political-news']
                    
                    is_listing_page = (not has_article_id) or (category in listing_categories and not has_article_id)
                    print(f"🔧 Auto-detected: {'LISTING PAGE' if is_listing_page else 'DIRECT ARTICLE'} (has_article_id={has_article_id})")
                
                if is_listing_page:
                    print(f"📋 Processing as LISTING PAGE - will find latest article first...")
                    
                    # Find the latest article URL from the listing page
                    # Use site-specific scraper based on scraper_website or URL
                    if scraper_website == 'espn-cricinfo' or 'espncricinfo.com' in url:
                        print(f"🏏 Using ESPN Cricinfo scraper (RSS feed)...")
                        article_urls = await self._find_espn_cricinfo_articles(1)
                        article_url = article_urls[0] if article_urls else None
                    elif scraper_website == 'bbc-cricket' or 'bbc.com/sport/cricket' in url:
                        print(f"🏏 Using BBC Cricket scraper for listing page...")
                        article_urls = await self._find_bbc_cricket_articles(downloaded, url, 1)
                        article_url = article_urls[0] if article_urls else None
                    else:
                        article_url = await self._find_latest_article_url(downloaded, url)
                    
                    if article_url:
                        print(f"✅ Found latest article URL: {article_url}")
                        print(f"📥 Now fetching content from the ACTUAL article page...")
                        
                        # IMPORTANT: Fetch the ACTUAL article page, NOT the listing page
                        article_downloaded = trafilatura.fetch_url(article_url)
                        
                        if article_downloaded:
                            # Extract content from the ACTUAL article using trafilatura (clean extraction)
                            extracted = trafilatura.extract(
                                article_downloaded,
                                include_comments=False,
                                include_tables=True,
                                no_fallback=False,
                                favor_precision=True
                            )
                            metadata = trafilatura.extract_metadata(article_downloaded)
                            
                            # Only extract YouTube URL from clean trafilatura content (not raw HTML)
                            # This avoids picking up ads and sidebar content
                            if extracted and not found_youtube_url:
                                youtube_from_content = self._extract_youtube_url(extracted, from_article_content=True)
                                if youtube_from_content:
                                    found_youtube_url = youtube_from_content
                                    print(f"🎬 Found YouTube URL in article content: {found_youtube_url}")
                            
                            if extracted:
                                if metadata and metadata.title:
                                    original_title = metadata.title
                                print(f"✅ Successfully extracted article content: {len(extracted)} chars")
                                print(f"📰 Article title: {original_title or 'Unknown'}")
                                fetched_content.append(f"**Article Title:** {original_title or 'Unknown'}\n\n**Article Content:**\n{extracted}")
                            else:
                                print(f"❌ trafilatura could not extract content from article: {article_url}")
                                fetched_content.append(f"**Could not extract article content from {article_url}**")
                        else:
                            print(f"❌ Failed to download the article page: {article_url}")
                            fetched_content.append(f"**Could not download article from {article_url}**")
                    else:
                        print(f"❌ Could not find any article links on the listing page: {url}")
                        fetched_content.append(f"**No article links found on listing page {url}**")
                else:
                    # Direct article URL - extract content directly
                    print(f"📄 Processing as DIRECT ARTICLE - extracting content directly...")
                    extracted = trafilatura.extract(
                        downloaded,
                        include_comments=False,
                        include_tables=True,
                        no_fallback=False,
                        favor_precision=True
                    )
                    metadata = trafilatura.extract_metadata(downloaded)
                    
                    # Only extract YouTube URL from clean trafilatura content (not raw HTML)
                    # This avoids picking up ads and sidebar content
                    if extracted and not found_youtube_url:
                        youtube_from_content = self._extract_youtube_url(extracted, from_article_content=True)
                        if youtube_from_content:
                            found_youtube_url = youtube_from_content
                            print(f"🎬 Found YouTube URL in article content: {found_youtube_url}")
                    
                    if extracted:
                        if metadata and metadata.title:
                            original_title = metadata.title
                        print(f"✅ Successfully extracted article content: {len(extracted)} chars")
                        print(f"📰 Article title: {original_title or 'Unknown'}")
                        fetched_content.append(f"**Article Title:** {original_title or 'Unknown'}\n\n**Article Content:**\n{extracted}")
                    else:
                        print(f"❌ trafilatura could not extract content from {url}")
                        fetched_content.append(f"**Could not extract article content from {url}**")
                    
            except Exception as e:
                print(f"❌ Failed to fetch {url}: {e}")
                fetched_content.append(f"**Error fetching {url}: {str(e)}**")
        
        return "\n\n---\n\n".join(fetched_content), original_title, found_youtube_url

    async def _find_latest_article_url(self, html_content: str, base_url: str) -> Optional[str]:
        """Find the latest article URL from a listing page by finding the highest article ID or latest datetime"""
        try:
            import re
            from urllib.parse import urljoin, urlparse
            from datetime import datetime
            
            # Extract domain and path category from base URL
            parsed_base = urlparse(base_url)
            base_domain = parsed_base.netloc
            
            # Extract category from base URL path (e.g., /andhra-news, /political-news, /movie-news)
            base_path_parts = [p for p in parsed_base.path.split('/') if p]
            base_category = base_path_parts[-1] if base_path_parts else None
            print(f"Base category: {base_category}")
            
            found_articles = []  # List of (url, sort_key, source_type)
            
            # First, try to find articles with datetime information
            # Look for patterns like: <time datetime="2024-12-17T14:30:00">
            # or <a href="..."><time datetime="...">
            datetime_patterns = [
                r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>.*?<time[^>]*datetime=["\']([^"\']+)["\']',
                r'<time[^>]*datetime=["\']([^"\']+)["\'][^>]*>.*?<a[^>]*href=["\']([^"\']+)["\']',
                r'datetime=["\'](\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})[^"\']*["\'][^>]*>.*?href=["\']([^"\']+)["\']',
            ]
            
            for pattern in datetime_patterns:
                matches = re.findall(pattern, html_content, re.IGNORECASE | re.DOTALL)
                for match in matches:
                    # Determine which group is URL and which is datetime
                    if match[0].startswith('http') or match[0].startswith('/'):
                        href, dt_str = match[0], match[1]
                    else:
                        dt_str, href = match[0], match[1]
                    
                    full_url = urljoin(base_url, href)
                    parsed_url = urlparse(full_url)
                    
                    if base_domain not in parsed_url.netloc:
                        continue
                    
                    # Parse datetime
                    try:
                        # Handle various datetime formats
                        dt_str_clean = dt_str.replace('Z', '+00:00')
                        if 'T' in dt_str_clean:
                            dt = datetime.fromisoformat(dt_str_clean.split('+')[0])
                            sort_key = int(dt.strftime('%Y%m%d%H%M%S'))
                            already_added = any(url == full_url for url, _, _ in found_articles)
                            if not already_added:
                                found_articles.append((full_url, sort_key, 'datetime'))
                    except:
                        pass
            
            # If no datetime found, fall back to URL-based ID extraction
            if not found_articles:
                href_pattern = r'href=["\']([^"\']+)["\']'
                all_hrefs = re.findall(href_pattern, html_content, re.IGNORECASE)
                
                for href in all_hrefs:
                    full_url = urljoin(base_url, href)
                    parsed_url = urlparse(full_url)
                    
                    # Filter criteria
                    is_same_domain = base_domain in parsed_url.netloc
                    is_not_asset = not any(x in full_url.lower() for x in [
                        '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', 
                        '.svg', '.ico', '/feed/', '/category/', '/tag/', '/author/',
                        'cdn.', 'assets', 'static', '#', 'javascript:', 'mailto:',
                        'login', 'signup', 'subscribe', 'search', 'page/', '/amp/'
                    ])
                    is_different_from_base = full_url.rstrip('/') != base_url.rstrip('/')
                    already_added = any(url == full_url for url, _, _ in found_articles)
                    
                    # Check if URL belongs to same category as base URL
                    is_same_category = True
                    if base_category:
                        # Check if the article URL contains the same category
                        is_same_category = base_category.lower() in parsed_url.path.lower()
                    
                    if not (is_same_domain and is_not_asset and is_different_from_base and not already_added and is_same_category):
                        continue
                    
                    article_id = 0
                    
                    # Try to find numeric ID in the URL path
                    id_patterns = [
                        r'/(\d{5,})/',  # ID in middle: /123456/
                        r'/(\d{5,})$',  # ID at end: /123456
                        r'-(\d{5,})$',  # ID after hyphen at end: -123456
                        r'-(\d{5,})/?$',  # ID after hyphen: -123456/
                    ]
                    
                    for pattern in id_patterns:
                        match = re.search(pattern, parsed_url.path)
                        if match:
                            article_id = int(match.group(1))
                            break
                    
                    # If no ID found, try date-based pattern in URL
                    if article_id == 0:
                        date_match = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', parsed_url.path)
                        if date_match:
                            article_id = int(f"{date_match.group(1)}{date_match.group(2)}{date_match.group(3)}000000")
                    
                    if article_id > 0:
                        found_articles.append((full_url, article_id, 'url_id'))
            
            # Sort by sort_key (highest first) to get the latest article
            if found_articles:
                found_articles.sort(key=lambda x: x[1], reverse=True)
                latest_url = found_articles[0][0]
                latest_key = found_articles[0][1]
                source = found_articles[0][2]
                print(f"Found {len(found_articles)} articles (source: {source}). Latest key: {latest_key}")
                print(f"Latest article URL: {latest_url}")
                return latest_url
            
            return None
            
        except Exception as e:
            print(f"Error finding article URL: {e}")
            return None

    async def _find_multiple_article_urls(self, html_content: str, base_url: str, count: int = 1) -> list:
        """Find multiple article URLs from a listing page, sorted by most recent first.
        
        Args:
            html_content: Raw HTML of the listing page
            base_url: Base URL of the listing page
            count: Number of article URLs to return (max)
            
        Returns: List of article URLs, up to 'count' items
        """
        try:
            import re
            from urllib.parse import urljoin, urlparse
            from datetime import datetime
            
            # Extract domain and path category from base URL
            parsed_base = urlparse(base_url)
            base_domain = parsed_base.netloc
            
            # Extract category from base URL path
            base_path_parts = [p for p in parsed_base.path.split('/') if p]
            base_category = base_path_parts[-1] if base_path_parts else None
            print(f"📋 Finding {count} articles from listing page. Base category: {base_category}")
            
            found_articles = []  # List of (url, sort_key, source_type)
            
            # First, try to find articles with datetime information
            datetime_patterns = [
                r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>.*?<time[^>]*datetime=["\']([^"\']+)["\']',
                r'<time[^>]*datetime=["\']([^"\']+)["\'][^>]*>.*?<a[^>]*href=["\']([^"\']+)["\']',
                r'datetime=["\'](\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})[^"\']*["\'][^>]*>.*?href=["\']([^"\']+)["\']',
            ]
            
            for pattern in datetime_patterns:
                matches = re.findall(pattern, html_content, re.IGNORECASE | re.DOTALL)
                for match in matches:
                    if match[0].startswith('http') or match[0].startswith('/'):
                        href, dt_str = match[0], match[1]
                    else:
                        dt_str, href = match[0], match[1]
                    
                    full_url = urljoin(base_url, href)
                    parsed_url = urlparse(full_url)
                    
                    if base_domain not in parsed_url.netloc:
                        continue
                    
                    try:
                        dt_str_clean = dt_str.replace('Z', '+00:00')
                        if 'T' in dt_str_clean:
                            dt = datetime.fromisoformat(dt_str_clean.split('+')[0])
                            sort_key = int(dt.strftime('%Y%m%d%H%M%S'))
                            already_added = any(url == full_url for url, _, _ in found_articles)
                            if not already_added:
                                found_articles.append((full_url, sort_key, 'datetime'))
                    except:
                        pass
            
            # If no datetime found, fall back to URL-based ID extraction
            if not found_articles:
                href_pattern = r'href=["\']([^"\']+)["\']'
                all_hrefs = re.findall(href_pattern, html_content, re.IGNORECASE)
                
                for href in all_hrefs:
                    full_url = urljoin(base_url, href)
                    parsed_url = urlparse(full_url)
                    
                    is_same_domain = base_domain in parsed_url.netloc
                    is_not_asset = not any(x in full_url.lower() for x in [
                        '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', 
                        '.svg', '.ico', '/feed/', '/category/', '/tag/', '/author/',
                        'cdn.', 'assets', 'static', '#', 'javascript:', 'mailto:',
                        'login', 'signup', 'subscribe', 'search', 'page/', '/amp/'
                    ])
                    is_different_from_base = full_url.rstrip('/') != base_url.rstrip('/')
                    already_added = any(url == full_url for url, _, _ in found_articles)
                    
                    is_same_category = True
                    if base_category:
                        is_same_category = base_category.lower() in parsed_url.path.lower()
                    
                    if not (is_same_domain and is_not_asset and is_different_from_base and not already_added and is_same_category):
                        continue
                    
                    article_id = 0
                    id_patterns = [
                        r'/(\d{5,})/',
                        r'/(\d{5,})$',
                        r'-(\d{5,})$',
                        r'-(\d{5,})/?$',
                    ]
                    
                    for pattern in id_patterns:
                        match = re.search(pattern, parsed_url.path)
                        if match:
                            article_id = int(match.group(1))
                            break
                    
                    if article_id == 0:
                        date_match = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', parsed_url.path)
                        if date_match:
                            article_id = int(f"{date_match.group(1)}{date_match.group(2)}{date_match.group(3)}000000")
                    
                    if article_id > 0:
                        found_articles.append((full_url, article_id, 'url_id'))
            
            # Sort by sort_key (highest first) to get the latest articles
            if found_articles:
                found_articles.sort(key=lambda x: x[1], reverse=True)
                # Return only the requested count
                result_urls = [url for url, _, _ in found_articles[:count]]
                print(f"✅ Found {len(found_articles)} total articles, returning top {len(result_urls)}")
                for i, url in enumerate(result_urls):
                    print(f"   {i+1}. {url}")
                return result_urls
            
            return []
            
        except Exception as e:
            print(f"❌ Error finding article URLs: {e}")
            return []

    async def _find_bbc_cricket_articles(self, html_content: str, base_url: str, count: int = 1) -> list:
        """Find BBC Cricket article URLs from their listing page.
        
        BBC Sport uses a specific URL pattern: /sport/cricket/articles/{article_id}
        
        Args:
            html_content: Raw HTML of the BBC Cricket listing page
            base_url: Base URL (should be https://www.bbc.com/sport/cricket)
            count: Number of article URLs to return
            
        Returns: List of article URLs, up to 'count' items
        """
        try:
            import re
            from urllib.parse import urljoin
            
            print(f"🏏 BBC Cricket scraper: Finding {count} articles...")
            
            found_articles = []
            seen_ids = set()  # Track unique article IDs
            
            # BBC Sport article URL pattern: /sport/cricket/articles/{article_id}
            # Article IDs are alphanumeric strings like 'cwyw1w7d4gjo'
            pattern = r'href="(/sport/cricket/articles/([a-zA-Z0-9]+))(?:#[^"]*)?'
            
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            
            for path, article_id in matches:
                # Skip if we've already seen this article (avoid duplicates from #comments links)
                if article_id in seen_ids:
                    continue
                seen_ids.add(article_id)
                
                # Build full URL
                full_url = f"https://www.bbc.com{path}"
                
                # Use position in page as sort key (first articles are more recent)
                position = len(found_articles)
                found_articles.append((full_url, position, article_id))
            
            if found_articles:
                # BBC typically lists articles in order, so position 0 = most recent
                # No need to sort, just take first N
                result_urls = [url for url, _, _ in found_articles[:count]]
                print(f"✅ BBC Cricket: Found {len(found_articles)} total articles, returning top {len(result_urls)}")
                for i, url in enumerate(result_urls):
                    print(f"   {i+1}. {url}")
                return result_urls
            
            print("❌ BBC Cricket: No articles found on listing page")
            return []
            
        except Exception as e:
            print(f"❌ BBC Cricket scraper error: {e}")
            return []

    async def _find_espn_cricinfo_articles(self, count: int = 1) -> list:
        """Find ESPN Cricinfo article URLs and content from their RSS feed.
        
        ESPN Cricinfo blocks direct web scraping but their RSS feed is accessible.
        RSS Feed URL: https://www.espncricinfo.com/rss/content/story/feeds/0.xml
        
        Args:
            count: Number of article URLs to return
            
        Returns: List of tuples (url, title, description, image_url), up to 'count' items
        """
        try:
            import re
            import httpx
            
            print(f"🏏 ESPN Cricinfo scraper: Finding {count} articles from RSS feed...")
            
            rss_url = "https://www.espncricinfo.com/rss/content/story/feeds/0.xml"
            
            # Fetch the RSS feed
            with httpx.Client(timeout=30) as client:
                response = client.get(rss_url)
                if response.status_code != 200:
                    print(f"❌ ESPN Cricinfo: Failed to fetch RSS feed (status {response.status_code})")
                    return []
                
                rss_content = response.text
            
            print(f"✅ ESPN Cricinfo: RSS feed downloaded ({len(rss_content)} bytes)")
            
            found_articles = []
            
            # Parse RSS items - extract full item data
            # Pattern to extract each <item>...</item> block
            item_pattern = r'<item>(.*?)</item>'
            items = re.findall(item_pattern, rss_content, re.DOTALL)
            
            for item in items:
                # Extract URL
                url_match = re.search(r'<url>(https://www\.espncricinfo\.com/story/[^<]+)</url>', item)
                if not url_match:
                    continue
                url = url_match.group(1)
                
                # Extract title
                title_match = re.search(r'<title>([^<]+)</title>', item)
                title = title_match.group(1) if title_match else ""
                
                # Extract description
                desc_match = re.search(r'<description>([^<]+)</description>', item)
                description = desc_match.group(1) if desc_match else ""
                
                # Extract image URL
                img_match = re.search(r'<coverImages>([^<]+)</coverImages>', item)
                image_url = img_match.group(1) if img_match else ""
                
                found_articles.append({
                    'url': url,
                    'title': title,
                    'description': description,
                    'image_url': image_url
                })
            
            if found_articles:
                result = found_articles[:count]
                print(f"✅ ESPN Cricinfo: Found {len(found_articles)} total articles, returning top {len(result)}")
                for i, article in enumerate(result):
                    print(f"   {i+1}. {article['title'][:50]}...")
                return result
            
            print("❌ ESPN Cricinfo: No articles found in RSS feed")
            return []
            
        except Exception as e:
            print(f"❌ ESPN Cricinfo scraper error: {e}")
            return []

    async def _fetch_espn_cricinfo_content(self, article_data: dict) -> tuple:
        """Generate content from ESPN Cricinfo RSS data.
        
        Since ESPN Cricinfo blocks direct article fetching, we use the RSS data
        (title + description) as the reference content for the LLM to expand.
        
        Args:
            article_data: Dict with 'url', 'title', 'description', 'image_url'
            
        Returns: (content, title, image_url)
        """
        title = article_data.get('title', '')
        description = article_data.get('description', '')
        image_url = article_data.get('image_url', '')
        url = article_data.get('url', '')
        
        # Build reference content from RSS data
        content = f"""**Article Title:** {title}

**Article Summary:** {description}

**Source:** ESPN Cricinfo
**Original URL:** {url}

Note: This is a news summary from ESPN Cricinfo RSS feed. Use this information to write a comprehensive cricket news article."""
        
        print(f"📰 ESPN Cricinfo RSS content prepared: {len(content)} chars")
        return content, title, image_url

    def _build_final_prompt(self, agent: Dict[str, Any], reference_content: str = "") -> str:
        """Build the final prompt with all dynamic placeholders replaced"""
        category = agent.get('category', '')
        
        # Use custom_prompt if defined, otherwise fall back to category mapping
        custom_prompt = agent.get('custom_prompt', '')
        if custom_prompt and custom_prompt.strip():
            base_prompt = custom_prompt
            print(f"Using custom prompt for agent (length: {len(base_prompt)} chars)")
        else:
            base_prompt = self._get_category_prompt(category)
            print(f"Using category prompt mapping for: {category}")
        
        # Get dynamic values
        target_state = agent.get('target_state', 'All States')
        word_count = agent.get('word_count', '<200')
        article_language = agent.get('article_language', 'en')
        content_type = agent.get('content_type', 'post')
        
        # Language mapping
        language_names = {
            'en': 'English', 'te': 'Telugu', 'hi': 'Hindi', 'ta': 'Tamil',
            'kn': 'Kannada', 'mr': 'Marathi', 'gu': 'Gujarati', 'bn': 'Bengali',
            'ml': 'Malayalam', 'pa': 'Punjabi'
        }
        language_name = language_names.get(article_language, 'English')
        
        # Get state language for regional cinema
        state_language = self._get_state_language(target_state)
        
        # Extract numeric word count
        word_count_num = word_count.replace('<', '').replace('>', '').strip() if word_count else '200'
        
        # Build context for target state
        target_state_context = ""
        if target_state and target_state != "All States":
            target_state_context = f"focusing on {target_state} region"
        else:
            target_state_context = "covering national/international news"
        
        # Build target audience
        target_audience = f"readers in {target_state}" if target_state and target_state != "All States" else "general audience"
        
        # Replace placeholders in prompt
        final_prompt = base_prompt
        final_prompt = final_prompt.replace('{target_state_context}', target_state_context)
        final_prompt = final_prompt.replace('{word_count}', word_count_num)
        final_prompt = final_prompt.replace('{target_audience}', target_audience)
        final_prompt = final_prompt.replace('{state_language}', state_language)
        final_prompt = final_prompt.replace('{target_state}', target_state or 'All States')
        
        # Handle reference content section - include actual fetched content
        reference_urls = agent.get('reference_urls', [])
        if reference_content:
            reference_section = f"""**REFERENCE CONTENT (ALREADY FETCHED - NO WEB ACCESS NEEDED):**
The following content has been fetched from the reference URLs. Use this as your PRIMARY source to generate the article.
DO NOT ask for web access or browsing - the content is provided below:

---BEGIN ARTICLE CONTENT---
{reference_content}
---END ARTICLE CONTENT---

**INSTRUCTIONS:**
1. Read and analyze the above reference content carefully
2. Identify the main news stories, facts, and key information
3. Write a NEW, original article based on this content
4. Do NOT copy text directly - rewrite in your own words
5. Do NOT say you need web access - all content is provided above"""
            # Replace placeholder if exists, otherwise append to prompt
            if '{reference_content_section}' in final_prompt:
                final_prompt = final_prompt.replace('{reference_content_section}', reference_section)
            else:
                final_prompt = reference_section + "\n\n" + final_prompt
        elif reference_urls and len(reference_urls) > 0:
            urls_list = "\n".join([f"- {url}" for url in reference_urls if url])
            reference_section = f"""Reference URLs provided: {urls_list}
Note: Could not fetch content from these URLs. Generate content based on general knowledge."""
            if '{reference_content_section}' in final_prompt:
                final_prompt = final_prompt.replace('{reference_content_section}', reference_section)
            else:
                final_prompt = reference_section + "\n\n" + final_prompt
        else:
            final_prompt = final_prompt.replace('{reference_content_section}', 'No reference URLs provided. Generate content based on general knowledge.')
        
        # Handle split content section
        split_content = agent.get('split_content', False)
        split_paragraphs = agent.get('split_paragraphs', 2)
        if split_content:
            split_section = f"""
**CONTENT STRUCTURE - SPLIT MODE:**
Structure your article into exactly {split_paragraphs} distinct paragraphs, clearly separated by blank lines.
- Each paragraph should be self-contained but flow logically
- Paragraph 1: Lead with the most important news
- Remaining paragraphs: Supporting details and context
"""
            final_prompt = final_prompt.replace('{split_content_section}', split_section)
        else:
            final_prompt = final_prompt.replace('{split_content_section}', '')
        
        # Handle image search section (will be handled separately)
        final_prompt = final_prompt.replace('{image_search_section}', '')
        
        # Add language instruction
        final_prompt += f"\n\n**IMPORTANT: Write the entire article in {language_name} language.**"
        
        return final_prompt

    async def _optimize_prompt(self, base_prompt: str) -> str:
        """Use OpenAI to optimize the prompt for better content generation"""
        if not self.client:
            self._initialize_ai_client()
        
        # Check if the prompt contains reference content - if so, skip optimization
        # to prevent the LLM from accidentally removing the actual content
        if "**REFERENCE CONTENT" in base_prompt or "Article Content:" in base_prompt:
            print("   ℹ️ Skipping prompt optimization (reference content detected)")
            return base_prompt
        
        optimization_prompt = f"""You are a prompt optimization expert. Optimize the following prompt to generate better, more engaging news content. 
Keep the core requirements but make the instructions clearer and more specific.

Original Prompt:
{base_prompt}

Return ONLY the optimized prompt, nothing else."""

        try:
            return self._chat_completion(
                "You are a prompt optimization expert.",
                optimization_prompt,
                20000
            )
        except Exception as e:
            print(f"Prompt optimization failed: {e}, using original prompt")
            return base_prompt

    async def _generate_content(self, optimized_prompt: str) -> str:
        """Generate article content using OpenAI"""
        if not self.client:
            self._initialize_ai_client()
        
        try:
            # Use a more explicit system prompt when reference content is included
            if "**REFERENCE CONTENT" in optimized_prompt or "Article Content:" in optimized_prompt:
                system_prompt = """You are a professional news writer and journalist. 
The article content has ALREADY been provided to you in the prompt below. 
You do NOT need web access - all the information you need is in the prompt.
Your task is to rewrite this content into a well-structured, engaging article.
Write engaging, factual, and well-structured articles based on the provided content."""
            else:
                system_prompt = "You are a professional news writer and journalist. Write engaging, factual, and well-structured articles."
            
            content = self._chat_completion(
                system_prompt,
                optimized_prompt,
                20000
            )
            
            # Clean up any unwanted prefixes
            content = content.replace("Headline:", "").replace("**Headline:**", "")
            content = content.replace("Title:", "").replace("**Title:**", "")
            
            return content
        except Exception as e:
            raise Exception(f"Content generation failed: {str(e)}")

    async def _polish_content(self, raw_content: str) -> str:
        """Post-process content to make it professional, elegant, and well-formatted"""
        if not self.client:
            self._initialize_ai_client()
        
        try:
            polished = self._chat_completion(
                "You are an expert news editor and content formatter. Your job is to polish articles and format them beautifully for web display.",
                f"""Rewrite and FORMAT the following article for excellent readability.

**FORMATTING REQUIREMENTS:**
1. Break content into clear paragraphs (separate with blank lines)
2. Each paragraph should be 2-4 sentences max
3. Use SHORT paragraphs for easy reading
4. Add section breaks where topic changes
5. If there are multiple points, use line breaks between them

**WRITING REQUIREMENTS:**
1. Professional, elegant journalistic style
2. Concise - remove filler words
3. Engaging and easy to read
4. Keep all facts and key information
5. Remove any labels like "Headline:", "Title:", "Article:"

**OUTPUT FORMAT:**
- First paragraph: Lead with the most important news (2-3 sentences)
- Middle paragraphs: Supporting details and context (2-3 sentences each)
- Final paragraph: Conclusion or future outlook (1-2 sentences)
- Separate each paragraph with a blank line

Return ONLY the formatted article content, nothing else.

Original Article:
{raw_content}""",
                20000
            )
            
            # Clean up any remaining unwanted prefixes
            polished = polished.replace("Headline:", "").replace("**Headline:**", "")
            polished = polished.replace("Title:", "").replace("**Title:**", "")
            polished = polished.replace("Article:", "").replace("**Article:**", "")
            
            # Remove em-dashes, horizontal rules, and separator lines between paragraphs
            import re
            polished = re.sub(r'\n\s*[—–-]+\s*\n', '\n\n', polished)  # Remove em-dash/en-dash/dash separators
            polished = re.sub(r'\n\s*\*\*\*\s*\n', '\n\n', polished)  # Remove *** separators
            polished = re.sub(r'\n\s*---+\s*\n', '\n\n', polished)  # Remove --- separators
            polished = re.sub(r'^\s*[—–-]+\s*$', '', polished, flags=re.MULTILINE)  # Remove standalone dashes
            
            # Ensure proper paragraph separation
            # Replace single newlines with double newlines for better display
            polished = re.sub(r'\n(?!\n)', '\n\n', polished)
            # Clean up any triple+ newlines
            polished = re.sub(r'\n{3,}', '\n\n', polished)
            
            return polished
        except Exception as e:
            print(f"Content polishing failed: {e}, using original content")
            return raw_content

    async def _generate_title(self, content: str, original_title: str = "") -> str:
        """Rewrite the original title using LLM, keeping it under 125 characters"""
        if not self.client:
            self._initialize_ai_client()
        
        try:
            # If we have an original title, rewrite it
            if original_title:
                print(f"   📝 Rewriting original title: {original_title}")
                prompt = f"""Rewrite this news headline in a different way. Return ONLY ONE headline.

Original: {original_title}

RULES:
- Return exactly ONE headline, nothing else
- MUST be under 125 characters
- Keep the same meaning but use different words
- Make it catchy and engaging
- No quotes, no numbering, no bullet points
- Write in the same language as the original

Your response should be just the headline text, nothing more."""

                title = self._chat_completion(
                    "You rewrite headlines. Return only ONE headline under 125 characters. No lists, no options, just one headline.",
                    prompt,
                    2000
                )
                print(f"   ✅ LLM returned title: {title}")
            else:
                # No original title - generate from content
                print(f"   📝 No original title, generating from content...")
                prompt = f"""Write a news headline for this article. Return ONLY ONE headline.

Article summary:
{content[:800]}

RULES:
- Return exactly ONE headline, nothing else
- MUST be under 125 characters
- Catchy and engaging
- No quotes, no numbering, no bullet points

Your response should be just the headline text, nothing more."""

                title = self._chat_completion(
                    "You write headlines. Return only ONE headline under 125 characters. No lists, no options, just one headline.",
                    prompt,
                    2000
                )
                print(f"   ✅ LLM generated title: {title}")
            
            # Clean up the title
            if title:
                # Take only the first line if multiple lines returned
                title = title.split('\n')[0].strip()
                # Remove leading bullet points or dashes (but not numbers that are part of the title like "2026")
                if title.startswith('-') or title.startswith('•') or title.startswith('*'):
                    title = title[1:].strip()
                title = title.strip('"\'')
                title = title.replace("Headline:", "").replace("Title:", "").strip()
            
            # If title is still too long (over 125 chars), ask AI to shorten it
            if title and len(title) > 125:
                print(f"   ⚠️ Title too long ({len(title)} chars), asking AI to shorten...")
                title = self._chat_completion(
                    "You shorten headlines to under 125 characters while keeping the meaning.",
                    f"Shorten this headline to UNDER 125 characters:\n\n{title}\n\nWrite only the shortened headline.",
                    500
                ).strip('"\'')
                print(f"   ✅ Shortened title ({len(title)} chars): {title}")
            
            # Final truncation safety check
            if title and len(title) > 125:
                # Truncate at last complete word before 125 chars
                title = title[:122].rsplit(' ', 1)[0] + '...'
            
            # If title generation failed or empty, use original title or content excerpt
            if not title:
                print(f"   ⚠️ LLM returned empty title, using fallback...")
                if original_title:
                    title = original_title[:122] + '...' if len(original_title) > 125 else original_title
                else:
                    first_sentence = content.split('.')[0] if content else "News Article"
                    title = first_sentence.strip()[:122] + '...' if len(first_sentence) > 125 else first_sentence.strip()
            
            print(f"   📰 Final title ({len(title)} chars): {title}")
            return title
            
        except Exception as e:
            print(f"   ❌ Title generation failed: {e}")
            # Fallback to original title or content excerpt
            if original_title:
                return original_title[:122] + '...' if len(original_title) > 125 else original_title
            first_sentence = content.split('.')[0] if content else "News Article"
            return first_sentence[:122] + '...' if len(first_sentence) > 125 else first_sentence

    async def _generate_summary(self, content: str) -> str:
        """Generate an engaging summary for the content"""
        if not self.client:
            self._initialize_ai_client()
        
        try:
            summary = self._chat_completion(
                "You are an expert news editor. Write summaries that hook readers and make them want to read the full article.",
                f"""Write a short, engaging summary for this news article.

Requirements:
1. 2-3 sentences maximum
2. Capture the key news in a compelling way
3. Make it sound exciting and newsworthy
4. Simple language that's easy to read
5. No filler words - be concise

Return ONLY the summary text, nothing else.

Article:
{content[:2500]}""",
                300
            )
            return summary
        except Exception as e:
            print(f"Summary generation failed: {e}")
            return content[:200] + "..."  # Fallback to truncated content

    async def _get_image_for_content(self, content: str, title: str, image_option: str, category: str) -> Optional[str]:
        """Get image based on the image option selected"""
        if image_option == 'web_search':
            return await self._search_web_image(content, title, category)
        elif image_option == 'ai_generate':
            return await self._generate_ai_image(content, title)
        else:
            # For 'upload' or 'existing', return None - user will add manually
            return None

    async def _search_web_image(self, content: str, title: str, category: str) -> Optional[str]:
        """Search for an image using OpenAI to generate search query"""
        if not self.client:
            self._initialize_ai_client()
        
        try:
            # Generate search query
            search_query = self._chat_completion(
                "You are an image search expert. Generate a specific search query to find a relevant news image.",
                f"Generate a Google image search query to find a relevant, high-quality image for this article. Category: {category}. Title: {title}. Return ONLY the search query, nothing else.",
                100
            )
            
            # For now, return None - actual web search would require additional API
            # This can be extended with Google Custom Search API or similar
            print(f"Image search query generated: {search_query}")
            return None
            
        except Exception as e:
            print(f"Image search failed: {e}")
            return None

    async def _generate_ai_image(self, content: str, title: str) -> Optional[str]:
        """Generate an image using the configured image generation model"""
        if not self.client:
            self._initialize_ai_client()
        
        try:
            # Generate image prompt
            image_prompt = self._chat_completion(
                "Create a detailed image generation prompt.",
                f"Create an image prompt for a news article image. Title: {title}. Make it professional, news-worthy, horizontal orientation. Return ONLY the prompt, max 100 words.",
                200
            )
            
            # Check which image model to use
            image_model = self.image_model or 'dall-e-3'
            
            if image_model.startswith('imagen') or image_model.startswith('gemini'):
                # Use Google Imagen via Gemini API
                image_url = await self._generate_google_image(image_prompt)
            else:
                # Use OpenAI DALL-E
                image_url = await self._generate_dalle_image(image_prompt, image_model)
            
            if image_url:
                # Download and upload to S3
                uploaded_url = await self._download_and_upload_image(image_url)
                return uploaded_url
            return None
            
        except Exception as e:
            print(f"AI image generation failed: {e}")
            return None

    async def _generate_dalle_image(self, prompt: str, model: str = "dall-e-3") -> Optional[str]:
        """Generate image using OpenAI DALL-E or gpt-image-1"""
        try:
            # Handle different image models
            if model in ["gpt-image-1", "gpt-image"]:
                image_response = self.client.images.generate(
                    model="gpt-image-1",
                    prompt=prompt,
                    size="1536x1024",
                    quality="medium",
                    n=1
                )
            else:
                image_response = self.client.images.generate(
                    model=model,
                    prompt=prompt,
                    size="1792x1024" if model == "dall-e-3" else "1024x1024",
                    quality="standard",
                    n=1
                )
            return image_response.data[0].url
        except Exception as e:
            print(f"Image generation failed: {e}")
            return None

    async def _generate_google_image(self, prompt: str) -> Optional[str]:
        """Generate image using Google Imagen API"""
        try:
            import google.generativeai as genai
            
            gemini_api_key = self.ai_config.get('gemini_api_key')
            if not gemini_api_key:
                print("Gemini API key not configured for image generation")
                return None
            
            genai.configure(api_key=gemini_api_key)
            
            # Use Imagen model
            imagen = genai.ImageGenerationModel(self.image_model)
            result = imagen.generate_images(
                prompt=prompt,
                number_of_images=1,
                aspect_ratio="16:9"
            )
            
            if result.images:
                # Save image temporarily and return path
                import base64
                timestamp = int(datetime.now().timestamp() * 1000)
                temp_path = f"/tmp/imagen_{timestamp}.png"
                result.images[0].save(temp_path)
                return temp_path
            return None
            
        except Exception as e:
            print(f"Google Imagen generation failed: {e}")
            # Fallback to DALL-E if available
            if self.client:
                return await self._generate_dalle_image(prompt)
            return None

    async def _download_and_upload_image(self, image_source: str) -> Optional[str]:
        """Download image from URL or local path and upload to S3"""
        try:
            from s3_service import s3_service
            
            # Generate filename
            timestamp = int(datetime.now().timestamp() * 1000)
            filename = f"ai_generated_{timestamp}.png"
            temp_path = f"/tmp/{filename}"
            
            # Check if it's a local file path or URL
            if image_source.startswith('/tmp/') or image_source.startswith('/'):
                # Local file - just use it directly
                temp_path = image_source
                with open(temp_path, 'rb') as f:
                    image_data = f.read()
            else:
                # Download from URL
                async with httpx.AsyncClient() as client:
                    response = await client.get(image_source, timeout=30.0)
                    if response.status_code != 200:
                        return None
                    image_data = response.content
                
                # Save temporarily
                with open(temp_path, 'wb') as f:
                    f.write(image_data)
            
            # Upload to S3 if enabled
            if s3_service.is_enabled():
                # Upload to S3
                s3_url = s3_service.upload_file(temp_path, f"articles/{filename}")
                
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return s3_url
            else:
                # Save locally
                local_path = f"/app/backend/uploads/articles/{filename}"
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                
                # Move or copy file
                if temp_path != local_path:
                    with open(temp_path, 'rb') as f:
                        image_data = f.read()
                    with open(local_path, 'wb') as f:
                        f.write(image_data)
                    if os.path.exists(temp_path) and temp_path.startswith('/tmp/'):
                        os.remove(temp_path)
                
                return f"/uploads/articles/{filename}"
                
        except Exception as e:
            print(f"Image download/upload failed: {e}")
            return None

    def _split_content(self, content: str, num_paragraphs: int) -> tuple:
        """Split content into main and secondary content"""
        # Split by double newlines (paragraphs)
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        if len(paragraphs) <= 1:
            # Try splitting by single newlines
            paragraphs = [p.strip() for p in content.split('\n') if p.strip()]
        
        if len(paragraphs) <= 1:
            return content, ""
        
        # First half goes to main content, rest to secondary
        split_point = max(1, len(paragraphs) // 2)
        main_content = '\n\n'.join(paragraphs[:split_point])
        secondary_content = '\n\n'.join(paragraphs[split_point:])
        
        return main_content, secondary_content

    def _get_status_from_workflow(self, workflow: str) -> tuple:
        """Get article status and is_published from workflow setting"""
        if workflow == 'auto_post':
            return 'published', True
        elif workflow == 'ready_to_publish':
            return 'approved', False
        else:  # 'in_review'
            return 'in_review', False

    def _extract_youtube_url(self, content: str, from_article_content: bool = False) -> Optional[str]:
        """Extract YouTube video URL from content if present.
        
        Args:
            content: HTML content or text content to search
            from_article_content: If True, only extract from clean article content (trafilatura extracted).
                                 If False, search in raw HTML (may include ads).
        
        Returns the first YouTube URL found that appears to be part of the main content, or None if not found.
        """
        import re
        
        # YouTube URL patterns
        youtube_patterns = [
            # Standard YouTube URLs
            r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
            # Short YouTube URLs
            r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})',
            # YouTube embed URLs
            r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})',
            # YouTube shorts
            r'(?:https?://)?(?:www\.)?youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
        ]
        
        # Skip patterns - these are typically ads, social links, or channel links
        skip_patterns = [
            r'youtube\.com/user/',           # Channel links
            r'youtube\.com/channel/',        # Channel links
            r'youtube\.com/@',               # Handle links
            r'youtube\.com/live/',           # Live streams (often ads)
            r'rll-youtube-player',           # Lazy load players (often ads)
            r'youtube-carousel',             # YouTube carousels (sidebar content)
            r'youtube-short',                # YouTube shorts carousels
        ]
        
        for pattern in youtube_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                video_id = match.group(1)
                full_match_context = content[max(0, match.start()-200):match.end()+100]
                
                # Skip if this URL is in an ad/sidebar context
                is_ad_content = False
                for skip_pat in skip_patterns:
                    if re.search(skip_pat, full_match_context, re.IGNORECASE):
                        is_ad_content = True
                        print(f"   ⏭️ Skipping YouTube URL (ad/sidebar context): {video_id}")
                        break
                
                if is_ad_content:
                    continue
                
                # For raw HTML, also check if it's in article main content area
                if not from_article_content:
                    # Look for common article content markers
                    article_markers = [
                        r'class="[^"]*entry-content[^"]*"',
                        r'class="[^"]*article-content[^"]*"',
                        r'class="[^"]*post-content[^"]*"',
                        r'class="[^"]*td-post-content[^"]*"',
                        r'<article[^>]*>',
                    ]
                    
                    # Try to find if the match is within an article content block
                    for marker in article_markers:
                        marker_match = re.search(marker, content[:match.start()], re.IGNORECASE)
                        if marker_match:
                            break
                
                youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                print(f"🎬 Found YouTube video URL: {youtube_url}")
                return youtube_url
        
        return None

    async def run_agent(self, agent_id: str) -> Dict[str, Any]:
        """Run an AI agent and generate article(s).
        
        If posts_count > 1, this will scrape multiple articles from a listing page
        and create a post for each.
        """
        # Get agent configuration
        agent = crud.get_ai_agent(db, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        
        try:
            # Initialize AI client
            self._initialize_ai_client()
            
            # Check if bulk creation is requested
            posts_count = agent.get('posts_count', 1) or 1
            posts_count = min(max(1, posts_count), 100)  # Clamp between 1 and 100
            
            if posts_count > 1:
                return await self._run_agent_bulk(agent, posts_count)
            else:
                return await self._run_agent_single(agent)
                
        except Exception as e:
            return {
                'success': False,
                'message': str(e),
                'article_id': None
            }
    
    async def _run_agent_bulk(self, agent: Dict[str, Any], posts_count: int) -> Dict[str, Any]:
        """Run agent in bulk mode - create multiple articles from a listing page."""
        import trafilatura
        
        reference_urls = agent.get('reference_urls', [])
        if not reference_urls:
            return {
                'success': False,
                'message': 'No reference URL provided for bulk creation',
                'article_id': None
            }
        
        # Get the first URL (should be a listing page)
        first_url = reference_urls[0]
        if isinstance(first_url, dict):
            listing_url = first_url.get('url', '')
        else:
            listing_url = first_url
        
        if not listing_url:
            return {
                'success': False,
                'message': 'Invalid listing page URL',
                'article_id': None
            }
        
        print(f"\n{'='*60}")
        print(f"🚀 BULK CREATION MODE: Creating {posts_count} posts from listing page")
        print(f"📋 Listing URL: {listing_url}")
        print(f"{'='*60}\n")
        
        # Get scraper website setting
        scraper_website = agent.get('scraper_website', '')
        
        # ESPN Cricinfo uses RSS feed - special handling
        if scraper_website == 'espn-cricinfo' or 'espncricinfo.com' in listing_url:
            print(f"🏏 Using ESPN Cricinfo scraper (RSS feed)...")
            espn_articles = await self._find_espn_cricinfo_articles(posts_count)
            
            if not espn_articles:
                return {
                    'success': False,
                    'message': 'No articles found in ESPN Cricinfo RSS feed',
                    'article_id': None
                }
            
            print(f"\n✅ Found {len(espn_articles)} ESPN Cricinfo articles to process\n")
            
            # Create articles for each ESPN article (using RSS data)
            created_articles = []
            failed_articles = []
            
            for i, article_data in enumerate(espn_articles):
                print(f"\n{'='*60}")
                print(f"📰 Processing article {i+1}/{len(espn_articles)}: {article_data['title'][:50]}...")
                print(f"{'='*60}")
                
                try:
                    # Get content from RSS data
                    content, title, image_url = await self._fetch_espn_cricinfo_content(article_data)
                    
                    # Create a modified agent with ESPN content as reference
                    single_agent = dict(agent)
                    single_agent['_espn_rss_content'] = content
                    single_agent['_espn_title'] = title
                    single_agent['_espn_image'] = image_url
                    single_agent['reference_urls'] = [{'url': article_data['url'], 'url_type': 'direct'}]
                    
                    result = await self._run_agent_single(single_agent)
                    
                    if result.get('success'):
                        created_articles.append({
                            'url': article_data['url'],
                            'article_id': result.get('article_id'),
                            'title': result.get('title')
                        })
                        print(f"✅ Created article: {result.get('title', 'Unknown')}")
                    else:
                        failed_articles.append({
                            'url': article_data['url'],
                            'error': result.get('message', 'Unknown error')
                        })
                        print(f"❌ Failed to create article: {result.get('message')}")
                        
                except Exception as e:
                    failed_articles.append({
                        'url': article_data.get('url', 'Unknown'),
                        'error': str(e)
                    })
                    print(f"❌ Exception creating article: {e}")
            
            success_count = len(created_articles)
            fail_count = len(failed_articles)
            
            return {
                'success': success_count > 0,
                'message': f'Created {success_count} articles successfully' + (f', {fail_count} failed' if fail_count > 0 else ''),
                'article_id': created_articles[0]['article_id'] if created_articles else None,
                'created_count': success_count,
                'failed_count': fail_count,
                'created_articles': created_articles,
                'failed_articles': failed_articles
            }
        
        # For other scrapers, fetch the listing page
        downloaded = trafilatura.fetch_url(listing_url)
        if not downloaded:
            return {
                'success': False,
                'message': f'Failed to download listing page: {listing_url}',
                'article_id': None
            }
        
        # Find multiple article URLs using appropriate scraper
        if scraper_website == 'bbc-cricket' or 'bbc.com/sport/cricket' in listing_url:
            print(f"🏏 Using BBC Cricket scraper...")
            article_urls = await self._find_bbc_cricket_articles(downloaded, listing_url, posts_count)
        else:
            article_urls = await self._find_multiple_article_urls(downloaded, listing_url, posts_count)
        
        if not article_urls:
            return {
                'success': False,
                'message': f'No article URLs found on listing page: {listing_url}',
                'article_id': None
            }
        
        print(f"\n✅ Found {len(article_urls)} article URLs to process\n")
        
        # Create articles for each URL
        created_articles = []
        failed_articles = []
        
        for i, article_url in enumerate(article_urls):
            print(f"\n{'='*60}")
            print(f"📰 Processing article {i+1}/{len(article_urls)}: {article_url}")
            print(f"{'='*60}")
            
            try:
                # Create a modified agent config with this specific URL
                single_agent = dict(agent)
                single_agent['reference_urls'] = [{'url': article_url, 'url_type': 'direct'}]
                
                result = await self._run_agent_single(single_agent)
                
                if result.get('success'):
                    created_articles.append({
                        'url': article_url,
                        'article_id': result.get('article_id'),
                        'title': result.get('title')
                    })
                    print(f"✅ Created article: {result.get('title', 'Unknown')}")
                else:
                    failed_articles.append({
                        'url': article_url,
                        'error': result.get('message', 'Unknown error')
                    })
                    print(f"❌ Failed to create article: {result.get('message')}")
                    
            except Exception as e:
                failed_articles.append({
                    'url': article_url,
                    'error': str(e)
                })
                print(f"❌ Exception creating article: {e}")
        
        # Return summary
        success_count = len(created_articles)
        fail_count = len(failed_articles)
        
        return {
            'success': success_count > 0,
            'message': f'Created {success_count} articles successfully' + (f', {fail_count} failed' if fail_count > 0 else ''),
            'article_id': created_articles[0]['article_id'] if created_articles else None,
            'created_count': success_count,
            'failed_count': fail_count,
            'created_articles': created_articles,
            'failed_articles': failed_articles
        }

    async def _run_agent_single(self, agent: Dict[str, Any]) -> Dict[str, Any]:
        """Run agent to create a single article from reference URLs."""
        try:
            # Ensure AI client is initialized
            if not self.client:
                self._initialize_ai_client()
            
            # Step 2: Fetch content from reference URLs
            reference_urls = agent.get('reference_urls', [])
            category = agent.get('category', '')
            scraper_website = agent.get('scraper_website', '')  # Website-specific scraper selection
            reference_content = ""
            original_title = ""
            youtube_url_from_source = None  # YouTube URL found in source HTML
            if reference_urls:
                print(f"Fetching content from {len(reference_urls)} reference URLs for category: {category}...")
                if scraper_website:
                    print(f"   🔧 Using forced scraper: {scraper_website}")
                reference_content, original_title, youtube_url_from_source = await self._fetch_reference_content(reference_urls, category, scraper_website)
                print(f"Fetched {len(reference_content)} characters of reference content")
                if original_title:
                    print(f"Original article title: {original_title}")
                if youtube_url_from_source:
                    print(f"🎬 YouTube URL found in source: {youtube_url_from_source}")
            
            # Step 3: Build the final prompt with all dynamic placeholders and reference content
            base_prompt = self._build_final_prompt(agent, reference_content)
            
            # Step 4: Optimize the prompt using OpenAI
            optimized_prompt = await self._optimize_prompt(base_prompt)
            
            # Step 5: Generate content using the optimized prompt
            raw_content = await self._generate_content(optimized_prompt)
            
            # Step 6: Polish the content to make it professional and elegant
            print("Polishing content for professional quality...")
            content = await self._polish_content(raw_content)
            
            # Step 7: Generate a compelling, simplified title (using original title if available)
            print("Generating article title...")
            title = await self._generate_title(content, original_title)
            print(f"Generated title: {title}")
            
            # Step 8: Generate an engaging summary
            print("Generating article summary...")
            summary = await self._generate_summary(content)
            
            # Step 9: Check for YouTube URL in reference content or generated content
            # For movie-news and state-news categories, auto-detect video content
            category = agent.get('category', '')
            video_categories = ['movie-news', 'state-news', 'state-politics', 'national-politics', 
                               'tollywood', 'bollywood', 'kollywood', 'entertainment']
            
            youtube_url = None
            content_type = agent.get('content_type', 'post')
            
            # Use YouTube URL found from source content first (most reliable - extracted from trafilatura content)
            if youtube_url_from_source:
                youtube_url = youtube_url_from_source
                print(f"🎬 Using YouTube URL from source content: {youtube_url}")
            else:
                # Fallback: Check reference content and generated content for YouTube URLs
                if category in video_categories or content_type == 'post':
                    youtube_url = self._extract_youtube_url(reference_content, from_article_content=True)
                    if not youtube_url:
                        youtube_url = self._extract_youtube_url(content, from_article_content=True)
            
            if youtube_url:
                print(f"🎬 YouTube video detected! Switching content type from '{content_type}' to 'video_post'")
                content_type = 'video_post'
            
            # Step 10: Get image based on image option (skip for video posts)
            image_url = None
            if content_type != 'video_post':
                image_option = agent.get('image_option', 'web_search')
                image_url = await self._get_image_for_content(content, title, image_option, agent.get('category', ''))
            else:
                print("📹 Skipping image generation for video post")
            
            # Step 11: Handle split content
            main_content = content
            secondary_content = ""
            if agent.get('split_content', False):
                main_content, secondary_content = self._split_content(content, agent.get('split_paragraphs', 2))
            
            # Step 12: Determine status from workflow
            status, is_published = self._get_status_from_workflow(agent.get('content_workflow', 'in_review'))
            
            # Step 13: Determine states based on target_language or target_state (both optional)
            target_language = agent.get('target_language', '')
            target_state = agent.get('target_state', '')
            
            if target_language:
                # Language-based targeting: get all states for this language
                states_list = self._get_states_for_language(target_language)
                if states_list:
                    # Build JSON array of states
                    quoted_states = [f'"{s}"' for s in states_list]
                    states_json = '[' + ', '.join(quoted_states) + ']'
                else:
                    states_json = '["all"]'  # English or unknown language shows to all
                print(f"   🌐 Language-based targeting: {target_language} -> {states_list}")
            elif target_state:
                # State-based targeting
                states_json = f'["{target_state}"]'
                print(f"   📍 State-based targeting: {target_state}")
            else:
                # No targeting - show to all states
                states_json = '["all"]'
                print(f"   🌍 No targeting specified - showing to all states")
            
            # Step 14: Create the article
            article_data = {
                'title': title,
                'content': main_content,
                'content_secondary': secondary_content if secondary_content else None,
                'summary': summary,
                'author': 'AI Agent',
                'article_language': agent.get('article_language', 'en'),
                'content_language': target_language if target_language else None,  # Content language for targeting
                'target_state': target_state if target_state else None,  # Target state for targeting
                'states': states_json,
                'category': agent.get('category', ''),
                'content_type': content_type,
                'image': image_url,
                'is_top_story': agent.get('is_top_story', False),
                'comments_enabled': agent.get('comments_enabled', True),
                'status': status,
                'is_published': is_published,
                'is_scheduled': False
            }
            
            # Add YouTube URL if video_post content type
            if content_type == 'video_post' and youtube_url:
                article_data['youtube_url'] = youtube_url
                print(f"📹 Added YouTube URL to article: {youtube_url}")
            
            # Generate slug from title
            slug = re.sub(r'[^a-zA-Z0-9\s]', '', title.lower())
            slug = re.sub(r'\s+', '-', slug.strip())
            article_data['slug'] = slug
            
            # Create the article
            created_article = crud.create_article(db, article_data)
            
            return {
                'success': True,
                'message': 'Article created successfully',
                'article_id': created_article.get('id'),
                'title': title,
                'status': status
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': str(e),
                'article_id': None
            }


# Singleton instance
agent_runner = AgentRunnerService()
