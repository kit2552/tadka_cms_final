# Health Check Fix for Digital Ocean Deployment

## Issue

Backend deployment failing with:
```
ERROR failed health checks after 7 attempts
Readiness probe failed: dial tcp 10.244.13.218:8000: connect: connection refused
```

## Root Cause

The backend takes time to:
1. Connect to MongoDB
2. Create indexes (seen in logs: "✅ MongoDB indexes created successfully")
3. Start the FastAPI server

Digital Ocean's default health check timeout is too short (default: 30 seconds), so it fails before the backend is ready.

## Solution

Added health check configuration to `.do/app.yaml`:

```yaml
health_check:
  http_path: /api
  initial_delay_seconds: 60       # Wait 60s before first check
  period_seconds: 10              # Check every 10s
  timeout_seconds: 10             # Each check times out after 10s
  success_threshold: 1            # 1 success = healthy
  failure_threshold: 3            # 3 failures = unhealthy
```

## What This Does

1. **initial_delay_seconds: 60** - Gives backend 60 seconds to start up completely
   - Time for MongoDB connection
   - Time for index creation
   - Time for FastAPI to start

2. **http_path: /api** - Checks the health endpoint that returns:
   ```json
   {"message": "Blog CMS API is running", "status": "healthy"}
   ```

3. **period_seconds: 10** - Checks every 10 seconds after initial delay

4. **timeout_seconds: 10** - Each health check waits up to 10 seconds

5. **failure_threshold: 3** - Only marks as unhealthy after 3 consecutive failures

## Expected Behavior After Fix

### Startup Sequence
```
0s:  Container starts
5s:  MongoDB connection established
10s: MongoDB indexes being created
15s: Indexes creation complete
20s: FastAPI server starting
25s: Server ready on 0.0.0.0:8000
60s: First health check (should pass)
70s: Second health check (confirming healthy)
```

### Logs You Should See
```
✅ MongoDB indexes created successfully
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Deployment Steps

1. **Commit the fix:**
   ```bash
   cd /app
   git add .do/app.yaml
   git commit -m "Fix: Add health check configuration for backend startup"
   git push origin main
   ```

2. **Monitor deployment:**
   - Watch for "MongoDB indexes created successfully"
   - Wait for "Application startup complete"
   - Health check should pass after 60 seconds

3. **Verify backend is healthy:**
   ```bash
   curl https://your-backend-url.ondigitalocean.app/api
   # Should return: {"message":"Blog CMS API is running","status":"healthy"}
   ```

## Alternative Solutions

### If 60 seconds is still not enough:

Increase initial delay:
```yaml
health_check:
  initial_delay_seconds: 90  # Increase to 90s
```

### If health check path is wrong:

Verify the health endpoint works:
```bash
curl http://localhost:8000/api
```

Should return JSON with "healthy" status.

## Troubleshooting

### Issue: Still failing after 60s

**Check 1**: MongoDB connection
- Verify MONGO_URL is set in environment variables
- Check MongoDB trusted sources includes Digital Ocean

**Check 2**: Port configuration
- Backend Dockerfile: `EXPOSE 8000` ✓
- app.yaml: `http_port: 8000` ✓
- uvicorn command: `--port 8000` ✓

**Check 3**: Environment variables
Ensure all required variables are set in Digital Ocean dashboard:
- MONGO_URL
- DB_NAME (tadka_cms)
- JWT_SECRET_KEY
- AWS credentials (if using S3)

### Issue: Health check passes but app doesn't work

The health endpoint might be responding but the app has other issues.

**Check**:
```bash
# Test other endpoints
curl https://your-backend-url.ondigitalocean.app/api/categories

# Check logs
doctl apps logs YOUR_APP_ID --type RUN
```

## Configuration Summary

### Backend (app.yaml)
```yaml
services:
  - name: backend
    http_port: 8000
    health_check:
      http_path: /api
      initial_delay_seconds: 60
      period_seconds: 10
      timeout_seconds: 10
```

### Backend (Dockerfile)
```dockerfile
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Backend (server.py)
```python
@app.get("/api")
async def root():
    return {"message": "Blog CMS API is running", "status": "healthy"}
```

## Status

✅ **Health check config added**  
✅ **Port configuration verified (8000)**  
✅ **Health endpoint exists (/api)**  
✅ **Initial delay set (60s)**  
✅ **Ready for deployment**

---

**Next Action**: Commit and push to trigger redeployment  
**Expected Result**: Health checks will pass after 60 second delay
