# How to Start MongoDB and Backend

## Quick Start Guide

### 1. Start MongoDB (Required - Admin Privileges)

**Option A: PowerShell (Run as Administrator)**
```powershell
net start MongoDB
```

**Option B: Services Manager**
1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "MongoDB Server (MongoDB)"
4. Right-click → Start

**Option C: Command Prompt (Run as Administrator)**
```cmd
net start MongoDB
```

### 2. Verify MongoDB is Running

```powershell
Get-Service MongoDB | Select-Object Name, Status
```

Should show: `Status: Running`

### 3. Start Backend Server

```powershell
cd backend
npm start
```

### 4. Create Test Users (Optional)

```powershell
cd backend
npm run create-users
```

This creates:
- Admin: `admin@test.com` / `admin123`
- Student: `student@test.com` / `student123`

### 5. Start Frontend

```powershell
cd frontend
npm run dev
```

## Troubleshooting

### MongoDB won't start
- Make sure you have administrator privileges
- Check if MongoDB is installed correctly
- Check MongoDB logs in: `C:\Program Files\MongoDB\Server\[version]\log\`

### Backend crashes on startup
- Verify MongoDB is running first
- Check the connection string in `backend/config/config.env`
- Default: `mongodb://localhost:27017/exam-proctoring`

### Connection refused errors
- Ensure MongoDB service is running
- Check if port 27017 is available
- Verify firewall isn't blocking MongoDB

## Quick Commands Summary

```powershell
# Start MongoDB (as Admin)
net start MongoDB

# Check MongoDB status
Get-Service MongoDB

# Start Backend
cd backend
npm start

# Create test users
cd backend
npm run create-users

# Start Frontend
cd frontend
npm run dev
```

