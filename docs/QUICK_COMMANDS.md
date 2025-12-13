# Quick Command Reference - Tadka CMS Deployment

Quick reference for common deployment commands.

## Database Commands

### Export Local Database
```bash
# Export current database
mongodump --uri="mongodb://localhost:27017/test_database" --out=/app/mongodb_export

# Verify export
ls -la /app/mongodb_export/test_database/
```

### Import to Remote Database
```bash
# Import with database name change
mongorestore \
  --uri="mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/tadka_cms" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --drop \
  /app/mongodb_export/test_database/

# Import with verbose output
mongorestore \
  --uri="mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/tadka_cms" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --drop \
  --verbose \
  /app/mongodb_export/test_database/
```

### Verify Database
```bash
# Connect to remote database
mongosh "mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/tadka_cms"

# List databases
mongosh "YOUR_URI" --eval "show dbs"

# List collections
mongosh "YOUR_URI" --eval "use tadka_cms; show collections"

# Count documents
mongosh "YOUR_URI" --eval "use tadka_cms; db.users.countDocuments()"
mongosh "YOUR_URI" --eval "use tadka_cms; db.articles.countDocuments()"
```

## Local Development

### Docker Compose
```bash
# Start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend
docker-compose restart frontend
```

### Without Docker (Traditional)
```bash
# Backend
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd /app/frontend
yarn install
yarn start
```

## Git Commands

### Initialize and Push
```bash
# Initialize Git (if not already)
cd /app
git init

# Add files
git add .

# Commit
git commit -m "Add Digital Ocean deployment configuration"

# Add remote (replace with your repo)
git remote add origin https://github.com/YOUR_USERNAME/tadka-cms.git

# Push to main branch
git push -u origin main
```

### Update and Redeploy
```bash
# Make changes, then:
git add .
git commit -m "Your commit message"
git push origin main

# Digital Ocean will auto-deploy if configured
```

## Digital Ocean CLI (doctl)

### Installation
```bash
# macOS
brew install doctl

# Linux
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf doctl-1.98.1-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Authenticate
doctl auth init
```

### App Management
```bash
# List apps
doctl apps list

# Get app info
doctl apps get YOUR_APP_ID

# View logs
doctl apps logs YOUR_APP_ID --type BUILD
doctl apps logs YOUR_APP_ID --type DEPLOY
doctl apps logs YOUR_APP_ID --type RUN
doctl apps logs YOUR_APP_ID --follow

# Create deployment
doctl apps create-deployment YOUR_APP_ID

# Delete app
doctl apps delete YOUR_APP_ID
```

## Testing Commands

### Backend Health Check
```bash
# Local
curl http://localhost:8000/api

# Production
curl https://your-backend-url.ondigitalocean.app/api
```

### API Testing
```bash
# Get categories
curl http://localhost:8000/api/categories

# Get articles
curl http://localhost:8000/api/articles

# Test with authentication
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Database Connection Test
```bash
# Test local connection
mongosh "mongodb://localhost:27017/tadka_cms" --eval "db.adminCommand('ping')"

# Test remote connection
mongosh "YOUR_REMOTE_URI" --eval "db.adminCommand('ping')"
```

## Environment Setup

### Generate JWT Secret Key
```bash
# Using OpenSSL
openssl rand -hex 32

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Create .env files
```bash
# Backend
cp /app/.env.example /app/backend/.env
# Edit with your values
nano /app/backend/.env

# Frontend
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > /app/frontend/.env
```

## Backup Commands

### Backup Remote Database
```bash
# Create backup
mongodump \
  --uri="YOUR_REMOTE_URI" \
  --out=./backup_$(date +%Y%m%d_%H%M%S)

# Compress backup
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz backup_*
```

### Restore from Backup
```bash
# Restore entire database
mongorestore \
  --uri="YOUR_REMOTE_URI" \
  --drop \
  ./backup_directory/

# Restore specific collection
mongorestore \
  --uri="YOUR_REMOTE_URI" \
  --collection=articles \
  ./backup_directory/tadka_cms/articles.bson
```

## Troubleshooting Commands

### Check Service Status
```bash
# Docker services
docker-compose ps

# Check if ports are in use
lsof -i :3000  # Frontend
lsof -i :8000  # Backend
lsof -i :27017 # MongoDB

# Kill process on port
kill -9 $(lsof -t -i:8000)
```

### Check Logs
```bash
# Docker logs
docker-compose logs --tail=100 backend
docker-compose logs --tail=100 frontend

# System logs (if using systemd)
journalctl -u tadka-backend -f
```

### Database Diagnostics
```bash
# Check database size
mongosh "YOUR_URI" --eval "use tadka_cms; db.stats()"

# List all collections with counts
mongosh "YOUR_URI" --eval "
  use tadka_cms;
  db.getCollectionNames().forEach(function(col) {
    print(col + ': ' + db[col].countDocuments());
  });
"

# Check indexes
mongosh "YOUR_URI" --eval "use tadka_cms; db.articles.getIndexes()"
```

## Performance Testing

### Load Testing
```bash
# Install Apache Bench
sudo apt-get install apache2-utils  # Linux
brew install ab  # macOS

# Test endpoint
ab -n 1000 -c 10 http://localhost:8000/api/
ab -n 1000 -c 10 https://your-backend-url.ondigitalocean.app/api/
```

### Database Performance
```bash
# Enable profiling
mongosh "YOUR_URI" --eval "use tadka_cms; db.setProfilingLevel(1, 100)"

# Check slow queries
mongosh "YOUR_URI" --eval "use tadka_cms; db.system.profile.find().limit(10).sort({ts:-1}).pretty()"
```

## Cleanup Commands

### Remove Docker Resources
```bash
# Remove all stopped containers
docker-compose down

# Remove volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Clean up Docker system
docker system prune -a
```

### Clear Node Modules
```bash
# Remove and reinstall
cd /app/frontend
rm -rf node_modules package-lock.json yarn.lock
yarn install
```

### Clear Python Cache
```bash
# Remove Python cache
find /app/backend -type d -name "__pycache__" -exec rm -r {} +
find /app/backend -type f -name "*.pyc" -delete
```

## Quick Fixes

### Reset Local Database
```bash
# Drop local database
mongosh --eval "use tadka_cms; db.dropDatabase()"

# Re-import from export
mongorestore --uri="mongodb://localhost:27017/tadka_cms" /app/mongodb_export/test_database/
```

### Reset Admin Password
```bash
# Connect to database
mongosh "YOUR_URI"

# Use database
use tadka_cms

# Update admin password (hash with bcrypt first)
db.users.updateOne(
  {username: "admin"},
  {$set: {password: "$2b$12$YOUR_HASHED_PASSWORD"}}
)
```

### Force Redeploy on Digital Ocean
```bash
# Using doctl
doctl apps create-deployment YOUR_APP_ID --force-rebuild

# Or via Git (make a small change)
echo "# $(date)" >> README.md
git add README.md
git commit -m "Force redeploy"
git push origin main
```

## Monitoring

### Watch Logs in Real-Time
```bash
# Local development
docker-compose logs -f

# Production (Digital Ocean)
doctl apps logs YOUR_APP_ID --follow

# Watch specific service
docker-compose logs -f backend
```

### Check Resource Usage
```bash
# Docker stats
docker stats

# MongoDB stats
mongosh "YOUR_URI" --eval "db.serverStatus()"
```

## Useful One-Liners

```bash
# Complete local setup
git clone YOUR_REPO && cd tadka-cms && docker-compose up --build

# Quick backend test
curl -s http://localhost:8000/api | jq .

# Count all documents in database
mongosh "YOUR_URI" --quiet --eval "use tadka_cms; let total = 0; db.getCollectionNames().forEach(c => total += db[c].countDocuments()); print(total)"

# Export and compress database
mongodump --uri="mongodb://localhost:27017/tadka_cms" --out=./export && tar -czf export.tar.gz export/

# Check if backend is responding
curl -I http://localhost:8000/api 2>&1 | head -n 1
```

---

## Need Help?

Refer to:
- [DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md) - Full deployment guide
- [MONGODB_IMPORT_GUIDE.md](./MONGODB_IMPORT_GUIDE.md) - Database import help
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Step-by-step checklist

---

**Note**: Replace placeholders like `YOUR_APP_ID`, `YOUR_URI`, `USERNAME`, `PASSWORD` with actual values.