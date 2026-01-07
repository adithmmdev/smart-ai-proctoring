# Smart AI Proctoring System

A full-stack MERN application for AI-powered exam proctoring with real-time monitoring, face detection, and automated violation tracking.

## 🚀 Deployment Guide

This project is configured for free deployment using:
- **Vercel** - React Frontend
- **Render** - Node.js/Express Backend  
- **MongoDB Atlas** - Database

---

## 📋 Prerequisites

- GitHub account
- Vercel account (free tier)
- Render account (free tier)
- MongoDB Atlas account (free tier)

---

## 🗄️ Step 1: Setup MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Create a database user:
   - Go to **Database Access** → **Add New Database User**
   - Set username and password (save these!)
4. Whitelist your IP:
   - Go to **Network Access** → **Add IP Address**
   - Click **Allow Access from Anywhere** (for production) or add specific IPs
5. Get your connection string:
   - Go to **Database** → **Connect** → **Connect your application**
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/database-name?retryWrites=true&w=majority`)
   - Replace `<password>` with your database user password
   - Replace `<database-name>` with your database name

---

## 🖥️ Step 2: Deploy Backend on Render

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Sign up/login with GitHub

3. **Create New Web Service**
   - Click **New +** → **Web Service**
   - Connect your GitHub repository
   - Select the repository

4. **Configure Backend Service**
   - **Name**: `proctoring-backend` (or any name)
   - **Region**: `Oregon` (or closest to you)
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node app.js`

5. **Set Environment Variables** (in Render dashboard):
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name?retryWrites=true&w=majority
   JWT_SECRET=your-super-secret-jwt-key-here-minimum-32-characters
   FRONTEND_URL=https://your-frontend-url.vercel.app
   PORT=3000
   ```
   - Use the MongoDB connection string from Step 1
   - Generate a strong JWT_SECRET (use `openssl rand -hex 32` or similar)
   - **Leave FRONTEND_URL blank for now** - you'll update it after deploying frontend

6. **Deploy**
   - Click **Create Web Service**
   - Wait for deployment to complete (usually 2-5 minutes)
   - Copy your backend URL (e.g., `https://proctoring-backend.onrender.com`)

7. **Test Backend**
   - Visit `https://your-backend-url.onrender.com/` in browser
   - Should see: "Backend running."

---

## 🌐 Step 3: Deploy Frontend on Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign up/login with GitHub

2. **Import Project**
   - Click **Add New...** → **Project**
   - Import your GitHub repository
   - Select the repository

3. **Configure Frontend**
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **Set Environment Variables** (in Vercel dashboard):
   ```
   VITE_API_BASE_URL=https://your-render-backend-url.onrender.com
   ```
   - Use the Render backend URL from Step 2

5. **Deploy**
   - Click **Deploy**
   - Wait for deployment to complete (usually 1-3 minutes)
   - Copy your frontend URL (e.g., `https://your-app.vercel.app`)

6. **Update Backend CORS**
   - Go back to Render dashboard
   - Update the `FRONTEND_URL` environment variable with your Vercel URL
   - Render will automatically redeploy

---

## ✅ Step 4: Verify Deployment

1. **Test Backend Health**
   - Visit: `https://your-backend-url.onrender.com/`
   - Should see: "Backend running."

2. **Test Frontend**
   - Visit your Vercel URL
   - Try logging in (you may need to create users first)

3. **Check API Calls**
   - Open browser DevTools → Network tab
   - All API calls should go to your Render backend URL
   - Should see successful responses (200 status)

---

## 🔧 Local Development Setup

### Backend
```bash
cd backend
npm install
# Copy .env.example to config/config.env and fill in values
npm run dev  # Uses nodemon for auto-reload
```

### Frontend
```bash
cd frontend
npm install
# Copy .env.example to .env and fill in values
npm run dev  # Starts Vite dev server
```

---

## 📝 Environment Variables Summary

### Backend (Render)
- `MONGO_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `FRONTEND_URL` - Vercel frontend URL (for CORS)
- `PORT` - Server port (default: 3000)

### Frontend (Vercel)
- `VITE_API_BASE_URL` - Render backend URL

---

## 🐛 Troubleshooting

### Backend Issues
- **Database connection fails**: Check MONGO_URI format and network access in MongoDB Atlas
- **CORS errors**: Verify FRONTEND_URL matches your Vercel URL exactly
- **Build fails**: Check that `startCommand` is `node app.js` (not `nodemon`)

### Frontend Issues
- **API calls fail**: Verify VITE_API_BASE_URL is set correctly in Vercel
- **Build fails**: Check that all dependencies are in package.json
- **404 errors**: Ensure vercel.json routes are configured correctly

### Common Solutions
- Clear browser cache
- Check environment variables are set correctly
- Verify URLs don't have trailing slashes
- Check Render/Vercel deployment logs for errors

---

## 📁 Project Structure

```
├── backend/
│   ├── app.js              # Main server file
│   ├── config/
│   │   ├── db.js           # MongoDB connection
│   │   └── config.env      # Environment variables
│   ├── controllers/        # Route controllers
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── render.yaml         # Render deployment config
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── config.ts       # API configuration
│   │   ├── App.tsx         # Main app component
│   │   └── components/      # React components
│   ├── vercel.json         # Vercel deployment config
│   └── package.json
└── README.md
```

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)

---

## 🎉 Success!

Your Smart AI Proctoring System should now be live and accessible at your Vercel URL!

**Note**: Free tiers on Render may spin down after inactivity. The first request after inactivity may take 30-60 seconds to wake up the service.

