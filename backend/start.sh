#!/bin/bash
cd "$(dirname "$0")"

# Kill ALL python processes on port 8000
powershell -Command "Get-Process python* -ErrorAction SilentlyContinue | Stop-Process -Force"
sleep 1

source venv/Scripts/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
