#!/bin/bash

# Tadka CMS - Quick Start Script
# This script helps you quickly build and start the Tadka CMS application

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

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_message "❌ Docker is not installed. Please install Docker first." "${RED}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_message "❌ Docker Compose is not installed. Please install Docker Compose first." "${RED}"
        exit 1
    fi
    
    print_message "✅ Docker and Docker Compose are installed" "${GREEN}"
}

# Setup environment file
setup_env() {
    if [ ! -f ".env" ]; then
        print_message "📝 Setting up environment file..." "${YELLOW}"
        cp env.example .env
        print_message "✅ Environment file created (.env)" "${GREEN}"
        print_message "⚠️  Please review and update .env with your configuration" "${YELLOW}"
    else
        print_message "✅ Environment file already exists" "${GREEN}"
    fi
}

# Build the application
build_app() {
    print_header "Building Docker Images"
    docker-compose build
    print_message "✅ Build complete!" "${GREEN}"
}

# Start the application
start_app() {
    print_header "Starting Tadka CMS"
    docker-compose up -d
    print_message "✅ Application started!" "${GREEN}"
}

# Show access information
show_info() {
    print_header "Application is Ready!"
    echo "📱 Frontend:       http://localhost:3000"
    echo "🚀 Backend API:    http://localhost:8000"
    echo "📚 API Docs:       http://localhost:8000/docs"
    echo "🏥 Health Check:   http://localhost:8000/health"
    echo ""
    print_message "💡 Useful Commands:" "${BLUE}"
    echo "   View logs:      docker-compose logs -f"
    echo "   Stop services:  docker-compose down"
    echo "   Restart:        docker-compose restart"
    echo ""
    echo "   Or use Makefile:"
    echo "   make help       Show all available commands"
    echo "   make logs       View logs"
    echo "   make down       Stop services"
    echo ""
}

# Main script
main() {
    print_header "Tadka CMS - Docker Setup"
    
    # Check prerequisites
    check_docker
    
    # Setup environment
    setup_env
    
    # Ask user what to do
    echo ""
    print_message "What would you like to do?" "${BLUE}"
    echo "1) Build and start (Production mode)"
    echo "2) Start in development mode (with hot reload)"
    echo "3) Just build (don't start)"
    echo "4) Exit"
    echo ""
    read -p "Enter your choice [1-4]: " choice
    
    case $choice in
        1)
            build_app
            start_app
            show_info
            ;;
        2)
            print_header "Starting in Development Mode"
            docker-compose -f docker-compose.dev.yml up -d
            show_info
            print_message "🔥 Hot reload is enabled!" "${YELLOW}"
            ;;
        3)
            build_app
            print_message "✅ Build complete. Run 'docker-compose up -d' to start." "${GREEN}"
            ;;
        4)
            print_message "👋 Goodbye!" "${BLUE}"
            exit 0
            ;;
        *)
            print_message "❌ Invalid choice" "${RED}"
            exit 1
            ;;
    esac
}

# Run main function
main

