#!/bin/sh
set -e

echo "Waiting for database..."
until alembic upgrade head; do
  echo "Database not ready — retrying in 4 seconds..."
  sleep 4
done

echo "Running seed data..."
python seed_data.py

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
