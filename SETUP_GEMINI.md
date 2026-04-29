# SETUP: Add Google Gemini API Key (2 minutes)

## Step 1: Get FREE Gemini API Key
1. Go to: https://aistudio.google.com/app/apikey
2. Click **"Create API Key"**
3. Select or create a project
4. Copy the key

## Step 2: Add to .env
Add this line to `C:\Users\LENOVO\AIEyes\.env`:
```
EXPO_PUBLIC_GEMINI_API_KEY=YOUR_KEY_HERE
```

Replace `YOUR_KEY_HERE` with your actual key from Step 1.

Example:
```
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyDe...your_key...abcd123
```

## FREE Tier Limits (Google Gemini)
- **15 requests per minute** ← Enough for demo
- **1 million tokens per day** ← More than enough
- **Models available**: gemini-1.5-flash, gemini-2.0-flash

## What Just Changed

### Read Mode
- ✅ **Before**: Used Groq (good)
- ✅ **After**: Uses Gemini (better quality) + Groq fallback

### Describe Mode  
- ✅ **Before**: Used Groq
- ✅ **After**: Uses Gemini (highest quality) + Groq fallback

### Currency Mode
- ✅ **Before**: Used Groq only
- ✅ **After**: Uses Gemini (best accuracy) + Groq fallback

### Explore Mode
- ✅ **Before**: Uses YOLO + Groq (no change needed)
- ✅ **After**: Still uses YOLO + Groq (optimal combo)

### Find Mode
- ✅ **Before**: Uses YOLO + Groq
- ✅ **After**: Still uses YOLO + Groq (optimal combo)

---

## Architecture Summary (100% FREE)

```
EXPLORE MODE:
  Camera → YOLO Server (free, local)
           ↓ (boxes/detections)
           Groq Vision (free, 15 req/min)
           ↓ (fallback for scene context)
           
READ MODE:
  Camera → Gemini Vision (free, 15 req/min) ← OCR
           ↓ (best accuracy)
           Groq Vision (free, fallback)
           
DESCRIBE MODE:
  Camera → Gemini Vision (free) ← Scene description
           ↓ (highest quality)
           Groq Vision (free, fallback)
           
FIND MODE:
  Camera → YOLO (free, local) + audio guidance
           ↓ (filtered by target class)
           Groq Vision (free, fallback for context)
           
CURRENCY MODE:
  Camera → Gemini Vision (free) ← Currency detection
           ↓ (best accuracy)
           Groq Vision (free, fallback)
```

---

## Next Steps

1. ✅ You've added Gemini functions to App.js
2. ⏳ **Get Gemini API key** (do now)
3. ⏳ **Add to .env file** (2 min)
4. ⏳ **Test app** (run `npm start`)

---

## Testing After Setup

Once you've added the key to .env:

```bash
npm start
# Select Android device/emulator
# Test Describe mode → should be high quality
# Test Read mode → should recognize text well
# Test Currency mode → should detect dinars
```

Watch console for:
- `[Gemini] vision call` ← means it's working
- `[Gemini] error` ← means Gemini failed, Groq fallback will kick in

---

## Cost
**$0.00** ← Completely free demo tier
- Groq free: ✓
- Gemini free: ✓
- YOLO open-source: ✓
- No paid APIs needed!
