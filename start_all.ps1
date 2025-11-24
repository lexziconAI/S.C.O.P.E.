# MetaGuardian Full Stack Launcher
# Starts both backend and frontend in separate persistent PowerShell windows

Write-Host "🌟 Launching MetaGuardian Full Stack..." -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

$ScriptDir = $PSScriptRoot

# Start Backend in new persistent window
Write-Host "1️⃣  Launching Backend (Port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$ScriptDir\start_backend.ps1"

# Wait a moment for backend to initialize
Write-Host "   Waiting 5 seconds for backend initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start Frontend in new persistent window
Write-Host "2️⃣  Launching Frontend (Port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$ScriptDir\start_frontend.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Both services launched successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop services: Close the PowerShell windows" -ForegroundColor Yellow
Write-Host "To view logs: Check the separate terminal windows" -ForegroundColor Yellow
Write-Host ""
Write-Host "MetaGuardian is ready for testing!" -ForegroundColor Green
