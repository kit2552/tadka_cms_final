"""
Movie Review Agent Service
Orchestrates scraping movie reviews and using LLM to generate formatted review content
"""

import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
from database import db
import crud
import uuid
import re
import json


class MovieReviewAgentService:
    """Service for running Movie Review agents"""
    
    def __init__(self):
        self.is_running = False
        self.llm_client = None
        self.llm_model = None
        self.llm_provider = None
    
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
    
    def _llm_complete(self, system_prompt: str, user_prompt: str, max_tokens: int = 4000) -> str:
        """Universal LLM completion"""
        try:
            if self.llm_provider == 'openai':
                response = self.llm_client.chat.completions.create(
                    model=self.llm_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_completion_tokens=max_tokens
                )
                return response.choices[0].message.content.strip()
                
            elif self.llm_provider == 'gemini':
                full_prompt = f"{system_prompt}\n\n{user_prompt}"
                response = self.llm_client.generate_content(full_prompt)
                return response.text.strip()
                
            elif self.llm_provider == 'anthropic':
                response = self.llm_client.messages.create(
                    model=self.llm_model,
                    max_tokens=max_tokens,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}]
                )
                return response.content[0].text.strip()
                
        except Exception as e:
            print(f"   ❌ LLM Error: {str(e)}")
            raise Exception(f"LLM completion failed: {str(e)}")
    
    async def run_movie_review_agent(self, agent_id: str) -> Dict:
        """
        Run the Movie Review agent to scrape and create movie review posts
        
        Args:
            agent_id: The ID of the agent to run
            
        Returns:
            Dict with execution results
        """
        from services.movie_review_scraper_service import movie_review_scraper
        
        print(f"\n🎬 Starting Movie Review Agent: {agent_id}")
        
        # Get agent configuration
        agent = db.ai_agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise ValueError(f"Agent not found: {agent_id}")
        
        # Extract agent settings
        reference_urls = agent.get('reference_urls', [])
        if isinstance(reference_urls, str):
            reference_urls = [url.strip() for url in reference_urls.split('\n') if url.strip()]
        
        rating_strategy = agent.get('review_rating_strategy', 'lowest')  # lowest, highest, average
        content_workflow = agent.get('content_workflow', 'in_review')
        article_language = agent.get('article_language', 'Telugu')
        
        print(f"   📋 Settings: URLs={len(reference_urls)}, RatingStrategy={rating_strategy}, Language={article_language}")
        
        # Initialize LLM
        self._initialize_llm()
        
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
        
        if not reference_urls:
            results["status"] = "failed"
            results["errors"].append("No reference URLs provided")
            return results
        
        try:
            # Scrape all reviews
            scraped_reviews = []
            for url in reference_urls:
                try:
                    review_data = await movie_review_scraper.scrape_review(url)
                    scraped_reviews.append(review_data)
                    results["reviews_scraped"] += 1
                except Exception as e:
                    error_msg = f"Failed to scrape {url}: {str(e)}"
                    print(f"   ❌ {error_msg}")
                    results["errors"].append(error_msg)
            
            if not scraped_reviews:
                results["status"] = "failed"
                results["errors"].append("No reviews could be scraped")
                return results
            
            # Determine the movie name (use most common or first)
            movie_names = [r.movie_name for r in scraped_reviews if r.movie_name]
            movie_name = movie_names[0] if movie_names else "Unknown Movie"
            
            # Calculate final rating based on strategy
            ratings = [r.normalized_rating for r in scraped_reviews if r.normalized_rating > 0]
            if ratings:
                if rating_strategy == 'lowest':
                    final_rating = min(ratings)
                elif rating_strategy == 'highest':
                    final_rating = max(ratings)
                else:  # average
                    final_rating = sum(ratings) / len(ratings)
            else:
                final_rating = 0.0
            
            print(f"\n   📊 Rating Strategy: {rating_strategy}")
            print(f"   📊 Individual ratings: {ratings}")
            print(f"   📊 Final rating: {final_rating:.1f}/5")
            
            # Merge data from all reviews
            merged_data = self._merge_review_data(scraped_reviews)
            
            # Use LLM to rewrite each section
            print("\n   ✍️ Rewriting review sections with LLM...")
            rewritten_sections = await self._rewrite_review_sections(merged_data, movie_name, article_language)
            
            # Create the movie review article
            article_data = self._create_article_data(
                movie_name=movie_name,
                rating=final_rating,
                merged_data=merged_data,
                rewritten_sections=rewritten_sections,
                content_workflow=content_workflow,
                article_language=article_language,
                source_urls=reference_urls
            )
            
            # Save to database
            created_article = crud.create_article(db, article_data)
            
            if created_article:
                results["reviews_created"] = 1
                results["created_reviews"].append({
                    "id": created_article.get('id'),
                    "title": created_article.get('title'),
                    "movie_name": movie_name,
                    "rating": final_rating
                })
                print(f"\n   ✅ Created review: {movie_name} ({final_rating:.1f}/5)")
            
        except Exception as e:
            results["status"] = "failed"
            results["errors"].append(str(e))
            print(f"\n   ❌ Agent failed: {str(e)}")
        
        return results
    
    def _merge_review_data(self, reviews: List) -> Dict:
        """Merge data from multiple review sources"""
        merged = {
            'cast': '',
            'director': '',
            'producer': '',
            'music_director': '',
            'dop': '',
            'genre': '',
            'runtime': '',
            'release_date': '',
            'banner': '',
            'poster_image': '',
            'story_plot': [],
            'performances': [],
            'what_works': [],
            'what_doesnt_work': [],
            'technical_aspects': [],
            'final_verdict': [],
            'quick_verdict': [],
            'full_review_texts': []
        }
        
        for review in reviews:
            # Take first non-empty value for single fields
            if review.cast and not merged['cast']:
                merged['cast'] = review.cast
            if review.director and not merged['director']:
                merged['director'] = review.director
            if review.producer and not merged['producer']:
                merged['producer'] = review.producer
            if review.music_director and not merged['music_director']:
                merged['music_director'] = review.music_director
            if review.dop and not merged['dop']:
                merged['dop'] = review.dop
            if review.genre and not merged['genre']:
                merged['genre'] = review.genre
            if review.runtime and not merged['runtime']:
                merged['runtime'] = review.runtime
            if review.release_date and not merged['release_date']:
                merged['release_date'] = review.release_date
            if review.banner and not merged['banner']:
                merged['banner'] = review.banner
            if review.poster_image and not merged['poster_image']:
                merged['poster_image'] = review.poster_image
            
            # Collect all content for sections
            if review.story_plot:
                merged['story_plot'].append(f"[{review.source_name}]: {review.story_plot}")
            if review.performances:
                merged['performances'].append(f"[{review.source_name}]: {review.performances}")
            if review.what_works:
                merged['what_works'].append(f"[{review.source_name}]: {review.what_works}")
            if review.what_doesnt_work:
                merged['what_doesnt_work'].append(f"[{review.source_name}]: {review.what_doesnt_work}")
            if review.technical_aspects:
                merged['technical_aspects'].append(f"[{review.source_name}]: {review.technical_aspects}")
            if review.final_verdict:
                merged['final_verdict'].append(f"[{review.source_name}]: {review.final_verdict}")
            if review.quick_verdict:
                merged['quick_verdict'].append(review.quick_verdict)
            if review.full_review_text:
                merged['full_review_texts'].append(f"=== {review.source_name} ===\n{review.full_review_text[:3000]}")
        
        return merged
    
    async def _rewrite_review_sections(self, merged_data: Dict, movie_name: str, language: str) -> Dict:
        """Use LLM to rewrite each review section"""
        
        system_prompt = f"""You are an expert movie critic writing reviews in {language} language style for an Indian entertainment news website.
Your task is to synthesize multiple review sources into a single, coherent, well-written review section.
- Write in a professional but engaging tone
- Be balanced and fair in your assessment
- Keep the content concise but informative
- Do not copy verbatim from sources - rewrite in your own words
- Output should be in English unless specifically asked for another language
- Do not include source attributions in the final text"""
        
        rewritten = {}
        
        # Rewrite story/plot
        if merged_data['story_plot']:
            prompt = f"""Rewrite the following plot summaries for "{movie_name}" into a single cohesive story summary (2-3 paragraphs):

{chr(10).join(merged_data['story_plot'])}

Write only the plot summary, no headers or labels."""
            rewritten['story_plot'] = self._llm_complete(system_prompt, prompt)
        
        # Rewrite performances
        if merged_data['performances']:
            prompt = f"""Rewrite the following performance reviews for "{movie_name}" into a single cohesive performances section (2-3 paragraphs):

{chr(10).join(merged_data['performances'])}

Write only the performances analysis, no headers or labels."""
            rewritten['performances'] = self._llm_complete(system_prompt, prompt)
        
        # Rewrite what works (positives)
        if merged_data['what_works']:
            prompt = f"""Summarize the positives/highlights from these reviews of "{movie_name}" into a bulleted list of 4-6 key points:

{chr(10).join(merged_data['what_works'])}

Format as bullet points starting with •"""
            rewritten['what_works'] = self._llm_complete(system_prompt, prompt)
        
        # Rewrite what doesn't work (negatives)
        if merged_data['what_doesnt_work']:
            prompt = f"""Summarize the negatives/drawbacks from these reviews of "{movie_name}" into a bulleted list of 3-5 key points:

{chr(10).join(merged_data['what_doesnt_work'])}

Format as bullet points starting with •"""
            rewritten['what_doesnt_work'] = self._llm_complete(system_prompt, prompt)
        
        # Rewrite technical aspects
        if merged_data['technical_aspects']:
            prompt = f"""Rewrite the following technical aspects reviews for "{movie_name}" into a single cohesive section (1-2 paragraphs):

{chr(10).join(merged_data['technical_aspects'])}

Cover cinematography, music, editing, and production design. Write only the content, no headers."""
            rewritten['technical_aspects'] = self._llm_complete(system_prompt, prompt)
        
        # Rewrite final verdict
        if merged_data['final_verdict']:
            prompt = f"""Synthesize these verdict/analysis sections for "{movie_name}" into a balanced final verdict (2-3 paragraphs):

{chr(10).join(merged_data['final_verdict'])}

Provide a balanced conclusion that summarizes the overall experience. Write only the content, no headers."""
            rewritten['final_verdict'] = self._llm_complete(system_prompt, prompt)
        
        # Generate quick verdict
        if merged_data['quick_verdict']:
            prompt = f"""Based on these quick verdicts for "{movie_name}", create a single catchy one-liner verdict (max 5 words):

{chr(10).join(merged_data['quick_verdict'])}

Output only the one-liner, nothing else."""
            rewritten['quick_verdict'] = self._llm_complete(system_prompt, prompt)
        
        return rewritten
    
    def _create_article_data(self, movie_name: str, rating: float, merged_data: Dict, 
                             rewritten_sections: Dict, content_workflow: str, 
                             article_language: str, source_urls: List[str]) -> Dict:
        """Create article data for database insertion"""
        
        # Map workflow to status
        status_map = {
            'in_review': 'draft',
            'ready_to_publish': 'draft',
            'publish': 'approved'
        }
        status = status_map.get(content_workflow, 'draft')
        is_published = content_workflow == 'publish'
        
        # Generate article ID
        article_id = crud.get_next_article_id(db)
        
        # Create title
        title = f"{movie_name} Movie Review"
        
        # Create slug
        slug = re.sub(r'[^a-z0-9]+', '-', movie_name.lower()).strip('-')
        slug = f"{slug}-movie-review-{article_id}"
        
        # Build content from sections
        content_parts = []
        if rewritten_sections.get('story_plot'):
            content_parts.append(f"<h2>Story</h2>\n<p>{rewritten_sections['story_plot']}</p>")
        if rewritten_sections.get('performances'):
            content_parts.append(f"<h2>Performances</h2>\n<p>{rewritten_sections['performances']}</p>")
        if rewritten_sections.get('what_works'):
            works_html = rewritten_sections['what_works'].replace('•', '<li>').replace('\n', '</li>\n')
            content_parts.append(f"<h2>What Works</h2>\n<ul>{works_html}</ul>")
        if rewritten_sections.get('what_doesnt_work'):
            doesnt_html = rewritten_sections['what_doesnt_work'].replace('•', '<li>').replace('\n', '</li>\n')
            content_parts.append(f"<h2>What Doesn't Work</h2>\n<ul>{doesnt_html}</ul>")
        if rewritten_sections.get('technical_aspects'):
            content_parts.append(f"<h2>Technical Aspects</h2>\n<p>{rewritten_sections['technical_aspects']}</p>")
        if rewritten_sections.get('final_verdict'):
            content_parts.append(f"<h2>Verdict</h2>\n<p>{rewritten_sections['final_verdict']}</p>")
        
        content = '\n\n'.join(content_parts)
        
        # Create meta description
        meta_description = f"{movie_name} movie review and rating. {rewritten_sections.get('quick_verdict', '')} Rating: {rating:.1f}/5"
        
        article_data = {
            'id': article_id,
            'title': title,
            'slug': slug,
            'content': content,
            'content_type': 'movie_review',
            'category_slug': 'reviews',
            'status': status,
            'is_published': is_published,
            'language': article_language,
            
            # Movie review specific fields
            'review_quick_verdict': rewritten_sections.get('quick_verdict', ''),
            'review_plot_summary': rewritten_sections.get('story_plot', ''),
            'review_performances': rewritten_sections.get('performances', ''),
            'review_what_works': rewritten_sections.get('what_works', ''),
            'review_what_doesnt_work': rewritten_sections.get('what_doesnt_work', ''),
            'review_technical_aspects': rewritten_sections.get('technical_aspects', ''),
            'review_final_verdict': rewritten_sections.get('final_verdict', ''),
            
            # Movie details
            'review_cast': merged_data.get('cast', ''),
            'review_director': merged_data.get('director', ''),
            'review_producer': merged_data.get('producer', ''),
            'review_music_director': merged_data.get('music_director', ''),
            'review_dop': merged_data.get('dop', ''),
            'review_genre': merged_data.get('genre', ''),
            'review_runtime': merged_data.get('runtime', ''),
            'release_date': merged_data.get('release_date', ''),
            'movie_language': article_language,
            
            # Rating
            'rating': rating,
            
            # Images
            'featured_image': merged_data.get('poster_image', ''),
            
            # SEO
            'meta_description': meta_description[:160],
            'meta_title': f"{movie_name} Review - Rating {rating:.1f}/5",
            
            # Sources
            'sources': json.dumps(source_urls),
            
            # Timestamps
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'published_at': datetime.now(timezone.utc) if is_published else None,
            
            # Author
            'author': 'AI Review Agent'
        }
        
        return article_data


# Singleton instance
movie_review_agent_service = MovieReviewAgentService()
