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
EXPO_PUBLIC_GEMINI_API_KEY=<gemini key>
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
