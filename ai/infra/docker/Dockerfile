FROM python:3.11-slim

# Prevent Python from writing pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app
COPY migrations ./migrations

EXPOSE 8000

RUN mkdir -p /app/data && chmod 777 /app/data

# CMD ["gunicorn", "-c", "app/wsgi.py"]

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app.wsgi:app"]
