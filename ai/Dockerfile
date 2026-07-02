# --- Stage 1: Build & Install ---
FROM python:3.11-slim as builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies from the service's own requirements
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# --- Stage 2: Final Runtime ---
FROM python:3.11-slim

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libgles2 \
    libegl1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages
COPY --from=builder /install /usr/local

# Copy AI source code
COPY . .

# Ensure directories exist
RUN mkdir -p /app/uploads /app/logs && chmod 777 /app/uploads /app/logs



# Pre-download low-RAM optimized models to make container startup instant
RUN mkdir -p /app/models && \
    apt-get update && apt-get install -y curl && \
    curl -L -o /app/models/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task && \
    curl -L -o /app/models/yolov8n.onnx https://huggingface.co/Kalray/yolov8/resolve/main/yolov8n.onnx && \
    curl -L -o /app/models/facenet.onnx https://huggingface.co/haikalmumtaz/facenet-onnx/resolve/main/facenet.onnx && \
    chmod 777 /app/models/* && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

EXPOSE 7860

ENV FLASK_APP=app.main:create_app
ENV ENV=production

# Use Gunicorn for production with threads for extreme concurrency (150+ users)
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--workers", "3", "--threads", "60", "--worker-class", "gthread", "--timeout", "120", "app.wsgi:app"]
