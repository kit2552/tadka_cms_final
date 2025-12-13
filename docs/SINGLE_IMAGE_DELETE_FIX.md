# Single Image Deletion from Gallery - Fix

## Issue
When a user tries to delete a single image from within a gallery and saves the gallery, the removed images were not being deleted from S3 bucket. The images remained in S3, causing:
- Storage waste
- Orphaned files
- Inconsistency between database and S3

## Root Cause
The `update_gallery` function in `/app/backend/crud.py` did not:
1. Compare the old image list with the new image list
2. Identify which images were removed
3. Delete removed images from S3

When a user:
1. Edits a gallery
2. Deletes one or more images using the UI
3. Saves the gallery

The frontend would send the updated image list (without the deleted images) to the backend, but the backend would just update the database without cleaning up S3.

## Solution Implemented

### Backend Changes

#### 1. Updated `crud.update_gallery()` Function
**File:** `/app/backend/crud.py`

Added logic to:
- Accept `s3_service` parameter
- Fetch the current gallery from database
- Extract current image URLs into a set
- Extract new image URLs from the update data into a set
- Calculate the difference (removed images)
- Delete each removed image from S3
- Update the gallery in database

**Code Pattern:**
```python
def update_gallery(db, gallery_id: str, gallery_data: dict, s3_service=None):
    # If images are being updated, check for removed images
    if "images" in gallery_data and s3_service and s3_service.is_enabled():
        current_gallery = db[GALLERIES].find_one({"gallery_id": gallery_id})
        
        # Get current image URLs
        current_urls = set()
        for img in current_gallery.get("images", []):
            if isinstance(img, dict):
                url = img.get("url")
                if url:
                    current_urls.add(url)
            elif isinstance(img, str):
                current_urls.add(img)
        
        # Get new image URLs
        new_urls = set()
        for img in gallery_data["images"]:
            if isinstance(img, dict):
                url = img.get("url")
                if url:
                    new_urls.add(url)
            elif isinstance(img, str):
                new_urls.add(img)
        
        # Find and delete removed images
        removed_urls = current_urls - new_urls
        for url in removed_urls:
            s3_service.delete_file(url)
    
    # Update gallery in database
    db[GALLERIES].update_one(...)
```

#### 2. Updated Gallery Update Route
**File:** `/app/backend/routes/gallery_routes_mongodb.py`

Modified PUT `/api/galleries/{gallery_id}` to:
- Import `s3_service` from server
- Pass `s3_service` to `crud.update_gallery()`

## How It Works Now

### User Flow:
1. User opens gallery for editing
2. User clicks delete button on one or more images
3. Images are removed from UI (local state)
4. User clicks "Save Gallery"
5. Frontend sends updated image list to backend
6. Backend compares old vs new image lists
7. Backend deletes removed images from S3
8. Backend updates gallery in database
9. Success!

### Technical Flow:
```
Frontend (Dashboard.jsx)
  ├─ User deletes image → handleImageDelete()
  │   └─ Removes from local state
  │
  └─ User saves gallery → handleGallerySubmit()
      └─ PUT /api/galleries/{gallery_id}
          └─ Backend receives new image list
              │
              └─ crud.update_gallery()
                  ├─ Fetches current gallery
                  ├─ Compares image URLs
                  ├─ Deletes removed images from S3 ✅
                  └─ Updates database
```

## Testing Recommendations

1. **Create a test gallery** with multiple images
2. **Edit the gallery** and remove one image
3. **Save the gallery**
4. **Verify:**
   - Gallery shows correct images in CMS ✅
   - Database has updated image list ✅
   - Removed image is deleted from S3 ✅
   - Remaining images are intact in S3 ✅

## Edge Cases Handled

1. **Mixed image formats:** Handles both dict `{"url": "..."}` and string `"https://..."` formats
2. **S3 disabled:** If S3 is not enabled, only database is updated (no errors)
3. **S3 deletion failures:** Logged but don't prevent database update
4. **All images removed:** All images deleted from S3, gallery updated with empty list
5. **No images changed:** No S3 operations performed

## Files Modified
1. `/app/backend/crud.py` - Line 1298-1362 (update_gallery function)
2. `/app/backend/routes/gallery_routes_mongodb.py` - Line 114-145 (PUT /galleries/{gallery_id})

## Related Fixes
This fix works in conjunction with:
- Gallery deletion fix (deletes all images when gallery is deleted)
- Article deletion fix (deletes article images)
- Theater/OTT release deletion fixes

## Status
✅ **Fixed** - Backend restarted successfully, ready for testing
