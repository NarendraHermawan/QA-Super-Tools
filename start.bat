@echo off
echo Starting FFID QA Super Tools (web + worker)...
docker compose up --build -d
echo.
echo Waiting for services...
timeout /t 10 /nobreak >nul
start http://localhost:3001
echo Open http://localhost:3001 in your browser.
echo Tool E requires office WiFi for CDN uploads.
