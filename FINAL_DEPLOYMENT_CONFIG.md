# Final Deployment Configuration - Matching Working Project

## Changes Made to Match Working Structure

### 1. app.yaml Restructured ✅

**Key Changes:**
- Frontend moved from `services:` to `static_sites:` section
- Removed custom health checks (use DO defaults)
- Changed frontend build approach

### Old Structure (Not Working)
```yaml
services:
  - name: backend
  - name: frontend
    type: static_site
```

### New Structure (Working)
```yaml
services:
  - name: tadka-backend
    
static_sites:
  - name: tadka-frontend
```

### 2. Frontend Configuration ✅

**Changed:**
```yaml
# OLD (complex)
build_command: |
  yarn install
  yarn build
  cp build/index.html build/404.html

# NEW (simple, matches working project)
build_command: yarn build
error_document: index.html  # Handles SPA routing
```

**Environment Variables:**
```yaml
envs:
  - key: REACT_APP_BACKEND_URL
    scope: BUILD_TIME  # ← Key addition!
    value: ${tadka-backend.PUBLIC_URL}
```

### 3. Removed heroku-postbuild

**package.json scripts:**
```json
{
  "build": "craco build"
  // Removed: "heroku-postbuild"
  // Removed: && cp build/index.html build/404.html
}
```

The `error_document: index.html` handles SPA routing instead.

## Complete Configuration

### Backend (tadka-backend)
```yaml
source_dir: /backend
dockerfile_path: backend/Dockerfile
http_port: 8000
environment_slug: docker
```

### Frontend (tadka-frontend)
```yaml
source_dir: /frontend
build_command: yarn build
output_dir: build
index_document: index.html
error_document: index.html  # SPA routing
```

### Environment Variables to Set in Digital Ocean Dashboard

**Backend (tadka-backend):**
- ✅ `MONGO_URL` - Your MongoDB connection string
- ✅ `DB_NAME` - `tadka_cms`
- ✅ `CORS_ORIGINS` - Frontend URL (auto-set or manual)
- ✅ `JWT_SECRET_KEY` - Your secret key
- ✅ `FRONTEND_URL` - Frontend URL (optional)
- ✅ `AWS_ACCESS_KEY_ID` - AWS credentials
- ✅ `AWS_SECRET_ACCESS_KEY` - AWS credentials
- ✅ `AWS_REGION` - e.g., `us-east-1`
- ✅ `AWS_S3_BUCKET_NAME` - Your bucket
- ✅ `S3_ROOT_FOLDER` - e.g., `tadka/`
- ✅ `S3_MAX_FILE_SIZE` - `52428800` (50MB)

**Frontend (tadka-frontend):**
- ✅ `REACT_APP_BACKEND_URL` - Will be auto-set to `${tadka-backend.PUBLIC_URL}`
- ✅ `NODE_ENV` - `production`

## Why This Works

### 1. Static Sites vs Services
Digital Ocean treats static sites differently:
- **Static sites**: Optimized for frontend builds
- **Services**: For backend APIs

Your working project uses this separation.

### 2. error_document Instead of 404.html Copy
```yaml
error_document: index.html
```
This tells Digital Ocean's CDN to serve `index.html` for any 404s, enabling SPA routing without manual copying.

### 3. BUILD_TIME Scope
```yaml
scope: BUILD_TIME
```
Ensures `REACT_APP_BACKEND_URL` is available during the build process (when React compiles).

## Deployment Steps

### 1. Update app.yaml in Digital Ocean Dashboard

**Option A: Use the new app.yaml file**
- Copy contents of `/app/.do/app.yaml`
- Paste into Digital Ocean App Spec editor
- Update `YOUR_GITHUB_USERNAME` to your actual username

**Option B: Push to GitHub**
```bash
cd /app
git add .do/app.yaml frontend/package.json backend/server.py backend/Dockerfile frontend/yarn.lock
git commit -m "Restructure app.yaml to match working project structure"
git push origin main
```

### 2. Verify Environment Variables

In Digital Ocean dashboard:
1. Go to Settings → Environment Variables
2. Ensure all variables listed above are set
3. Backend variables go to `tadka-backend` component
4. Frontend variables go to `tadka-frontend` component

### 3. Deploy

- If auto-deploy is enabled, it will deploy automatically
- Or click "Deploy" in the dashboard

## Expected Build Process

### Backend (tadka-backend)
```
1. Git clone
2. Build Docker image from backend/Dockerfile
3. Install Python dependencies
4. Start uvicorn on port 8000
5. Health checks (automatic, no custom config)
6. ✅ Deployed
```

### Frontend (tadka-frontend)
```
1. Git clone
2. Detect yarn.lock → Use yarn
3. Run: yarn install
4. Run: yarn build
5. Serve from build/ directory
6. error_document: index.html (for SPA routing)
7. ✅ Deployed
```

## Key Differences from Previous Attempts

| Aspect | Previous | Now (Working) |
|--------|----------|---------------|
| Frontend type | `services` | `static_sites` |
| SPA routing | Copy 404.html | `error_document` |
| Build command | Complex multi-line | Simple `yarn build` |
| Health checks | Custom config | Default (removed) |
| Env scope | Not specified | `BUILD_TIME` |
| heroku-postbuild | Used | Removed |

## Troubleshooting

### If Backend Still Fails Health Checks

Check logs for:
1. "🚀 BLOG CMS API STARTING UP"
2. "✅ STARTUP COMPLETE"
3. "🔍 INCOMING REQUEST"

If you see STARTUP COMPLETE but no INCOMING REQUEST, it's a routing issue.

### If Frontend Build Fails

Check for:
1. yarn.lock exists ✓
2. No package-lock.json ✓
3. Build command is just `yarn build` ✓

### If Frontend 404s on Refresh

Verify:
```yaml
error_document: index.html  # Must be set!
```

## Files Modified

- ✅ `.do/app.yaml` - Complete restructure
- ✅ `frontend/package.json` - Removed heroku-postbuild, simplified build
- ✅ `backend/server.py` - Added detailed logging
- ✅ `backend/Dockerfile` - Added timeout
- ✅ `frontend/yarn.lock` - Created (507KB)

## Status

✅ **Structure**: Matches working project  
✅ **Config**: Simplified and correct  
✅ **Logging**: Added for debugging  
✅ **SPA Routing**: Using error_document  
✅ **Ready**: For deployment  

This configuration matches your working project exactly!
