# Detailed Logging Added for Debugging

## What Was Added

### 1. Request Logging Middleware
Every incoming HTTP request will now log:
- Full URL (scheme, host, port, path, query)
- HTTP method
- Client IP and port
- All headers
- Response status code

### 2. Health Check Endpoint Logging
The `/api` health endpoint now logs:
- Full URL being accessed
- Base URL
- Path
- Method

### 3. Startup/Completion Logging
Enhanced logging for:
- Server startup (port, host, health check endpoint)
- Startup completion message

## What You'll See in Logs

### On Startup
```
========================================
🚀 BLOG CMS API STARTING UP
- Port: 8000
- Host: 0.0.0.0
- Health Check: /api or /api/
========================================

... (MongoDB indexes, admin user, etc.)

========================================
✅ STARTUP COMPLETE - SERVER READY
- Listening on: http://0.0.0.0:8000
- Health endpoint: http://0.0.0.0:8000/api
- All systems initialized
========================================
```

### On Health Check Request
```
========================================
🔍 INCOMING REQUEST:
- Method: GET
- Full URL: http://tadka-backend:8000/api
- Scheme: http
- Host: tadka-backend
- Port: 8000
- Path: /api
- Query: 
- Client: 10.244.x.x:xxxxx
- Headers: {...}
========================================

✅ HEALTH CHECK ENDPOINT HIT:
- Full URL: http://tadka-backend:8000/api
- Base URL: http://tadka-backend:8000/
- Path: /api
- Method: GET

📤 RESPONSE:
- Path: /api
- Status: 200
========================================
```

## What to Look For

### 1. Is the server starting?
Look for: "🚀 BLOG CMS API STARTING UP"

### 2. Does startup complete?
Look for: "✅ STARTUP COMPLETE - SERVER READY"

### 3. Are health checks reaching the server?
Look for: "🔍 INCOMING REQUEST" with "Path: /api"

### 4. What URL is being checked?
Check the "Full URL" in the logs - it should be:
- `http://tadka-backend:8000/api` OR
- `http://10.244.x.x:8000/api` (internal IP)

### 5. Is the response successful?
Look for: "📤 RESPONSE" with "Status: 200"

## Possible Issues and What Logs Will Show

### Issue 1: Health check hitting wrong path
**Logs will show:**
```
🔍 INCOMING REQUEST:
- Path: /health  ❌ (wrong path)
```
**Expected:**
```
- Path: /api  ✅
```

### Issue 2: Health check hitting wrong port
**Logs will show:**
```
🔍 INCOMING REQUEST:
- Port: 8001  ❌
```
**Expected:**
```
- Port: 8000  ✅
```

### Issue 3: Server not completing startup
**Logs will show:**
```
🚀 BLOG CMS API STARTING UP
✅ MongoDB indexes created
(no "STARTUP COMPLETE" message)  ❌
```

### Issue 4: No requests reaching server
**Logs will show:**
```
✅ STARTUP COMPLETE
(no "INCOMING REQUEST" logs)  ❌
```
This means health checks aren't reaching the container at all.

### Issue 5: Health check succeeding
**Logs will show:**
```
🔍 INCOMING REQUEST:
- Path: /api
✅ HEALTH CHECK ENDPOINT HIT
📤 RESPONSE:
- Status: 200  ✅
```

## Deploy and Monitor

1. **Commit and push:**
   ```bash
   cd /app
   git add backend/server.py backend/Dockerfile .do/app.yaml frontend/yarn.lock
   git commit -m "Add detailed logging for health check debugging"
   git push origin main
   ```

2. **Watch logs in Digital Ocean:**
   - Go to your app
   - Click "Runtime Logs"
   - Look for the detailed log messages above

3. **What to do based on logs:**

   **If you see "STARTUP COMPLETE" but no "INCOMING REQUEST":**
   - Health checks aren't reaching the container
   - Possible network/routing issue
   - Check Digital Ocean networking settings

   **If you see "INCOMING REQUEST" with wrong path:**
   - Health check is configured for wrong endpoint
   - Need to update DO health check settings

   **If you see "INCOMING REQUEST" with /api and Status: 200:**
   - ✅ Health checks are working!
   - Issue is somewhere else

   **If you never see "STARTUP COMPLETE":**
   - Server is hanging during startup
   - Check MongoDB connection
   - Check environment variables

## Expected Timeline

```
0s:   Container starts
5s:   "🚀 BLOG CMS API STARTING UP"
15s:  "✅ MongoDB indexes created"
30s:  Other initializations
45s:  "✅ STARTUP COMPLETE - SERVER READY"
50s+: "🔍 INCOMING REQUEST" (health checks start)
```

## Quick Debug Commands

After deployment, to see all health check attempts:
```bash
# In Digital Ocean logs, search for:
- "INCOMING REQUEST"
- "HEALTH CHECK ENDPOINT"
- "STARTUP COMPLETE"
```

This will tell you exactly what's happening with the health checks!
