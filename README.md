# AI Eyes · عيون الذكاء

Mobile accessibility app for blind and low-vision Arabic speakers in Tunisia. The phone camera becomes a real-time visual assistant that narrates the world back to the user in spoken Arabic.

## Features

- **Object detection**: YOLOv8 finds everyday objects and estimates how far away they are
- **Text reading (OCR)**: reads Arabic and French text out loud
- **Scene description**: a vision LLM describes what is in front of the camera
- **Navigation**: GPS guidance outdoors, QR codes for indoor spots (e.g. university doors)
- **Arabic voice output**: all feedback is spoken with text-to-speech
- **Family link**: relatives can follow activity and alerts from the [web dashboard](https://github.com/Zemoo8/AI-Eyes-dashboard)

## Architecture

| Part | Location | Stack |
| --- | --- | --- |
| Mobile app | this repo (root) | React Native, Expo SDK 54, Supabase auth |
| Detection server | `server/` | FastAPI, Ultralytics YOLOv8n, OpenCV |
| OCR backend | [aieyes-backend](https://github.com/Zemoo8/aieyes-backend) | FastAPI, Groq vision API |
| Family dashboard | [AI-Eyes-dashboard](https://github.com/Zemoo8/AI-Eyes-dashboard) | Next.js, TypeScript |

## Getting started

### 1. Environment variables

Create a `.env` file in the project root (it is git-ignored):

```bash
EXPO_PUBLIC_BACKEND_URL=https://your-ocr-backend.example.com
EXPO_PUBLIC_YOLO_URL=http://<your-computer-ip>:8000
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
# Optional Gemini fallback. See "Security notes" below before using a real key.
EXPO_PUBLIC_GEMINI_API_KEY=<restricted dev key>
```

### 2. Detection server

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The Android emulator reaches it at `http://10.0.2.2:8000` automatically.

### 3. Mobile app

```bash
npm install
npm run android
```

Android is the main target platform (Arabic-first UX).

## Stack

React Native · Expo · YOLOv8 · FastAPI · OpenCV · Supabase · Gemini API · Groq API

## Security notes

- Variables prefixed with `EXPO_PUBLIC_` are embedded in the compiled app bundle and can be extracted by anyone who installs it. Treat `EXPO_PUBLIC_GEMINI_API_KEY` as public: use a restricted, quota-limited key for development only.
- For production, vision-model calls should go through a backend that holds the secret (see [aieyes-backend](https://github.com/Zemoo8/aieyes-backend)) instead of being called from the phone.
- Never commit `.env` files; the repo ignores them.

## Current status and limitations

- Object detection uses the pretrained YOLOv8n weights; the model is not fine-tuned yet, and this repo does not include a quantitative evaluation (mAP, per-class accuracy) on everyday scenes.
- OCR and scene description rely on hosted vision models (Groq, Gemini), so they need network access and add latency.

## Roadmap

- Fine-tune the detector on a small labelled set of Arabic/French signage and everyday objects, and report mAP and on-device latency against the pretrained baseline.
- Validate the distance estimates against measured ground truth.
- Move all third-party model calls behind the backend and add an offline fallback for core detection.
