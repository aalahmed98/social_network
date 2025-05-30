# 🐳 Docker Setup for Social Network Application

This guide explains how to run the Social Network application using Docker and Docker Compose.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers

## 🚀 Quick Start

### Production Mode

```bash
# Clone the repository
git clone <repository-url>
cd social-network

# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Development Mode

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

## 🏗️ Architecture

### Services

#### Backend (`social-network-backend`)

- **Port**: 8080
- **Technology**: Go with Gorilla WebSocket
- **Database**: SQLite
- **Features**: REST API, WebSocket support, File uploads

#### Frontend (`social-network-frontend`)

- **Port**: 3000
- **Technology**: Next.js React
- **Features**: Modern UI, Real-time chat, Responsive design

### Networking

- Custom bridge network `social-network`
- Services communicate via container names
- Frontend connects to backend at `http://backend:8080` (internal)
- External access via `localhost:3000` (frontend) and `localhost:8080` (backend)

### Volumes

- `backend_data`: Persistent SQLite database storage
- `backend_uploads`: User-uploaded files (avatars, images)

## 🔧 Configuration

### Environment Variables

#### Backend

```env
PORT=8080
DATABASE_URL=sqlite:///data/social-network.db
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CORS_ORIGIN=http://localhost:3000
```

#### Frontend

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NODE_ENV=production
```

### Custom Configuration

Create a `.env` file in the project root:

```env
# Backend Configuration
BACKEND_PORT=8080
JWT_SECRET=your-custom-secret-key
CORS_ORIGIN=http://localhost:3000

# Frontend Configuration
FRONTEND_PORT=3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

## 📊 Monitoring & Health Checks

Both services include health checks:

- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3
- **Start Period**: 40 seconds

Check service health:

```bash
docker-compose ps
```

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Check what's using the ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :8080

# Stop existing processes or change ports in docker-compose.yml
```

#### Database Issues

```bash
# Reset database (WARNING: This deletes all data)
docker-compose down -v
docker-compose up -d
```

#### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### Container Shell Access

```bash
# Backend container
docker-compose exec backend sh

# Frontend container
docker-compose exec frontend sh
```

### Performance Optimization

#### For Development

- Use `docker-compose.dev.yml` for hot reloading
- Mount source code as volumes for real-time changes

#### For Production

- Use multi-stage builds (already implemented)
- Enable resource limits if needed:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
```

## 🛠️ Advanced Usage

### Scaling Services

```bash
# Scale frontend instances
docker-compose up -d --scale frontend=2

# Note: Backend should typically run as single instance due to SQLite
```

### Custom Networks

```bash
# Create external network
docker network create social-network-external

# Use in docker-compose.yml:
networks:
  default:
    external: true
    name: social-network-external
```

### Data Backup

```bash
# Backup database and uploads
docker run --rm -v social-network_backend_data:/data -v $(pwd):/backup alpine tar czf /backup/database-backup.tar.gz /data
docker run --rm -v social-network_backend_uploads:/uploads -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz /uploads
```

### Data Restore

```bash
# Restore database
docker run --rm -v social-network_backend_data:/data -v $(pwd):/backup alpine tar xzf /backup/database-backup.tar.gz -C /
```

## 🔐 Security Considerations

### Production Deployment

1. **Change default secrets**:

   - JWT_SECRET
   - Database passwords (if using external DB)

2. **Use HTTPS**:

   - Add reverse proxy (nginx/traefik)
   - SSL certificates

3. **Network Security**:

   - Use custom networks
   - Restrict external access
   - Firewall rules

4. **Resource Limits**:
   - Set memory/CPU limits
   - Monitor resource usage

### Example Production Setup with Nginx

```yaml
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

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Guide](https://nextjs.org/docs/deployment#docker-image)
- [Go Docker Best Practices](https://docs.docker.com/language/golang/)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs -f`
3. Verify Docker and Docker Compose versions
4. Check system resources (RAM, disk space)
5. Create an issue with detailed error logs
