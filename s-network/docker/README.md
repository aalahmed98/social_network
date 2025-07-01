# Docker Configuration

This directory contains all Docker-related files for the Social Network application.

## Structure

```
docker/
├── frontend/
│   ├── Dockerfile          # Production frontend build
│   └── Dockerfile.dev      # Development frontend build
└── backend/
    └── Dockerfile          # Backend build (production & development)
```

## Usage

All Docker commands should be run from the project root:

```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up -d
```

## Build Contexts

- **Frontend**: `s-network/` (includes package.json, src/, etc.)
- **Backend**: `s-network/backend/` (includes go.mod, server.go, etc.)

The dockerfiles are referenced from the compose files in the project root.
