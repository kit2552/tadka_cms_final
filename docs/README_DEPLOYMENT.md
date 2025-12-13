# Tadka CMS - Production Deployment

This document provides a quick overview of the deployment setup for Tadka CMS.

## 📋 Quick Links

- **Full Deployment Guide**: [DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md)
- **Database Import Guide**: [MONGODB_IMPORT_GUIDE.md](./MONGODB_IMPORT_GUIDE.md)
- **Deployment Checklist**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

## 🏗️ Architecture

```
┌────────────────────┐
│   Digital Ocean      │
│   App Platform       │
│                      │
│  ┌───────────────┐  │
│  │   Frontend      │  │
│  │ (React/Static)│  │
│  └──────┬─────────┘  │
│         │            │
│  ┌──────┴─────────┐  │
│  │   Backend       │  │
│  │ (FastAPI)     │  │
│  └──────┬─────────┘  │
│         │            │
└─────────┼───────────┘
          │
    ┌─────┼─────┐
    │           │
┌───┴───┐   ┌───┴───┐
│ MongoDB│   │  AWS  │
│Managed │   │  S3   │
│Database│   │Bucket│
└────────┘   └───────┘
```

## 🚀 Quick Start

### 1. Database Configuration

The application now uses `tadka_cms` as the database name (updated from `test_database`).

**Local Development**:
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="tadka_cms"
```

**Production**:
```env
MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net/admin"
DB_NAME="tadka_cms"
```

### 2. Database Export

Your local database has been exported to:
```
/app/mongodb_export/test_database/
```

### 3. Import to Remote Database

```bash
mongorestore \
  --uri="YOUR_REMOTE_MONGODB_URI" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --drop \
  /app/mongodb_export/test_database/
```

See [MONGODB_IMPORT_GUIDE.md](./MONGODB_IMPORT_GUIDE.md) for detailed instructions.

## 📂 Project Structure

```
/app/
├── backend/
│   ├── Dockerfile          # Production Docker image
│   ├── server.py           # FastAPI application
│   ├── database.py         # MongoDB connection (uses tadka_cms)
│   ├── requirements.txt    # Python dependencies
│   └── .env                # Backend environment variables
├── frontend/
│   ├── src/                # React source code
│   ├── public/             # Static assets
│   ├── package.json        # Node dependencies
│   └── .env                # Frontend environment variables
├── .do/
│   └── app.yaml            # Digital Ocean App Platform config
├── docker-compose.yml      # Local development with Docker
├── .env.example            # Environment variables template
├── mongodb_export/         # Database export directory
└── DIGITALOCEAN_DEPLOYMENT.md  # Full deployment guide
```

## ⚙️ Configuration Files

### docker-compose.yml
Configured for local development with:
- Frontend on port 3000
- Backend on port 8000
- MongoDB on port 27017
- Database name: `tadka_cms`

### .do/app.yaml
Digital Ocean App Platform configuration:
- Backend: Docker service (FastAPI)
- Frontend: Static site (React)
- Auto-deployment on git push
- Environment variable templates

### backend/Dockerfile
Production-ready Docker image:
- Python 3.11 slim
- Optimized for size and performance
- Health checks configured

## 🔑 Environment Variables

### Required for Deployment

```env
# Database
MONGO_URL=mongodb+srv://...
DB_NAME=tadka_cms

# Security
JWT_SECRET_KEY=your-secret-key

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=...
S3_ROOT_FOLDER=tadka/
```

See [.env.example](./.env.example) for complete list.

## 📝 Key Changes from Local to Production

| Aspect | Local | Production |
|--------|-------|------------|
| Database Name | `test_database` | `tadka_cms` |
| MongoDB | localhost:27017 | Managed MongoDB |
| Backend URL | localhost:8000 | *.ondigitalocean.app |
| Frontend URL | localhost:3000 | *.ondigitalocean.app |
| File Storage | Local uploads/ | AWS S3 |
| HTTPS | No | Yes (automatic) |

## 🛠️ Deployment Steps (Summary)

1. **Export Database** ✅ (Already done)
   ```bash
   mongodump --uri="mongodb://localhost:27017/test_database" --out=/app/mongodb_export
   ```

2. **Create Remote MongoDB**
   - Digital Ocean Managed MongoDB
   - Database name: `tadka_cms`

3. **Import Database**
   ```bash
   mongorestore --uri="REMOTE_URI" --nsFrom="test_database.*" --nsTo="tadka_cms.*" ...
   ```

4. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Production deployment setup"
   git push origin main
   ```

5. **Deploy on Digital Ocean**
   - Create app from GitHub
   - Configure environment variables (in dashboard!)
   - Deploy

6. **Verify Deployment**
   - Test backend health endpoint
   - Verify frontend loads
   - Test database connection
   - Login to CMS

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for detailed checklist.

## 💡 Important Notes

### Database Name Change
The database name has been changed from `test_database` to `tadka_cms`:
- ✅ Updated in `backend/database.py`
- ✅ Updated in `backend/.env`
- ✅ Configured in `docker-compose.yml`
- ✅ Configured in `.do/app.yaml`

### Environment Variables
**CRITICAL**: Digital Ocean App Platform does NOT automatically apply environment variables from `app.yaml`. You MUST set them manually in the dashboard:

1. Go to Settings → Environment Variables
2. Add each variable manually
3. Mark sensitive values as "Encrypted"
4. Save and redeploy

### SPA Routing
For React Router to work on refresh, the build command includes:
```bash
cp build/index.html build/404.html
```

This is already configured in `app.yaml`.

## 🐛 Troubleshooting

### Backend Won't Start
- Check environment variables are set
- Verify MONGO_URL is correct
- Check DB_NAME is `tadka_cms`
- Review deployment logs

### Frontend 404 on Refresh
- Verify build command includes `cp build/index.html build/404.html`
- Check Digital Ocean build logs

### Database Connection Failed
- Verify MongoDB trusted sources
- Test connection string locally
- Check network access settings

### CORS Errors
- Verify CORS_ORIGINS is set to frontend URL
- Check backend logs for CORS configuration

See [DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md) for complete troubleshooting guide.

## 📚 Documentation Files

1. **DIGITALOCEAN_DEPLOYMENT.md** - Complete deployment guide with step-by-step instructions
2. **MONGODB_IMPORT_GUIDE.md** - Database import instructions with examples
3. **DEPLOYMENT_CHECKLIST.md** - Checklist to ensure nothing is missed
4. **README_DEPLOYMENT.md** - This file, quick reference

## 🔒 Security Checklist

- [ ] JWT_SECRET_KEY changed from default
- [ ] MongoDB authentication enabled
- [ ] MongoDB IP whitelist configured
- [ ] Environment variables encrypted
- [ ] HTTPS enabled (automatic)
- [ ] Strong admin password
- [ ] Database backups configured

## 💰 Cost Estimate

**Digital Ocean Monthly Costs**:
- Backend (Basic XXS): $5-12
- Frontend (Static Site): $3-5
- MongoDB (Starter): $15-25
- **Total**: ~$25-45/month

**Additional Costs**:
- AWS S3 Storage: ~$1-5/month (depends on usage)
- Domain (if needed): ~$10-15/year

## 🎓 Next Steps After Deployment

1. ✅ Verify all functionality
2. 📸 Take initial backup
3. 📊 Set up monitoring
4. 🔔 Configure alerts
5. 📄 Document admin credentials
6. 🌎 Configure custom domain (optional)
7. 🚀 Plan for scaling

## 👥 Support

For deployment issues:
1. Check deployment logs first
2. Review troubleshooting sections
3. Test database connectivity
4. Verify environment variables

## 🔗 Useful Commands

```bash
# Local development
docker-compose up --build

# Test MongoDB connection
mongosh "YOUR_CONNECTION_STRING" --eval "db.adminCommand('ping')"

# Export database (already done)
mongodump --uri="mongodb://localhost:27017/test_database" --out=/app/mongodb_export

# Import database
mongorestore --uri="REMOTE_URI" --nsFrom="test_database.*" --nsTo="tadka_cms.*" /app/mongodb_export/test_database/

# Check Digital Ocean logs
doctl apps logs YOUR_APP_ID --type RUN
```

---

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Database**: tadka_cms  
**Platform**: Digital Ocean App Platform