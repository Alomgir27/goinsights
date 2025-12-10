#!/bin/bash
cd "$(dirname "$0")"

# Kill ALL python processes on port 8000
kill -9 $(lsof -t -i:8000)

source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
