# Root-level Dockerfile — delegates to backend/
# Render Web Service uses this when Root Directory is not set to backend/
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN playwright install chromium --with-deps

COPY backend/ .

RUN chmod +x entrypoint.sh

EXPOSE 8000
CMD ["./entrypoint.sh"]
