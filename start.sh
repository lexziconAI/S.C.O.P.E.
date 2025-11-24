#!/bin/bash
# Startup script for Render deployment

cd backend

# Run database migration
python migrate_db.py

# Start the server
uvicorn main:app --host 0.0.0.0 --port $PORT
