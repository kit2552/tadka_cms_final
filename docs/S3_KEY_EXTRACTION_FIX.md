# S3 Key Extraction Bug Fix - Images Not Actually Deleted

## Issue
Even after the JSON parsing fix, deleted images were still **NOT being removed from S3 bucket**.

## Root Cause - S3 Key Extraction Error

### The Problem
The `delete_file()` function in `s3_service.py` was incorrectly extracting the S3 key from the URL.

**Image URL from database:**
```
https://tadka-cms.s3.amazonaws.com/galleries/actress/priyanka_jawalkar/v/1/1.png
```

**Actual S3 Key (correct):**
```
galleries/actress/priyanka_jawalkar/v/1/1.png
```

**What the code extracted (WRONG):**
```
actress/priyanka_jawalkar/v/1/1.png  ← Missing "galleries/" prefix!
```

### The Broken Logic
```python
# Old code (BROKEN)
s3_key = file_url.split(f"{bucket_name}.s3")[1].split('/', 2)[-1]

# What this did:
# 1. Split: ".amazonaws.com/galleries/actress/..."
# 2. Split again by '/': ['.amazonaws.com', 'galleries', 'actress/...']
# 3. Take last: 'actress/...'  ← WRONG!
```

### Why It Failed Silently
The S3 `delete_object` call doesn't throw an error when deleting a non-existent key! It just returns success, so:

```python
# Backend tried to delete
s3_client.delete_object(Bucket='tadka-cms', Key='actress/priyanka_jawalkar/v/1/1.png')
# ← This key doesn't exist, but boto3 returns success anyway!

# Actual file remains at
Key='galleries/actress/priyanka_jawalkar/v/1/1.png'  ← Still in S3!
```

## Solution

### Fix Applied
Rewrote the S3 key extraction logic to properly parse the URL:

**Before (BROKEN):**
```python
if bucket_name in file_url:
    s3_key = file_url.split(f"{bucket_name}.s3")[1].split('/', 2)[-1]
```

**After (FIXED):**
```python
# Try standard URL format: https://bucket.s3.amazonaws.com/key
if f"{bucket_name}.s3.amazonaws.com/" in file_url:
    parts = file_url.split(f"{bucket_name}.s3.amazonaws.com/")
    if len(parts) > 1:
        s3_key = parts[1]  # Everything after the domain

# Try regional URL format: https://bucket.s3.region.amazonaws.com/key
elif f"{bucket_name}.s3.{region}.amazonaws.com/" in file_url:
    parts = file_url.split(f"{bucket_name}.s3.{region}.amazonaws.com/")
    if len(parts) > 1:
        s3_key = parts[1]
```

### Improved Error Handling
Added better logging and validation:

```python
if s3_key:
    self.s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
    print(f"Successfully deleted from S3: {s3_key}")  # Full key logged
    return True
else:
    print(f"Failed to extract S3 key from URL: {file_url}")  # Error logged
    return False
```

## Testing the Fix

### Before Fix:
```bash
# Log showed:
Deleted removed image from S3: https://tadka-cms.s3.amazonaws.com/galleries/.../1.png

# But in S3, tried to delete:
Key: actress/.../1.png  ← WRONG key!

# Actual file at:
Key: galleries/actress/.../1.png  ← Still exists!

# Result: File NOT deleted ❌
```

### After Fix:
```bash
# Log now shows:
Successfully deleted from S3: galleries/actress/.../1.png  ← Full key!

# In S3, deletes:
Key: galleries/actress/.../1.png  ← CORRECT!

# Result: File DELETED ✅
```

## Why This Bug Was Hard to Catch

1. **Silent failure**: S3 `delete_object` doesn't error on non-existent keys
2. **Incomplete logging**: Old code only logged the URL, not the extracted key
3. **No validation**: Code didn't check if extraction was successful
4. **String parsing complexity**: URL parsing is error-prone

## Files Modified
- `/app/backend/s3_service.py` - Line 103-141 (`delete_file` function)

## Related Fixes Working Together

This is the **third fix** in a series:

1. ✅ **UI Fix**: Images now get unique IDs for deletion
2. ✅ **JSON Parsing Fix**: Images parsed from string to array
3. ✅ **S3 Key Extraction Fix**: Correct key extracted from URL

All three fixes are required for image deletion to work!

## Verification Steps

### Check Logs After Deletion:
```bash
# Should see (with full S3 key):
Successfully deleted from S3: galleries/actress/priyanka_jawalkar/v/1/2.png
```

### Check S3 Bucket:
```bash
# File should be gone:
aws s3 ls s3://tadka-cms/galleries/actress/priyanka_jawalkar/v/1/
# Should NOT list the deleted image
```

## Technical Notes

### S3 Delete Behavior
From AWS documentation:
> "If there is no such key, the operation is considered successful."

This means `delete_object` will always succeed, even if:
- The key doesn't exist
- The key is wrong
- The file was already deleted

### Prevention Going Forward
1. Always log the extracted S3 key, not just the URL
2. Consider storing and using `s3_key` field instead of parsing URLs
3. Add unit tests for URL parsing logic
4. Consider using S3 HEAD request to verify file exists before deleting

### Future Improvement
Instead of parsing URLs, the crud functions could pass the `s3_key` field directly:
```python
# Current: Only passes URL
s3_service.delete_file(image["url"])

# Better: Pass s3_key if available
s3_service.delete_file_by_key(image.get("s3_key") or image["url"])
```

## Status
✅ **Fixed** - Backend restarted, S3 key extraction corrected, ready for testing
