# Digital Ocean Deployment Guide for Tadka CMS

Complete guide for deploying Tadka CMS application to Digital Ocean App Platform.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Database Export](#database-export)
3. [MongoDB Setup on Digital Ocean](#mongodb-setup)
4. [Environment Variables Configuration](#environment-variables)
5. [Deployment Steps](#deployment-steps)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- Digital Ocean account with payment method
- GitHub account for repository hosting
- AWS account (for S3 storage)

### Tools Needed
- Git
- `mongorestore` (MongoDB Database Tools)
- Text editor

### Cost Estimate (Monthly)
- Backend (Basic XXS): $5-12/month
- Frontend (Static Site): $3-5/month
- MongoDB Managed Database: $15-25/month
- **Total**: ~$25-45/month

---

## Database Export

### Step 1: Export Local MongoDB Data

The database export has been created in `/app/mongodb_export/` directory.

```bash
# Export command (already done)
mongodump --uri="mongodb://localhost:27017/test_database" --out=/app/mongodb_export
```

### Step 2: Download the Export

You'll need to download the MongoDB export directory to import it into your remote database later.

**Export Location**: `/app/mongodb_export/test_database/`

This directory contains:
- All collection BSON files
- Collection metadata
- Indexes

---

## MongoDB Setup on Digital Ocean

### Option 1: Digital Ocean Managed MongoDB (Recommended)

1. **Create MongoDB Database**
   - Log into Digital Ocean
   - Go to **Databases** → **Create Database**
   - Select **MongoDB** version 7.x
   - Choose datacenter region (same as your app)
   - Select plan (Starter: $15/month recommended)
   - Database name: `tadka_cms`
   - Click **Create Database**

2. **Get Connection Details**
   - Once created, go to **Connection Details**
   - Copy the **Connection String** (format: `mongodb+srv://...`)
   - Note down:
     - Database Host
     - Port
     - Username
     - Password

3. **Add Trusted Sources**
   - Go to **Settings** → **Trusted Sources**
   - Add your local IP (for import)
   - Add "All Digital Ocean Resources" (for app access)

### Option 2: MongoDB Atlas (Alternative)

If you prefer MongoDB Atlas:

1. Create free cluster at https://www.mongodb.com/cloud/atlas
2. Create database user
3. Whitelist Digital Ocean IP ranges
4. Get connection string

---

## Import Database to Remote MongoDB

### Step 1: Prepare Connection String

Your MongoDB connection string should look like:
```
mongodb+srv://doadmin:YOUR_PASSWORD@tadka-mongodb-xxxxx.mongo.ondigitalocean.com/admin?retryWrites=true&w=majority
```

### Step 2: Import Data

**Important**: We're importing to database name `tadka_cms` (not `test_database`).

```bash
# Navigate to export directory
cd /app/mongodb_export

# Import to remote MongoDB with new database name
mongorestore \
  --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongo.ondigitalocean.com/tadka_cms?retryWrites=true&w=majority" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --drop \
  ./test_database/
```

**Flags Explained**:
- `--uri`: Your remote MongoDB connection string (replace with actual)
- `--nsFrom`: Source namespace (our local DB)
- `--nsTo`: Target namespace (new DB name)
- `--drop`: Drop existing collections before import
- `./test_database/`: Path to export directory

### Step 3: Verify Import

```bash
# List databases
mongosh "YOUR_CONNECTION_STRING" --eval "show dbs"

# Check collections in tadka_cms
mongosh "YOUR_CONNECTION_STRING" --eval "use tadka_cms; show collections"

# Count documents
mongosh "YOUR_CONNECTION_STRING" --eval "use tadka_cms; db.users.countDocuments()"
```

---

## Environment Variables

### Required Environment Variables

These must be set in Digital Ocean App Platform:

```env
# MongoDB
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/admin?retryWrites=true&w=majority
DB_NAME=tadka_cms

# Security
JWT_SECRET_KEY=generate-a-secure-random-string-here

# AWS S3 (for media uploads)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
S3_ROOT_FOLDER=tadka/
S3_MAX_FILE_SIZE=52428800

# Auto-configured by Digital Ocean
CORS_ORIGINS=${frontend.PUBLIC_URL}
FRONTEND_URL=${frontend.PUBLIC_URL}
REACT_APP_BACKEND_URL=${backend.PUBLIC_URL}
```

### How to Generate JWT Secret Key

```bash
# Option 1: OpenSSL
openssl rand -hex 32

# Option 2: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Deployment Steps

### Step 1: Prepare GitHub Repository

1. **Create GitHub Repository**
   ```bash
   # Initialize git (if not already)
   cd /app
   git init
   
   # Create .gitignore
   cat > .gitignore << 'EOF'
   # Environment files
   .env
   .env.local
   *.env
   
   # Node modules
   node_modules/
   frontend/node_modules/
   
   # Python
   __pycache__/
   *.pyc
   *.pyo
   *.pyd
   .Python
   venv/
   env/
   
   # Build outputs
   frontend/build/
   backend/uploads/
   
   # Database exports
   mongodb_export/
   
   # IDEs
   .vscode/
   .idea/
   *.swp
   *.swo
   
   # OS
   .DS_Store
   Thumbs.db
   
   # Logs
   *.log
   logs/
   EOF
   
   # Add and commit
   git add .
   git commit -m "Initial commit: Tadka CMS"
   
   # Push to GitHub
   git remote add origin https://github.com/YOUR_USERNAME/tadka-cms.git
   git push -u origin main
   ```

### Step 2: Update app.yaml

Edit `/app/.do/app.yaml` and replace:
- `YOUR_GITHUB_USERNAME` with your actual GitHub username
- Repository name if different from `tadka-cms`

### Step 3: Create App in Digital Ocean

1. **Using app.yaml (Recommended)**
   - Log into Digital Ocean
   - Go to **Apps** → **Create App**
   - Choose **GitHub** as source
   - Select your repository: `tadka-cms`
   - Choose branch: `main`
   - Click **Edit Your App Spec**
   - Paste the contents of `.do/app.yaml`
   - Click **Next**

2. **Manual Configuration (Alternative)**
   - If app.yaml doesn't work, configure manually:
   
   **Backend Service**:
   - Type: Docker
   - Source Directory: `/backend`
   - Dockerfile Path: `backend/Dockerfile`
   - HTTP Port: 8000
   - Instance Size: Basic XXS
   
   **Frontend Service**:
   - Type: Static Site
   - Source Directory: `/frontend`
   - Build Command: `yarn install && yarn build && cp build/index.html build/404.html`
   - Output Directory: `build`

### Step 4: Configure Environment Variables

**CRITICAL**: Environment variables in app.yaml are NOT automatically applied. You MUST set them in the dashboard.

1. Go to your app **Settings**
2. Find **Environment Variables** section
3. Click **Edit**
4. Add each variable from the list above
5. For sensitive values, check **Encrypt**
6. Click **Save**

**Component-Level Variables**:
- Backend: Add all backend environment variables
- Frontend: Only needs `REACT_APP_BACKEND_URL` (auto-set)

### Step 5: Deploy

1. Review configuration
2. Click **Create Resources**
3. Wait for deployment (5-10 minutes)
4. Monitor build logs

---

## Post-Deployment

### Verify Deployment

1. **Backend Health Check**
   ```bash
   curl https://your-backend-url.ondigitalocean.app/api
   # Should return: {"message": "Blog CMS API is running", "status": "healthy"}
   ```

2. **Frontend Check**
   - Visit: `https://your-frontend-url.ondigitalocean.app`
   - Should load the Tadka CMS homepage

3. **Database Connection**
   ```bash
   curl https://your-backend-url.ondigitalocean.app/api/categories
   # Should return list of categories
   ```

### Configure Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your domain
3. Update DNS records as instructed:
   - CNAME: `www` → `your-app.ondigitalocean.app`
   - A: `@` → Digital Ocean IP
4. Enable SSL (automatic)

### Update Environment Variables for Production

1. Update `CORS_ORIGINS` to include custom domain
2. Update `FRONTEND_URL` if using custom domain

---

## Troubleshooting

### Common Issues

#### 1. "uvicorn not found" Error

**Cause**: Dockerfile not building properly.

**Fix**:
- Verify `backend/requirements.txt` includes `uvicorn==0.25.0`
- Check build logs for pip install errors
- Ensure Dockerfile is in correct location

#### 2. "Missing required environment variables"

**Cause**: Environment variables not set in dashboard.

**Fix**:
- Go to Settings → Environment Variables
- Manually add all required variables
- DO NOT rely on app.yaml for env vars
- Redeploy after adding

#### 3. "Database connection failed"

**Cause**: MongoDB not accessible or wrong credentials.

**Fix**:
- Verify MongoDB trusted sources includes Digital Ocean
- Test connection string locally:
  ```bash
  mongosh "YOUR_CONNECTION_STRING" --eval "db.adminCommand('ping')"
  ```
- Check MONGO_URL format
- Ensure DB_NAME is set to `tadka_cms`

#### 4. "Frontend shows 404 on refresh"

**Cause**: SPA routing not configured.

**Fix**:
- Ensure build command includes: `cp build/index.html build/404.html`
- This is already in the app.yaml configuration

#### 5. "CORS Error"

**Cause**: CORS_ORIGINS not set correctly.

**Fix**:
- Set CORS_ORIGINS to frontend URL
- In app.yaml: `${frontend.PUBLIC_URL}`
- Or manually: `https://your-frontend.ondigitalocean.app`

### Check Logs

```bash
# Using Digital Ocean CLI (doctl)
doctl apps logs YOUR_APP_ID --type BUILD
doctl apps logs YOUR_APP_ID --type DEPLOY
doctl apps logs YOUR_APP_ID --type RUN

# Or use the web interface:
# Dashboard → Your App → Runtime Logs
```

### Health Check Port Issue

If you see "Readiness probe failed: dial tcp PORT_MISMATCH":

1. Go to Settings → Health Checks
2. Verify port is **8000** (not 8001)
3. Update if needed
4. Save and redeploy

---

## Maintenance

### Database Backups

1. **Automatic Backups** (Managed MongoDB)
   - Digital Ocean provides daily backups
   - Configure in Database Settings

2. **Manual Backup**
   ```bash
   mongodump --uri="YOUR_CONNECTION_STRING" --out=./backup_$(date +%Y%m%d)
   ```

### Scaling

1. Go to app Settings → Resources
2. Upgrade instance size if needed
3. Increase MongoDB resources if performance degrades

### Updates

```bash
# Push updates
git add .
git commit -m "Update description"
git push origin main

# Auto-deploys if deploy_on_push: true
```

---

## Security Checklist

- [ ] Change JWT_SECRET_KEY to a strong random value
- [ ] Use encrypted environment variables for secrets
- [ ] Enable MongoDB authentication
- [ ] Configure MongoDB trusted sources (not 0.0.0.0/0)
- [ ] Use HTTPS only (enabled by default)
- [ ] Regularly update dependencies
- [ ] Monitor access logs
- [ ] Set up database backups
- [ ] Use strong database passwords
- [ ] Configure rate limiting (if needed)

---

## Additional Resources

- [Digital Ocean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Digital Ocean Managed MongoDB](https://docs.digitalocean.com/products/databases/mongodb/)
- [MongoDB Import/Export](https://www.mongodb.com/docs/database-tools/mongodump/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

---

## Support

For issues:
1. Check deployment logs first
2. Verify all environment variables
3. Test database connectivity
4. Review this guide's troubleshooting section

---

**Last Updated**: December 2025  
**Version**: 1.0.0