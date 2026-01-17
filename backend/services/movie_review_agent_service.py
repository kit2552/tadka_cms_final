"""
Movie Review Agent Service
Simplified flow: Scrape single URL -> Store temp -> LLM rewrite -> Create article
"""

import asyncio
from datetime import datetime, timezone
from typing import Dict, Optional
from database import db
import crud
import re
import json

# Default rating verdicts mapping (used if not configured in system settings)
DEFAULT_RATING_VERDICTS = {
    0.00: {"tag": "Disaster", "verdict": "Complete disaster! Skip entirely. Not even worth OTT."},
    0.25: {"tag": "Terrible", "verdict": "Absolute disaster. Save your time and money. Stay away!"},
    0.50: {"tag": "Awful", "verdict": "Painfully bad. Not recommended under any circumstances."},
    0.75: {"tag": "Very Poor", "verdict": "Major misfire. Even hardcore fans should skip this one."},
    1.00: {"tag": "Flop", "verdict": "Big disappointment. Wait for TV premiere if curious."},
    1.25: {"tag": "Poor", "verdict": "Falls short. Only for completists. Better options exist."},
    1.50: {"tag": "Weak", "verdict": "Struggles throughout. Maybe catch on TV after 6 months."},
    1.75: {"tag": "Below Par", "verdict": "Disappointing effort. Skip theaters, maybe OTT later."},
    2.00: {"tag": "Below Average", "verdict": "Strictly average. Watch in theaters if you're bored and have nothing else to do, otherwise catch it on OTT later."},
    2.25: {"tag": "Passable", "verdict": "Just okay time-pass. Hit theaters if you're free and bored, or wait for OTT - no rush either way."},
    2.50: {"tag": "Average", "verdict": "Average entertainer. Worth catching in theaters if you have time this weekend, good OTT option too."},
    2.75: {"tag": "Good", "verdict": "Good watch! Theaters recommended if you're free, makes for a good outing."},
    3.00: {"tag": "Very Good", "verdict": "Very good entertainer! Catch it in theaters while you can - worth the experience."},
    3.25: {"tag": "Hit", "verdict": "Solid hit! Book your weekend tickets. Worth the theater experience."},
    3.50: {"tag": "Super Hit", "verdict": "Super hit! Paisa vasool. Grab friends and hit theaters! 🔥"},
    3.75: {"tag": "Blockbuster", "verdict": "Blockbuster! Must watch in theaters. Don't wait for OTT! 💥"},
    4.00: {"tag": "Excellent", "verdict": "Excellent! Outstanding cinema. Theater mandatory! ⭐"},
    4.25: {"tag": "Superhit", "verdict": "Superhit! Cinematic brilliance. Book tickets now! 🏆"},
    4.50: {"tag": "Masterpiece", "verdict": "Masterpiece! Pure magic. FDFS recommended! 💎"},
    4.75: {"tag": "Epic", "verdict": "Epic cinema! Watch multiple times in theaters! 👑"},
    5.00: {"tag": "Legendary", "verdict": "All-time classic! Unforgettable theatrical experience! 🌟"}
}


class MovieReviewAgentService:
    """Service for running Movie Review agents"""
    
    def __init__(self):
        self.llm_client = None
        self.llm_model = None
        self.llm_provider = None
        self.temp_review_data = None  # Temporary storage for scraped data
        self.rating_verdicts = None  # Rating verdicts mapping from system settings
    
    def _load_rating_verdicts(self):
        """Load rating verdicts from system settings or use defaults"""
        try:
            # Try to get from system settings
            settings = db.system_settings.find_one({"setting_type": "movie_rating_verdicts"})
            if settings and settings.get('verdicts'):
                # Convert string keys to float keys
                self.rating_verdicts = {float(k): v for k, v in settings['verdicts'].items()}
                print("   ✅ Loaded rating verdicts from system settings")
            else:
                # Use default verdicts
                self.rating_verdicts = DEFAULT_RATING_VERDICTS.copy()
                print("   ℹ️  Using default rating verdicts")
        except Exception as e:
            print(f"   ⚠️  Error loading rating verdicts: {e}, using defaults")
            self.rating_verdicts = DEFAULT_RATING_VERDICTS.copy()
    
    def _round_rating(self, rating: float) -> float:
        """Round rating to nearest 0.25"""
        return round(rating * 4) / 4
    
    def _get_verdict_for_rating(self, rating: float) -> Dict[str, str]:
        """
        Get verdict tag and text for a given rating
        
        Returns: {"tag": "Hit", "verdict": "Solid hit! ..."}
        """
        if not self.rating_verdicts:
            self._load_rating_verdicts()
        
        # Round to nearest 0.25
        rounded_rating = self._round_rating(rating)
        
        # Clamp between 0.0 and 5.0
        rounded_rating = max(0.0, min(5.0, rounded_rating))
        
        # Get verdict from mapping
        verdict_data = self.rating_verdicts.get(rounded_rating, {
            "tag": "Not Rated",
            "verdict": "Rating not available."
        })
        
        return verdict_data
    
    def _initialize_llm(self):
        """Initialize LLM client based on system settings"""
        ai_config = crud.get_ai_api_keys(db)
        if not ai_config:
            raise ValueError("AI API keys not configured. Please add them in System Settings > API Keys.")
        
        self.llm_model = ai_config.get('default_text_model') or 'gpt-4o'
        model_lower = self.llm_model.lower()
        
        if 'gemini' in model_lower:
            self.llm_provider = 'gemini'
            if not ai_config.get('gemini_api_key'):
                raise ValueError("Gemini API key not configured.")
            import google.generativeai as genai
            genai.configure(api_key=ai_config['gemini_api_key'])
            self.llm_client = genai.GenerativeModel(self.llm_model)
            
        elif 'claude' in model_lower or 'sonnet' in model_lower or 'opus' in model_lower:
            self.llm_provider = 'anthropic'
            if not ai_config.get('anthropic_api_key'):
                raise ValueError("Anthropic API key not configured.")
            import anthropic
            self.llm_client = anthropic.Anthropic(api_key=ai_config['anthropic_api_key'])
            
        else:
            self.llm_provider = 'openai'
            if not ai_config.get('openai_api_key'):
                raise ValueError("OpenAI API key not configured.")
            from openai import OpenAI
            self.llm_client = OpenAI(api_key=ai_config['openai_api_key'])
        
        print(f"   🤖 Initialized {self.llm_provider} with model: {self.llm_model}")
    
    def _llm_complete(self, system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> str:
        """Universal LLM completion with timeout handling"""
        import signal
        
        def timeout_handler(signum, frame):
            raise TimeoutError("LLM call timed out")
        
        try:
            # Set a 225 second timeout for LLM calls (5x increased)
            old_handler = signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(225)
            
            try:
                if self.llm_provider == 'openai':
                    response = self.llm_client.chat.completions.create(
                        model=self.llm_model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        max_completion_tokens=max_tokens,
                        timeout=200
                    )
                    result = response.choices[0].message.content.strip()
                    
                elif self.llm_provider == 'gemini':
                    full_prompt = f"{system_prompt}\n\n{user_prompt}"
                    response = self.llm_client.generate_content(full_prompt)
                    result = response.text.strip()
                    
                elif self.llm_provider == 'anthropic':
                    response = self.llm_client.messages.create(
                        model=self.llm_model,
                        max_tokens=max_tokens,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_prompt}]
                    )
                    result = response.content[0].text.strip()
                else:
                    result = ""
                    
                signal.alarm(0)
                return result
                
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)
                
        except TimeoutError:
            print(f"   ⚠️ LLM call timed out, using raw content")
            return ""
        except Exception as e:
            print(f"   ❌ LLM Error: {str(e)}")
            return ""
    
    async def run_movie_review_agent(self, agent_id: str) -> Dict:
        """
        Run the Movie Review agent - supports both listing pages and direct URLs
        
        For Listing Pages: Scrapes review links, checks if movie exists in DB, creates only new reviews
        For Direct URLs: Scrapes single review and creates article
        
        Step 1: Determine URL type and get review URLs
        Step 2: For each URL, check if movie review exists in DB for that language
        Step 3: Scrape and create only non-existing reviews
        """
        from services.movie_review_scraper_service import movie_review_scraper
        
        print(f"\n🎬 Starting Movie Review Agent: {agent_id}")
        
        # Get agent configuration
        agent = db.ai_agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise ValueError(f"Agent not found: {agent_id}")
        
        # Extract agent settings
        reference_urls_raw = agent.get('reference_urls', [])
        
        # Parse reference URLs with url_type support
        reference_urls = []
        if isinstance(reference_urls_raw, str):
            reference_urls.append({'url': reference_urls_raw.strip(), 'url_type': 'auto'})
        elif isinstance(reference_urls_raw, list):
            for item in reference_urls_raw:
                if isinstance(item, str):
                    reference_urls.append({'url': item.strip(), 'url_type': 'auto'})
                elif isinstance(item, dict) and 'url' in item:
                    reference_urls.append({
                        'url': item['url'].strip(),
                        'url_type': item.get('url_type', 'auto')
                    })
        
        content_workflow = agent.get('content_workflow', 'in_review')
        article_language = agent.get('review_language', agent.get('article_language', 'Telugu'))
        rating_strategy = agent.get('review_rating_strategy', 'lowest')
        
        print(f"   📋 Settings: URLs={len(reference_urls)}, Language={article_language}, Rating Strategy={rating_strategy}")
        
        # Update agent last run time
        db.ai_agents.update_one(
            {"id": agent_id},
            {"$set": {"last_run": datetime.now(timezone.utc)}}
        )
        
        results = {
            "agent_id": agent_id,
            "agent_name": agent.get('agent_name', 'Unknown'),
            "status": "success",
            "reviews_scraped": 0,
            "reviews_created": 0,
            "reviews_skipped": 0,
            "errors": [],
            "created_reviews": [],
            "skipped_reviews": []
        }
        
        if not reference_urls:
            results["status"] = "failed"
            results["errors"].append("No review URLs provided")
            return results
        
        try:
            # Process each reference URL
            for ref_url_obj in reference_urls:
                ref_url = ref_url_obj['url']
                url_type = ref_url_obj['url_type']
                
                print(f"\n   🔗 Processing URL: {ref_url} (Type: {url_type})")
                
                # Determine if this is a listing page or direct article
                is_listing = await self._is_listing_page(ref_url, url_type)
                
                if is_listing:
                    # LISTING PAGE: Get all review URLs from the list
                    print(f"   📋 Detected as Listing Page - fetching review links...")
                    review_urls = await self._extract_review_links_from_listing(ref_url)
                    print(f"   ✅ Found {len(review_urls)} review links")
                else:
                    # DIRECT ARTICLE: Single URL
                    print(f"   📄 Detected as Direct Article")
                    review_urls = [ref_url]
                
                # Process each review URL
                for review_url in review_urls:
                    try:
                        await self._process_single_review(
                            review_url=review_url,
                            article_language=article_language,
                            content_workflow=content_workflow,
                            rating_strategy=rating_strategy,
                            results=results
                        )
                    except Exception as e:
                        error_msg = f"Error processing {review_url}: {str(e)}"
                        print(f"   ❌ {error_msg}")
                        results["errors"].append(error_msg)
            
        except Exception as e:
            results["status"] = "failed"
            error_msg = f"Agent execution error: {str(e)}"
            print(f"   ❌ {error_msg}")
            results["errors"].append(error_msg)
        
        print(f"\n   📊 Final Results: {results['reviews_created']} created, {results['reviews_skipped']} skipped")
        return results
            results["errors"].append(str(e))
            print(f"\n   ❌ Agent failed: {str(e)}")
            import traceback
            traceback.print_exc()
        
        return results
    
    def _rewrite_from_temp(self, language: str) -> Dict:
        """Rewrite review sections from temp storage using LLM, with fallback to raw content"""
        
        if not self.temp_review_data:
            return {}
        
        movie_name = self.temp_review_data['movie_name']
        
        system_prompt = f"""You are an expert movie critic writing reviews for an Indian entertainment news website.
Rewrite the given content in a professional, engaging tone.
- Keep it concise but informative
- Do not copy verbatim - rewrite in your own words
- Output should be in English
- Do not add any headers or labels"""
        
        rewritten = {}
        
        # Try to rewrite each section, but use raw content if LLM fails
        sections_to_rewrite = [
            ('story_plot', 'story/plot', f'Rewrite this plot summary for "{movie_name}" in 2-3 paragraphs:\n\n'),
            ('performances', 'performances', f'Rewrite this performances section for "{movie_name}" in 2-3 paragraphs:\n\n'),
            ('what_works', 'highlights', f'Rewrite these highlights/positives for "{movie_name}" as 4-6 bullet points starting with •:\n\n'),
            ('what_doesnt_work', 'drawbacks', f'Rewrite these drawbacks/negatives for "{movie_name}" as 3-5 bullet points starting with •:\n\n'),
            ('technical_aspects', 'technical aspects', f'Rewrite this technical aspects section for "{movie_name}" in 1-2 paragraphs:\n\n'),
            ('final_verdict', 'verdict', f'Rewrite this verdict for "{movie_name}" in 2-3 paragraphs:\n\n'),
        ]
        
        for field, label, prompt_prefix in sections_to_rewrite:
            raw_content = self.temp_review_data.get(field, '')
            if raw_content:
                print(f"      - Processing {label}...")
                try:
                    result = self._llm_complete(system_prompt, prompt_prefix + raw_content)
                    rewritten[field] = result if result else raw_content
                except Exception as e:
                    print(f"      ⚠️ LLM failed for {label}, using raw content: {str(e)[:50]}")
                    rewritten[field] = raw_content
            else:
                rewritten[field] = ''
        
        # Quick verdict - just copy as-is
        rewritten['quick_verdict'] = self.temp_review_data.get('quick_verdict', '')
        
        return rewritten
    
    def _format_release_date(self, date_str: str) -> str:
        """Convert date string to YYYY-MM-DD format for HTML date input"""
        if not date_str:
            return ''
        
        # Try various date formats
        date_formats = [
            '%b %d, %Y',    # Jan 09, 2026
            '%B %d, %Y',    # January 09, 2026
            '%d %b %Y',     # 09 Jan 2026
            '%d %B %Y',     # 09 January 2026
            '%Y-%m-%d',     # 2026-01-09 (already correct format)
            '%d-%m-%Y',     # 09-01-2026
            '%m/%d/%Y',     # 01/09/2026
        ]
        
        for fmt in date_formats:
            try:
                parsed = datetime.strptime(date_str.strip(), fmt)
                return parsed.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        # Return as-is if no format matches
        return date_str
    
    def _format_as_list(self, text: str) -> str:
        """Convert bullet point text to proper HTML unordered list"""
        if not text:
            return ''
        
        # Check if text contains bullet points
        if '•' in text:
            # Split by bullet points and filter empty items
            items = [item.strip() for item in text.split('•') if item.strip()]
            if items:
                list_items = ''.join([f'<li>{item}</li>' for item in items])
                return f'<ul>{list_items}</ul>'
        
        # If no bullet points, check for newlines that might indicate list items
        if '\n' in text:
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            if len(lines) > 1:
                # Check if lines start with common list markers
                list_items = []
                for line in lines:
                    # Remove common list markers at the start
                    clean_line = line.lstrip('-•*').strip()
                    if clean_line:
                        list_items.append(f'<li>{clean_line}</li>')
                if list_items:
                    return f'<ul>{"".join(list_items)}</ul>'
        
        # Return as paragraph if not a list
        return f'<p>{text}</p>'
    
    def _create_article_data(self, content_workflow: str, article_language: str, rewritten_sections: Dict) -> Dict:
        """Create article data from temp storage and rewritten sections"""
        
        if not self.temp_review_data:
            raise ValueError("No temp review data available")
        
        movie_name = self.temp_review_data['movie_name']
        rating = self.temp_review_data['normalized_rating']
        
        # Map workflow to status
        status_map = {
            'in_review': 'draft',
            'ready_to_publish': 'draft',
            'publish': 'approved'
        }
        status = status_map.get(content_workflow, 'draft')
        is_published = content_workflow == 'publish'
        
        # Create title and slug (ID will be generated by crud.create_article)
        title = f"{movie_name} Movie Review"
        slug = re.sub(r'[^a-z0-9]+', '-', movie_name.lower()).strip('-')
        slug = f"{slug}-movie-review-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Build HTML content from rewritten sections
        content_parts = []
        if rewritten_sections.get('story_plot'):
            content_parts.append(f"<h2>Story</h2>\n<p>{rewritten_sections['story_plot']}</p>")
        if rewritten_sections.get('performances'):
            content_parts.append(f"<h2>Performances</h2>\n<p>{rewritten_sections['performances']}</p>")
        if rewritten_sections.get('what_works'):
            works_text = rewritten_sections['what_works']
            if '•' in works_text:
                works_html = '<ul>' + ''.join([f'<li>{item.strip()}</li>' for item in works_text.split('•') if item.strip()]) + '</ul>'
            else:
                works_html = f"<p>{works_text}</p>"
            content_parts.append(f"<h2>What Works</h2>\n{works_html}")
        if rewritten_sections.get('what_doesnt_work'):
            doesnt_text = rewritten_sections['what_doesnt_work']
            if '•' in doesnt_text:
                doesnt_html = '<ul>' + ''.join([f'<li>{item.strip()}</li>' for item in doesnt_text.split('•') if item.strip()]) + '</ul>'
            else:
                doesnt_html = f"<p>{doesnt_text}</p>"
            content_parts.append(f"<h2>What Doesn't Work</h2>\n{doesnt_html}")
        if rewritten_sections.get('technical_aspects'):
            content_parts.append(f"<h2>Technical Aspects</h2>\n<p>{rewritten_sections['technical_aspects']}</p>")
        if rewritten_sections.get('final_verdict'):
            content_parts.append(f"<h2>Verdict</h2>\n<p>{rewritten_sections['final_verdict']}</p>")
        
        content = '\n\n'.join(content_parts)
        
        # Meta description
        quick_verdict = rewritten_sections.get('quick_verdict', '')
        meta_description = f"{movie_name} movie review and rating. {quick_verdict} Rating: {rating:.1f}/5"
        
        # Parse genre into array format then stringify
        genre_raw = self.temp_review_data.get('genre', '')
        if genre_raw:
            genre_list = [g.strip() for g in genre_raw.split(',') if g.strip()]
        else:
            genre_list = []
        
        # Map language to content_language code
        language_to_code = {
            'Telugu': 'te',
            'Tamil': 'ta',
            'Kannada': 'kn',
            'Malayalam': 'ml',
            'Hindi': 'hi',
            'Marathi': 'mr',
            'Bengali': 'bn',
            'English': 'en'
        }
        content_language_code = language_to_code.get(article_language, 'en')
        
        # Map language to state for state-language mapping
        language_to_state = {
            'Telugu': ['ap', 'ts'],
            'Tamil': ['tn'],
            'Kannada': ['ka'],
            'Malayalam': ['kl'],
            'Hindi': ['mh', 'dl', 'up'],
            'Marathi': ['mh'],
            'Bengali': ['wb'],
        }
        states = language_to_state.get(article_language, [])
        
        article_data = {
            'title': title,
            'slug': slug,
            'content': content,
            'content_type': 'movie_review',
            'category_slug': 'movie-reviews',
            'category': 'movie-reviews',
            'status': status,
            'is_published': is_published,
            'article_language': 'en',  # Use 'en' for CMS filtering
            'content_language': content_language_code,  # Actual language code (te, ta, hi, etc.)
            'summary': '',  # Required field
            'youtube_url': '',  # Required field for movie review form
            
            # Movie review specific fields - review sections with HTML
            'review_quick_verdict': rewritten_sections.get('quick_verdict', ''),
            'review_plot_summary': f"<p>{rewritten_sections.get('story_plot', '')}</p>",
            'review_performances': f"<p>{rewritten_sections.get('performances', '')}</p>",
            'review_what_works': self._format_as_list(rewritten_sections.get('what_works', '')),
            'review_what_doesnt_work': self._format_as_list(rewritten_sections.get('what_doesnt_work', '')),
            'review_technical_aspects': f"<p>{rewritten_sections.get('technical_aspects', '')}</p>",
            'review_final_verdict': f"<p>{rewritten_sections.get('final_verdict', '')}</p>",
            
            # Movie details - matching existing schema
            'review_cast': self.temp_review_data.get('cast', '') or '',
            'review_director': self.temp_review_data.get('director', '') or '',
            'review_producer': self.temp_review_data.get('producer', '') or '',
            'review_music_director': self.temp_review_data.get('music_director', '') or '',
            'review_dop': self.temp_review_data.get('dop', '') or '',
            'review_editor': self.temp_review_data.get('editor', '') or '',
            'review_banner': self.temp_review_data.get('banner', '') or '',
            'review_genre': json.dumps(genre_list),  # JSON string like '["Action","Romance"]'
            'review_runtime': self.temp_review_data.get('runtime', '') or '',
            'release_date': self._format_release_date(self.temp_review_data.get('release_date', '')),
            
            # Movie metadata - JSON strings to match schema
            'movie_language': json.dumps([article_language]),  # JSON string like '["Telugu"]'
            'movie_rating': f"{rating:.2f}",  # String format with 2 decimals like '2.00'
            'platform': 'Theater',
            'states': json.dumps(states),  # JSON string like '["ap", "ts"]'
            
            # Images
            'image': self.temp_review_data.get('poster_image', ''),
            
            # SEO
            'seo_description': meta_description[:160],
            'seo_title': f"{movie_name} Review - Rating {rating:.1f}/5",
            
            # Timestamps
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'published_at': datetime.now(timezone.utc) if is_published else None,
            
            # Required fields for CMS - as JSON strings
            'is_scheduled': False,
            'is_sponsored': False,
            'is_featured': False,
            'is_top_story': False,
            'artists': '[]',
            'faqs': '[]',
            'ott_platforms': '[]',
            'view_count': 0,
            'comments_enabled': True,
            'review_comments_enabled': True,  # Enable user reviews section
            
            # Author
            'author': 'AI Review Agent'
        }
        
        return article_data
    
    async def _is_listing_page(self, url: str, url_type: str) -> bool:
        """
        Determine if URL is a listing page or direct article
        
        url_type: 'auto', 'listing', 'direct_article'
        """
        if url_type == 'listing':
            return True
        elif url_type == 'direct_article':
            return False
        
        # Auto detection - check if URL pattern suggests listing page
        url_lower = url.lower()
        
        # Common listing page patterns
        listing_patterns = [
            '/reviews',  # https://www.greatandhra.com/reviews
            '/category/moviereviews',  # https://www.gulte.com/category/moviereviews
            '/moviereviews',
            '/reviews/',
            '/category/reviews',
            '/movie-reviews',
        ]
        
        for pattern in listing_patterns:
            if pattern in url_lower:
                return True
        
        return False
    
    async def _extract_review_links_from_listing(self, listing_url: str, max_links: int = 10) -> list:
        """
        Extract individual review article URLs from a listing page
        
        Returns list of review URLs found on the page
        """
        import httpx
        from bs4 import BeautifulSoup
        
        print(f"      🔍 Scraping listing page: {listing_url}")
        
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                response = await client.get(listing_url)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.content, 'html.parser')
                review_links = []
                
                # Extract all article links from the page
                # Different sites have different HTML structures
                
                # Pattern 1: GreatAndhra - find links within review listings
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '')
                    
                    # Check if link is likely a review article
                    if any(pattern in href.lower() for pattern in ['/reviews/', '/moviereviews/', 'review']):
                        # Make absolute URL
                        if href.startswith('http'):
                            full_url = href
                        elif href.startswith('/'):
                            from urllib.parse import urlparse
                            parsed = urlparse(listing_url)
                            full_url = f"{parsed.scheme}://{parsed.netloc}{href}"
                        else:
                            continue
                        
                        # Avoid duplicates and pagination links
                        if full_url not in review_links and 'page' not in full_url.lower() and 'category' not in full_url.lower():
                            review_links.append(full_url)
                            
                            if len(review_links) >= max_links:
                                break
                
                print(f"      ✅ Found {len(review_links)} review links")
                return review_links[:max_links]
                
        except Exception as e:
            print(f"      ❌ Error extracting links from listing page: {str(e)}")
            return []
    
    async def _process_single_review(self, review_url: str, article_language: str, content_workflow: str, rating_strategy: str, results: dict):
        """
        Process a single review URL - check if exists, scrape, and create if needed
        
        Args:
            review_url: URL of the review to process
            article_language: Target language for the review
            content_workflow: 'in_review' or 'published'
            rating_strategy: 'lowest', 'highest', 'average'
            results: Results dict to update
        """
        from services.movie_review_scraper_service import movie_review_scraper
        
        try:
            # Step 1: Scrape the review to get movie name
            print(f"      📥 Scraping: {review_url}")
            scraped_data = await movie_review_scraper.scrape_review(review_url)
            movie_name = scraped_data.movie_name
            
            results["reviews_scraped"] += 1
            
            # Step 2: Check if review already exists for this movie and language
            content_language_code = self._get_language_code(article_language)
            existing_review = db.articles.find_one({
                "content_type": "movie_review",
                "title": {"$regex": f"^{re.escape(movie_name)}", "$options": "i"},
                "content_language": content_language_code
            })
            
            if existing_review:
                print(f"      ⏭️  SKIPPED: Review already exists for '{movie_name}' ({article_language})")
                results["reviews_skipped"] += 1
                results["skipped_reviews"].append({
                    "movie_name": movie_name,
                    "language": article_language,
                    "reason": "Already exists in database"
                })
                return
            
            # Step 3: Review doesn't exist - create it
            print(f"      ✅ NEW MOVIE: '{movie_name}' - Creating review...")
            
            # Generate quick verdict based on rating
            verdict_data = self._get_verdict_for_rating(scraped_data.normalized_rating)
            auto_generated_verdict = f"{verdict_data['tag']} - {verdict_data['verdict']}"
            
            print(f"      🎯 Auto-generated verdict: {auto_generated_verdict}")
            
            # Store in temporary space
            self.temp_review_data = {
                'movie_name': movie_name,
                'rating': scraped_data.rating,
                'rating_scale': scraped_data.rating_scale,
                'normalized_rating': scraped_data.normalized_rating,
                'cast': scraped_data.cast,
                'director': scraped_data.director,
                'producer': scraped_data.producer,
                'music_director': scraped_data.music_director,
                'dop': scraped_data.dop,
                'editor': scraped_data.editor,
                'genre': scraped_data.genre,
                'runtime': scraped_data.runtime,
                'release_date': scraped_data.release_date,
                'banner': scraped_data.banner,
                'poster_image': scraped_data.poster_image,
                'story_plot': scraped_data.story_plot,
                'performances': scraped_data.performances,
                'what_works': scraped_data.what_works,
                'what_doesnt_work': scraped_data.what_doesnt_work,
                'technical_aspects': scraped_data.technical_aspects,
                'final_verdict': scraped_data.final_verdict,
                'quick_verdict': auto_generated_verdict,  # Use auto-generated verdict
                'source_url': review_url,
                'source_name': scraped_data.source_name
            }
            
            # Initialize LLM if not already done
            if not self.llm_client:
                self._initialize_llm()
            
            # Rewrite sections
            print(f"      ✍️  Rewriting with LLM...")
            rewritten_sections = self._rewrite_from_temp(article_language)
            
            # Create article
            print(f"      📝 Creating article...")
            article_data = self._create_article_data(
                content_workflow=content_workflow,
                article_language=article_language,
                rewritten_sections=rewritten_sections
            )
            
            # Save to database
            created_article = crud.create_article(db, article_data)
            
            if created_article:
                results["reviews_created"] += 1
                results["created_reviews"].append({
                    "id": created_article.get('id'),
                    "title": created_article.get('title'),
                    "movie_name": movie_name,
                    "rating": self.temp_review_data['normalized_rating']
                })
                print(f"      ✅ CREATED: {movie_name} ({self.temp_review_data['normalized_rating']:.1f}/5)")
            
            # Clear temp data
            self.temp_review_data = None
            
        except Exception as e:
            error_msg = f"Error processing {review_url}: {str(e)}"
            print(f"      ❌ {error_msg}")
            results["errors"].append(error_msg)
    
    def _get_language_code(self, language_name: str) -> str:
        """Convert language name to ISO code"""
        language_map = {
            'Telugu': 'te',
            'Tamil': 'ta',
            'Hindi': 'hi',
            'Kannada': 'kn',
            'Malayalam': 'ml',
            'Bengali': 'bn',
            'Marathi': 'mr',
            'Punjabi': 'pa',
            'Gujarati': 'gu',
            'English': 'en'
        }
        return language_map.get(language_name, 'en')


# Singleton instance
movie_review_agent_service = MovieReviewAgentService()
