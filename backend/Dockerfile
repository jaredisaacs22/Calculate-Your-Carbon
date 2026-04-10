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

# Install Playwright browsers
RUN playwright install chromium --with-deps

COPY . .

# Run Alembic migrations then start server
CMD ["sh", "-c", "alembic upgrade head && python seed_data.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
