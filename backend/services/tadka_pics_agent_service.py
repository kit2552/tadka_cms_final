"""
Tadka Pics Agent Service
Handles execution of AI agents to create Tadka Pics galleries from Websites or Instagram
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
from urllib.parse import urljoin, urlparse, unquote
from database import db
import crud


class TadkaPicsAgentService:
    """Service to run Tadka Pics AI agents"""
    
    def __init__(self):
        self.s3_service = None
        
    def _initialize_s3_service(self):
        """Initialize S3 service using existing s3_service from server"""
        from s3_service import s3_service
        
        aws_config = crud.get_aws_config(db)
        if not aws_config:
            raise ValueError("AWS configuration not found. Please configure S3 in System Settings.")
        
        if not s3_service.is_enabled():
            s3_service.initialize(aws_config)
        
        if not s3_service.is_enabled():
            raise ValueError("S3 service is not enabled. Please check AWS configuration.")
        
        self.s3_service = s3_service
        print(f"✅ S3 service initialized")

    async def _extract_instagram_images(self, urls: List[str], content_type: str = 'photos') -> List[Dict]:
        """Extract images from Instagram post URLs
        
        Args:
            urls: List of Instagram post/reel URLs
            content_type: 'photos' or 'reels'
        
        Returns:
            List of image dictionaries with 'url' key
        """
        all_images = []
        seen_urls = set()
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            for url in urls:
                if not url:
                    continue
                
                # Clean and get direct post URL
                direct_url = self._get_direct_url(url)
                if not direct_url:
                    print(f"❌ Could not parse Instagram URL: {url}")
                    continue
                
                print(f"📸 Fetching Instagram post: {direct_url}")
                
                try:
                    # Fetch the direct post page using Googlebot UA to get pre-rendered content
                    # Instagram serves SEO-friendly content to crawlers with images
                    response = await client.get(direct_url, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                    })
                    
                    if response.status_code != 200:
                        print(f"❌ Failed to fetch post page: {response.status_code}")
                        continue
                    
                    html = response.text
                    
                    # Extract images from meta tags (og:image and twitter:image)
                    images = self._parse_instagram_meta_tags(html, content_type)
                    
                    for img in images:
                        # Normalize URL for deduplication
                        normalized = self._normalize_instagram_url(img['url'])
                        if normalized not in seen_urls:
                            seen_urls.add(normalized)
                            all_images.append(img)
                            print(f"   📷 Found image: {img['url'][:80]}...")
                    
                except Exception as e:
                    print(f"❌ Error fetching Instagram post: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
        
        print(f"📊 Found {len(all_images)} unique Instagram images")
        return all_images

    def _get_direct_url(self, url: str) -> Optional[str]:
        """Convert Instagram URL to direct post URL"""
        # Clean up URL
        url = url.strip()
        
        # Remove embed suffix if present
        url = url.replace('/embed/', '/').replace('/embed', '/')
        
        # Extract shortcode from various URL formats
        patterns = [
            r'instagram\.com/p/([A-Za-z0-9_-]+)',      # Post
            r'instagram\.com/reel/([A-Za-z0-9_-]+)',   # Reel
            r'instagram\.com/reels/([A-Za-z0-9_-]+)',  # Reels alternate
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                shortcode = match.group(1)
                return f"https://www.instagram.com/p/{shortcode}/"
        
        return None
    
    def _get_embed_url(self, url: str) -> Optional[str]:
        """Convert Instagram URL to embed URL (for extracting artist name)"""
        direct_url = self._get_direct_url(url)
        if direct_url:
            return direct_url.rstrip('/') + '/embed/'
        return None

    def _normalize_instagram_url(self, url: str) -> str:
        """Normalize Instagram image URL for deduplication"""
        # Extract the unique image ID from the URL
        match = re.search(r'/([0-9]+_[0-9]+_[0-9]+_n\.jpg)', url)
        if match:
            return match.group(1)
        
        # Try alternate pattern for newer URLs
        match = re.search(r'/(\d+_\d+_\d+_n)\.(jpg|webp)', url)
        if match:
            return match.group(1)
        
        # Fallback: remove size parameters and use base URL
        url = re.sub(r'\?.*$', '', url)
        url = re.sub(r'_s\d+x\d+', '', url)
        return url
    
    def _parse_instagram_meta_tags(self, html: str, content_type: str) -> List[Dict]:
        """Parse Instagram page HTML to extract image URLs from meta tags
        
        Instagram now renders images via JavaScript, but meta tags still contain
        preview images that we can use.
        """
        images = []
        seen_urls = set()
        
        # Extract from og:image meta tag
        og_patterns = [
            r'<meta[^>]*property="og:image"[^>]*content="([^"]+)"',
            r'<meta[^>]*content="([^"]+)"[^>]*property="og:image"',
        ]
        
        for pattern in og_patterns:
            matches = re.findall(pattern, html)
            for url in matches:
                url = url.replace('&amp;', '&')
                if url not in seen_urls and 'cdninstagram' in url:
                    seen_urls.add(url)
                    images.append({'url': url})
        
        # Extract from twitter:image meta tag
        twitter_patterns = [
            r'<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"',
            r'<meta[^>]*content="([^"]+)"[^>]*name="twitter:image"',
        ]
        
        for pattern in twitter_patterns:
            matches = re.findall(pattern, html)
            for url in matches:
                url = url.replace('&amp;', '&')
                if url not in seen_urls and 'cdninstagram' in url:
                    seen_urls.add(url)
                    images.append({'url': url})
        
        # Also try to find any scontent CDN URLs in the page
        cdn_pattern = r'https://scontent[^"\s<>]+cdninstagram\.com[^"\s<>]+\.(?:jpg|jpeg|webp)[^"\s<>]*'
        cdn_matches = re.findall(cdn_pattern, html)
        for url in cdn_matches:
            url = url.replace('&amp;', '&')
            # Skip very small thumbnails and profile pics
            if 's150x150' in url or 's75x75' in url or 's100x100' in url:
                continue
            if url not in seen_urls:
                seen_urls.add(url)
                images.append({'url': url})
        
        return images

    def _parse_instagram_embed(self, html: str, content_type: str) -> List[Dict]:
        """Parse Instagram embed HTML to extract image URLs"""
        images = []
        
        # Find all image URLs from cdninstagram.com
        # Look for high-resolution versions (1080 or larger)
        pattern = r'https://scontent[^"]*?cdninstagram\.com[^"]*?\.jpg[^"]*'
        matches = re.findall(pattern, html)
        
        seen_image_ids = set()
        
        for match in matches:
            # Clean up the URL (unescape HTML entities)
            url = match.replace('&amp;', '&')
            
            # Skip profile pictures (s150x150)
            if 's150x150' in url and 'profile' in url.lower():
                continue
            
            # Skip very small thumbnails
            if '_s75x75' in url or '_s100x100' in url:
                continue
            
            # Extract image ID to avoid duplicates of different sizes
            id_match = re.search(r'/(\d+)_\d+_\d+_n\.jpg', url)
            if id_match:
                image_id = id_match.group(1)
                if image_id in seen_image_ids:
                    continue
                seen_image_ids.add(image_id)
            
            # Prefer larger versions
            # Check if this is a high-res version (1080 or similar)
            if 'p1080x1080' in url or 'e35_p' not in url or 'p750x750' in url:
                images.append({'url': url})
        
        return images

    async def _download_images(self, images: List[Dict], temp_dir: str) -> List[Dict]:
        """Download images to temp directory"""
        downloaded = []
        MIN_IMAGE_SIZE = 10 * 1024  # 10KB minimum
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            for i, img in enumerate(images):
                try:
                    url = img['url']
                    print(f"⬇️ Downloading image {i+1}/{len(images)}...")
                    
                    response = await client.get(url, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    
                    if response.status_code == 200:
                        file_size = len(response.content)
                        
                        if file_size < MIN_IMAGE_SIZE:
                            print(f"⏭️ Skipping small image ({file_size} bytes)")
                            continue
                        
                        # Determine extension
                        content_type = response.headers.get('content-type', '')
                        ext = '.jpg'
                        if 'png' in content_type:
                            ext = '.png'
                        elif 'webp' in content_type:
                            ext = '.webp'
                        
                        filename = f"image_{len(downloaded)+1:03d}{ext}"
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
                        
                except Exception as e:
                    print(f"❌ Error downloading: {e}")
                    continue
        
        return downloaded

    async def _upload_images_to_s3(self, images: List[Dict], folder_path: str) -> List[Dict]:
        """Upload images to S3"""
        uploaded = []
        galleries_root = self.s3_service.config.get('galleries_root_folder', 'galleries')
        
        for i, img in enumerate(images):
            try:
                local_path = img['local_path']
                ext = os.path.splitext(img['filename'])[1].lower()
                image_number = i + 1
                new_filename = f"{image_number}{ext}"
                
                s3_key = f"{galleries_root}/{folder_path}/{new_filename}"
                
                content_types = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.webp': 'image/webp',
                }
                content_type = content_types.get(ext, 'image/jpeg')
                
                print(f"☁️ Uploading to S3: {s3_key}")
                
                with open(local_path, 'rb') as f:
                    file_content = f.read()
                
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
                    
            except Exception as e:
                print(f"❌ Error uploading: {e}")
                continue
        
        return uploaded

    def _generate_gallery_id(self) -> str:
        """Generate unique gallery ID"""
        timestamp = int(datetime.now().timestamp() * 1000)
        random_suffix = uuid.uuid4().hex[:6].upper()
        return f"TDK-{timestamp}-{random_suffix}"

    async def _extract_artist_name_from_instagram(self, html: str) -> str:
        """Extract artist name from Instagram page HTML
        
        Looks for patterns in meta tags and page content like:
        - og:title: "Name on Instagram: caption..."
        - "A post shared by Pragya Jaiswal (@jaiswalpragya)"
        - "shared by Name Here (@username)"
        """
        import html as html_module
        
        # Try to extract from og:title meta tag
        # Format: "Name on Instagram: caption..."
        og_title_patterns = [
            r'<meta[^>]*property="og:title"[^>]*content="([^"]+)"',
            r'<meta[^>]*content="([^"]+)"[^>]*property="og:title"',
        ]
        
        for pattern in og_title_patterns:
            match = re.search(pattern, html)
            if match:
                title = html_module.unescape(match.group(1))
                # Extract name before "on Instagram"
                name_match = re.match(r'^([^@]+?)\s+(?:on Instagram|&#x2605;|★)', title)
                if name_match:
                    name = name_match.group(1).strip()
                    # Clean up any remaining HTML entities
                    name = html_module.unescape(name)
                    if name and len(name) > 1:
                        print(f"👤 Extracted artist name from og:title: {name}")
                        return name
        
        # Try to find the actual name from "shared by Name (@username)" pattern
        # This gives us the real name, not just the username
        match = re.search(r'shared by ([^(]+)\s*\(@', html)
        if match:
            name = match.group(1).strip()
            if name:
                print(f"👤 Extracted artist name: {name}")
                return name
        
        # Fallback: Try to get name from "by Name Here" pattern
        match = re.search(r'by\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', html)
        if match:
            name = match.group(1).strip()
            if name and len(name) > 2:
                print(f"👤 Extracted artist name (fallback): {name}")
                return name
        
        # Last fallback: Use username without @
        match = re.search(r'@([a-zA-Z0-9_.]+)', html)
        if match:
            username = match.group(1)
            # Convert username to title case for display
            name = username.replace('_', ' ').replace('.', ' ').title()
            print(f"👤 Using username as name: {name}")
            return name
        
        return "Unknown"

    async def run_tadka_pics_agent(self, agent_id: str) -> Dict[str, Any]:
        """Run a Tadka Pics AI agent"""
        agent = crud.get_ai_agent(db, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        
        temp_dir = None
        
        try:
            self._initialize_s3_service()
            
            # Get agent configuration
            source_type = agent.get('source_type', 'websites')  # 'websites' or 'instagram'
            instagram_content_type = agent.get('instagram_content_type', 'photos')  # 'photos' or 'reels'
            gallery_category = agent.get('gallery_category', 'Actress')
            max_images = agent.get('max_images', 50)
            
            print(f"\n{'='*60}")
            print(f"🌟 Running Tadka Pics Agent: {agent.get('agent_name')}")
            print(f"📌 Source Type: {source_type}")
            print(f"📌 Gallery Category: {gallery_category}")
            print(f"{'='*60}\n")
            
            images = []
            artist_name = "Unknown"
            gallery_title = agent.get('agent_name', 'Tadka Pics Gallery')
            
            if source_type == 'instagram':
                # Get Instagram URLs
                instagram_urls = agent.get('instagram_urls', [])
                if not instagram_urls:
                    raise ValueError("No Instagram URLs configured")
                
                # Extract URLs from the list (handle both string and dict formats)
                url_list = []
                for item in instagram_urls:
                    if isinstance(item, str):
                        url_list.append(item)
                    elif isinstance(item, dict):
                        url_list.append(item.get('url', ''))
                
                print(f"📸 Processing {len(url_list)} Instagram URLs...")
                images = await self._extract_instagram_images(url_list, instagram_content_type)
                
                # Try to get artist name from the direct page (has better metadata)
                if url_list:
                    direct_url = self._get_direct_url(url_list[0])
                    if direct_url:
                        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                            response = await client.get(direct_url, headers={
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            })
                            if response.status_code == 200:
                                artist_name = await self._extract_artist_name_from_instagram(response.text)
                                gallery_title = f"{artist_name} Instagram Photos"
                
            else:
                # Website source - use same logic as Photo Gallery Agent
                from services.gallery_agent_service import gallery_agent_runner
                
                reference_urls = agent.get('reference_urls', [])
                if not reference_urls:
                    raise ValueError("No reference URLs configured")
                
                # Get the first URL
                url_item = reference_urls[0]
                if isinstance(url_item, dict):
                    source_url = url_item.get('url', '')
                    url_type = url_item.get('url_type', 'auto')
                else:
                    source_url = url_item
                    url_type = 'auto'
                
                print(f"🌐 Processing website: {source_url}")
                
                # Fetch page
                html, page_title = await gallery_agent_runner._fetch_page_content(source_url)
                
                # Check if listing page
                is_listing_page = url_type == 'listing'
                if url_type == 'auto':
                    listing_indicators = ['/category/', '/photos', '/galleries', '/albums']
                    has_gallery_id = bool(re.search(r'/\d{5,}/', source_url))
                    if any(ind in source_url.lower() for ind in listing_indicators) and not has_gallery_id:
                        is_listing_page = True
                
                if is_listing_page:
                    gallery_url = await gallery_agent_runner._find_latest_gallery_url(html, source_url)
                    if gallery_url:
                        html, page_title = await gallery_agent_runner._fetch_page_content(gallery_url)
                        source_url = gallery_url
                
                # Extract images
                images = await gallery_agent_runner._extract_gallery_images(html, source_url, max_images)
                
                # Extract artist name
                artist_name = await gallery_agent_runner._extract_artist_name(html, page_title)
                gallery_title = page_title or f"{artist_name} Gallery"
            
            if not images:
                raise ValueError("No images found")
            
            print(f"✅ Found {len(images)} images")
            
            # Download images
            temp_dir = tempfile.mkdtemp(prefix='tadka_pics_')
            downloaded_images = await self._download_images(images, temp_dir)
            
            if not downloaded_images:
                raise ValueError("Failed to download any images")
            
            # Generate folder path
            entity_folder_name = artist_name.lower().replace(' ', '_').replace('-', '_').replace('@', '')
            next_number = crud.get_next_gallery_number(db, gallery_category, artist_name) or 1
            folder_path = f"tadka_pics/{entity_folder_name}/v/{next_number}"
            
            # Upload to S3
            print("☁️ Uploading images to S3...")
            uploaded_images = await self._upload_images_to_s3(downloaded_images, folder_path)
            
            if not uploaded_images:
                raise ValueError("Failed to upload images to S3")
            
            # Create gallery (Tadka Pics enabled)
            gallery_id = self._generate_gallery_id()
            
            gallery_data = {
                "gallery_id": gallery_id,
                "title": gallery_title,
                "artists": [artist_name],
                "images": uploaded_images,
                "gallery_type": "vertical",  # Always vertical for Tadka Pics
                "category_type": gallery_category,
                "entity_name": artist_name,
                "folder_path": folder_path,
                "tadka_pics_enabled": True,  # Always enabled for Tadka Pics
                "source_type": source_type
            }
            
            print("💾 Creating Tadka Pics gallery...")
            new_gallery = crud.create_gallery(db, gallery_data)
            print(f"✅ Gallery created with ID: {new_gallery.get('id')}")
            
            return {
                "success": True,
                "gallery_id": new_gallery.get('id'),
                "title": gallery_title,
                "artist": artist_name,
                "images_count": len(uploaded_images),
                "message": f"Successfully created Tadka Pics gallery with {len(uploaded_images)} images"
            }
            
        except Exception as e:
            print(f"❌ Tadka Pics agent error: {e}")
            import traceback
            traceback.print_exc()
            raise
            
        finally:
            if temp_dir and os.path.exists(temp_dir):
                print(f"🧹 Cleaning up temp folder")
                shutil.rmtree(temp_dir, ignore_errors=True)


# Singleton instance
tadka_pics_agent_runner = TadkaPicsAgentService()
