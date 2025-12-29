#!/bin/bash

# Tadka CMS - Local Development Setup (Without Docker)
# This script helps you run the app locally

set -e  # Exit on error

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print colored message
print_message() {
    echo -e "${2}${1}${NC}"
}

# Print header
print_header() {
    echo ""
    echo "======================================"
    print_message "$1" "${BLUE}"
    echo "======================================"
    echo ""
}

# Check Node version
check_node() {
    print_header "Checking Node.js Version"
    
    REQUIRED_NODE_VERSION=18
    CURRENT_NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$CURRENT_NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
        print_message "⚠️  Current Node.js version: v$CURRENT_NODE_VERSION" "${YELLOW}"
        print_message "⚠️  Required Node.js version: v$REQUIRED_NODE_VERSION or higher" "${YELLOW}"
        echo ""
        print_message "Please upgrade Node.js:" "${RED}"
        echo "  Option 1 - Using Homebrew:"
        echo "    brew install node@18"
        echo ""
        echo "  Option 2 - Using NVM (Node Version Manager):"
        echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        echo "    nvm install 18"
        echo "    nvm use 18"
        echo ""
        echo "  Option 3 - Download from:"
        echo "    https://nodejs.org/"
        echo ""
        exit 1
    else
        print_message "✅ Node.js version: v$CURRENT_NODE_VERSION" "${GREEN}"
    fi
}

# Check Python version
check_python() {
    print_header "Checking Python Version"
    
    if ! command -v python3 &> /dev/null; then
        print_message "❌ Python 3 is not installed" "${RED}"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 --version)
    print_message "✅ $PYTHON_VERSION" "${GREEN}"
}

# Check if .env exists
check_env() {
    print_header "Checking Environment Configuration"
    
    if [ ! -f ".env" ]; then
        print_message "⚠️  .env file not found. Creating from env.example..." "${YELLOW}"
        cp env.example .env
        print_message "✅ .env file created" "${GREEN}"
        print_message "⚠️  Please review and update .env with your configuration" "${YELLOW}"
    else
        print_message "✅ .env file exists" "${GREEN}"
    fi
}

# Install backend dependencies
install_backend() {
    print_header "Installing Backend Dependencies"
    
    cd backend
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        print_message "📦 Creating Python virtual environment..." "${YELLOW}"
        python3 -m venv venv
        print_message "✅ Virtual environment created" "${GREEN}"
    fi
    
    # Activate virtual environment
    print_message "📦 Activating virtual environment..." "${YELLOW}"
    source venv/bin/activate
    
    # Install dependencies
    print_message "📦 Installing Python packages..." "${YELLOW}"
    pip install --upgrade pip
    pip install -r requirements.txt
    
    print_message "✅ Backend dependencies installed" "${GREEN}"
    
    cd ..
}

# Install frontend dependencies
install_frontend() {
    print_header "Installing Frontend Dependencies"
    
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        print_message "📦 Installing Node.js packages..." "${YELLOW}"
        npm install
        print_message "✅ Frontend dependencies installed" "${GREEN}"
    else
        print_message "✅ Frontend dependencies already installed" "${GREEN}"
    fi
    
    cd ..
}

# Start backend server
start_backend() {
    print_header "Starting Backend Server"
    
    cd backend
    source venv/bin/activate
    
    print_message "🚀 Starting FastAPI server on http://localhost:8000" "${GREEN}"
    print_message "📚 API Documentation: http://localhost:8000/docs" "${BLUE}"
    
    # Start backend in background
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    
    print_message "✅ Backend started (PID: $BACKEND_PID)" "${GREEN}"
    
    cd ..
}

# Start frontend server
start_frontend() {
    print_header "Starting Frontend Server"
    
    cd frontend
    
    print_message "🚀 Starting React app on http://localhost:3000" "${GREEN}"
    
    # Start frontend in background
    npm start &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    
    print_message "✅ Frontend started (PID: $FRONTEND_PID)" "${GREEN}"
    
    cd ..
}

# Stop servers
stop_servers() {
    print_header "Stopping Servers"
    
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        kill $BACKEND_PID 2>/dev/null || true
        rm backend.pid
        print_message "✅ Backend stopped" "${GREEN}"
    fi
    
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        kill $FRONTEND_PID 2>/dev/null || true
        rm frontend.pid
        print_message "✅ Frontend stopped" "${GREEN}"
    fi
}

# Show server status
show_status() {
    print_header "Server Status"
    
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        if ps -p $BACKEND_PID > /dev/null; then
            print_message "✅ Backend running (PID: $BACKEND_PID)" "${GREEN}"
        else
            print_message "❌ Backend not running" "${RED}"
        fi
    else
        print_message "❌ Backend not running" "${RED}"
    fi
    
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        if ps -p $FRONTEND_PID > /dev/null; then
            print_message "✅ Frontend running (PID: $FRONTEND_PID)" "${GREEN}"
        else
            print_message "❌ Frontend not running" "${RED}"
        fi
    else
        print_message "❌ Frontend not running" "${RED}"
    fi
}

# Show information
show_info() {
    print_header "Application is Ready!"
    echo "📱 Frontend:       http://localhost:3000"
    echo "🚀 Backend API:    http://localhost:8000"
    echo "📚 API Docs:       http://localhost:8000/docs"
    echo "🏥 Health Check:   http://localhost:8000/health"
    echo ""
    print_message "💡 Useful Commands:" "${BLUE}"
    echo "   ./run_local.sh status    - Check server status"
    echo "   ./run_local.sh stop      - Stop all servers"
    echo "   ./run_local.sh restart   - Restart all servers"
    echo ""
    print_message "📝 View logs:" "${BLUE}"
    echo "   Backend logs:  tail -f backend/logs/*.log"
    echo "   Frontend: Check the terminal where npm start is running"
    echo ""
}

# Main menu
show_menu() {
    print_header "Tadka CMS - Local Development"
    echo "1) Install dependencies only"
    echo "2) Start servers (install if needed)"
    echo "3) Stop servers"
    echo "4) Check status"
    echo "5) Restart servers"
    echo "6) Exit"
    echo ""
}

# Main script
main() {
    case "$1" in
        install)
            check_python
            check_node
            check_env
            install_backend
            install_frontend
            ;;
        start)
            check_python
            check_node
            check_env
            
            # Install if needed
            if [ ! -d "backend/venv" ] || [ ! -d "frontend/node_modules" ]; then
                install_backend
                install_frontend
            fi
            
            start_backend
            sleep 3  # Wait for backend to start
            start_frontend
            sleep 2
            show_info
            ;;
        stop)
            stop_servers
            ;;
        status)
            show_status
            ;;
        restart)
            stop_servers
            sleep 2
            $0 start
            ;;
        *)
            if [ -z "$1" ]; then
                # Interactive mode
                show_menu
                read -p "Enter your choice [1-6]: " choice
                
                case $choice in
                    1)
                        check_python
                        check_node
                        check_env
                        install_backend
                        install_frontend
                        print_message "✅ Installation complete! Run './run_local.sh start' to start servers" "${GREEN}"
                        ;;
                    2)
                        $0 start
                        ;;
                    3)
                        $0 stop
                        ;;
                    4)
                        $0 status
                        ;;
                    5)
                        $0 restart
                        ;;
                    6)
                        print_message "👋 Goodbye!" "${BLUE}"
                        exit 0
                        ;;
                    *)
                        print_message "❌ Invalid choice" "${RED}"
                        exit 1
                        ;;
                esac
            else
                echo "Usage: $0 {install|start|stop|status|restart}"
                echo ""
                echo "Commands:"
                echo "  install  - Install all dependencies"
                echo "  start    - Start both backend and frontend servers"
                echo "  stop     - Stop all running servers"
                echo "  status   - Check if servers are running"
                echo "  restart  - Restart all servers"
                echo ""
                echo "Or run without arguments for interactive menu"
                exit 1
            fi
            ;;
    esac
}

# Run main function
main "$@"

