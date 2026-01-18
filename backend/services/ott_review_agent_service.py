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


class OTTReviewAgentService:
    """Service for creating OTT review articles"""
    
    def __init__(self):
        self.temp_review_data = {}
    
    def _get_language_code(self, language_name: str) -> str:
        """Convert language name to ISO code"""
        lang_map = {
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
        }
        return lang_map.get(language_name, 'en')
    
    def _get_states_for_language(self, language: str) -> List[str]:
        """Get state codes for a language"""
        state_map = {
            'Telugu': ['ap', 'ts'],
            'Tamil': ['tn'],
            'Hindi': ['up', 'mp', 'rj', 'br', 'hr', 'jh', 'uk', 'cg', 'dl'],
            'Kannada': ['ka'],
            'Malayalam': ['kl'],
            'Bengali': ['wb'],
            'Marathi': ['mh'],
            'Punjabi': ['pb'],
            'Gujarati': ['gj'],
            'Odia': ['od'],
        }
        return state_map.get(language, [])
    
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
            
            print(f"   📋 Settings: Language={article_language}, Max Reviews={max_reviews}")
            
            # Import scrapers
            from services.ott_review_scraper_service import ott_review_scraper
            from services.binged_scraper_service import binged_scraper
            
            # Get OTT releases data for matching (from binged streaming-now)
            print(f"\n   📥 Fetching OTT releases data for matching...")
            ott_releases = await binged_scraper.scrape_releases(language=article_language, mode='streaming-now')
            print(f"   ✅ Found {len(ott_releases)} OTT releases for matching")
            
            # Build lookup dict by title
            ott_lookup = {}
            for release in ott_releases:
                title = release.get('title', '').lower().strip()
                if title:
                    ott_lookup[title] = release
            
            # Process each reference URL
            for ref_url in reference_urls:
                if isinstance(ref_url, dict):
                    ref_url = ref_url.get('url', '')
                
                if not ref_url:
                    continue
                
                print(f"\n   🔗 Processing URL: {ref_url}")
                
                # Check if this is a listing page or direct review
                if '/category/reviews' in ref_url or ref_url.endswith('/reviews/'):
                    # Listing page - get review links
                    fetch_count = max(max_reviews * 3, 10)
                    print(f"   📋 Listing page - fetching up to {fetch_count} review links...")
                    review_urls = await ott_review_scraper.get_review_links(max_links=fetch_count)
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
    
    async def _process_single_review(self, review_url: str, article_language: str, 
                                      content_workflow: str, ott_lookup: Dict,
                                      results: dict, db):
        """Process a single OTT review"""
        from services.ott_review_scraper_service import ott_review_scraper
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
            
            # Check for duplicates
            content_language_code = self._get_language_code(article_language)
            existing = db.articles.find_one({
                "content_type": "ott_review",
                "title": {"$regex": f"^{re.escape(title)[:30]}", "$options": "i"},
                "content_language": content_language_code
            })
            
            if existing:
                print(f"      ⏭️  SKIPPED: Review already exists for '{title}'")
                results["reviews_skipped"] += 1
                results["skipped_reviews"].append({
                    "title": title,
                    "reason": "Already exists"
                })
                return
            
            # Try to match with OTT releases data
            title_lower = title.lower().strip()
            ott_info = ott_lookup.get(title_lower, {})
            
            if ott_info:
                print(f"      ✅ Matched with OTT release: {ott_info.get('title')}")
                review_data.cast = ott_info.get('cast', '')
                review_data.director = ott_info.get('director', '')
                review_data.platform = ott_info.get('platform', '')
                review_data.language = ott_info.get('language', article_language)
                review_data.runtime = str(ott_info.get('runtime', ''))
                review_data.genre = ott_info.get('genre', '')
                review_data.youtube_url = ott_info.get('youtube_url', '')
                if not review_data.poster_image:
                    review_data.poster_image = ott_info.get('poster', '')
            else:
                print(f"      ⚠️  No OTT release match found for '{title}'")
            
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
            poster_image = ''  # Don't use poster without YouTube
        else:
            # Generate thumbnail from YouTube
            youtube_match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)', youtube_url)
            if youtube_match:
                video_id = youtube_match.group(1)
                poster_image = f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'
            else:
                poster_image = review_data.poster_image or ''
        
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
        
        # Build content
        content_parts = []
        if review_data.review_content:
            content_parts.append(f"<p>{review_data.review_content}</p>")
        if review_data.verdict:
            content_parts.append(f"<h2>Verdict</h2>\n<p>{review_data.verdict}</p>")
        
        content = '\n\n'.join(content_parts)
        
        # Normalize rating to 5-point scale
        if review_data.rating_scale and review_data.rating_scale != 5:
            normalized_rating = (review_data.rating / review_data.rating_scale) * 5
        else:
            normalized_rating = review_data.rating
        
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
            'article_language': 'en',
            'content_language': content_language_code,
            'summary': '',
            'youtube_url': youtube_url,
            
            # Action Needed tracking
            'action_needed': action_needed,
            'action_needed_reasons': action_needed_reasons,
            
            # Review fields
            'review_final_verdict': f"<p>{review_data.verdict}</p>",
            'movie_rating': f"{normalized_rating:.2f}",
            
            # OTT info
            'review_cast': review_data.cast,
            'review_director': review_data.director,
            'platform': review_data.platform,
            'movie_language': json.dumps([article_language]),
            'review_genre': json.dumps([review_data.genre]) if review_data.genre else '[]',
            'review_runtime': review_data.runtime,
            'states': json.dumps(states),
            
            # Images
            'image': poster_image,
            
            # SEO
            'seo_description': f"{review_data.title} OTT review. Rating: {normalized_rating:.1f}/5",
            'seo_title': f"{review_data.title} Review - {review_data.platform or 'OTT'}",
            
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
