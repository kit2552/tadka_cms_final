# Tadka CMS - Local Development Setup Guide

This guide will help you run the Tadka CMS application locally **without Docker**.

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

1. **Python 3.10 or higher** (Current: 3.9.6 - needs upgrade)
2. **Node.js 18 or higher** (Current: v14.15.4 - needs upgrade)
3. **MongoDB** (Remote database is already configured in `.env`)

## Quick Setup Steps

### Step 1: Upgrade Python to 3.11+

```bash
# Install Python 3.11 via Homebrew (after Xcode CLI tools are installed)
brew install python@3.11

# Verify installation
python3.11 --version
```

### Step 2: Upgrade Node.js to v18+

```bash
# Install Node 18 via Homebrew
brew install node@18

# Link it to make it default
brew link node@18 --force --overwrite

# Verify installation
node --version  # Should show v18.x.x
```

### Step 3: Install Backend Dependencies

```bash
cd backend

# Create virtual environment with Python 3.11
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### Step 4: Install Frontend Dependencies

```bash
cd ../frontend

# Install npm packages
npm install
```

## Running the Application

### Terminal 1: Start Backend Server

```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at:
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Terminal 2: Start Frontend Server

```bash
cd frontend
npm start
```

The frontend will be available at:
- **App**: http://localhost:3000

## Quick Start Script

Alternatively, use the provided script:

```bash
# Make it executable (first time only)
chmod +x run_local.sh

# Install dependencies
./run_local.sh install

# Start both servers
./run_local.sh start

# Check status
./run_local.sh status

# Stop servers
./run_local.sh stop
```

## Environment Configuration

The `.env` file is already set up with:
- MongoDB connection (remote database)
- CORS settings for local development
- JWT secret key
- S3 configuration (if needed)

## Troubleshooting

### Python Version Issues

If you see errors like "requires Python 3.10+":
```bash
# Use pyenv to install Python 3.11
brew install pyenv
pyenv install 3.11
pyenv global 3.11
```

### Node Version Issues

If npm install fails:
```bash
# Use nvm to manage Node versions
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Permission Issues

If you encounter permission errors:
```bash
# Fix Homebrew permissions
sudo chown -R $(whoami) /usr/local/Cellar
sudo chown -R $(whoami) $(brew --prefix)/*
```

### Port Already in Use

If port 8000 or 3000 is already in use:
```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

## Development Commands

### Backend

```bash
# Run with auto-reload
uvicorn server:app --reload --port 8000

# Run tests
cd backend
pytest

# Check linting
flake8 .
```

### Frontend

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Default Admin Credentials

The system will create a default admin user on first startup:
- **Email**: admin@example.com
- **Password**: admin123

**⚠️ Change these credentials immediately in production!**

## Database

The application uses a remote MongoDB database configured in `.env`:
- Database: `tadka_cms`
- Collections: Users, Articles, Topics, Galleries, etc.

## File Uploads

- Local uploads are stored in: `backend/uploads/`
- S3 integration is optional (configured in `.env`)

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Common Issues

### 1. "Module not found" errors
```bash
# Reinstall dependencies
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install
```

### 2. "Cannot connect to MongoDB"
- Check your internet connection
- Verify the `MONGO_URL` in `.env` is correct

### 3. CORS errors
- Ensure `CORS_ORIGINS` in `.env` includes `http://localhost:3000`
- Restart the backend server after changing `.env`

## Next Steps

1. **Upgrade Python and Node** to the required versions
2. **Run the setup script**: `./run_local.sh install`
3. **Start the servers**: `./run_local.sh start`
4. **Access the app**: http://localhost:3000

## Support

For more information, check:
- `README.md` - General project documentation
- `docs/` - Additional documentation
- `docker-compose.yml` - Docker configuration (reference)

---

**Happy Coding! 🚀**

