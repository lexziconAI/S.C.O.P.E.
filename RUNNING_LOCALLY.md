# Running MetaGuardian Locally

## 🎯 Current Status: RUNNING ✅

### Active Services

| Service | URL | Status | Terminal ID |
|---------|-----|--------|-------------|
| **Backend (FastAPI)** | http://localhost:8000 | ✅ Running | `88d481f0-f03e-4880-ac92-2c74b1589309` |
| **Frontend (Vite/React)** | http://localhost:5500 | ✅ Running | `b306dd92-85cb-4ff0-92df-5ece3f701d4f` |
| **API Documentation** | http://localhost:8000/docs | ✅ Available | - |
| **WebSocket Endpoint** | ws://localhost:8000/ws/openai-relay | ✅ Ready | - |

---

## 🚀 Quick Start (Services Already Running)

Your MetaGuardian application is **currently running**! Just open:

```
http://localhost:5500
```

---

## 🔄 Restart Services (If Needed)

### Method 1: Use PowerShell Scripts (Recommended)

#### Start Both Services Together
```powershell
.\start_all.ps1
```

#### Start Backend Only
```powershell
.\start_backend.ps1
```

#### Start Frontend Only
```powershell
.\start_frontend.ps1
```

### Method 2: Manual Commands

#### Backend (Terminal 1)
```powershell
cd "c:\Users\regan\ID SYSTEM\MetaGuardian\backend"
python -c "from database import init_quantum_db; init_quantum_db()"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend (Terminal 2)
```powershell
cd "c:\Users\regan\ID SYSTEM\MetaGuardian"
npm run dev
```

---

## 🛑 Stop Services

### Stop Individual Services
- **In Terminal**: Press `Ctrl+C` in the terminal running the service
- **Close Window**: Close the PowerShell window running the service

### Stop All Services
1. Find both PowerShell windows
2. Press `Ctrl+C` in each OR close the windows

---

## 📋 Service Details

### Backend (FastAPI + Uvicorn)

**Features:**
- FastAPI REST API
- WebSocket relay for OpenAI Realtime API
- Quantum storytelling database (SQLite)
- Constitutional AI validation
- Groq API integration for story synthesis
- SendGrid email service

**Environment Variables** (`.env`):
- `OPENAI_API_KEY` - OpenAI Realtime API key
- `GROQ_API_KEY` - Groq API for story synthesis
- `SENDGRID_API_KEY` - Email service
- `SECRET_KEY` - JWT authentication

**Database:**
- Location: `backend/metaguardian_quantum.db`
- Tables: 6 quantum storytelling tables
- Auto-initialized on startup

### Frontend (Vite + React)

**Features:**
- React 19 with TypeScript
- Real-time WebSocket communication
- Quantum storytelling dashboard
- Voice recording and playback
- Chart.js visualizations
- framer-motion animations

**Dependencies:**
- react, react-dom
- lucide-react (icons)
- chart.js, react-chartjs-2
- framer-motion
- @google/genai

---

## 🔍 Troubleshooting

### Backend Won't Start

**Error: `uvicorn not found`**
```powershell
pip install uvicorn fastapi
python -m uvicorn main:app --reload
```

**Error: `ModuleNotFoundError: No module named 'xyz'`**
```powershell
cd backend
pip install -r requirements.txt
```

**Error: Database initialization failed**
```powershell
cd backend
python -c "from database import init_quantum_db; init_quantum_db()"
```

### Frontend Won't Start

**Error: `Cannot find module`**
```powershell
npm install
npm run dev
```

**Error: Port already in use**
```powershell
# Check what's using the port
netstat -ano | findstr :5500
# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F
```

### WebSocket Connection Issues

1. **Verify backend is running**: http://localhost:8000/docs
2. **Check browser console** for WebSocket errors
3. **Ensure CORS is configured** (already done in `main.py`)
4. **Test WebSocket endpoint**:
```powershell
# Install wscat if needed: npm install -g wscat
wscat -c "ws://localhost:8000/ws/openai-relay?token=YOUR_JWT_TOKEN"
```

---

## 🧪 Testing the System

### 1. Register/Login
- Go to http://localhost:5500
- Create account or login
- You'll receive a JWT token

### 2. Start Voice Session
- Click "Start Session" button
- Allow microphone access
- Speak to MetaGuardian

### 3. Watch Real-time Updates
- Dashboard updates as you speak
- Narrative streams tracked live
- Quantum states visualized

### 4. Finalize Session
- Click "End Session"
- Groq generates living story synthesis
- Constitutional receipt emailed to you

### 5. Check Database
```powershell
cd backend
python
>>> from database import SessionLocal, QuantumSession
>>> db = SessionLocal()
>>> sessions = db.query(QuantumSession).all()
>>> print(len(sessions))
```

---

## 📊 Monitoring

### Backend Logs
- Watch Terminal 1 for API requests
- Errors logged to console
- Database operations logged

### Frontend Logs
- Open browser DevTools (F12)
- Check Console tab for React errors
- Network tab shows API/WebSocket traffic

### Database Inspection
```powershell
cd backend
# Install DB Browser for SQLite or use Python
python
>>> import sqlite3
>>> conn = sqlite3.connect('metaguardian_quantum.db')
>>> cursor = conn.cursor()
>>> cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
>>> print(cursor.fetchall())
```

---

## 🎨 Development Workflow

### Make Code Changes

1. **Backend Changes**: 
   - Edit Python files in `backend/`
   - Uvicorn auto-reloads on save
   - Check Terminal 1 for errors

2. **Frontend Changes**:
   - Edit React files in `components/` or `src/`
   - Vite hot-reloads instantly
   - Check browser console for errors

### Test Changes

1. Refresh browser (frontend usually auto-refreshes)
2. Test API endpoints: http://localhost:8000/docs
3. Check console logs in both terminals

### Commit Changes

```powershell
git add .
git commit -m "feat: description of changes"
git push origin main
```

---

## 🔒 Security Notes

- **API Keys**: Stored in `backend/.env` (not committed to git)
- **JWT Tokens**: 30-minute expiration
- **CORS**: Currently allows all origins (`*`) - tighten for production
- **Database**: SQLite file - use PostgreSQL for production

---

## 📦 Production Deployment

### Render (Recommended)

**Backend:**
```yaml
# render.yaml
services:
  - type: web
    name: metaguardian-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: OPENAI_API_KEY
        sync: false
      - key: GROQ_API_KEY
        sync: false
```

**Frontend:**
```yaml
  - type: web
    name: metaguardian-frontend
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run preview
```

### Alternative: Docker

```dockerfile
# Backend Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 💡 Tips

- **Keep terminals open**: Don't close the PowerShell windows running services
- **Check logs first**: Most issues show up in terminal output
- **Database resets**: Delete `metaguardian_quantum.db` and restart backend to reset
- **Hot reload**: Both backend and frontend auto-reload on code changes
- **API testing**: Use http://localhost:8000/docs for interactive API testing

---

**Document Version**: 1.0  
**Last Updated**: November 23, 2025  
**Services Status**: ✅ Running (Backend: 8000, Frontend: 5500)
