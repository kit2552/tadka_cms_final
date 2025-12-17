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

    async def _fetch_reference_content(self, urls: list, category: str = "") -> tuple:
        """Fetch and extract main article content from reference URLs using trafilatura
        For listing pages (like politics), finds the latest article first.
        Returns: (content_text, original_title)
        """
        if not urls:
            return "", ""
        
        fetched_content = []
        original_title = ""
        
        for url in urls:
            if not url:
                continue
            try:
                import trafilatura
                from urllib.parse import urljoin
                
                # Download the webpage
                downloaded = trafilatura.fetch_url(url)
                
                if downloaded:
                    # First, try to extract as a direct article
                    extracted = trafilatura.extract(
                        downloaded,
                        include_comments=False,
                        include_tables=True,
                        no_fallback=False,
                        favor_precision=True
                    )
                    
                    metadata = trafilatura.extract_metadata(downloaded)
                    
                    # Check if this is a listing page (short content or category page)
                    # Listing pages typically have less direct content
                    is_listing_page = (not extracted or len(extracted) < 500) or \
                                      (category in ['politics', 'sports', 'business', 'technology', 'state-news'])
                    
                    if is_listing_page:
                        print(f"Detected listing page, searching for latest article links...")
                        # Try to find article links on the page
                        article_url = await self._find_latest_article_url(downloaded, url)
                        
                        if article_url:
                            print(f"Found latest article: {article_url}")
                            # Fetch the actual article
                            article_downloaded = trafilatura.fetch_url(article_url)
                            if article_downloaded:
                                extracted = trafilatura.extract(
                                    article_downloaded,
                                    include_comments=False,
                                    include_tables=True,
                                    no_fallback=False,
                                    favor_precision=True
                                )
                                metadata = trafilatura.extract_metadata(article_downloaded)
                    
                    if extracted:
                        if metadata and metadata.title:
                            original_title = metadata.title
                            print(f"Extracted original title: {original_title}")
                        
                        fetched_content.append(f"**Article Title:** {original_title or 'Unknown'}\n\n**Article Content:**\n{extracted}")
                        print(f"Successfully extracted article: {len(extracted)} chars")
                    else:
                        fetched_content.append(f"**Could not extract article content from {url}**")
                        print(f"trafilatura could not extract content from {url}")
                else:
                    fetched_content.append(f"**Could not download page from {url}**")
                    print(f"Failed to download {url}")
                    
            except Exception as e:
                print(f"Failed to fetch {url}: {e}")
                fetched_content.append(f"**Error fetching {url}: {str(e)}**")
        
        return "\n\n---\n\n".join(fetched_content), original_title

    async def _find_latest_article_url(self, html_content: str, base_url: str) -> Optional[str]:
        """Find the latest/first article URL from a listing page"""
        try:
            import re
            from urllib.parse import urljoin
            
            # Common patterns for article links
            # Look for links that appear to be articles (contain date patterns, news, article, story, etc.)
            article_patterns = [
                r'href=["\']([^"\']*(?:/\d{4}/\d{2}/\d{2}/|/\d{4}/[a-z]+/\d+/|/news/|/article/|/story/)[^"\']*)["\']',
                r'href=["\']([^"\']*(?:\.html|\.htm)[^"\']*)["\']',
                r'href=["\'](/[^"\']+/[^"\']+/[^"\']+)["\']'  # Paths with multiple segments
            ]
            
            found_urls = []
            for pattern in article_patterns:
                matches = re.findall(pattern, html_content, re.IGNORECASE)
                for match in matches:
                    full_url = urljoin(base_url, match)
                    # Filter out non-article URLs
                    if not any(x in full_url.lower() for x in ['#', 'javascript:', 'mailto:', '.css', '.js', '.png', '.jpg', 'login', 'signup', 'subscribe']):
                        if full_url != base_url and full_url not in found_urls:
                            found_urls.append(full_url)
            
            # Return the first article URL found (usually the latest)
            if found_urls:
                print(f"Found {len(found_urls)} potential article URLs")
                return found_urls[0]
            
            return None
            
        except Exception as e:
            print(f"Error finding article URL: {e}")
            return None

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
            self._initialize_ai_client()
        
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
            content = self._chat_completion(
                "You are a professional news writer and journalist. Write engaging, factual, and well-structured articles.",
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
        """Generate a compelling, DIFFERENT title for the content using OpenAI"""
        if not self.client:
            self._initialize_ai_client()
        
        try:
            # Build prompt based on whether we have original title
            if original_title:
                prompt = f"""Write a SHORT news headline (8-10 words ONLY).

Topic: {original_title[:200]}

RULES:
- 8 to 10 words MAXIMUM
- One simple sentence
- Catchy and clear
- No quotes, colons, or dashes

Good examples:
- "Cameron Wants to Visit Rajamouli's Film Sets"
- "Pawan Kalyan's OG Sequel Coming in 2028"
- "Director Plans Exciting New Telugu Project"

Write ONLY the headline, nothing else."""
            else:
                prompt = f"""Write a SHORT news headline (8-10 words ONLY).

Article summary:
{content[:800]}

RULES:
- 8 to 10 words MAXIMUM
- One simple sentence
- Catchy and clear
- No quotes, colons, or dashes

Write ONLY the headline, nothing else."""

            title = self._chat_completion(
                "You are a headline writer. You write ONLY 8-10 word headlines. Never more than 10 words. Keep it simple and punchy.",
                prompt,
                100
            )
            
            # Clean up the title
            title = title.strip('"\'')
            title = title.replace("Headline:", "").replace("Title:", "").strip()
            
            # If title is too long, ask AI to shorten it properly
            words = title.split()
            if len(words) > 14:
                print(f"Title too long ({len(words)} words), asking AI to shorten...")
                title = self._chat_completion(
                    "You shorten headlines while keeping the complete meaning.",
                    f"Shorten this headline to 10-12 words while keeping the full meaning:\n\n{title}\n\nWrite only the shortened headline.",
                    100
                ).strip('"\'')
                print(f"Shortened title ({len(title.split())} words): {title}")
            
            # If title generation failed or empty, create from content
            if not title:
                first_sentence = content.split('.')[0] if content else "News Article"
                title = first_sentence.strip()
            
            print(f"Final title ({len(title.split())} words): {title}")
            return title
            
        except Exception as e:
            print(f"Title generation failed: {e}")
            # Fallback to content excerpt
            first_sentence = content.split('.')[0] if content else "News Article"
            words = first_sentence.split()[:10]
            return ' '.join(words)

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

    async def run_agent(self, agent_id: str) -> Dict[str, Any]:
        """Run an AI agent and generate an article"""
        # Get agent configuration
        agent = crud.get_ai_agent(db, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        
        try:
            # Step 1: Initialize OpenAI
            self._initialize_ai_client()
            
            # Step 2: Fetch content from reference URLs
            reference_urls = agent.get('reference_urls', [])
            reference_content = ""
            original_title = ""
            if reference_urls:
                print(f"Fetching content from {len(reference_urls)} reference URLs...")
                reference_content, original_title = await self._fetch_reference_content(reference_urls)
                print(f"Fetched {len(reference_content)} characters of reference content")
                if original_title:
                    print(f"Original article title: {original_title}")
            
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
