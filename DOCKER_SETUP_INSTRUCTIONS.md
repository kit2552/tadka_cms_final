# Docker Setup Instructions for Tadka CMS

## Step 1: Install Docker Desktop

### For macOS:
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Open the downloaded `.dmg` file
3. Drag Docker.app to Applications folder
4. Open Docker Desktop from Applications
5. Wait for Docker to start (you'll see a whale icon in the menu bar)

### Alternative (using Homebrew - requires password):
```bash
brew install --cask docker
```

Then open Docker Desktop from Applications.

## Step 2: Verify Docker Installation

Once Docker Desktop is running, verify it's working:

```bash
docker --version
docker-compose --version
```

You should see version numbers for both commands.

## Step 3: Build and Run the App

Navigate to the project directory and run:

### Option A: Using Makefile (Recommended)
```bash
cd /Users/stephenpallam/primepixelapps/tadka_cms_final
make prod
```

### Option B: Using Docker Compose directly
```bash
cd /Users/stephenpallam/primepixelapps/tadka_cms_final
docker-compose up -d --build
```

### Option C: Using the start script
```bash
cd /Users/stephenpallam/primepixelapps/tadka_cms_final
chmod +x start.sh
./start.sh
```

## Step 4: Access the Application

Once the containers are running:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Useful Commands

### View logs:
```bash
make logs
# or
docker-compose logs -f
```

### Stop services:
```bash
make down
# or
docker-compose down
```

### Restart services:
```bash
make restart
# or
docker-compose restart
```

### Check status:
```bash
make status
# or
docker-compose ps
```

## Troubleshooting

### If ports 3000 or 8000 are already in use:
```bash
# Find what's using the port
lsof -i :3000
lsof -i :8000

# Kill the process or change ports in docker-compose.yml
```

### If containers fail to start:
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild from scratch
make rebuild
```

## Development Mode (with hot reload)

For development with auto-reload:
```bash
make dev
# or
docker-compose -f docker-compose.dev.yml up
```


