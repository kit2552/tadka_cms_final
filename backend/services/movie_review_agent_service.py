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


class MovieReviewAgentService:
    """Service for running Movie Review agents"""
    
    def __init__(self):
        self.llm_client = None
        self.llm_model = None
        self.llm_provider = None
        self.temp_review_data = None  # Temporary storage for scraped data
    
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
        Run the Movie Review agent - simplified single URL flow
        
        Step 1: Scrape and store in temp space
        Step 2: Run LLM to rewrite from temp data
        Step 3: Create article with movie info copied as-is
        """
        from services.movie_review_scraper_service import movie_review_scraper
        
        print(f"\n🎬 Starting Movie Review Agent: {agent_id}")
        
        # Get agent configuration
        agent = db.ai_agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise ValueError(f"Agent not found: {agent_id}")
        
        # Extract agent settings
        reference_urls_raw = agent.get('reference_urls', [])
        
        # Get single URL (first one)
        review_url = None
        if isinstance(reference_urls_raw, str):
            review_url = reference_urls_raw.strip()
        elif isinstance(reference_urls_raw, list) and len(reference_urls_raw) > 0:
            first_item = reference_urls_raw[0]
            if isinstance(first_item, str):
                review_url = first_item.strip()
            elif isinstance(first_item, dict) and 'url' in first_item:
                review_url = first_item['url'].strip()
        
        content_workflow = agent.get('content_workflow', 'in_review')
        article_language = agent.get('review_language', agent.get('article_language', 'Telugu'))
        
        print(f"   📋 Settings: URL={review_url}, Language={article_language}")
        
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
            "errors": [],
            "created_reviews": []
        }
        
        if not review_url:
            results["status"] = "failed"
            results["errors"].append("No review URL provided")
            return results
        
        try:
            # ========== STEP 1: SCRAPE AND STORE IN TEMP SPACE ==========
            print(f"\n   📥 STEP 1: Scraping review...")
            
            scraped_data = await movie_review_scraper.scrape_review(review_url)
            results["reviews_scraped"] = 1
            
            # Store in temporary space
            self.temp_review_data = {
                'movie_name': scraped_data.movie_name,
                'rating': scraped_data.rating,
                'rating_scale': scraped_data.rating_scale,
                'normalized_rating': scraped_data.normalized_rating,
                
                # Movie info - copy as-is
                'cast': scraped_data.cast,
                'director': scraped_data.director,
                'producer': scraped_data.producer,
                'music_director': scraped_data.music_director,
                'dop': scraped_data.dop,
                'genre': scraped_data.genre,
                'runtime': scraped_data.runtime,
                'release_date': scraped_data.release_date,
                'banner': scraped_data.banner,
                'poster_image': scraped_data.poster_image,
                
                # Review sections - to be rewritten
                'story_plot': scraped_data.story_plot,
                'performances': scraped_data.performances,
                'what_works': scraped_data.what_works,
                'what_doesnt_work': scraped_data.what_doesnt_work,
                'technical_aspects': scraped_data.technical_aspects,
                'final_verdict': scraped_data.final_verdict,
                'quick_verdict': scraped_data.quick_verdict,
                
                # Source info
                'source_url': review_url,
                'source_name': scraped_data.source_name
            }
            
            print(f"   ✅ Scraped: {self.temp_review_data['movie_name']} - Rating: {self.temp_review_data['rating']}/{self.temp_review_data['rating_scale']}")
            print(f"   📦 Stored in temp space")
            
            # ========== STEP 2: LLM REWRITE FROM TEMP DATA ==========
            print(f"\n   ✍️ STEP 2: Rewriting review sections with LLM...")
            
            # Initialize LLM
            self._initialize_llm()
            
            # Rewrite sections from temp data
            rewritten_sections = self._rewrite_from_temp(article_language)
            
            print(f"   ✅ LLM rewrite complete")
            
            # ========== STEP 3: CREATE ARTICLE ==========
            print(f"\n   📝 STEP 3: Creating article...")
            
            article_data = self._create_article_data(
                content_workflow=content_workflow,
                article_language=article_language,
                rewritten_sections=rewritten_sections
            )
            
            # Save to database
            created_article = crud.create_article(db, article_data)
            
            if created_article:
                results["reviews_created"] = 1
                results["created_reviews"].append({
                    "id": created_article.get('id'),
                    "title": created_article.get('title'),
                    "movie_name": self.temp_review_data['movie_name'],
                    "rating": self.temp_review_data['normalized_rating']
                })
                print(f"\n   ✅ Created review: {self.temp_review_data['movie_name']} ({self.temp_review_data['normalized_rating']:.1f}/5)")
            
            # Clear temp data
            self.temp_review_data = None
            
        except Exception as e:
            results["status"] = "failed"
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
            'article_language': 'en',  # Use 'en' for CMS filtering, movie_language specifies actual language
            'summary': '',  # Required field
            
            # Movie review specific fields - review sections with HTML
            'review_quick_verdict': rewritten_sections.get('quick_verdict', ''),
            'review_plot_summary': f"<p>{rewritten_sections.get('story_plot', '')}</p>",
            'review_performances': f"<p>{rewritten_sections.get('performances', '')}</p>",
            'review_what_works': f"<p>{rewritten_sections.get('what_works', '')}</p>",
            'review_what_doesnt_work': f"<p>{rewritten_sections.get('what_doesnt_work', '')}</p>",
            'review_technical_aspects': f"<p>{rewritten_sections.get('technical_aspects', '')}</p>",
            'review_final_verdict': f"<p>{rewritten_sections.get('final_verdict', '')}</p>",
            
            # Movie details - matching existing schema
            'review_cast': self.temp_review_data.get('cast', ''),
            'review_director': self.temp_review_data.get('director', ''),
            'review_producer': self.temp_review_data.get('producer', ''),
            'review_music_director': self.temp_review_data.get('music_director', ''),
            'review_dop': self.temp_review_data.get('dop', ''),
            'review_genre': json.dumps(genre_list),  # JSON string like '["Action","Romance"]'
            'review_runtime': self.temp_review_data.get('runtime', ''),
            'release_date': self.temp_review_data.get('release_date', ''),
            
            # Movie metadata - JSON strings to match schema
            'movie_language': json.dumps([article_language]),  # JSON string like '["Telugu"]'
            'movie_rating': str(rating),  # String format like '2.0'
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
            
            # Author
            'author': 'AI Review Agent'
        }
        
        return article_data


# Singleton instance
movie_review_agent_service = MovieReviewAgentService()
