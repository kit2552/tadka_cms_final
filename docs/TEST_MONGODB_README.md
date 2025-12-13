# MongoDB Connection Testing

## Quick Test Scripts

### 1. Test MongoDB Connection

Tests if your MongoDB is accessible and the database exists:

```bash
cd /app/backend

# Using environment variables
export MONGO_URL="your-mongodb-connection-string"
export DB_NAME="tadka_cms"
python3 test_mongo_connection.py

# Or without setting env vars (it will prompt you)
python3 test_mongo_connection.py
```

**What it checks:**
- ✅ MongoDB server is reachable
- ✅ Database exists
- ✅ Collections are present
- ✅ Read/write permissions work
- ✅ Sample queries execute

### 2. Test Backend Startup

Simulates production startup to find issues:

```bash
cd /app/backend

# With production MongoDB
export MONGO_URL="your-mongodb-connection-string"
export DB_NAME="tadka_cms"
export JWT_SECRET_KEY="your-secret-key"
python3 test_startup.py
```

**What it checks:**
- ✅ Environment variables are set
- ✅ All Python imports work
- ✅ MongoDB connection succeeds
- ✅ Server module loads
- ✅ API routes are registered

## Get Your MongoDB Connection String

### From Digital Ocean Dashboard

1. Go to **Databases**
2. Click on your MongoDB cluster
3. Go to **Connection Details**
4. Copy the **Connection String**

Format:
```
mongodb+srv://username:password@cluster.mongodb.net/admin?retryWrites=true&w=majority
```

### Test Format

Your connection string should look like:
```
mongodb+srv://doadmin:PASSWORD@tadka-mongodb-xxxxx.mongo.ondigitalocean.com/admin?retryWrites=true&w=majority
```

## Common Issues and Solutions

### Issue 1: "Connection refused" or "Connection timeout"

**Possible causes:**
- MongoDB IP whitelist doesn't include your IP
- MongoDB server is down
- Wrong connection string

**Fix:**
1. Go to MongoDB → Settings → Trusted Sources
2. Add your current IP address
3. Or add "0.0.0.0/0" temporarily for testing

### Issue 2: "Authentication failed"

**Possible causes:**
- Wrong username/password
- User doesn't have database access

**Fix:**
1. Verify credentials in connection string
2. Check if user has read/write permissions
3. Try connecting with MongoDB Compass to verify credentials

### Issue 3: "Database 'tadka_cms' not found"

**Possible causes:**
- Database wasn't imported yet
- Wrong database name

**Fix:**
1. Import your local database:
   ```bash
   mongorestore --uri="YOUR_REMOTE_URI" \
     --nsFrom="test_database.*" \
     --nsTo="tadka_cms.*" \
     /app/mongodb_export/test_database/
   ```

2. Or verify the correct database name:
   ```bash
   mongosh "YOUR_URI" --eval "show dbs"
   ```

## Production Logs Not Showing

If you don't see logs in Digital Ocean, the server likely isn't starting. Possible reasons:

### 1. Missing Environment Variables

**Check in Digital Ocean:**
- Settings → Environment Variables
- Verify all required vars are set:
  - MONGO_URL ✓
  - DB_NAME ✓
  - JWT_SECRET_KEY ✓
  - AWS credentials (if using S3) ✓

### 2. Python Version Mismatch

**Fix:** We added `.python-version` file with Python 3.11.9

### 3. Import Errors

**Test locally:**
```bash
cd /app/backend
python3 test_startup.py
```

This will show exactly which import is failing.

### 4. MongoDB Connection Failing at Startup

The server tries to connect to MongoDB during startup. If it fails, the server never starts.

**Test:**
```bash
python3 test_mongo_connection.py
```

## Quick Diagnostics

Run both test scripts:

```bash
# Terminal 1: Test MongoDB
cd /app/backend
export MONGO_URL="your-production-mongo-url"
python3 test_mongo_connection.py

# Terminal 2: Test Startup
export MONGO_URL="your-production-mongo-url"
export DB_NAME="tadka_cms"
export JWT_SECRET_KEY="your-secret"
python3 test_startup.py
```

If BOTH scripts pass locally, the issue is in Digital Ocean configuration, not your code.

## What to Check in Digital Ocean

1. **Runtime Logs**
   - Go to your app
   - Click "Runtime Logs"
   - Look for Python errors or import failures

2. **Build Logs**
   - Check if Python dependencies installed correctly
   - Look for version conflicts

3. **Environment Variables**
   - Verify MONGO_URL is set
   - Check if it's marked as "Encrypted" (should be)
   - Verify no typos in variable names

4. **Network Access**
   - MongoDB → Trusted Sources
   - Should include "Digital Ocean" or specific IPs

## Expected Output (Success)

### test_mongo_connection.py
```
✅ ALL TESTS PASSED - MONGODB CONNECTION IS WORKING
📌 Connection Summary:
   • Server: Reachable ✓
   • Database 'tadka_cms': EXISTS ✓
   • Collections: 15
   • Read/Write: Working ✓
```

### test_startup.py
```
✅ STARTUP TEST COMPLETED
✅ All tests passed
```

## Next Steps After Tests Pass

If tests pass locally but deployment fails:

1. **Check Digital Ocean environment variables match exactly**
2. **Verify MongoDB network access includes DO**
3. **Look at actual Digital Ocean runtime logs**
4. **Check if port 8000 is accessible in container**

## Need More Help?

Share the output of both test scripts and we can diagnose further!
