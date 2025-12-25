.PHONY: help build up down logs clean dev prod restart backend-logs frontend-logs

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Tadka CMS - Docker Compose Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

build: ## Build all Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker-compose build

up: ## Start all services in detached mode
	@echo "$(BLUE)Starting all services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8000"
	@echo "Backend Docs: http://localhost:8000/docs"

dev: ## Start all services in development mode with hot reload
	@echo "$(BLUE)Starting services in development mode...$(NC)"
	docker-compose -f docker-compose.dev.yml up
	
dev-detached: ## Start all services in development mode (detached)
	@echo "$(BLUE)Starting services in development mode (detached)...$(NC)"
	docker-compose -f docker-compose.dev.yml up -d
	@echo "$(GREEN)Development services started!$(NC)"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8000"

prod: ## Start all services in production mode
	@echo "$(BLUE)Starting services in production mode...$(NC)"
	docker-compose up -d --build
	@echo "$(GREEN)Production services started!$(NC)"

down: ## Stop all services
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose down
	docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
	@echo "$(GREEN)All services stopped!$(NC)"

restart: ## Restart all services
	@echo "$(BLUE)Restarting services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)Services restarted!$(NC)"

logs: ## Show logs from all services
	docker-compose logs -f

backend-logs: ## Show logs from backend service
	docker-compose logs -f backend

frontend-logs: ## Show logs from frontend service
	docker-compose logs -f frontend

ps: ## Show running containers
	docker-compose ps

clean: ## Stop and remove all containers, networks, and volumes
	@echo "$(YELLOW)Warning: This will remove all containers, networks, and volumes$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true; \
		echo "$(GREEN)Cleanup complete!$(NC)"; \
	fi

rebuild: ## Rebuild and restart all services
	@echo "$(BLUE)Rebuilding and restarting services...$(NC)"
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d
	@echo "$(GREEN)Services rebuilt and restarted!$(NC)"

shell-backend: ## Open a shell in the backend container
	docker-compose exec backend /bin/bash

shell-frontend: ## Open a shell in the frontend container
	docker-compose exec frontend /bin/sh

status: ## Check the health status of services
	@echo "$(BLUE)Service Status:$(NC)"
	@docker-compose ps

prune: ## Remove unused Docker data
	@echo "$(YELLOW)Removing unused Docker data...$(NC)"
	docker system prune -f
	@echo "$(GREEN)Prune complete!$(NC)"

