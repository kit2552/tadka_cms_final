"""
Photo Gallery Agent Service
Handles execution of AI agents to scrape and create photo galleries
"""
import os
import re
import uuid
import httpx
import asyncio
import tempfile
import shutil
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from urllib.parse import urljoin, urlparse
from database import db
import crud


class GalleryAgentService:
    """Service to run Photo Gallery AI agents"""
    
    def __init__(self):
        self.client = None
        self.model = None
        self.provider = None
        
    def _initialize_ai_client(self):
        """Initialize the appropriate AI client based on selected model"""
        ai_config = crud.get_ai_api_keys(db)
        if not ai_config:
            raise ValueError("AI API keys not configured. Please add them in System Settings > API Keys.")
        
        self.model = ai_config.get('default_text_model') or 'gpt-4o'
        self.ai_config = ai_config
        
        model_lower = self.model.lower()
        
        if 'gemini' in model_lower:
            self.provider = 'gemini'
            if not ai_config.get('gemini_api_key'):
                raise ValueError("Gemini API key not configured.")
            import google.generativeai as genai
            genai.configure(api_key=ai_config['gemini_api_key'])
            self.client = genai.GenerativeModel(self.model)
            
        elif 'claude' in model_lower or 'sonnet' in model_lower:
            self.provider = 'anthropic'
            if not ai_config.get('anthropic_api_key'):
                raise ValueError("Anthropic API key not configured.")
            from anthropic import Anthropic
            self.client = Anthropic(api_key=ai_config['anthropic_api_key'])
            
        else:
            self.provider = 'openai'
            if not ai_config.get('openai_api_key'):
                raise ValueError("OpenAI API key not configured.")
            from openai import OpenAI
            self.client = OpenAI(api_key=ai_config['openai_api_key'])
    
    def _initialize_s3_service(self):
        """Initialize S3 service using existing s3_service from server"""
        from s3_service import s3_service
        
        # Get AWS config and initialize if not already done
        aws_config = crud.get_aws_config(db)
        if not aws_config:
            raise ValueError("AWS configuration not found. Please configure S3 in System Settings.")
        
        if not s3_service.is_enabled():
            s3_service.initialize(aws_config)
        
        if not s3_service.is_enabled():
            raise ValueError("S3 service is not enabled. Please check AWS configuration in System Settings.")
        
        self.s3_service = s3_service
        print(f"✅ S3 service initialized")

    async def _fetch_page_content(self, url: str) -> Tuple[str, str]:
        """Fetch page HTML content and extract title"""
        import trafilatura
        
        print(f"📥 Fetching page: {url}")
        downloaded = trafilatura.fetch_url(url)
        
        if not downloaded:
            raise ValueError(f"Could not download page: {url}")
        
        metadata = trafilatura.extract_metadata(downloaded)
        title = metadata.title if metadata else ""
        
        return downloaded, title

    async def _find_latest_gallery_url(self, html: str, base_url: str) -> Optional[str]:
        """Find the latest gallery URL from a listing page"""
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html, 'html.parser')
        parsed_base = urlparse(base_url)
        base_domain = f"{parsed_base.scheme}://{parsed_base.netloc}"
        
        # Common gallery/photo link patterns - more flexible to catch various URL formats
        gallery_patterns = [
            r'/photogallery/[^/]+-\d+',      # /photogallery/name-12345
            r'/photos/\d+/[^/]+',             # /photos/12345/slug
            r'/photos/\d+',                   # /photos/12345
            r'/gallery/[^/]+',                # /gallery/name
            r'/albums/[^/]+/[^/]+',           # /albums/category/name
            r'/news/\d+/[^/]+',               # /news/12345/slug (some sites use news for galleries)
            r'/\d{6}/[^/]+',                  # /387315/slug (just ID at root)
        ]
        
        # Find all links
        links = soup.find_all('a', href=True)
        gallery_links = []
        
        print(f"🔍 Scanning {len(links)} links for gallery URLs...")
        
        for link in links:
            href = link.get('href', '')
            full_url = urljoin(base_domain, href)
            
            # Skip non-content links
            if any(skip in href.lower() for skip in ['#', 'javascript:', 'mailto:', '/tag/', '/category/', '/author/', '/page/']):
                continue
            
            for pattern in gallery_patterns:
                if re.search(pattern, href):
                    # Extract ID - try multiple patterns
                    id_match = re.search(r'/(\d{5,})(?:/|$|-)', href)  # Look for 5+ digit IDs
                    if not id_match:
                        id_match = re.search(r'-(\d{5,})(?:\.|$)', href)  # ID at end with dash
                    
                    gallery_id = int(id_match.group(1)) if id_match else 0
                    
                    if gallery_id > 0:
                        gallery_links.append((full_url, gallery_id))
                        print(f"   Found: ID={gallery_id} -> {href[:60]}...")
                    break
        
        if gallery_links:
            # Sort by ID (highest = latest) and return the first one
            gallery_links.sort(key=lambda x: x[1], reverse=True)
            latest_url = gallery_links[0][0]
            print(f"✅ Selected latest gallery (ID={gallery_links[0][1]}): {latest_url}")
            return latest_url
        
        print(f"❌ No gallery links found matching patterns")
        return None

    async def _extract_gallery_images(self, html: str, base_url: str, max_images: int = 50) -> List[Dict]:
        """Extract all gallery images from the page, handling pagination"""
        from bs4 import BeautifulSoup
        import trafilatura
        
        all_images = []
        seen_urls = set()  # Track all seen URLs to avoid duplicates
        visited_urls = set()
        current_html = html
        current_url = base_url
        
        while len(all_images) < max_images:
            soup = BeautifulSoup(current_html, 'html.parser')
            visited_urls.add(current_url)
            
            # Find images in various gallery structures
            images_found = []
            
            # Look for high-res images in various attributes
            for img in soup.find_all('img'):
                src = img.get('data-src') or img.get('data-lazy-src') or img.get('src') or ''
                
                # Skip thumbnails and icons
                if any(skip in src.lower() for skip in ['thumb', 'icon', 'logo', 'avatar', 'placeholder']):
                    continue
                
                if src and not src.startswith('data:'):
                    full_url = urljoin(base_url, src)
                    
                    # Try to get higher resolution version
                    high_res_url = self._get_high_res_url(full_url)
                    
                    # Normalize URL for comparison (remove query params, trailing slashes)
                    normalized_url = high_res_url.split('?')[0].rstrip('/')
                    
                    if normalized_url not in seen_urls:
                        seen_urls.add(normalized_url)
                        images_found.append({
                            'url': high_res_url,
                            'alt': img.get('alt', ''),
                            'title': img.get('title', '')
                        })
            
            # Also look for links to full-size images
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                if any(ext in href.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
                    full_url = urljoin(base_url, href)
                    
                    # Normalize URL for comparison
                    normalized_url = full_url.split('?')[0].rstrip('/')
                    
                    if normalized_url not in seen_urls:
                        seen_urls.add(normalized_url)
                        images_found.append({
                            'url': full_url,
                            'alt': '',
                            'title': ''
                        })
            
            all_images.extend(images_found)
            print(f"📸 Found {len(images_found)} unique images on page, total: {len(all_images)}")
            
            if len(all_images) >= max_images:
                break
            
            # Look for "Next" button/link for pagination
            next_url = self._find_next_page(soup, current_url)
            
            if next_url and next_url not in visited_urls:
                print(f"📄 Following pagination to: {next_url}")
                next_html = trafilatura.fetch_url(next_url)
                if next_html:
                    current_html = next_html
                    current_url = next_url
                else:
                    break
            else:
                break
        
        return all_images[:max_images]

    def _get_high_res_url(self, url: str) -> str:
        """Try to convert thumbnail URL to high-res URL"""
        # Common thumbnail patterns
        patterns = [
            (r'-\d+x\d+\.', '.'),  # Remove dimensions like -300x200
            (r'_thumb\.', '.'),
            (r'/thumb/', '/'),
            (r'/small/', '/large/'),
            (r'/medium/', '/large/'),
            (r'\?.*$', ''),  # Remove query params that might limit size
        ]
        
        result = url
        for pattern, replacement in patterns:
            result = re.sub(pattern, replacement, result)
        
        return result

    def _find_next_page(self, soup, current_url: str) -> Optional[str]:
        """Find next page URL for pagination"""
        # Common next button patterns
        next_patterns = [
            {'class': re.compile(r'next', re.I)},
            {'rel': 'next'},
            {'aria-label': re.compile(r'next', re.I)},
        ]
        
        for pattern in next_patterns:
            next_link = soup.find('a', pattern)
            if next_link and next_link.get('href'):
                return urljoin(current_url, next_link['href'])
        
        # Look for text-based next links
        for link in soup.find_all('a', href=True):
            text = link.get_text(strip=True).lower()
            if text in ['next', 'next page', '>', '»', 'next →']:
                return urljoin(current_url, link['href'])
        
        return None

    async def _download_images(self, images: List[Dict], temp_dir: str) -> List[Dict]:
        """Download images to temp directory, filtering out placeholder images"""
        downloaded = []
        
        # Minimum file size to filter out placeholders (10KB)
        MIN_IMAGE_SIZE = 10 * 1024  # 10KB
        
        # Skip URLs that look like placeholders
        placeholder_patterns = [
            'placeholder', 'loading', 'spinner', 'loader', 'blank',
            'pixel', 'spacer', 'transparent', 'empty', '1x1',
            'data:image', 'base64'
        ]
        
        valid_image_count = 0
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            for i, img in enumerate(images):
                try:
                    url = img['url']
                    
                    # Skip placeholder URLs
                    url_lower = url.lower()
                    if any(pattern in url_lower for pattern in placeholder_patterns):
                        print(f"⏭️ Skipping placeholder URL: {url[:60]}...")
                        continue
                    
                    print(f"⬇️ Downloading image {i+1}/{len(images)}: {url[:80]}...")
                    
                    response = await client.get(url, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    
                    if response.status_code == 200:
                        file_size = len(response.content)
                        
                        # Skip tiny images (likely placeholders)
                        if file_size < MIN_IMAGE_SIZE:
                            print(f"⏭️ Skipping small image ({file_size} bytes < {MIN_IMAGE_SIZE}): likely placeholder")
                            continue
                        
                        # Determine file extension from content-type first, then URL
                        content_type = response.headers.get('content-type', '')
                        ext = '.jpg'  # default
                        
                        if 'webp' in content_type:
                            ext = '.webp'
                        elif 'png' in content_type:
                            ext = '.png'
                        elif 'gif' in content_type:
                            ext = '.gif'
                        elif 'jpeg' in content_type or 'jpg' in content_type:
                            ext = '.jpg'
                        else:
                            # Fallback to URL extension
                            url_ext = os.path.splitext(urlparse(url).path)[1].lower()
                            if url_ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
                                ext = url_ext if url_ext != '.jpeg' else '.jpg'
                        
                        valid_image_count += 1
                        filename = f"image_{valid_image_count:03d}{ext}"
                        filepath = os.path.join(temp_dir, filename)
                        
                        with open(filepath, 'wb') as f:
                            f.write(response.content)
                        
                        downloaded.append({
                            'local_path': filepath,
                            'filename': filename,
                            'original_url': url,
                            'size': file_size
                        })
                        print(f"✅ Downloaded: {filename} ({file_size} bytes)")
                    else:
                        print(f"❌ Failed to download: {url} (status: {response.status_code})")
                        
                except Exception as e:
                    print(f"❌ Error downloading {img['url']}: {e}")
                    continue
        
        print(f"📊 Downloaded {len(downloaded)} valid images (skipped {len(images) - len(downloaded)} placeholders/small files)")
        return downloaded

    async def _upload_images_to_s3(self, images: List[Dict], folder_path: str) -> List[Dict]:
        """Upload images to S3 using existing s3_service and return their URLs"""
        uploaded = []
        
        # Get galleries root folder from config
        galleries_root = self.s3_service.config.get('galleries_root_folder', 'galleries')
        
        for i, img in enumerate(images):
            try:
                local_path = img['local_path']
                
                # Use sequential numbering like the manual upload: 1.jpg, 2.png, etc.
                ext = os.path.splitext(img['filename'])[1].lower()
                image_number = i + 1
                new_filename = f"{image_number}{ext}"
                
                # Create S3 key with proper folder structure: {galleries_root}/{folder_path}/{number}.ext
                s3_key = f"{galleries_root}/{folder_path}/{new_filename}"
                
                # Determine content type
                content_types = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.webp': 'image/webp',
                    '.gif': 'image/gif'
                }
                content_type = content_types.get(ext, 'image/jpeg')
                
                print(f"☁️ Uploading to S3: {s3_key}")
                
                # Read file content
                with open(local_path, 'rb') as f:
                    file_content = f.read()
                
                # Use existing s3_service upload method
                url = self.s3_service.upload_file(file_content, s3_key, content_type)
                
                if url:
                    uploaded.append({
                        'id': str(uuid.uuid4()),
                        'name': new_filename,
                        'url': url,
                        's3_key': s3_key,
                        'size': img['size']
                    })
                    print(f"✅ Uploaded: {url}")
                else:
                    print(f"❌ Failed to upload {new_filename}: s3_service returned None")
                
            except Exception as e:
                print(f"❌ Error uploading {img['filename']}: {e}")
                continue
        
        return uploaded

    async def _extract_artist_name(self, html: str, title: str) -> str:
        """Extract artist/celebrity name from page content using AI"""
        import trafilatura
        
        # Extract text content
        text_content = trafilatura.extract(html) or ""
        
        prompt = f"""Analyze this photo gallery page and extract the celebrity/artist name.

Title: {title}

Content excerpt:
{text_content[:1500]}

Instructions:
1. Identify the main celebrity, actor, or actress featured in this gallery
2. Return ONLY the name, nothing else
3. Use proper capitalization (e.g., "Samantha Ruth Prabhu" not "samantha ruth prabhu")
4. If multiple people, return the primary/main person
5. If you cannot determine the name, respond with "Unknown"

Artist Name:"""

        try:
            if self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=50,
                    temperature=0.1
                )
                return response.choices[0].message.content.strip()
            elif self.provider == 'gemini':
                response = self.client.generate_content(prompt)
                return response.text.strip()
            elif self.provider == 'anthropic':
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=50,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text.strip()
        except Exception as e:
            print(f"Error extracting artist name: {e}")
            return "Unknown"

    async def _generate_gallery_content(self, html: str, title: str, artist_name: str, word_count: str = "<100", custom_prompt: str = None) -> Tuple[str, str]:
        """Generate new title and content for the gallery post"""
        import trafilatura
        
        text_content = trafilatura.extract(html) or ""
        
        # Parse word count
        max_words = 100
        if word_count == "<150":
            max_words = 150
        elif word_count == "<200":
            max_words = 200
        elif word_count == "<250":
            max_words = 250
        
        # Use custom prompt if provided, otherwise use default
        if custom_prompt and custom_prompt.strip():
            prompt = custom_prompt
            # Replace placeholders
            prompt = prompt.replace('{title}', title)
            prompt = prompt.replace('{artist_name}', artist_name)
            prompt = prompt.replace('{content}', text_content[:2000])
            prompt = prompt.replace('{word_count}', str(max_words))
            print(f"📝 Using custom prompt for gallery content generation")
        else:
            prompt = f"""Create engaging content for a photo gallery post.

Original Title: {title}
Artist/Celebrity: {artist_name}

Original Content:
{text_content[:2000]}

Instructions:
1. Generate a catchy, SEO-friendly title (max 10 words)
2. Write engaging content about this photoshoot/gallery ({max_words} words max)
3. Mention the artist name naturally
4. Use professional, engaging language suitable for entertainment news
5. Format: First line should be the title, then a blank line, then the content

Output:"""

        try:
            if self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=500,
                    temperature=0.7
                )
                result = response.choices[0].message.content.strip()
            elif self.provider == 'gemini':
                response = self.client.generate_content(prompt)
                result = response.text.strip()
            elif self.provider == 'anthropic':
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=500,
                    messages=[{"role": "user", "content": prompt}]
                )
                result = response.content[0].text.strip()
            
            # Parse title and content
            lines = result.split('\n', 1)
            new_title = lines[0].strip()
            new_content = lines[1].strip() if len(lines) > 1 else ""
            
            return new_title, new_content
            
        except Exception as e:
            print(f"Error generating content: {e}")
            return title, ""

    async def _find_or_create_artist(self, artist_name: str, gallery_category: str) -> Dict:
        """Find existing artist or create new one"""
        if not artist_name or artist_name == "Unknown":
            return None
        
        # Map gallery category to entity type
        entity_type = gallery_category.lower()  # 'actor', 'actress', 'events', etc.
        
        # Search for existing artist (exact match)
        existing = crud.get_gallery_entity_by_name(db, entity_type, artist_name)
        
        if existing:
            print(f"✅ Found existing {gallery_category}: {artist_name}")
            return existing
        
        # Create new artist
        print(f"➕ Creating new {gallery_category}: {artist_name}")
        new_artist = crud.create_gallery_entity(db, entity_type, {
            "name": artist_name,
            "is_active": True
        })
        
        return new_artist

    def _generate_gallery_id(self) -> str:
        """Generate unique gallery ID"""
        timestamp = int(datetime.now().timestamp() * 1000)
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f"VIG-{timestamp}-{random_suffix}"

    async def run_gallery_agent(self, agent_id: str) -> Dict[str, Any]:
        """Run a Photo Gallery AI agent"""
        agent = crud.get_ai_agent(db, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        
        temp_dir = None
        
        try:
            # Initialize AI client and S3 service
            self._initialize_ai_client()
            self._initialize_s3_service()
            
            # Get agent configuration
            reference_urls = agent.get('reference_urls', [])
            gallery_type = agent.get('gallery_type', 'vertical')
            gallery_category = agent.get('gallery_category', 'Actress')
            tadka_pics_enabled = agent.get('tadka_pics_enabled', False)
            word_count = agent.get('word_count', '<100')
            max_images = agent.get('max_images', 50)
            
            if not reference_urls:
                raise ValueError("No reference URLs configured for this agent")
            
            # Get the first URL (support both old and new format)
            url_item = reference_urls[0]
            if isinstance(url_item, dict):
                source_url = url_item.get('url', '')
                url_type = url_item.get('url_type', 'auto')
            else:
                source_url = url_item
                url_type = 'auto'
            
            print(f"\n{'='*60}")
            print(f"🖼️ Running Photo Gallery Agent: {agent.get('agent_name')}")
            print(f"📌 Source URL: {source_url}")
            print(f"📌 URL Type: {url_type}")
            print(f"📌 Gallery Type: {gallery_type}")
            print(f"📌 Gallery Category: {gallery_category}")
            print(f"{'='*60}\n")
            
            # Step 1: Fetch the page
            html, page_title = await self._fetch_page_content(source_url)
            
            # Step 2: If listing page, find the latest gallery
            if url_type == 'listing':
                gallery_url = await self._find_latest_gallery_url(html, source_url)
                if gallery_url:
                    html, page_title = await self._fetch_page_content(gallery_url)
                    source_url = gallery_url
                else:
                    raise ValueError("Could not find any gallery links on the listing page")
            
            # Step 3: Extract artist name
            print("🔍 Extracting artist name...")
            artist_name = await self._extract_artist_name(html, page_title)
            print(f"👤 Artist identified: {artist_name}")
            
            # Step 4: Extract gallery images
            print(f"📸 Extracting gallery images (max {max_images})...")
            images = await self._extract_gallery_images(html, source_url, max_images)
            
            if not images:
                raise ValueError("No images found on the gallery page")
            
            print(f"✅ Found {len(images)} images")
            
            # Step 5: Create temp directory and download images
            temp_dir = tempfile.mkdtemp(prefix='gallery_agent_')
            print(f"📁 Downloading images to temp folder: {temp_dir}")
            
            downloaded_images = await self._download_images(images, temp_dir)
            
            if not downloaded_images:
                raise ValueError("Failed to download any images")
            
            print(f"✅ Downloaded {len(downloaded_images)} images")
            
            # Step 6: Find or create artist entity
            artist_entity = await self._find_or_create_artist(artist_name, gallery_category)
            entity_name = artist_entity.get('name', artist_name) if artist_entity else artist_name
            
            # Step 7: Generate gallery folder path (matching frontend format)
            # Format: {category}/{entity_name}/{v or h}/{number}
            # entity_name: spaces and dashes replaced with underscores
            entity_folder_name = entity_name.lower().replace(' ', '_').replace('-', '_')
            orientation_folder = 'h' if gallery_type == 'horizontal' else 'v'
            next_number = crud.get_next_gallery_number(db, gallery_category, entity_name) or 1
            folder_path = f"{gallery_category.lower()}/{entity_folder_name}/{orientation_folder}/{next_number}"
            
            print(f"📂 Gallery folder path: {folder_path}")
            
            # Step 8: Upload images to S3
            print("☁️ Uploading images to S3...")
            uploaded_images = await self._upload_images_to_s3(downloaded_images, folder_path)
            
            if not uploaded_images:
                raise ValueError("Failed to upload images to S3")
            
            print(f"✅ Uploaded {len(uploaded_images)} images to S3")
            
            # Step 9: Generate content
            print("✍️ Generating gallery content...")
            custom_prompt = agent.get('custom_prompt', '')
            new_title, new_content = await self._generate_gallery_content(html, page_title, artist_name, word_count, custom_prompt)
            print(f"📰 Generated title: {new_title}")
            
            # Step 10: Create gallery in database
            gallery_id = self._generate_gallery_id()
            
            gallery_data = {
                "gallery_id": gallery_id,
                "title": new_title,
                "artists": [entity_name],
                "images": uploaded_images,
                "gallery_type": gallery_type,
                "category_type": gallery_category,
                "entity_name": entity_name,
                "folder_path": folder_path,
                "tadka_pics_enabled": tadka_pics_enabled
            }
            
            print("💾 Creating gallery in database...")
            new_gallery = crud.create_gallery(db, gallery_data)
            print(f"✅ Gallery created with ID: {new_gallery.get('id')}")
            
            # Step 11: Create article with Photo Gallery content type
            article_status, is_published = self._get_status_from_workflow(agent.get('content_workflow', 'in_review'))
            
            article_data = {
                'title': new_title,
                'content': new_content,
                'summary': new_content[:200] if new_content else '',
                'author': 'AI Agent',
                'article_language': agent.get('article_language', 'en'),
                'states': f'["{agent.get("target_state", "all")}"]' if agent.get('target_state') else '["all"]',
                'category': agent.get('category', 'gallery'),
                'content_type': 'photo',  # Photo Gallery content type
                'image': uploaded_images[0]['url'] if uploaded_images else None,
                'gallery_id': new_gallery.get('id'),
                'artists': [entity_name],
                'is_top_story': agent.get('is_top_story', False),
                'comments_enabled': agent.get('comments_enabled', True),
                'status': article_status,
                'is_published': is_published,
                'is_scheduled': False
            }
            
            print("📝 Creating article with Photo Gallery content type...")
            article = crud.create_article(db, article_data)
            print(f"✅ Article created with ID: {article.get('id')}")
            
            return {
                "success": True,
                "gallery_id": new_gallery.get('id'),
                "article_id": article.get('id'),
                "title": new_title,
                "artist": entity_name,
                "images_count": len(uploaded_images),
                "message": f"Successfully created gallery with {len(uploaded_images)} images and article"
            }
            
        except Exception as e:
            print(f"❌ Gallery agent error: {e}")
            import traceback
            traceback.print_exc()
            raise
            
        finally:
            # Cleanup temp directory
            if temp_dir and os.path.exists(temp_dir):
                print(f"🧹 Cleaning up temp folder: {temp_dir}")
                shutil.rmtree(temp_dir, ignore_errors=True)

    def _get_status_from_workflow(self, workflow: str) -> tuple:
        """Get article status from workflow setting"""
        if workflow == 'auto_post':
            return 'published', True
        elif workflow == 'ready_to_publish':
            return 'approved', False
        else:
            return 'in_review', False


# Singleton instance
gallery_agent_runner = GalleryAgentService()
