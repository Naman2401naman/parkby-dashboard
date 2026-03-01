# Deployment Guide - Parking Dashboard

## 🚀 Quick Start (Development)

### Prerequisites:
- Node.js 18+ installed
- MongoDB running (local or Atlas)
- Mapbox account with valid token

### Setup Steps:

1. **Install Dependencies:**
   ```bash
   npm install
   cd backend && npm install
   ```

2. **Configure Environment:**
   
   **Frontend `.env`:**
   ```env
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   VITE_API_URL=http://localhost:5000/api
   ```

   **Backend `.env`:**
   ```env
   MONGODB_URI=your_mongodb_connection_string
   PORT=5000
   NODE_ENV=development
   ```

3. **Start Development Servers:**
   
   **Terminal 1 (Backend):**
   ```bash
   cd backend
   npm run dev
   ```

   **Terminal 2 (Frontend):**
   ```bash
   npm run dev
   ```

4. **Access Application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000/api

---

## 📦 Production Deployment

### Option 1: Traditional Hosting (VPS/Cloud)

#### Backend Deployment:
```bash
cd backend
npm run build
npm start
```

**Environment Variables (Production):**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/parking
PORT=5000
NODE_ENV=production
```

#### Frontend Deployment:
```bash
npm run build
# Deploy 'dist' folder to static hosting
```

**Update `.env` for production:**
```env
VITE_MAPBOX_TOKEN=your_production_token
VITE_API_URL=https://your-api-domain.com/api
```

### Option 2: Vercel (Frontend) + Railway (Backend)

#### Backend on Railway:
1. Connect GitHub repo
2. Set root directory to `backend`
3. Add environment variables
4. Deploy automatically

#### Frontend on Vercel:
1. Import GitHub repo
2. Framework: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables

### Option 3: Docker Deployment

**Dockerfile (Backend):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

**Dockerfile (Frontend):**
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - NODE_ENV=production
    depends_on:
      - mongodb

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

---

## 🔒 Security Checklist

- [ ] Use HTTPS in production
- [ ] Set CORS to specific domains (not `*`)
- [ ] Use environment variables for secrets
- [ ] Enable MongoDB authentication
- [ ] Rate limit API endpoints
- [ ] Validate all user inputs
- [ ] Use Mapbox token restrictions (URL whitelist)

---

## 📊 Monitoring

### Health Checks:
- Backend: `GET /health`
- Database: Check MongoDB connection logs

### Logging:
- Backend logs to console (use PM2 or similar for production)
- Frontend errors in browser console

---

## 🛠️ Troubleshooting

### Map Not Loading:
1. Check Mapbox token validity
2. Verify token URL restrictions
3. Check browser console for 401 errors

### Backend Connection Failed:
1. Verify MongoDB connection string
2. Check firewall/network settings
3. Ensure backend server is running

### Data Not Persisting:
1. Check MongoDB connection
2. Verify API endpoints responding
3. Check browser network tab for errors

---

## 📈 Performance Optimization

### Frontend:
- Enable Vite build optimizations
- Use CDN for static assets
- Implement lazy loading for components
- Compress images and assets

### Backend:
- Enable MongoDB indexing
- Use connection pooling
- Implement caching (Redis)
- Enable gzip compression

---

## 🔄 Updates & Maintenance

### Updating Dependencies:
```bash
npm update
cd backend && npm update
```

### Database Backups:
```bash
mongodump --uri="your_mongodb_uri" --out=/backup/path
```

### Rolling Back:
```bash
git checkout previous_commit_hash
npm install
npm run build
```

---

**Support:** For issues, check logs and console errors first.
**Version:** 1.0.0
**Last Updated:** 2026-02-13
