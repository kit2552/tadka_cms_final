# Deployment Checklist for Tadka CMS

Use this checklist to ensure a smooth deployment to Digital Ocean.

## Pre-Deployment

### ✅ Database Preparation
- [ ] Local MongoDB data exported to `/app/mongodb_export/`
- [ ] Database export downloaded to local machine
- [ ] Database export verified (all collections present)

### ✅ Digital Ocean Setup
- [ ] Digital Ocean account created and verified
- [ ] Payment method added
- [ ] MongoDB Managed Database created
  - [ ] Database name set to `tadka_cms`
  - [ ] Connection string obtained
  - [ ] Trusted sources configured
- [ ] Database imported successfully
  - [ ] All collections present
  - [ ] Document counts verified
  - [ ] Admin user can login

### ★ GitHub Repository
- [ ] GitHub repository created
- [ ] `.gitignore` file configured
- [ ] Code pushed to `main` branch
- [ ] `.do/app.yaml` updated with correct repo name

### ★ Environment Variables Prepared
- [ ] `MONGO_URL` - Remote MongoDB connection string
- [ ] `DB_NAME` - Set to `tadka_cms`
- [ ] `JWT_SECRET_KEY` - Strong random key generated
- [ ] `AWS_ACCESS_KEY_ID` - AWS credentials
- [ ] `AWS_SECRET_ACCESS_KEY` - AWS credentials
- [ ] `AWS_REGION` - AWS region (e.g., us-east-1)
- [ ] `AWS_S3_BUCKET_NAME` - S3 bucket name
- [ ] `S3_ROOT_FOLDER` - S3 folder prefix

## Deployment

### ✅ Create Digital Ocean App
- [ ] App created from GitHub repository
- [ ] Backend service configured
  - [ ] Dockerfile path: `backend/Dockerfile`
  - [ ] HTTP Port: 8000
  - [ ] Instance size: Basic XXS
- [ ] Frontend service configured
  - [ ] Type: Static Site
  - [ ] Build command includes: `cp build/index.html build/404.html`
  - [ ] Output directory: `build`

### ★ Configure Environment Variables in Dashboard

**CRITICAL**: Do NOT rely on app.yaml for environment variables!

#### Backend Environment Variables
- [ ] `MONGO_URL` (Encrypted)
- [ ] `DB_NAME` = `tadka_cms`
- [ ] `JWT_SECRET_KEY` (Encrypted)
- [ ] `AWS_ACCESS_KEY_ID` (Encrypted)
- [ ] `AWS_SECRET_ACCESS_KEY` (Encrypted)
- [ ] `AWS_REGION`
- [ ] `AWS_S3_BUCKET_NAME`
- [ ] `S3_ROOT_FOLDER`
- [ ] `S3_MAX_FILE_SIZE` = 52428800
- [ ] `CORS_ORIGINS` = `${frontend.PUBLIC_URL}`
- [ ] `FRONTEND_URL` = `${frontend.PUBLIC_URL}`

#### Frontend Environment Variables
- [ ] `REACT_APP_BACKEND_URL` = `${backend.PUBLIC_URL}` (auto-set)

### ✅ Deploy
- [ ] Configuration reviewed
- [ ] "Create Resources" clicked
- [ ] Build logs monitored
- [ ] Deployment successful (no errors)

## Post-Deployment Verification

### ✅ Backend Verification
- [ ] Backend URL accessible
- [ ] Health endpoint returns 200: `/api`
  ```bash
  curl https://your-backend-url.ondigitalocean.app/api
  ```
- [ ] Categories endpoint works: `/api/categories`
- [ ] No environment variable errors in logs

### ✅ Frontend Verification
- [ ] Frontend URL loads successfully
- [ ] No console errors
- [ ] Homepage displays correctly
- [ ] Images load properly
- [ ] Navigation works
- [ ] Page refresh works (SPA routing)

### ✅ Database Connection
- [ ] Backend connects to MongoDB
- [ ] Data loads on frontend
- [ ] CMS login works
- [ ] Article creation works
- [ ] Image uploads work (S3)

### ✅ Functional Testing
- [ ] Admin login successful
- [ ] Can create new article
- [ ] Can edit existing article
- [ ] Can delete article
- [ ] Can upload images
- [ ] Can create categories
- [ ] Scheduled publishing works
- [ ] Comments system works

## Optional Configurations

### ☐ Custom Domain
- [ ] Domain added in Digital Ocean
- [ ] DNS records updated
  - [ ] CNAME for `www`
  - [ ] A record for `@`
- [ ] SSL certificate issued
- [ ] Environment variables updated for custom domain

### ☐ Monitoring & Alerts
- [ ] Email alerts enabled
- [ ] Resource usage monitoring configured
- [ ] Error tracking setup

### ☐ Backups
- [ ] MongoDB automatic backups enabled
- [ ] Backup schedule configured
- [ ] Manual backup tested

## Troubleshooting

If any verification fails, refer to:
- [ ] Check deployment logs
- [ ] Verify environment variables
- [ ] Test database connectivity
- [ ] Review `DIGITALOCEAN_DEPLOYMENT.md` troubleshooting section

## Security Post-Deployment

- [ ] Default admin password changed
- [ ] MongoDB IP whitelist reviewed
- [ ] Environment variables encrypted
- [ ] HTTPS enforced (automatic)
- [ ] Rate limiting configured (if needed)
- [ ] CORS origins restricted to actual domains

## Performance Optimization

- [ ] MongoDB indexes created
- [ ] S3 CDN configured (if needed)
- [ ] Image optimization enabled
- [ ] Caching headers configured

## Documentation

- [ ] Deployment guide reviewed
- [ ] Admin credentials documented (secure location)
- [ ] Environment variables documented
- [ ] Architecture diagram created (optional)

---

## Deployment Complete! 🎉

Your Tadka CMS is now live on Digital Ocean!

### URLs
- Backend: `https://backend-xxxxx.ondigitalocean.app`
- Frontend: `https://frontend-xxxxx.ondigitalocean.app`
- Admin Panel: `https://frontend-xxxxx.ondigitalocean.app/cms/dashboard`

### Next Steps
1. Monitor application for 24 hours
2. Create initial backup
3. Document any issues
4. Plan for scaling if needed

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Environment**: Production  
**Status**: ✅ Successful