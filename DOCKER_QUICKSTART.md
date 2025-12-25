# Tadka CMS - Docker Compose Quick Reference

## ✅ Application is Running!

### Access URLs:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api

---

## 📋 Quick Commands

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart services
docker-compose restart

# Start in dev mode (with hot reload)
docker-compose -f docker-compose.dev.yml up -d
```

### View Logs
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

### Check Status
```bash
# List running containers
docker-compose ps

# View resource usage
docker stats
```

### Using Makefile (easier)
```bash
make help          # Show all commands
make up            # Start services
make down          # Stop services
make logs          # View logs
make dev           # Start in dev mode
make restart       # Restart services
make clean         # Remove all containers and volumes
```

---

## 🔧 Configuration

Environment variables are in `env.example`. Copy to `.env` to customize:
```bash
cp env.example .env
```

Key variables:
- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET_KEY` - Secret key for JWT tokens
- `CORS_ORIGINS` - Allowed CORS origins
- `REACT_APP_BACKEND_URL` - Backend URL for frontend

---

## 🐛 Troubleshooting

### View backend logs for errors:
```bash
docker-compose logs backend
```

### Restart a specific service:
```bash
docker-compose restart backend
# or
docker-compose restart frontend
```

### Rebuild after code changes:
```bash
docker-compose build
docker-compose up -d
```

### Clean start (removes volumes):
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## 📦 What's Included

### Backend Container
- Python 3.11
- FastAPI framework
- All dependencies from requirements.txt
- Persistent uploads volume
- Port: 8000

### Frontend Container
- Node 20
- React application
- Production optimized build
- Port: 3000

### Network
- Custom bridge network: `tadka-network`
- Services can communicate using service names

### Volumes
- `backend-uploads` - Persistent storage for uploaded files

---

## 🚀 Next Steps

1. Access the frontend at http://localhost:3000
2. Check API docs at http://localhost:8000/docs
3. View logs: `docker-compose logs -f`
4. Make changes and rebuild as needed

For detailed documentation, see `README.Docker.md`

