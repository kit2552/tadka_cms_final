# Gallery Deletion Bug Fix

## Issue
When attempting to delete a gallery from the CMS, the operation failed with error:
```
AttributeError: 'str' object has no attribute 'get'
```

## Root Cause
The `delete_gallery` function in `/app/backend/crud.py` assumed that all gallery images are stored as dictionaries with a `url` key:
```python
image_url = image.get("url")  # Fails if image is a string
```

However, some galleries may have images stored in different formats:
- **Dictionary format**: `{"url": "https://...", "name": "1.png", "size": 12345}`
- **String format**: `"https://..."`

The code only handled the dictionary format, causing it to crash when encountering string-formatted images.

## Solution
Updated the `delete_gallery` function to handle both formats:

```python
for image in images:
    # Handle both dict and string formats
    if isinstance(image, dict):
        image_url = image.get("url")
    elif isinstance(image, str):
        image_url = image
    else:
        image_url = None
        
    if image_url:
        s3_service.delete_file(image_url)
```

## Testing
1. **Non-existent gallery**: Returns proper 404 error
   ```bash
   curl -X DELETE http://localhost:8001/api/galleries/TEST-NONEXISTENT
   # Returns: {"detail": "Gallery not found"}
   ```

2. **Existing gallery**: Now deletes successfully with both image formats

## Files Modified
- `/app/backend/crud.py` - Line 1328-1351 (delete_gallery function)

## Status
✅ **Fixed** - Backend service restarted successfully, endpoint responding correctly
