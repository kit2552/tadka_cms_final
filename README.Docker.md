# Tadka CMS - Docker Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker (v20.10 or higher)
- Docker Compose (v2.0 or higher)

### Option 1: Using Make Commands (Recommended)

```bash
# Show all available commands
make help

# Start in development mode (with hot reload)
make dev

# Start in production mode
make prod

# View logs
make logs

# Stop services
make down
```

### Option 2: Using Docker Compose Directly

#### Production Mode
```bash
# Build and start services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Development Mode
```bash
# Start with hot reload enabled
docker-compose -f docker-compose.dev.yml up

# Or run in background
docker-compose -f docker-compose.dev.yml up -d
```

## 📋 Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration:
   ```bash
   # MongoDB Configuration
   MONGO_URL=your-mongodb-connection-string
   DB_NAME=tadka_cms
   
   # JWT Configuration
   JWT_SECRET_KEY=your-super-secret-key
   
   # CORS Configuration
   CORS_ORIGINS=http://localhost:3000
   FRONTEND_URL=http://localhost:3000
   
   # Backend URL (for frontend)
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```

## 🏗️ Architecture

The application consists of two main services:

### Backend (FastAPI)
- **Port**: 8000
- **Technology**: Python 3.11, FastAPI
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Frontend (React)
- **Port**: 3000
- **Technology**: Node 20, React, TailwindCSS
- **URL**: http://localhost:3000

## 📦 Docker Compose Files

- `docker-compose.yml` - Production configuration
- `docker-compose.dev.yml` - Development configuration with hot reload

## 🔧 Common Commands

### View Service Status
```bash
make status
# or
docker-compose ps
```

### View Logs
```bash
# All services
make logs

# Backend only
make backend-logs

# Frontend only
make frontend-logs
```

### Restart Services
```bash
make restart
# or
docker-compose restart
```

### Rebuild Services
```bash
make rebuild
# or
docker-compose build --no-cache
docker-compose up -d
```

### Access Container Shell
```bash
# Backend
make shell-backend

# Frontend
make shell-frontend
```

### Clean Up
```bash
# Stop and remove containers
make down

# Remove everything including volumes
make clean

# Remove unused Docker data
make prune
```

## 🔍 Troubleshooting

### Port Already in Use
If ports 3000 or 8000 are already in use:
```bash
# Find process using the port
lsof -i :3000
lsof -i :8000

# Kill the process
kill -9 <PID>
```

Or modify the ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Change host port
```

### MongoDB Connection Issues
1. Verify your MongoDB connection string in `.env`
2. Check if your IP is whitelisted in MongoDB Atlas
3. Verify network connectivity:
   ```bash
   docker-compose logs backend | grep -i mongo
   ```

### Frontend Not Loading
1. Check if backend is healthy:
   ```bash
   curl http://localhost:8000/health
   ```

2. Verify environment variable:
   ```bash
   docker-compose exec frontend env | grep REACT_APP_BACKEND_URL
   ```

3. Check browser console for CORS errors

### Container Keeps Restarting
```bash
# Check logs for errors
docker-compose logs backend
docker-compose logs frontend

# Check container status
docker-compose ps
```

## 🎯 Development Workflow

### Local Development with Hot Reload
```bash
# Start development mode
make dev

# Backend will auto-reload on code changes
# Frontend will auto-reload on code changes
```

### Testing Changes
```bash
# View real-time logs
make logs

# Make code changes - services will auto-reload

# If needed, restart specific service
docker-compose restart backend
```

### Database Operations
```bash
# Access backend shell to run migrations/seeds
make shell-backend

# Inside container
python seed_data.py
```

## 📊 Health Checks

The backend service includes a health check endpoint:
- **Endpoint**: `GET /health`
- **Interval**: Every 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

Monitor health status:
```bash
curl http://localhost:8000/health
```

## 🔒 Security Notes

1. **Change default JWT secret** in production
2. **Use environment-specific .env files**
3. **Never commit .env files** to version control
4. **Update CORS origins** for production domains
5. **Use HTTPS** in production with reverse proxy (nginx/traefik)

## 🚢 Production Deployment

### Using Docker Compose
```bash
# Build for production
make prod

# Or with custom env file
docker-compose --env-file .env.production up -d --build
```

### Using a Reverse Proxy (Recommended)
Add nginx or traefik for SSL termination:

```yaml
# docker-compose.prod.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
```

## 📈 Monitoring

### View Resource Usage
```bash
docker stats
```

### Check Logs
```bash
# Recent logs
docker-compose logs --tail=100

# Follow logs
docker-compose logs -f --tail=100
```

## 🔄 Updates and Maintenance

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
make rebuild
```

### Backup Volumes
```bash
# Backup uploads volume
docker run --rm -v tadka-backend-uploads:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup.tar.gz /data
```

### Restore Volumes
```bash
# Restore uploads volume
docker run --rm -v tadka-backend-uploads:/data -v $(pwd):/backup \
  alpine tar xzf /backup/uploads-backup.tar.gz -C /
```

## 📞 Support

For issues or questions:
1. Check the logs: `make logs`
2. Review environment configuration
3. Verify all prerequisites are installed
4. Check Docker and Docker Compose versions

## 🎉 Success!

Once everything is running:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

Happy coding! 🚀

