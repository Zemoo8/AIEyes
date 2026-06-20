import asyncio
import base64
import binascii
import importlib
import logging
import os
import subprocess
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── ENV ─────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("AIEyes")

# ── YOLO MODEL ──────────────────────────────────────
_model = None
_infer_busy = False       # non-blocking busy flag — drop frames instead of queueing
_last_detections: list = []


def _load_model():
    # maximise CPU throughput
    try:
        import torch
        torch.set_num_threads(os.cpu_count() or 4)
    except Exception:
        pass

    ultralytics = importlib.import_module("ultralytics")
    return ultralytics.YOLO("yolov8n.pt")


def _resize_for_inference(img: np.ndarray, max_width: int = 256) -> np.ndarray:
    height, width = img.shape[:2]
    if width <= max_width:
        return img
    scale = max_width / float(width)
    new_height = max(1, int(height * scale))
    return cv2.resize(img, (max_width, new_height), interpolation=cv2.INTER_AREA)


def _format_detections(results):
    detections = []
    for box in results.boxes:
        x1, y1, x2, y2 = map(float, box.xyxy[0])
        detections.append({
            "label": _model.names[int(box.cls[0])],
            "confidence": float(box.conf[0]),
            "box": {
                "x1": round(x1, 1),
                "y1": round(y1, 1),
                "x2": round(x2, 1),
                "y2": round(y2, 1),
            },
        })
    return detections


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    log.info("Loading YOLOv8 model...")

    try:
        _model = _load_model()
        # warm-up at inference resolution so first real request is fast
        await asyncio.to_thread(
            _model, np.zeros((256, 256, 3), dtype=np.uint8),
            conf=0.25, imgsz=256, verbose=False,
        )
        log.info("YOLO ready")
    except Exception as exc:
        _model = None
        log.error("YOLO failed: %s", exc)

    yield


# ── FASTAPI APP ─────────────────────────────────────
app = FastAPI(title="AIEyes YOLO Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── HEALTH ──────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok" if _model else "degraded",
        "model": "yolov8n" if _model else None,
    }


@app.get("/ping")
async def ping():
    return {"status": "ok"}


# ── DETECT ──────────────────────────────────────────
class DetectPayload(BaseModel):
    image: str


def _decode_base64_image(raw_image: str) -> np.ndarray:
    raw = (raw_image or "").strip()
    if not raw:
        raise HTTPException(400, "Missing image base64")

    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]

    try:
        data = base64.b64decode(raw)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Invalid base64 image")

    img_array = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image format")

    return _resize_for_inference(img, 256)


def _decode_file_image(data: bytes) -> np.ndarray:
    if len(data) == 0:
        raise HTTPException(400, "Empty image")

    img_array = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image format")

    return _resize_for_inference(img, 256)


async def _infer_image(img: np.ndarray):
    global _infer_busy, _last_detections

    if _model is None:
        raise HTTPException(503, "YOLO model not loaded")

    # Drop-frame: if a previous inference is still running return the cached
    # result immediately so the mobile client never has to wait in a queue.
    if _infer_busy:
        log.info("inference busy — returning cached result (%d objects)", len(_last_detections))
        return _last_detections

    _infer_busy = True
    try:
        started = time.perf_counter()
        results = await asyncio.to_thread(
            _model, img, conf=0.25, imgsz=256, verbose=False,
        )
        duration_ms = (time.perf_counter() - started) * 1000
        log.info("inference finished in %.1f ms", duration_ms)
        _last_detections = _format_detections(results[0])
        return _last_detections
    finally:
        _infer_busy = False


@app.post("/detect")
@app.post("/api/detect")
async def detect(file: UploadFile = File(...)):
    request_started = time.perf_counter()

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be image/*")

    data = await file.read()
    img = await asyncio.to_thread(_decode_file_image, data)
    detections = await _infer_image(img)

    total_ms = (time.perf_counter() - request_started) * 1000
    log.info("/detect done in %.1f ms — %d objects", total_ms, len(detections))

    return detections


@app.post("/detect_base64")
@app.post("/api/detect_base64")
async def detect_base64(payload: DetectPayload):
    request_started = time.perf_counter()

    img = await asyncio.to_thread(_decode_base64_image, payload.image)
    detections = await _infer_image(img)

    total_ms = (time.perf_counter() - request_started) * 1000
    log.info("/detect_base64 done in %.1f ms — %d objects", total_ms, len(detections))

    return detections


# ── RUN ─────────────────────────────────────────────
def _kill_port(port: int) -> None:
    """Kill whatever process is listening on the given port (Windows)."""
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True,
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                pid = parts[-1]
                if pid.isdigit() and int(pid) != os.getpid():
                    log.info("Killing process holding port %d (PID %s)", port, pid)
                    subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                    time.sleep(0.5)   # give the OS a moment to release the socket
    except Exception as exc:
        log.warning("Could not auto-kill port %d: %s", port, exc)


if __name__ == "__main__":
    import uvicorn

    _kill_port(8000)

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
