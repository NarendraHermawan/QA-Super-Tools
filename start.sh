#!/usr/bin/env sh
set -e
echo "Starting FFID QA Super Tools (web + worker)..."
docker compose up --build -d
echo "Waiting for services..."
sleep 10
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:3001
elif command -v open >/dev/null 2>&1; then
  open http://localhost:3001
fi
echo "Open http://localhost:3001 in your browser."
echo "Tool E requires office WiFi for CDN uploads."
