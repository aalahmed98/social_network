# Vercel Deployment Guide for S-Network

## Overview
Your S-Network application is now configured for Vercel deployment. This guide ensures everything runs smoothly in production.

## 🚀 Quick Deployment Steps

### 1. Backend Deployment (Required First)
Your Go backend needs to be deployed separately. Recommended options:

#### Option A: Railway.app (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy backend
cd backend
railway up
```

#### Option B: Render.com
1. Connect your GitHub repository
2. Select `backend` folder as root directory
3. Use Docker deployment with the provided Dockerfile

#### Option C: Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy backend
cd backend
fly deploy
```

### 2. Vercel Environment Configuration
In your Vercel dashboard, add these environment variables:

#### Required Environment Variables:
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.com
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

#### Optional Environment Variables:
```
VERCEL_ENV=production
ENABLE_ANALYTICS=false
ENABLE_ERROR_REPORTING=false
```

### 3. Update Next.js Configuration
Update `next.config.mjs` line 9 with your actual backend domain:
```javascript
{
  protocol: "https",
  hostname: "your-actual-backend-domain.com", // Replace this
  pathname: "/uploads/**",
},
```

### 4. Backend CORS Configuration
Ensure your backend Go server allows your Vercel domain. Update the CORS settings in `backend/server.go`:

```go
// Add your Vercel domain to allowed origins
if origin == "https://your-vercel-app.vercel.app" ||
   origin == "https://social-network-nu-umber.vercel.app" {
    w.Header().Set("Access-Control-Allow-Origin", origin)
}
```

## 🔧 Production Optimizations Made

### Next.js Configuration Updates:
- ✅ Removed localhost-specific configurations
- ✅ Added production-ready image domains
- ✅ Optimized caching headers
- ✅ Conditional API rewrites for development only
- ✅ Added experimental performance optimizations

### Vercel-Specific Optimizations:
- ✅ Added `vercel.json` configuration
- ✅ Optimized build process
- ✅ Set appropriate regions and timeouts
- ✅ Configured clean URLs

## 🧪 Testing Your Deployment

### 1. Check Backend Connection
Visit your deployed app and open browser DevTools:
```javascript
// Run in browser console
fetch('/api/health')
  .then(res => res.json())
  .then(data => console.log('Backend Status:', data))
  .catch(err => console.error('Backend Error:', err));
```

### 2. Test Authentication
1. Try registering a new account
2. Test login functionality
3. Check if protected routes work

### 3. Test Image Uploads
1. Create a post with an image
2. Verify images display correctly
3. Check avatar uploads in profile

## 🛠️ Troubleshooting Common Issues

### Issue: "Failed to fetch posts"
**Solution:**
1. Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
2. Check backend CORS configuration
3. Ensure backend is running and accessible

### Issue: Images not loading
**Solution:**
1. Update `next.config.mjs` with correct backend domain
2. Verify image upload paths on backend
3. Check CORS headers for `/uploads/` paths

### Issue: Authentication not working
**Solution:**
1. Check session configuration in backend
2. Verify cookies are being sent with `credentials: 'include'`
3. Ensure CORS allows credentials

### Issue: WebSocket connections failing
**Solution:**
1. Check if your backend hosting supports WebSockets
2. Update WebSocket URLs to use production backend
3. Consider using Socket.IO for better compatibility

## 📊 Performance Monitoring

### Vercel Analytics (Optional)
Add to your Vercel project:
```bash
npm install @vercel/analytics
```

Then add to your `layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## 🔐 Security Considerations

### Environment Variables
- Never commit `.env` files
- Use Vercel's environment variable management
- Rotate secrets regularly

### CORS Security
- Restrict CORS to your specific domains
- Don't use wildcards in production
- Regularly audit allowed origins

### Session Security
- Use HTTPS in production
- Set secure cookie flags
- Implement proper session timeout

## 📈 Scaling Considerations

### Database
- Consider migrating from SQLite to PostgreSQL for production
- Implement connection pooling
- Add database backups

### File Storage
- Consider using cloud storage (S3, Cloudinary) for uploads
- Implement CDN for better performance
- Add file size limits

### Caching
- Implement Redis for session storage
- Add API response caching
- Use Vercel's Edge Functions for static content

## 🔄 CI/CD Pipeline

### Automatic Deployments
1. Connect GitHub repository to Vercel
2. Enable automatic deployments on push
3. Set up preview deployments for branches

### Build Optimization
- Use `npm ci` instead of `npm install`
- Enable build cache
- Optimize bundle size

## 📱 Mobile Optimization

Your app includes:
- ✅ Responsive design
- ✅ Mobile-first approach
- ✅ Touch-friendly interface
- ✅ Progressive Web App features

## 🎯 Next Steps

1. **Deploy Backend**: Choose a hosting provider and deploy your Go backend
2. **Configure Environment Variables**: Set up all required environment variables in Vercel
3. **Update Domains**: Replace placeholder domains with actual backend URL
4. **Test Thoroughly**: Run through all application features
5. **Monitor Performance**: Set up monitoring and analytics
6. **Security Audit**: Review and implement security best practices

## 📞 Support

If you encounter issues:
1. Check Vercel build logs
2. Review browser console for errors
3. Verify backend logs
4. Test API endpoints directly

Your application is now optimized for production deployment on Vercel! 🚀 