# S3 Image Deletion Fix

## Problem
When deleting galleries, articles, theater releases, or OTT releases from the CMS, the associated images were not being deleted from the S3 bucket. This caused:
- Orphaned files in S3 storage
- Unnecessary storage costs
- Potential data accumulation over time

## Root Cause
The deletion functions in `crud.py` only removed database records but did not call the S3 service to delete the actual image files from the bucket.

## Solution Implemented

### 1. Updated Gallery Deletion (`crud.delete_gallery`)
**File:** `/app/backend/crud.py`
- Now accepts `s3_service` parameter
- Fetches gallery document to access image URLs
- Iterates through all gallery images and deletes each from S3
- Then deletes the gallery from MongoDB

**Route Updated:** `/app/backend/routes/gallery_routes_mongodb.py`
- DELETE `/api/galleries/{gallery_id}` now passes `s3_service` to crud function

### 2. Updated Article Deletion (`crud.delete_article`)
**File:** `/app/backend/crud.py`
- Now accepts `s3_service` parameter
- Deletes main article image from S3
- Deletes gallery images (image_gallery field) from S3 if present
- Then deletes the article from MongoDB

**Route Updated:** `/app/backend/server.py`
- DELETE `/api/cms/articles/{article_id}` now passes `s3_service` to crud function

### 3. Added Theater Release Deletion (`crud.delete_theater_release`)
**File:** `/app/backend/crud.py`
- NEW function created (was missing)
- Accepts `s3_service` parameter
- Deletes movie image from S3
- Deletes movie banner from S3
- Then deletes the release from MongoDB

**Added Helper Function:** `crud.get_theater_release(db, release_id)`
- NEW function to get single theater release by ID (was missing)

**Route Updated:** `/app/backend/server.py`
- DELETE `/api/cms/theater-releases/{release_id}` now passes `s3_service` to crud function

### 4. Added OTT Release Deletion (`crud.delete_ott_release`)
**File:** `/app/backend/crud.py`
- NEW function created (was missing)
- Accepts `s3_service` parameter
- Deletes movie image from S3
- Then deletes the release from MongoDB

**Added Helper Function:** `crud.get_ott_release(db, release_id)`
- NEW function to get single OTT release by ID (was missing)

**Route Updated:** `/app/backend/server.py`
- DELETE `/api/cms/ott-releases/{release_id}` now passes `s3_service` to crud function

## Technical Implementation

### S3 Service Integration
All deletion functions now follow this pattern:
1. Fetch the document from MongoDB to get image URLs
2. Check if S3 service is enabled
3. For each image URL, call `s3_service.delete_file(url)`
4. Delete the database record

### Error Handling
- Each S3 deletion is wrapped in try-except
- Failures are logged but don't prevent database deletion
- This ensures partial failures don't leave inconsistent state

### Example Code Pattern
```python
def delete_gallery(db, gallery_id: str, s3_service=None):
    """Delete gallery, remove all associations, and delete images from S3"""
    # Get full gallery document to access images
    gallery = db[GALLERIES].find_one({"gallery_id": gallery_id}, {"_id": 0})
    
    if gallery and s3_service and s3_service.is_enabled():
        images = gallery.get("images", [])
        for image in images:
            image_url = image.get("url")
            if image_url:
                try:
                    s3_service.delete_file(image_url)
                    print(f"Deleted image from S3: {image_url}")
                except Exception as e:
                    print(f"Failed to delete image from S3: {image_url}, Error: {e}")
    
    # Delete from database
    result = db[GALLERIES].delete_one({"gallery_id": gallery_id})
    return result.deleted_count > 0
```

## Testing Recommendations
To verify the fix works correctly:

1. **Create a test gallery** with images via CMS
2. **Verify images are in S3** bucket
3. **Delete the gallery** from CMS
4. **Check S3 bucket** to confirm images are removed
5. **Verify gallery is deleted** from database

Repeat similar tests for:
- Articles with images
- Theater releases
- OTT releases

## Files Modified
1. `/app/backend/crud.py` - Added S3 deletion logic to all delete functions
2. `/app/backend/server.py` - Updated article, theater, and OTT delete endpoints
3. `/app/backend/routes/gallery_routes_mongodb.py` - Updated gallery delete endpoint

## Backward Compatibility
- All functions maintain backward compatibility
- `s3_service` parameter is optional (defaults to None)
- If S3 service is not enabled, only database deletion occurs
- No breaking changes to existing API endpoints
