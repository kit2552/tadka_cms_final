# Test Results

## Tadka Pics Agent Testing

### Features to Test
1. Instagram URL parsing - accept both URLs and embed codes
2. Image extraction from Instagram carousel posts
3. Artist name extraction from Instagram embed page
4. Gallery creation with tadka_pics_enabled=true
5. NO article creation (gallery only)
6. Frontend form accepts both URLs and embed codes

### Test URLs
- https://www.instagram.com/p/DI3wfP7sN1d/?hl=en (Disha Patani - 3 images carousel)
- https://www.instagram.com/p/DR7BBFTEfI1/ (Priyanka Jawalkar - carousel)

### Expected Behavior
- Should extract all carousel images (not "More posts" section images)
- Should extract artist name from og:title or username
- Should create gallery with tadka_pics_enabled=true
- Should NOT create any article/post
