# MetaGuardian Backend Startup Script (Persistent)
# This script ensures the backend stays running without auto-shutdown

Write-Host "🚀 Starting MetaGuardian Backend (Persistent Mode)..." -ForegroundColor Cyan

# Navigate to backend directory
$BackendPath = "$PSScriptRoot\backend"
Set-Location $BackendPath

# Check if virtual environment exists
if (-Not (Test-Path "venv")) {
    Write-Host "📦 Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "🔧 Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Install/update dependencies
Write-Host "📥 Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

# Check for .env file
if (-Not (Test-Path ".env")) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Red
    Write-Host "   Please create backend\.env with required API keys:" -ForegroundColor Yellow
    Write-Host "   - OPENAI_API_KEY" -ForegroundColor Yellow
    Write-Host "   - GROQ_API_KEY" -ForegroundColor Yellow
    Write-Host "   - SENDGRID_API_KEY" -ForegroundColor Yellow
    Write-Host "   - SECRET_KEY" -ForegroundColor Yellow
    Read-Host "Press Enter to continue anyway"
}

# Initialize quantum database
Write-Host "🗄️  Initializing quantum storytelling database..." -ForegroundColor Yellow
python -c "from database import init_quantum_db; init_quantum_db()"

Write-Host "`n✅ Backend starting on http://localhost:8000" -ForegroundColor Green
Write-Host "📊 API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "🔌 WebSocket: ws://localhost:8000/ws/openai-relay" -ForegroundColor Green
Write-Host "`n⚡ Press Ctrl+C to stop the server`n" -ForegroundColor Yellow

# Start FastAPI with auto-reload enabled for development
# Use --host 0.0.0.0 to allow external access if needed
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
