# Database Persistence Fix Guide

## Problem
When deploying your social network backend on services like Render.com, the SQLite database was being reset on every deployment because it was stored in the container's ephemeral filesystem.

## Solution
We've implemented configurable database and uploads paths that support persistent storage:

### 🔧 What Was Fixed

1. **Environment Variable Support**: Database and uploads paths are now configurable via environment variables
2. **Persistent Storage Paths**: Automatic detection of production environment with persistent storage paths
3. **Consistent Upload Handling**: All upload handlers now use the same configurable path system

### 📁 Directory Structure

#### Development (Local)
```
./data/social-network.db      # Database
./uploads/                    # File uploads
  ├── avatars/               # User avatars
  ├── banners/               # Profile banners
  ├── posts/                 # Post images
  ├── comments/              # Comment images
  └── groups/                # Group images
```

#### Production (Render.com)
```
/opt/render/project/data/social-network.db    # Persistent database
/opt/render/project/uploads/                  # Persistent uploads
  ├── avatars/
  ├── banners/
  ├── posts/
  ├── comments/
  └── groups/
```

### 🌍 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | Full path to SQLite database file | Auto-detected |
| `UPLOADS_PATH` | Full path to uploads directory | Auto-detected |
| `NODE_ENV` | Environment (development/production) | development |
| `RENDER` | Render.com detection flag | - |

### 🚀 Deployment Instructions

#### For Render.com

1. **Deploy Your Backend**:
   ```bash
   git add .
   git commit -m "Fix database persistence"
   git push origin main
   ```

2. **Set Environment Variables** (Optional):
   - Go to your Render.com service dashboard
   - Navigate to "Environment"
   - Add variables if you want custom paths:
     ```
     NODE_ENV=production
     DATABASE_PATH=/opt/render/project/data/social-network.db
     UPLOADS_PATH=/opt/render/project/uploads
     ```

3. **Persistent Disk Setup** (Render.com Paid Plans):
   - Go to your service settings
   - Add a persistent disk mounted at `/opt/render/project`
   - Size: 1GB+ (depending on your needs)

#### For Other Platforms

1. **Docker with Volumes**:
   ```bash
   docker run -d \
     -p 8080:8080 \
     -v /path/to/persistent/data:/opt/render/project/data \
     -v /path/to/persistent/uploads:/opt/render/project/uploads \
     -e NODE_ENV=production \
     your-app:latest
   ```

2. **Custom Environment**:
   ```bash
   export DATABASE_PATH="/custom/path/database.db"
   export UPLOADS_PATH="/custom/path/uploads"
   export NODE_ENV="production"
   ./server
   ```

### 🔄 Migration Process

#### Existing Render.com Deployment
If you had data before this fix, it's likely lost due to the ephemeral filesystem. Going forward, your data will persist.

#### Backing Up Data (Local Development)
```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz data/ uploads/

# Restore backup
tar -xzf backup-YYYYMMDD.tar.gz
```

### 📊 Monitoring

Check if persistence is working:

1. **Database Location**:
   - Check your backend logs for: `"Using database path: /opt/render/project/data/social-network.db"`

2. **Uploads Location**:
   - Check your backend logs for: `"Using uploads directory: /opt/render/project/uploads"`

3. **Test Persistence**:
   - Create a user, post, or upload an image
   - Trigger a deployment (push a small change)
   - Verify your data still exists

### 🛠️ Troubleshooting

#### Database Still Resetting
- Check Render.com logs for the database path being used
- Ensure you're on a paid plan if using persistent disks
- Verify environment variables are set correctly

#### Upload Files Not Persisting
- Check that `UPLOADS_PATH` points to a persistent location
- Verify upload subdirectories are being created
- Check file permissions (should be 755)

#### Permission Errors
```bash
# If running in Docker, ensure correct permissions
RUN mkdir -p /opt/render/project/data /opt/render/project/uploads
RUN chmod -R 755 /opt/render/project
```

### ✅ Success Indicators

- ✅ Database path shows: `/opt/render/project/data/social-network.db`
- ✅ Uploads path shows: `/opt/render/project/uploads`
- ✅ User accounts persist after deployments
- ✅ Uploaded images remain accessible
- ✅ No more "Internal Server Error" on data operations

### 🔮 Alternative Solutions

#### For High-Scale Applications
Consider migrating to a dedicated database service:

1. **PostgreSQL** (Recommended):
   - Railway PostgreSQL
   - Supabase
   - Render PostgreSQL

2. **Cloud Storage** for uploads:
   - AWS S3
   - Cloudflare R2
   - Digital Ocean Spaces

This would require code changes but provides better scalability and reliability.

### 🎯 Quick Test

After deployment, test persistence:

1. Register a new user
2. Upload a profile picture
3. Create a post with an image
4. Note the user ID and post ID
5. Deploy a small change (add a comment to code)
6. Verify the user and post still exist
7. Check that uploaded images still load

Your social network should now maintain all data across deployments! 🎉 