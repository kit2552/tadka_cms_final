"""
OTT Review Agent Service
Creates OTT movie and web series review articles from binged.com
Combines review content with OTT releases data for complete information
"""
import re
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
import os
import asyncio


class OTTReviewAgentService:
    """Service for creating OTT review articles"""
    
    # Language name to ISO code mapping
    LANGUAGE_MAP = {
        'Telugu': 'te',
        'Tamil': 'ta',
        'Hindi': 'hi',
        'Kannada': 'kn',
        'Malayalam': 'ml',
        'Bengali': 'bn',
        'Marathi': 'mr',
        'Punjabi': 'pa',
        'Gujarati': 'gu',
        'Odia': 'or',
        'English': 'en',
        'Korean': 'ko',
        'Japanese': 'ja',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
    }
    
    # State codes for each language
    STATE_MAP = {
        'Telugu': ['ap', 'ts'],
        'Tamil': ['tn'],
        'Hindi': ['up', 'mp', 'rj', 'br', 'hr', 'jh', 'uk', 'cg', 'dl', 'mh'],
        'Kannada': ['ka'],
        'Malayalam': ['kl'],
        'Bengali': ['wb'],
        'Marathi': ['mh'],
        'Punjabi': ['pb'],
        'Gujarati': ['gj'],
        'Odia': ['od'],
        'English': [],  # English is shown in Bollywood tab (with Hindi)
    }
    
    def __init__(self):
        self.temp_review_data = {}
    
    def _get_language_code(self, language_name: str) -> str:
        """Convert language name to ISO code"""
        return self.LANGUAGE_MAP.get(language_name, 'en')
    
    def _get_states_for_language(self, language: str) -> List[str]:
        """Get state codes for a language"""
        return self.STATE_MAP.get(language, [])
    
    def _normalize_title_for_matching(self, title: str) -> str:
        """Normalize title for comparison/matching"""
        if not title:
            return ''
        # Remove review suffix, year, special chars
        normalized = title.lower().strip()
        normalized = re.sub(r'\s*review\s*$', '', normalized, flags=re.I)
        normalized = re.sub(r'\s*\(\d{4}\)\s*$', '', normalized)
        normalized = re.sub(r'\s*-\s*$', '', normalized)
        normalized = re.sub(r'[^\w\s]', '', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized
    
    async def _get_quick_verdict(self, rating: float, bottom_line: str, db) -> str:
        """
        Get quick verdict tagline based on OTT rating mapping from system settings
        Falls back to bottom_line from review if no mapping found
        """
        # Try to get OTT rating mapping from system settings
        try:
            settings = db.system_settings.find_one({"setting_type": "ott_rating_mapping"})
            if settings and settings.get('mappings'):
                mappings = settings['mappings']
                # Find the matching rating range
                for mapping in mappings:
                    min_rating = float(mapping.get('min_rating', 0))
                    max_rating = float(mapping.get('max_rating', 5))
                    if min_rating <= rating <= max_rating:
                        return mapping.get('verdict', '')
        except Exception as e:
            print(f"   ⚠️ Error fetching OTT rating mapping: {str(e)}")
        
        # Fallback to bottom_line from review
        if bottom_line:
            return bottom_line
        
        # Default verdicts based on rating
        if rating >= 4.0:
            return "Must Watch!"
        elif rating >= 3.5:
            return "Worth Your Time"
        elif rating >= 3.0:
            return "One-Time Watch"
        elif rating >= 2.5:
            return "Passable"
        elif rating >= 2.0:
            return "Below Average"
        else:
            return "Skip It"
    
    async def run(self, agent: dict, db) -> Dict:
        """
        Run the OTT Review agent
        
        Args:
            agent: Agent configuration dict
            db: Database connection
            
        Returns:
            Results dict with counts and created reviews
        """
        print(f"\n🎬 Starting OTT Review Agent...")
        
        results = {
            "status": "success",
            "reviews_scraped": 0,
            "reviews_created": 0,
            "reviews_skipped": 0,
            "skipped_reviews": [],
            "created_reviews": [],
            "errors": []
        }
        
        try:
            # Get agent settings
            reference_urls = agent.get('reference_urls', [])
            if isinstance(reference_urls, str):
                reference_urls = [reference_urls]
            
            content_workflow = agent.get('content_workflow', 'in_review')
            article_language = agent.get('review_language', 'Telugu')
            max_reviews = agent.get('max_reviews_from_listing', 5)
            
            print(f"   📋 Settings: Language={article_language}, Workflow={content_workflow}, Max Reviews={max_reviews}")
            
            # Import scrapers
            from services.ott_review_scraper_service import ott_review_scraper
            from services.binged_scraper_service import binged_scraper
            
            # Fetch OTT releases data for matching (streaming-now for the target language)
            print(f"\n   📥 Fetching OTT releases data for {article_language} to match reviews...")
            ott_releases = await binged_scraper.fetch_ott_releases(
                language=article_language,
                streaming_now=True,
                streaming_soon=True,
                limit=50  # Fetch more to increase matching chances
            )
            print(f"   ✅ Found {len(ott_releases)} OTT releases for matching")
            
            # Build lookup dict by normalized title
            ott_lookup = {}
            for release in ott_releases:
                title = release.get('movie_name', '') or release.get('title', '')
                if title:
                    normalized = self._normalize_title_for_matching(title)
                    ott_lookup[normalized] = release
                    # Also add without common suffixes
                    alt_normalized = re.sub(r'\s*(season\s*\d+|s\d+)$', '', normalized, flags=re.I).strip()
                    if alt_normalized != normalized:
                        ott_lookup[alt_normalized] = release
            
            print(f"   📚 Built lookup with {len(ott_lookup)} titles")
            
            # If no reference URLs provided, use the default reviews listing page
            if not reference_urls:
                reference_urls = [{'url': 'https://www.binged.com/category/reviews/', 'url_type': 'listing'}]
            
            # Process each reference URL
            for ref_url_obj in reference_urls:
                if isinstance(ref_url_obj, dict):
                    ref_url = ref_url_obj.get('url', '')
                else:
                    ref_url = ref_url_obj
                
                if not ref_url:
                    continue
                
                print(f"\n   🔗 Processing URL: {ref_url}")
                
                # Check if this is a listing page or direct review
                is_listing = '/category/reviews' in ref_url or ref_url.endswith('/reviews/')
                
                if is_listing:
                    # Listing page - get review links
                    fetch_count = max(max_reviews * 3, 15)  # Fetch extra to allow for skips
                    print(f"   📋 Listing page - fetching up to {fetch_count} review links...")
                    review_items = await ott_review_scraper.get_review_links(max_links=fetch_count)
                    review_urls = [item['url'] for item in review_items]
                else:
                    # Direct review URL
                    review_urls = [ref_url]
                
                # Process each review
                for review_url in review_urls:
                    if results["reviews_created"] >= max_reviews:
                        print(f"   ✅ Reached max reviews limit ({max_reviews}), stopping...")
                        break
                    
                    try:
                        await self._process_single_review(
                            review_url=review_url,
                            article_language=article_language,
                            content_workflow=content_workflow,
                            ott_lookup=ott_lookup,
                            results=results,
                            db=db
                        )
                        # Small delay between reviews to avoid rate limiting
                        await asyncio.sleep(0.5)
                    except Exception as e:
                        error_msg = f"Error processing {review_url}: {str(e)}"
                        print(f"   ❌ {error_msg}")
                        results["errors"].append(error_msg)
            
        except Exception as e:
            results["status"] = "failed"
            error_msg = f"Agent execution error: {str(e)}"
            print(f"   ❌ {error_msg}")
            import traceback
            traceback.print_exc()
            results["errors"].append(error_msg)
        
        print(f"\n   📊 Final Results: {results['reviews_created']} created, {results['reviews_skipped']} skipped")
        return results
    
    async def _process_single_review(self, review_url: str, article_language: str, 
                                      content_workflow: str, ott_lookup: Dict,
                                      results: dict, db):
        """Process a single OTT review"""
        from services.ott_review_scraper_service import ott_review_scraper
        from services.binged_scraper_service import binged_scraper
        import crud
        
        try:
            # Scrape the review
            print(f"      📥 Scraping: {review_url}")
            review_data = await ott_review_scraper.scrape_review(review_url)
            
            if not review_data.title:
                error_msg = f"Could not extract title from {review_url}"
                print(f"      ❌ {error_msg}")
                results["errors"].append(error_msg)
                return
            
            results["reviews_scraped"] += 1
            title = review_data.title
            
            # Check for duplicates in database
            content_language_code = self._get_language_code(article_language)
            
            # Search for existing review with similar title
            existing = db.articles.find_one({
                "content_type": "ott_review",
                "$or": [
                    {"title": {"$regex": f"^{re.escape(title[:30])}", "$options": "i"}},
                    {"title": {"$regex": re.escape(self._normalize_title_for_matching(title)), "$options": "i"}}
                ]
            })
            
            if existing:
                print(f"      ⏭️  SKIPPED: Review already exists for '{title}'")
                results["reviews_skipped"] += 1
                results["skipped_reviews"].append({
                    "title": title,
                    "reason": "Already exists in database"
                })
                return
            
            # Try to match with OTT releases data
            normalized_title = self._normalize_title_for_matching(title)
            ott_info = ott_lookup.get(normalized_title)
            
            # Try partial matching if exact match not found
            if not ott_info:
                for lookup_title, info in ott_lookup.items():
                    if normalized_title in lookup_title or lookup_title in normalized_title:
                        ott_info = info
                        break
            
            if ott_info:
                print(f"      ✅ Matched with OTT release: {ott_info.get('movie_name', ott_info.get('title', 'Unknown'))}")
                
                # Populate review data from OTT release info
                cast_list = ott_info.get('cast', [])
                review_data.cast = ', '.join(cast_list) if isinstance(cast_list, list) else str(cast_list)
                review_data.director = ott_info.get('director', '')
                
                platforms = ott_info.get('ott_platforms', [])
                review_data.platforms = platforms if isinstance(platforms, list) else [platforms] if platforms else []
                
                languages = ott_info.get('languages', [])
                review_data.languages = languages if isinstance(languages, list) else [languages] if languages else [article_language]
                
                # Set original language (first in the list is typically original)
                if review_data.languages:
                    review_data.original_language = review_data.languages[0]
                
                runtime = ott_info.get('runtime')
                review_data.runtime = f"{runtime} min" if runtime else ''
                
                genres = ott_info.get('genres', [])
                review_data.genre = ', '.join(genres) if isinstance(genres, list) else str(genres)
                
                review_data.youtube_url = ott_info.get('youtube_url', '')
                review_data.synopsis = ott_info.get('synopsis', '')
                
                if not review_data.poster_image:
                    review_data.poster_image = ott_info.get('poster_url', '')
            else:
                print(f"      ⚠️  No OTT release match found for '{title}'")
                # Set default language
                review_data.languages = [article_language]
                review_data.original_language = article_language
            
            # If we have a binged detail URL but no OTT info, try to fetch it
            if not ott_info and review_data.binged_detail_url:
                print(f"      🔍 Fetching details from: {review_data.binged_detail_url}")
                try:
                    detail_info = await binged_scraper.fetch_release_details(review_data.binged_detail_url)
                    if detail_info:
                        cast_list = detail_info.get('cast', [])
                        review_data.cast = ', '.join(cast_list) if isinstance(cast_list, list) else str(cast_list)
                        review_data.director = detail_info.get('director', '')
                        review_data.platforms = detail_info.get('ott_platforms', [])
                        review_data.languages = detail_info.get('languages', [article_language])
                        if review_data.languages:
                            review_data.original_language = review_data.languages[0]
                        runtime = detail_info.get('runtime')
                        review_data.runtime = f"{runtime} min" if runtime else ''
                        genres = detail_info.get('genres', [])
                        review_data.genre = ', '.join(genres) if isinstance(genres, list) else str(genres)
                        review_data.youtube_url = detail_info.get('youtube_url', '')
                        review_data.synopsis = detail_info.get('synopsis', '')
                        print(f"      ✅ Got details from binged page")
                except Exception as e:
                    print(f"      ⚠️ Could not fetch details: {str(e)}")
            
            # Create article
            article = await self._create_article(
                review_data=review_data,
                article_language=article_language,
                content_workflow=content_workflow,
                db=db
            )
            
            if article:
                results["reviews_created"] += 1
                results["created_reviews"].append({
                    "id": article.get('id'),
                    "title": article.get('title'),
                    "action_needed": article.get('action_needed', False)
                })
                print(f"      ✅ Created: {article.get('title')} (ID: {article.get('id')})")
            
        except Exception as e:
            error_msg = f"Error processing review: {str(e)}"
            print(f"      ❌ {error_msg}")
            import traceback
            traceback.print_exc()
            results["errors"].append(error_msg)
    
    async def _create_article(self, review_data, article_language: str, 
                               content_workflow: str, db) -> Optional[Dict]:
        """Create an OTT review article"""
        import crud
        
        content_language_code = self._get_language_code(article_language)
        states = self._get_states_for_language(article_language)
        
        # Check for YouTube URL - if missing, mark as action needed
        youtube_url = review_data.youtube_url or ''
        action_needed = False
        action_needed_reasons = []
        
        if not youtube_url:
            action_needed = True
            action_needed_reasons.append('Missing YouTube trailer')
            main_image_url = review_data.poster_image or ''
        else:
            # Generate thumbnail from YouTube
            youtube_match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]+)', youtube_url)
            if youtube_match:
                video_id = youtube_match.group(1)
                main_image_url = f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'
            else:
                main_image_url = review_data.poster_image or ''
        
        # Determine status and publish state
        if action_needed:
            status = 'approved'
            is_published = False
            print(f"      ⚠️  Action Needed: {', '.join(action_needed_reasons)}")
        else:
            status_map = {
                'in_review': 'draft',
                'ready_to_publish': 'draft',
                'publish': 'approved',
                'auto_post': 'approved'
            }
            status = status_map.get(content_workflow, 'draft')
            is_published = content_workflow in ['publish', 'auto_post']
        
        # Build article data
        title = f"{review_data.title} Review"
        slug = re.sub(r'[^a-z0-9]+', '-', review_data.title.lower()).strip('-')
        slug = f"{slug}-ott-review-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Build content from review sections
        content_parts = []
        
        # Story/Synopsis section
        story_content = review_data.story_synopsis or review_data.synopsis
        if story_content:
            content_parts.append(f"<h2>Story</h2>\n<p>{story_content}</p>")
        
        # Performances section
        if review_data.performances:
            paragraphs = review_data.performances.split('\n\n')
            perf_html = '\n'.join([f"<p>{p}</p>" for p in paragraphs if p.strip()])
            content_parts.append(f"<h2>Performances</h2>\n{perf_html}")
        
        # Analysis section
        if review_data.analysis:
            paragraphs = review_data.analysis.split('\n\n')
            analysis_html = '\n'.join([f"<p>{p}</p>" for p in paragraphs if p.strip()])
            content_parts.append(f"<h2>Analysis</h2>\n{analysis_html}")
        
        # Technical Aspects section
        if review_data.technical_aspects:
            paragraphs = review_data.technical_aspects.split('\n\n')
            tech_html = '\n'.join([f"<p>{p}</p>" for p in paragraphs if p.strip()])
            content_parts.append(f"<h2>Technical Aspects</h2>\n{tech_html}")
        
        # If no structured sections, use the full review content
        if not content_parts and review_data.review_content:
            paragraphs = review_data.review_content.split('\n\n')
            review_html = '\n'.join([f"<p>{p}</p>" for p in paragraphs if p.strip()])
            content_parts.append(f"<h2>Review</h2>\n{review_html}")
        
        # Verdict section
        verdict_content = review_data.verdict
        if verdict_content:
            paragraphs = verdict_content.split('\n\n')
            verdict_html = '\n'.join([f"<p>{p}</p>" for p in paragraphs if p.strip()])
            content_parts.append(f"<h2>Verdict</h2>\n{verdict_html}")
        
        content = '\n\n'.join(content_parts)
        
        # Normalize rating to 5-point scale
        if review_data.rating_scale and review_data.rating_scale != 5 and review_data.rating_scale > 0:
            normalized_rating = (review_data.rating / review_data.rating_scale) * 5
        else:
            normalized_rating = review_data.rating
        
        # Ensure rating is within bounds
        normalized_rating = max(0, min(5, normalized_rating))
        
        # Get quick verdict from OTT rating mapping (similar to movie reviews)
        quick_verdict = await self._get_quick_verdict(normalized_rating, review_data.bottom_line, db)
        
        # Build platform string
        platform_str = ', '.join(review_data.platforms) if review_data.platforms else ''
        
        # Build highlights (what works) as bullet points
        highlights_html = ""
        if review_data.highlights:
            highlights_html = f"<ul>\n"
            for line in review_data.highlights.split('\n'):
                line = line.strip()
                if line:
                    # Remove bullet prefix if present
                    line = re.sub(r'^[•\-\*]\s*', '', line)
                    if line:
                        highlights_html += f"<li>{line}</li>\n"
            highlights_html += "</ul>"
        
        # Build drawbacks (what doesn't work) as bullet points
        drawbacks_html = ""
        if review_data.drawbacks:
            drawbacks_html = f"<ul>\n"
            for line in review_data.drawbacks.split('\n'):
                line = line.strip()
                if line:
                    line = re.sub(r'^[•\-\*]\s*', '', line)
                    if line:
                        drawbacks_html += f"<li>{line}</li>\n"
            drawbacks_html += "</ul>"
        
        article_data = {
            'title': title,
            'slug': slug,
            'content': content,
            'content_type': 'ott_review',
            'ott_content_type': review_data.content_type,  # 'movie' or 'webseries'
            'category_slug': 'ott-reviews',
            'category': 'ott-reviews',
            'status': status,
            'is_published': is_published,
            'article_language': 'en',  # Article written in English
            'content_language': content_language_code,  # Content language for filtering
            'summary': review_data.verdict[:200] if review_data.verdict else '',
            'youtube_url': youtube_url,
            
            # Action Needed tracking
            'action_needed': action_needed,
            'action_needed_reasons': action_needed_reasons,
            
            # Review fields - properly filled from sections
            'review_quick_verdict': quick_verdict,
            'review_plot_summary': f"<p>{story_content}</p>" if story_content else '',
            'review_performances': f"<p>{review_data.performances}</p>" if review_data.performances else '',
            'review_what_works': highlights_html,
            'review_what_doesnt_work': drawbacks_html,
            'review_technical_aspects': f"<p>{review_data.technical_aspects}</p>" if review_data.technical_aspects else '',
            'review_final_verdict': f"<p>{review_data.verdict}</p>" if review_data.verdict else '',
            'movie_rating': f"{normalized_rating:.1f}",
            
            # OTT info
            'review_cast': review_data.cast,
            'review_director': review_data.director,
            'platform': platform_str,
            'ott_platforms': json.dumps(review_data.platforms),
            
            # Language info - critical for state-based filtering
            'movie_language': json.dumps(review_data.languages),
            'original_language': review_data.original_language,
            'languages': json.dumps(review_data.languages),
            
            'review_genre': json.dumps([review_data.genre]) if review_data.genre else '[]',
            'review_runtime': review_data.runtime,
            'states': json.dumps(states),
            
            # Images
            'image': main_image_url,
            'main_image_url': main_image_url,
            
            # SEO
            'seo_description': f"{review_data.title} OTT review. Rating: {normalized_rating:.1f}/5. {platform_str}",
            'seo_title': f"{review_data.title} Review - {platform_str or 'OTT'}",
            
            # Source
            'source_url': review_data.source_url,
            'source_name': review_data.source_name,
            
            # Timestamps
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }
        
        if is_published:
            article_data['published_at'] = datetime.now(timezone.utc)
        
        # Create the article
        created_article = crud.create_article(db, article_data)
        return created_article


# Singleton instance
ott_review_agent_service = OTTReviewAgentService()
