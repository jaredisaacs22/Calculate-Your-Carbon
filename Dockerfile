# Root-level Dockerfile for Render
# Playwright/Chromium excluded from default build to fit free-tier build limits.
# Scrapers use ENABLE_SCRAPERS=true env var to lazy-install at runtime if needed.
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
# Install everything except playwright browser binaries
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN chmod +x entrypoint.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
