#!/bin/bash

# Social Network Docker Management Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker and Docker Compose are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Requirements check passed"
}

# Start production environment
start_prod() {
    print_status "Starting production environment..."
    docker-compose up -d
    print_success "Production environment started"
    print_status "Frontend: http://localhost:3000"
    print_status "Backend: http://localhost:8080"
}

# Start development environment
start_dev() {
    print_status "Starting development environment..."
    docker-compose -f docker-compose.dev.yml up -d
    print_success "Development environment started"
    print_status "Frontend: http://localhost:3000"
    print_status "Backend: http://localhost:8080"
}

# Stop production environment
stop_prod() {
    print_status "Stopping production environment..."
    docker-compose down
    print_success "Production environment stopped"
}

# Stop development environment
stop_dev() {
    print_status "Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    print_success "Development environment stopped"
}

# View logs
logs() {
    local env=${1:-prod}
    if [ "$env" == "dev" ]; then
        print_status "Showing development logs..."
        docker-compose -f docker-compose.dev.yml logs -f
    else
        print_status "Showing production logs..."
        docker-compose logs -f
    fi
}

# Check status
status() {
    local env=${1:-prod}
    if [ "$env" == "dev" ]; then
        print_status "Development environment status:"
        docker-compose -f docker-compose.dev.yml ps
    else
        print_status "Production environment status:"
        docker-compose ps
    fi
}

# Rebuild containers
rebuild() {
    local env=${1:-prod}
    if [ "$env" == "dev" ]; then
        print_status "Rebuilding development environment..."
        docker-compose -f docker-compose.dev.yml down
        docker-compose -f docker-compose.dev.yml build --no-cache
        docker-compose -f docker-compose.dev.yml up -d
    else
        print_status "Rebuilding production environment..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
    fi
    print_success "Rebuild completed"
}

# Clean up Docker resources
cleanup() {
    print_warning "This will remove all stopped containers, unused networks, and dangling images"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up Docker resources..."
        docker system prune -f
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Reset data (WARNING: This deletes all data)
reset_data() {
    print_error "WARNING: This will delete ALL application data including database and uploads!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Resetting application data..."
        docker-compose down -v
        docker-compose -f docker-compose.dev.yml down -v
        print_success "Data reset completed"
    else
        print_status "Data reset cancelled"
    fi
}

# Backup data
backup() {
    local backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    print_status "Creating backup in $backup_dir..."
    
    mkdir -p "$backup_dir"
    
    # Backup database
    docker run --rm -v social-network_backend_data:/data -v "$(pwd)/$backup_dir":/backup alpine tar czf /backup/database.tar.gz /data
    
    # Backup uploads
    docker run --rm -v social-network_backend_uploads:/uploads -v "$(pwd)/$backup_dir":/backup alpine tar czf /backup/uploads.tar.gz /uploads
    
    print_success "Backup created in $backup_dir"
}

# Show help
show_help() {
    echo "Social Network Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start-prod          Start production environment"
    echo "  start-dev           Start development environment"
    echo "  stop-prod           Stop production environment"
    echo "  stop-dev            Stop development environment"
    echo "  logs [prod|dev]     Show logs (default: prod)"
    echo "  status [prod|dev]   Show container status (default: prod)"
    echo "  rebuild [prod|dev]  Rebuild and restart (default: prod)"
    echo "  cleanup             Clean up Docker resources"
    echo "  reset-data          Reset all application data (WARNING: destructive)"
    echo "  backup              Backup application data"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start-prod       # Start production environment"
    echo "  $0 logs dev         # Show development logs"
    echo "  $0 rebuild prod     # Rebuild production environment"
}

# Main script logic
main() {
    case "${1:-help}" in
        "start-prod")
            check_requirements
            start_prod
            ;;
        "start-dev")
            check_requirements
            start_dev
            ;;
        "stop-prod")
            stop_prod
            ;;
        "stop-dev")
            stop_dev
            ;;
        "logs")
            logs "$2"
            ;;
        "status")
            status "$2"
            ;;
        "rebuild")
            check_requirements
            rebuild "$2"
            ;;
        "cleanup")
            cleanup
            ;;
        "reset-data")
            reset_data
            ;;
        "backup")
            backup
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@" 