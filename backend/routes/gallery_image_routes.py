from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
import os
import re

router = APIRouter()

@router.get("/api/cms/gallery-next-image-number")
async def get_next_image_number(folder_path: str):
    """Get the next available image number in a gallery folder"""
    from server import s3_service
    
    try:
        if s3_service.is_enabled():
            # S3 implementation
            prefix = f"galleries/{folder_path}/"
            objects = s3_service.list_objects(prefix=prefix)
            
            # Extract numbers from filenames
            numbers = []
            for obj in objects:
                filename = obj['Key'].split('/')[-1]
                # Extract number from filename (e.g., "1.jpg" -> 1)
                match = re.match(r'^(\d+)\.[a-zA-Z]+$', filename)
                if match:
                    numbers.append(int(match.group(1)))
            
            # Find the next number
            next_number = max(numbers) + 1 if numbers else 1
            return {"next_number": next_number, "current_count": len(numbers)}
        else:
            # Local storage implementation
            local_path = f"/app/frontend/public/uploads/galleries/{folder_path}"
            os.makedirs(local_path, exist_ok=True)
            
            # Get all image files
            files = os.listdir(local_path) if os.path.exists(local_path) else []
            
            # Extract numbers from filenames
            numbers = []
            for filename in files:
                match = re.match(r'^(\d+)\.[a-zA-Z]+$', filename)
                if match:
                    numbers.append(int(match.group(1)))
            
            # Find the next number
            next_number = max(numbers) + 1 if numbers else 1
            return {"next_number": next_number, "current_count": len(numbers)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get next image number: {str(e)}")

@router.post("/api/cms/renumber-gallery-images")
async def renumber_gallery_images(folder_path: str = Form(...)):
    """Renumber all images in a gallery folder to be sequential (1, 2, 3, etc.)"""
    from server import s3_service
    
    try:
        if s3_service.is_enabled():
            # S3 implementation
            prefix = f"galleries/{folder_path}/"
            objects = s3_service.list_objects(prefix=prefix)
            
            # Get all image objects with their numbers
            images = []
            for obj in objects:
                filename = obj['Key'].split('/')[-1]
                match = re.match(r'^(\d+)\.([a-zA-Z]+)$', filename)
                if match:
                    images.append({
                        'key': obj['Key'],
                        'number': int(match.group(1)),
                        'extension': match.group(2),
                        'size': obj.get('Size', 0)
                    })
            
            # Sort by current number
            images.sort(key=lambda x: x['number'])
            
            # Renumber sequentially
            renamed_count = 0
            for idx, img in enumerate(images, start=1):
                old_key = img['key']
                new_filename = f"{idx}.{img['extension']}"
                new_key = f"galleries/{folder_path}/{new_filename}"
                
                # Only rename if the number changed
                if img['number'] != idx:
                    # Copy to new name
                    s3_service.copy_object(old_key, new_key)
                    # Delete old
                    s3_service.delete_object(old_key)
                    renamed_count += 1
            
            return {
                "success": True,
                "message": f"Renumbered {renamed_count} images",
                "total_images": len(images)
            }
        else:
            # Local storage implementation
            local_path = f"/app/frontend/public/uploads/galleries/{folder_path}"
            
            if not os.path.exists(local_path):
                raise HTTPException(status_code=404, detail="Gallery folder not found")
            
            # Get all image files
            files = os.listdir(local_path)
            
            # Get all images with their numbers
            images = []
            for filename in files:
                match = re.match(r'^(\d+)\.([a-zA-Z]+)$', filename)
                if match:
                    images.append({
                        'filename': filename,
                        'number': int(match.group(1)),
                        'extension': match.group(2)
                    })
            
            # Sort by current number
            images.sort(key=lambda x: x['number'])
            
            # Renumber sequentially
            renamed_count = 0
            for idx, img in enumerate(images, start=1):
                old_path = os.path.join(local_path, img['filename'])
                new_filename = f"{idx}.{img['extension']}"
                new_path = os.path.join(local_path, new_filename)
                
                # Only rename if the number changed
                if img['number'] != idx:
                    # Use a temp name to avoid conflicts
                    temp_path = os.path.join(local_path, f"temp_{idx}.{img['extension']}")
                    os.rename(old_path, temp_path)
                    os.rename(temp_path, new_path)
                    renamed_count += 1
            
            return {
                "success": True,
                "message": f"Renumbered {renamed_count} images",
                "total_images": len(images)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to renumber images: {str(e)}")
