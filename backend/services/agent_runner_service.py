"""
AI Agent Runner Service
Handles execution of AI agents to generate content using OpenAI
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
    
    def _initialize_openai(self):
        """Initialize OpenAI client with API key from system settings"""
        ai_config = crud.get_ai_api_keys(db)
        if not ai_config or not ai_config.get('openai_api_key'):
            raise ValueError("OpenAI API key not configured. Please add it in System Settings > API Keys.")
        
        self.client = OpenAI(api_key=ai_config['openai_api_key'])
        
        # Use default_text_model from system settings, fallback to gpt-4o
        configured_model = ai_config.get('default_text_model') or ai_config.get('openai_default_model') or 'gpt-4o'
        
        # Use the configured model directly - GPT-5 is now available
        self.model = configured_model
        
        # Store the image model for later use
        self.image_model = ai_config.get('default_image_model') or 'dall-e-3'
        
        # Store full config for provider-specific operations
        self.ai_config = ai_config
        
        return self.client
    
    def _get_category_prompt(self, category_slug: str) -> str:
        """Get the prompt template for a category"""
        mappings = crud.get_category_prompt_mappings(db)
        if mappings and category_slug in mappings:
            return mappings[category_slug]
        
        # Default prompt if no mapping exists
        return f"""Search the web for the latest trending news about {category_slug}. Write a comprehensive article that:
- Has an engaging headline
- Provides context and background
- Is well-structured and informative
- Uses clear, accessible language"""

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

    async def _fetch_reference_content(self, urls: list) -> str:
        """Fetch content from reference URLs"""
        if not urls:
            return ""
        
        fetched_content = []
        for url in urls:
            if not url:
                continue
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, timeout=30.0, follow_redirects=True)
                    if response.status_code == 200:
                        html_content = response.text
                        # Extract text content from HTML (basic extraction)
                        import re
                        # Remove script and style elements
                        html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
                        html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
                        # Remove HTML tags
                        text = re.sub(r'<[^>]+>', ' ', html_content)
                        # Clean up whitespace
                        text = re.sub(r'\s+', ' ', text).strip()
                        # Limit content length
                        if len(text) > 5000:
                            text = text[:5000] + "..."
                        fetched_content.append(f"**Content from {url}:**\n{text}")
            except Exception as e:
                print(f"Failed to fetch {url}: {e}")
                fetched_content.append(f"**Could not fetch content from {url}**")
        
        return "\n\n".join(fetched_content)

    def _build_final_prompt(self, agent: Dict[str, Any], reference_content: str = "") -> str:
        """Build the final prompt with all dynamic placeholders replaced"""
        category = agent.get('category', '')
        base_prompt = self._get_category_prompt(category)
        
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
            reference_section = f"""**REFERENCE CONTENT (FETCHED FROM PROVIDED URLs):**
The following content has been fetched from the reference URLs. Use this as your PRIMARY source to generate the article:

{reference_content}

**INSTRUCTIONS:**
1. Read and analyze the above reference content carefully
2. Identify the main news stories, facts, and key information
3. Write a NEW, original article based on this content
4. Do NOT copy text directly - rewrite in your own words"""
            final_prompt = final_prompt.replace('{reference_content_section}', reference_section)
        elif reference_urls and len(reference_urls) > 0:
            urls_list = "\n".join([f"- {url}" for url in reference_urls if url])
            reference_section = f"""Reference URLs provided: {urls_list}
Note: Could not fetch content from these URLs. Generate content based on general knowledge."""
            final_prompt = final_prompt.replace('{reference_content_section}', reference_section)
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
            self._initialize_openai()
        
        optimization_prompt = f"""You are a prompt optimization expert. Optimize the following prompt to generate better, more engaging news content. 
Keep the core requirements but make the instructions clearer and more specific.

Original Prompt:
{base_prompt}

Return ONLY the optimized prompt, nothing else."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a prompt optimization expert."},
                    {"role": "user", "content": optimization_prompt}
                ],
                max_completion_tokens=20000
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Prompt optimization failed: {e}, using original prompt")
            return base_prompt

    async def _generate_content(self, optimized_prompt: str) -> str:
        """Generate article content using OpenAI"""
        if not self.client:
            self._initialize_openai()
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional news writer and journalist. Write engaging, factual, and well-structured articles."},
                    {"role": "user", "content": optimized_prompt}
                ],
                max_completion_tokens=20000
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise Exception(f"Content generation failed: {str(e)}")

    async def _generate_title(self, content: str) -> str:
        """Generate a title for the content using OpenAI"""
        if not self.client:
            self._initialize_openai()
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a headline writer. Create catchy, engaging, SEO-friendly headlines."},
                    {"role": "user", "content": f"Create a compelling headline/title for the following article. Return ONLY the headline, nothing else:\n\n{content[:1500]}"}
                ],
                max_completion_tokens=200
            )
            title = response.choices[0].message.content.strip()
            # Remove quotes if present
            title = title.strip('"\'')
            return title
        except Exception as e:
            raise Exception(f"Title generation failed: {str(e)}")

    async def _generate_summary(self, content: str) -> str:
        """Generate a summary for the content"""
        if not self.client:
            self._initialize_openai()
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a content summarizer. Create concise, informative summaries."},
                    {"role": "user", "content": f"Create a 2-3 sentence summary for the following article. Return ONLY the summary:\n\n{content[:2000]}"}
                ],
                max_completion_tokens=500
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
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
            self._initialize_openai()
        
        try:
            # Generate search query
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an image search expert. Generate a specific search query to find a relevant news image."},
                    {"role": "user", "content": f"Generate a Google image search query to find a relevant, high-quality image for this article. Category: {category}. Title: {title}. Return ONLY the search query, nothing else."}
                ],
                max_completion_tokens=100
            )
            search_query = response.choices[0].message.content.strip()
            
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
            self._initialize_openai()
        
        try:
            # Generate image prompt
            prompt_response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Create a detailed image generation prompt."},
                    {"role": "user", "content": f"Create an image prompt for a news article image. Title: {title}. Make it professional, news-worthy, horizontal orientation. Return ONLY the prompt, max 100 words."}
                ],
                max_completion_tokens=200
            )
            image_prompt = prompt_response.choices[0].message.content.strip()
            
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

    async def run_agent(self, agent_id: str) -> Dict[str, Any]:
        """Run an AI agent and generate an article"""
        # Get agent configuration
        agent = crud.get_ai_agent(db, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        
        try:
            # Step 1: Initialize OpenAI
            self._initialize_openai()
            
            # Step 2: Build the final prompt with all dynamic placeholders
            base_prompt = self._build_final_prompt(agent)
            
            # Step 3: Optimize the prompt using OpenAI
            optimized_prompt = await self._optimize_prompt(base_prompt)
            
            # Step 4: Generate content using the optimized prompt
            content = await self._generate_content(optimized_prompt)
            
            # Step 5: Generate title for the content
            title = await self._generate_title(content)
            
            # Step 6: Generate summary
            summary = await self._generate_summary(content)
            
            # Step 7: Get image based on image option
            image_option = agent.get('image_option', 'web_search')
            image_url = await self._get_image_for_content(content, title, image_option, agent.get('category', ''))
            
            # Step 8: Handle split content
            main_content = content
            secondary_content = ""
            if agent.get('split_content', False):
                main_content, secondary_content = self._split_content(content, agent.get('split_paragraphs', 2))
            
            # Step 9: Determine status from workflow
            status, is_published = self._get_status_from_workflow(agent.get('content_workflow', 'in_review'))
            
            # Step 10: Create the article
            article_data = {
                'title': title,
                'content': main_content,
                'content_secondary': secondary_content if secondary_content else None,
                'summary': summary,
                'author': 'AI Agent',
                'article_language': agent.get('article_language', 'en'),
                'states': f'["{agent.get("target_state", "all")}"]' if agent.get('target_state') else '["all"]',
                'category': agent.get('category', ''),
                'content_type': agent.get('content_type', 'post'),
                'image': image_url,
                'is_top_story': agent.get('is_top_story', False),
                'comments_enabled': agent.get('comments_enabled', True),
                'status': status,
                'is_published': is_published,
                'is_scheduled': False
            }
            
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
