#!/bin/sh

echo "=== Calculate Your Carbon API ==="
echo "Starting up..."

# Run migrations (retry up to 5 times for DB cold-start)
n=0
until [ $n -ge 5 ]; do
  echo "Attempting database migration (try $((n+1))/5)..."
  alembic upgrade head && break
  n=$((n+1))
  echo "Database not ready — retrying in 5 seconds..."
  sleep 5
done

if [ $n -ge 5 ]; then
  echo "WARNING: Could not run migrations after 5 attempts."
  echo "Starting server anyway — tables will be created by SQLAlchemy..."
fi

echo "Running seed data..."
python seed_data.py || echo "Seed script encountered an error (non-fatal)"

echo "Starting API server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
