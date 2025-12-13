# 🔥 Tadka News Platform - Fresh Installation Guide

## 📋 Prerequisites
- Python 3.8+
- Node.js 16+
- Yarn package manager

## 🚀 Quick Start

### 1. Extract and Setup
```bash
# Extract the project
tar -xzf tadka_complete_project.tar.gz
cd app

# Run the migration script to setup database
python fresh_install_migration.py
```

### 2. Install Dependencies
```bash
# Backend dependencies
pip install -r backend/requirements.txt

# Frontend dependencies  
cd frontend
yarn install
cd ..
```

### 3. Start the Application
```bash
# Terminal 1: Start Backend
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Terminal 2: Start Frontend  
cd frontend
yarn start
```

### 4. Access the Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001
- **CMS Dashboard:** http://localhost:3000/cms/dashboard

## 📊 What's Included

### Database Content
- **117 Articles** (Viral shorts, trending videos, politics, movie news, NRI news)
- **58 Categories** (All content categories)
- **3 Movie Reviews** 
- **2 Theater Releases**
- **2 OTT Releases**
- **5 Topics** with categories
- **4 Galleries** with images
- **Complete configuration** and settings

### File Structure
```
app/
├── backend/                 # FastAPI Backend
│   ├── server.py           # Main server
│   ├── database.py         # Database configuration
│   ├── models/             # Database models
│   ├── routes/             # API routes  
│   ├── uploads/            # Uploaded images
│   └── blog_cms.db         # SQLite database
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Application pages
│   │   ├── contexts/       # React contexts
│   │   └── services/       # API services
│   └── public/             # Static files
├── database_export.json    # Database backup (JSON)
├── database_export.sql     # Database backup (SQL)
└── fresh_install_migration.py # Setup script
```

## 🔧 Configuration

The application comes pre-configured with:
- SQLite database with all content
- Environment variables
- Required dependencies
- Upload directories

## 📝 Important Notes

1. **Database:** All your original content is preserved
2. **Uploads:** All images are included in backend/uploads/
3. **Environment:** .env files are created automatically
4. **Development:** Both frontend and backend have hot-reload enabled

## 🆘 Troubleshooting

### Database Issues
```bash
# If database setup fails, run migration again
python fresh_install_migration.py
```

### Dependency Issues  
```bash
# Backend dependencies
pip install -r backend/requirements.txt --force-reinstall

# Frontend dependencies
cd frontend
rm -rf node_modules yarn.lock
yarn install
```

### Port Conflicts
- Backend default: 8001 (change in uvicorn command)
- Frontend default: 3000 (change in package.json)

## 🎯 Success Verification

After setup, verify everything works:
1. ✅ Backend responds at http://localhost:8001/docs
2. ✅ Frontend loads at http://localhost:3000  
3. ✅ Articles display on homepage
4. ✅ CMS dashboard accessible
5. ✅ Images load correctly

## 📞 Support

If you encounter issues:
1. Check the console logs for errors
2. Verify all dependencies are installed
3. Ensure ports 3000 and 8001 are available
4. Run migration script again if database issues persist

---

**🔥 Your complete Tadka News Platform is ready to go!**
