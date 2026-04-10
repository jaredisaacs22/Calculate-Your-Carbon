FROM python:3.12-slim

WORKDIR /app

# System deps for Playwright + psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (needed for OEM scrapers)
RUN playwright install chromium --with-deps

COPY . .

RUN chmod +x entrypoint.sh

# PORT env var is set automatically by Render; defaults to 8000
EXPOSE 8000
CMD ["./entrypoint.sh"]
