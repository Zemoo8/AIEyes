# AIEyes — Premium UI refresh · drop-in pack

Senior product designer pass on top of your existing codebase.

**What this pack contains** (4 files, ~1450 lines total):

| File | Replace at | Status |
| --- | --- | --- |
| `screens/AuthScreen.js` | `AIEyes/screens/AuthScreen.js` | **Drop-in replacement** — same public API |
| `components/FamilyModal.js` | `AIEyes/components/FamilyModal.js` | **Drop-in replacement** — same public API |
| `screens/AssistantScreen.js` | `AIEyes/screens/AssistantScreen.js` | **New file** — wire from `App.js` |
| `components/AssistantTransition.js` | `AIEyes/components/AssistantTransition.js` | **New file** — used by `App.js` |

**No new packages required.** Everything is built on what's already in your `package.json`:
`react-native-svg`, `react-native-reanimated`, `expo-linear-gradient`, `expo-speech`, `expo-sensors`, `react-native-qrcode-svg`.

---

## How to install

You can drag the files in by hand. The files use the same imports and the same prop signatures as your existing ones, so once they're in place, nothing else has to change for Auth and Family.

```bash
# from the AIEyes/ root
cp /path/to/rn-output/screens/AuthScreen.js          screens/AuthScreen.js
cp /path/to/rn-output/components/FamilyModal.js      components/FamilyModal.js
cp /path/to/rn-output/screens/AssistantScreen.js     screens/AssistantScreen.js
cp /path/to/rn-output/components/AssistantTransition.js components/AssistantTransition.js
```

No `npm install` needed. Just run as normal:

```bash
npm start
```

---

## Design improvements (what changed and why)

### 1 · Welcome screen
The previous version stacked the `FormCard` directly under a `WaveSep` so the bottom half had three competing layers (wave + opaque card + CTA stack). It read as crowded.

- Removed `WaveSep` and the opaque `FormCard` background — the page is now one continuous dark surface.
- Layout is a clear vertical rhythm: orb · wordmark · "BY ZEMOO" eyebrow · tagline · CTAs. No element overlaps another's safe area.
- Background "circle" dimmed from `0.55` → `0.35` opacity. Particles removed. One focal point: the eye.
- Tagline uses Inter 34/700 with `-0.6` letterspacing; Arabic subtitle sits beneath in muted lavender. Both have explicit space from the buttons below.

### 2 · Sign In
- Hero orb shrunk from `108 → 80 px`. Brand wordmark removed from this screen — you already know which app you're in.
- Email/password fields now share the same `52 px` height and `14 px` radius. Micro-labels added above each field in two scripts ("EMAIL · البريد الإلكتروني").
- Remember-me + Forgot? collapsed into one row, saving vertical space.
- Biometric prompt is now a quiet text link with a tiny fingerprint icon — not a chrome'd card. Reads premium, doesn't compete with the primary CTA.

### 3 · Create Account
- New `STEP 1 OF 2` indicator top-right (two pill segments).
- Mini orb (56 px) sits beside the headline rather than above it. Headline runs to two lines: "Create your / guardian eye." — establishes the brand voice.
- Three fields with `13 px` gap and a quiet helper line beneath password ("Use 8+ characters with a number · 8 أحرف ورقم").
- Terms checkbox is its own row positioned `~22 px` above the Continue button — clear visual separation.
- Continue is the only thing competing for attention at the bottom; "Already have an account? Sign in" sits below it as muted text.

### 4 · AI Assistant Mode (new)
This is the new hero feature.

- `AnimatedAssistantOrb` is a layered SVG sphere with blue/cyan/violet light bands, rim light, specular highlight, and atmospheric corona. State-aware:
  - `idle` — slow float + slow spin + breathing halo
  - `listening` — bigger pulse, expanding rim rings
  - `thinking` — faster pulse + faster spin
  - `speaking` — soft glow pulse
  - `error` — single muted red pulse
- Layout: top bar (back + ASSISTANT label) → orb → editorial Arabic title — "كيف يمكنني أن أُساعدك؟" → glass input pill at the bottom with mic on the right.
- Listening: input pill switches to a live waveform of 11 animated bars.
- Thinking: input pill shows a dot animation; main view keeps the user's transcribed question visible.
- Answer view drops the orb to a 56 px chip at the top-left, then renders the question and answer as plain editorial prose. A Replay button uses `Speech.speak()` again with the same Arabic phrase.
- Calls `expo-speech` (`Speech.speak(text, { language: 'ar-TN', rate: 0.95 })`) for voice responses — same pattern your existing `App.js` already uses.
- Pure functions for transcription/answer come from props (`onSendQuery`) so this stays UI-only — no business logic baked in.

### 5 · Assistant transition (new, bidirectional)
A single component handles both directions — `direction="in"` for camera → assistant and `direction="out"` for the reverse. ~1.0 s of layered motion:

**IN  (camera → assistant)**

| ms | layer |
| --- | --- |
| 0 – 250 | dim + violet/blue blur wash hides the camera |
| 200 – 700 | bright white-cyan light streak sweeps across center |
| 250 – 900 | 16 particle streaks fly inward from edges |
| 300 – 900 | double glow ring expands outward from center |
| 400 – 950 | deep-navy backdrop fades in |
| 950 – 1000 | bright bloom flash → `onDone` fires |

**OUT (assistant → camera)** — the same choreography in reverse:

| ms | layer |
| --- | --- |
| 0 – 200 | bloom flash from center |
| 150 – 800 | rings *collapse* inward from screen edges |
| 200 – 850 | 12 particle streaks fly *outward* |
| 300 – 950 | navy backdrop fades out, revealing the camera |
| 950 – 1000 | dim layer fades off → `onDone` fires |

Both directions call `onDone` once the curtain is fully across, so you can swap the underlying view at exactly the right frame.

### 6 · Family Access
- QR is now the focal point. Hero white card (188 px QR + 14 px padding), violet halo behind it, 30 px shadow.
- Invite code rendered in big mono ("78H · 24L · XX") with 6 px letter-spacing under the QR — was a tiny line before.
- Validity is a calm chip with a green dot ("valid · 6d 4h") rather than a dim gray timestamp.
- Primary action is now Share invite — fires `Share.share` with both URL and code in Arabic.
- Open dashboard is a ghost button that calls `Linking.openURL`.
- Secondary actions (New code · Revoke all) collapsed into a single horizontal row of text links.
- Logout demoted to a quiet bottom link beside the user email, freeing the modal from a heavy red button competing with the QR.

---

## App.js integration · shake → mic → keyword routing

The intended flow is one universal gesture for everything:

> **Shake the phone → mic opens and listens → say a keyword → app routes you.**

Keywords route to any mode, not just the Assistant:

| Say | Goes to |
| --- | --- |
| "AI" · "assistant" · "مساعد" | AI Assistant Mode (cinematic transition) |
| "read" · "قراءة" | Read mode |
| "describe" · "وصف" | Describe mode |
| "discover" · "explore" · "استكشاف" | Discover mode |
| "find" · "بحث" | Find mode |
| "currency" · "money" · "عملة" | Currency mode |
| "eyes" · "back" · "كاميرا" · "رجوع" | Exit Assistant → camera |
| "SOS" · "نجدة" · "ساعدني" | (already wired in your `SOS_WORDS`) |

```js
// 1. imports
import AssistantScreen from './screens/AssistantScreen';
import AssistantTransition from './components/AssistantTransition';
import { Accelerometer } from 'expo-sensors';

// 2. state
//    'idle'      → camera; not recording
//    'listening' → mic open, waiting for a keyword
//    'enter'     → IN transition playing
//    'assistant' → assistant fully visible
//    'exit'      → OUT transition playing
const [phase, setPhase] = useState('idle');
const lastShakeRef = useRef(0);

// 3. SHAKE → open mic
useEffect(() => {
  Accelerometer.setUpdateInterval(80);
  const sub = Accelerometer.addListener(({ x, y, z }) => {
    const mag = Math.sqrt(x*x + y*y + z*z);
    const now = Date.now();
    if (mag > 1.8 && now - lastShakeRef.current > 1500) {
      lastShakeRef.current = now;
      startListening();           // <-- shake just opens the mic
    }
  });
  return () => sub.remove();
}, [phase]);

async function startListening() {
  if (phase === 'enter' || phase === 'exit') return;
  setPhase('listening');
  // optional confirmation cue:
  // Speech.speak('نعم؟', { language: 'ar-TN', rate: 1.0 });
  // start your existing Whisper recorder here. When the transcript
  // returns, call handleVoiceTranscript(text).
}

// 4. KEYWORD ROUTER — single entry point for every spoken command
function handleVoiceTranscript(transcript) {
  if (!transcript) { setPhase(phase === 'assistant' ? 'assistant' : 'idle'); return; }
  const t = ` ${transcript.toLowerCase()} `;

  // ── exit assistant first ─────────────────────────────────────
  if (phase === 'assistant' && /\b(eyes|back|exit|stop|كاميرا|رجوع|خروج)\b/i.test(t)) {
    setPhase('exit');
    return;
  }

  // ── enter assistant ──────────────────────────────────────────
  if (/\b(ai|hey ai|assistant|مساعد|مساعدة)\b/i.test(t)) {
    setPhase('enter');
    return;
  }

  // ── switch camera mode ───────────────────────────────────────
  const modeFromSpeech =
      /\b(read|قراءة|قراية)\b/i.test(t)               ? 'read'
    : /\b(describe|وصف|اوصف)\b/i.test(t)              ? 'describe'
    : /\b(discover|explore|استكشاف|اكتشاف)\b/i.test(t)? 'explore'
    : /\b(find|search|بحث|دور|دوّر)\b/i.test(t)       ? 'find'
    : /\b(currency|money|عملة|فلوس)\b/i.test(t)       ? 'currency'
    : null;

  if (modeFromSpeech) {
    setMode(modeFromSpeech);        // your existing setMode from App.js
    setPhase('idle');
    // optional acknowledgement:
    // Speech.speak('حسناً', { language: 'ar-TN', rate: 1.0 });
    return;
  }

  // ── fall through to your existing handlers (SOS_WORDS, etc.) ─
  if (handleSosWordsMaybe(transcript)) return;
  // … anything else: speak a tiny "لم أفهم" or just go back to idle
  setPhase('idle');
}

// 5. render
return (
  <View style={{ flex: 1 }}>
    <YourCameraStage/>

    {/* optional: tiny "listening" indicator over the camera while phase==='listening' */}

    {phase === 'assistant' && (
      <AssistantScreen
        onBack={() => setPhase('exit')}
        onSendQuery={async (q) => await yourAskAnythingFn(q)}
      />
    )}

    {phase === 'enter' && (
      <AssistantTransition direction="in"
        onDone={() => setPhase('assistant')}/>
    )}
    {phase === 'exit' && (
      <AssistantTransition direction="out"
        onDone={() => setPhase('idle')}/>
    )}
  </View>
);
```

### Why this shape?

- **One gesture, every command.** Users don't need to remember "shake for assistant, double-tap for read, swipe for find". Shake → speak → done. Friendlier for blind users.
- **The Assistant is just another keyword.** It happens to play the cinematic transition; everything else (Read, Describe, Find, Currency, Discover) is an instant mode switch with a short voice ack.
- **Eyes / كاميرا / رجوع** lives only when `phase === 'assistant'`. Saying "eyes" from the camera doesn't do anything (you're already there).
- **No double-trigger.** The 1.5 s cooldown on `lastShakeRef` prevents a single vigorous shake from firing twice.
- **Optional listening UI.** Add a tiny waveform pill anywhere on the camera while `phase === 'listening'` so sighted users can see "AI Eyes is listening". For non-sighted users, the audio cue is enough.

---

## Things I deliberately did NOT change

- Your modes, navigation, voice recording, SOS, camera detection, and Supabase logic — every handler in `AuthScreen` and `FamilyModal` is byte-identical to your previous implementation. Only the rendering layer and styles were rewritten.
- No phone mockups, no fake screens, no extra screens beyond Welcome / Sign In / Create Account / Forgot / Success + Assistant + Family.
- App name everywhere remains **AIEyes / عيون الذكاء**.
- All Arabic strings preserved (and added more — e.g., field labels are now bilingual).

---

## Notes for the engineer

- **Performance:** the orb runs on Reanimated SharedValues (no JS thread cost). Re-render only on `state` change.
- **Accessibility:** every interactive element has a 44 × 44 minimum hit target (the back button is 38 + 6 padding). For a follow-up pass: add `accessibilityLabel` / `accessibilityHint` strings in Arabic for TalkBack — I left them off in the drop-in to avoid changing semantics blindly.
- **Reduced motion:** if you want a `useReducedMotion()` switch, wire it into `AnimatedAssistantOrb` and short-circuit `withRepeat` blocks. Not done yet.
- **Skia (`@shopify/react-native-skia`):** you already have it. The orb uses SVG to stay light and accurate; if you ever want volumetric glow on Android, lift the orb into Skia and use `BlurMask`.
- **Type system:** the design uses three faces — Inter, Space Grotesk, Tajawal — but the RN files don't load custom fonts. Add them via `expo-font` if you want them in the build; otherwise system defaults are clean enough.

---

## Quick design summary

| Surface | Before | After |
| --- | --- | --- |
| Welcome | crowded lower half | one orb, one tagline, two buttons |
| Sign In | heavy biometric card | quiet text link |
| Create Account | terms + CTA tangled | step indicator + separated CTA |
| Family | small QR buried in card | hero QR + big code |
| Assistant | (didn't exist) | full premium screen w/ cinematic entry |
