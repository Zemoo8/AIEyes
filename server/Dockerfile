FROM python:3.11-slim

# OpenCV system deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1-mesa-glx libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer-cached until requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download YOLOv8n weights at build time → zero-latency cold starts
RUN python -c "\
from ultralytics import YOLO; \
import shutil, os; \
m = YOLO('yolov8n.pt'); \
shutil.copy(m.ckpt_path, '/app/yolov8n.pt'); \
print('[Dockerfile] yolov8n.pt saved to /app')"

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
