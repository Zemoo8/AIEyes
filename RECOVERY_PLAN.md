# AI Eyes - Peak Level Recovery Sprint (1-2 weeks)

## CURRENT STATUS (as of diagnostic)
✅ YOLO Server: RUNNING on port 8000
✅ Groq API: KEY configured + FIXED model names (was ~40 errors)
✅ Server running: Python FastAPI server healthy
❌ ANTHROPIC_API_KEY: NOT set (need for best scene descriptions)
❌ Each feature mode: needs end-to-end testing

---

## MASTER PLAN - BEST TOOL PER FEATURE

### Feature 1: EXPLORE MODE (Auto object detection)
**Goal**: Point camera → instant Arabic narration + visual overlay
**Tools**:
- Primary: YOLO Server (/detect endpoint)
- Fallback: Groq Vision (llama-3.3)
- Output: Bracket overlays + Arabic TTS
**Status**: 
- [ ] Test YOLO endpoint connectivity
- [ ] Test Groq fallback
- [ ] Verify overlay rendering
- [ ] Test Arabic TTS

### Feature 2: READ MODE (Text recognition)
**Goal**: Point at text → Arabic TTS narration
**Tools**:
- Primary: Groq Vision with OCR prompt
- Fallback: Could use ML Kit (future)
**Status**:
- [ ] Test Groq OCR detection
- [ ] Handle Arabic + French
- [ ] Suppress duplicate readings

### Feature 3: DESCRIBE MODE (Rich scene narration)
**Goal**: Tap button → rich description of entire scene
**Tools**:
- Best: Claude Vision API (need ANTHROPIC_API_KEY)
- Fallback: Groq Vision (llama-3.3)
**Status**:
- [ ] Add ANTHROPIC_API_KEY to .env
- [ ] Create utils/claude.js integration
- [ ] Use Claude for Describe, fall back to Groq

### Feature 4: FIND MODE (Search for specific object)
**Goal**: Say object name → camera points to it, audio guidance
**Tools**:
- Primary: YOLO filtered by class + audio guidance
- Fallback: Groq Vision with search prompt
**Status**:
- [ ] Test YOLO class filtering
- [ ] Add "searching..." audio feedback
- [ ] Test guidance UX

### Feature 5: CURRENCY MODE (Detect Tunisian dinars)
**Goal**: Point at bills → denomination + Arabic TTS
**Tools**:
- Option A: Custom YOLO model (if trained)
- Option B: Groq Vision with currency prompt
**Status**:
- [ ] Check if currency model exists
- [ ] Test Groq currency detection fallback
- [ ] Verify denomination accuracy

---

## IMMEDIATE TODO (Next 2 Hours)

### 1. FIX Groq Models ✅ DONE
- [x] Replaced invalid models with `llama-3.3-70b-versatile`

### 2. GET ANTHROPIC KEY (Optional but Recommended)
- [ ] Get Claude API key from anthropic.com
- [ ] Add to .env: `ANTHROPIC_API_KEY=...`
- [ ] This enables best-quality scene descriptions

### 3. TEST YOLO CONNECTIVITY
```bash
# Test endpoint manually
curl -X POST http://localhost:8000/health

# Or use Python:
# See test_yolo.py
```

### 4. TEST GROQ CONNECTIVITY  
- Already verified in diagnostic
- Models should now work

---

## TESTING ORDER (Days 1-3)

1. **Test Explore mode alone**
   - Start app
   - Enter Explore mode
   - Point at object
   - Should see bracket overlay + hear Arabic narration
   - Check console for errors

2. **Test Read mode alone**
   - Point at text
   - Should hear Arabic TTS of text
   - Try both Arabic and French

3. **Test Describe mode alone**  
   - If Claude API configured: use Claude (best quality)
   - Otherwise: use Groq fallback

4. **Test Find mode alone**
   - Say "كرسي" (chair)
   - Camera should guide you to it
   - Visual + audio feedback

5. **Test Currency mode alone**
   - Point at Tunisian bills
   - Should detect denomination

---

## DEMO SCRIPT (2-3 minutes for judges)

**Setup**: App opened, Explore mode ready
**Flow**:
1. "جاهز" (ready) beep → screen on
2. Point at diverse objects: person → hear "شخص"
3. Point at phone → hear "هاتف"
4. Show detection accuracy + speed
5. (Optional) Tap Read mode → point at sign text
6. (Optional) Find mode → say "جاهز" search

**Talking Points**:
- Real-time detection: <500ms per frame
- Works online and offline
- Arabic-first UX
- Accessible for visually impaired

---

## POLISH CHECKLIST (Before Demo)

- [ ] Splash screen with logo (6 sec animation)
- [ ] App doesn't crash on permissions
- [ ] Clear error messages in Arabic
- [ ] Audio cues for every action
- [ ] Smooth mode transitions  
- [ ] Offline mode clearly indicated
- [ ] Backup video recorded (in case live demo fails)
- [ ] Test on target device 3x without crashes

---

## RISK MITIGATION

### Risk: YOLO server crashes
**Mitigation**: Use Groq Vision fallback (slower but works)

### Risk: Groq rate limit (429 errors)
**Mitigation**: Added 35s throttle + fallback handling

### Risk: Network timeout
**Mitigation**: 5s timeout per detection + clear "服务器繁忙" message

### Risk: Live demo fails
**Mitigation**: Record backup video + have preloaded app ready

---

## SUCCESS CRITERIA

✅ All 5 modes work without crashing  
✅ Average detection latency < 1 second  
✅ No Groq 400/401 errors  
✅ Judges can clearly hear Arabic narration  
✅ Visual overlays are crisp + responsive  
✅ Demo runs 3x without interruption  

---

## TIMELINE

**Week 1** (Days 1-7):
- Days 1-2: Fix Groq + test each mode  
- Days 3-4: Integrate Claude API
- Days 5-7: Polish UX + fix crashes

**Week 2** (Days 8-14):
- Days 8-10: Optimize performance  
- Days 11-12: Record backup video
- Days 13-14: Final dry runs + presentation prep

---

## FILES TO MODIFY

1. **App.js** - Main app logic (already fixed Groq models)
2. **utils/api.js** - API connectivity  
3. **utils/claude.js** - (NEW) Claude Vision integration
4. **app.json** - Permissions + metadata
5. **server/main.py** - Optional optimizations

---

## NEXT IMMEDIATE ACTION

Run the app and test Explore mode:
```bash
npm start
# Then select Android and see if it starts
```

Watch console for errors. Report any crashes or Groq errors (should be gone now).
