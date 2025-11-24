# MetaGuardian Frontend Startup Script
# Runs Vite dev server for React frontend

Write-Host "🎨 Starting MetaGuardian Frontend..." -ForegroundColor Cyan

# Navigate to project root
Set-Location $PSScriptRoot

# Install dependencies if needed
if (-Not (Test-Path "node_modules")) {
    Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

Write-Host "`n✅ Frontend starting on http://localhost:5173" -ForegroundColor Green
Write-Host "🔗 Backend should be running on http://localhost:8000" -ForegroundColor Yellow
Write-Host "`n⚡ Press Ctrl+C to stop the server`n" -ForegroundColor Yellow

# Start Vite dev server
npm run dev
