import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Pressable,
  ScrollView, Animated, Dimensions, Platform,
  ActivityIndicator, Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './utils/supabase';
import { detectObjects } from './utils/api';
import {
  geminiReadText,
  geminiDescribeScene,
  geminiDetectCurrency,
  getGeminiBlockedUntil,
} from './utils/gemini';

// ─── screen ──────────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');

// ─── env ─────────────────────────────────────────────────────────────────────
const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const TG_TOKEN = process.env.EXPO_PUBLIC_TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.EXPO_PUBLIC_TELEGRAM_CHAT_ID ?? '8698073497';

// ─── modes ────────────────────────────────────────────────────────────────────
const MODES = [
  { id: 'explore',  ar: 'استكشاف', hint: 'كشف تلقائي للأشياء' },
  { id: 'read',     ar: 'قراءة',   hint: 'قراءة النصوص' },
  { id: 'describe', ar: 'وصف',     hint: 'اضغط ◉ لوصف المشهد' },
  { id: 'find',     ar: 'بحث',     hint: 'يبحث تلقائياً - اضغط ◉ لتحديد الهدف' },
  { id: 'currency', ar: 'عملة',    hint: 'كشف الأوراق النقدية التونسية' },
];

const SOS_WORDS = [
  'نجدة', 'النجدة', 'ساعدني', 'أغثني', 'مساعدة',
  'خطر', 'الله', 'يا ناس',
  'help', 'urgence', 'urgent', 'sos',
];
const GREEN = '#22c55e';
const ORANGE = '#f97316';
const RED   = '#ef4444';

const COCO_AR = {
  person: 'شخص',
  bicycle: 'دراجة',
  car: 'سيارة',
  motorcycle: 'دراجة نارية',
  bus: 'حافلة',
  truck: 'شاحنة',
  bottle: 'زجاجة',
  cup: 'كأس',
  chair: 'كرسي',
  couch: 'أريكة',
  bed: 'سرير',
  'dining table': 'طاولة',
  tv: 'تلفاز',
  laptop: 'حاسوب',
  'cell phone': 'هاتف',
  book: 'كتاب',
  backpack: 'حقيبة',
  handbag: 'حقيبة يد',
  umbrella: 'مظلة',
  clock: 'ساعة',
  knife: 'سكين',
  fork: 'شوكة',
  spoon: 'ملعقة',
  refrigerator: 'ثلاجة',
};

const LABEL_ALIASES = {
  person: ['شخص', 'إنسان', 'رجل', 'امرأة', 'ناس', 'people', 'person'],
  bicycle: ['دراجة', 'bike', 'bicycle'],
  car: ['سيارة', 'عربية', 'car'],
  motorcycle: ['دراجة نارية', 'motorcycle', 'moto'],
  bus: ['حافلة', 'bus'],
  truck: ['شاحنة', 'truck'],
  bottle: ['زجاجة', 'bottle'],
  cup: ['كأس', 'cup', 'كوب'],
  chair: ['كرسي', 'chair'],
  couch: ['أريكة', 'couch', 'sofa'],
  bed: ['سرير', 'bed'],
  'dining table': ['طاولة', 'table', 'dining table'],
  tv: ['تلفاز', 'tv', 'television'],
  laptop: ['حاسوب', 'laptop', 'computer'],
  'cell phone': ['هاتف', 'هاتف نقال', 'phone', 'mobile', 'cell phone'],
  book: ['كتاب', 'book'],
  backpack: ['حقيبة', 'backpack'],
  handbag: ['حقيبة يد', 'handbag'],
  umbrella: ['مظلة', 'umbrella'],
  clock: ['ساعة', 'clock'],
  knife: ['سكين', 'knife'],
  fork: ['شوكة', 'fork'],
  spoon: ['ملعقة', 'spoon'],
  refrigerator: ['ثلاجة', 'fridge', 'refrigerator'],
};

const FIND_QUICK_TARGETS = ['شخص', 'كرسي', 'طاولة', 'هاتف', 'سيارة', 'كتاب', 'حقيبة', 'سرير', 'حاسوب'];

function normalizeText(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoisyTranscript(value) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return true;
  const collapsed = raw.replace(/[\.\,\!\?\-\_\s]+/g, '');
  if (!collapsed) return true;
  if (collapsed.length <= 1) return true;
  return false;
}

function translateLabel(label) {
  return COCO_AR[label] ?? label;
}

function matchesTarget(label, target) {
  const normalizedTarget = normalizeText(target);
  if (!normalizedTarget) return false;
  const aliases = LABEL_ALIASES[label] ?? [label];
  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) return false;
    return (
      normalizedAlias === normalizedTarget
      || normalizedTarget.includes(normalizedAlias)
      || normalizedAlias.includes(normalizedTarget)
    );
  });
}

function detectionPosition(box, frameWidth) {
  const cx = (box.x1 + box.x2) / 2;
  if (cx < frameWidth / 3) return 'يسارك';
  if (cx > (frameWidth * 2) / 3) return 'يمينك';
  return 'أمامك';
}

function detectionSummary(detections, frameWidth) {
  const seen = new Set();
  let lastLabel = null;
  const top = [];
  for (const det of [...detections].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))) {
    if (det.label === lastLabel) continue;
    lastLabel = det.label;
    if (seen.has(det.label)) continue;
    seen.add(det.label);
    top.push(`${translateLabel(det.label)} ${detectionPosition(det.box, frameWidth)}`);
    if (top.length >= 2) break;
  }
  return top.join('، ');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function boxArea(box) {
  return Math.max(0, box.x2 - box.x1) * Math.max(0, box.y2 - box.y1);
}

function boxIoU(a, b) {
  const left = Math.max(a.x1, b.x1);
  const top = Math.max(a.y1, b.y1);
  const right = Math.min(a.x2, b.x2);
  const bottom = Math.min(a.y2, b.y2);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  if (intersection <= 0) return 0;
  const union = boxArea(a) + boxArea(b) - intersection;
  return union > 0 ? intersection / union : 0;
}

function dedupeDetections(detections, frameWidth, frameHeight) {
  const total = detections.length;
  const minArea = frameWidth * frameHeight * 0.01;

  const afterConf = [...detections].filter((d) => (d.confidence ?? 0) >= 0.25);
  const afterArea = afterConf.filter((d) => boxArea(d.box) >= minArea);
  const sorted = afterArea.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  console.log('[Dedup] total:', total, 'afterConf:', afterConf.length, 'afterArea:', afterArea.length);

  const kept = [];
  for (const det of sorted) {
    const overlaps = kept.some((other) => other.label === det.label && boxIoU(other.box, det.box) > 0.55);
    if (overlaps) {
      console.log('[Dedup] skipping overlap:', det.label, 'conf:', det.confidence);
      continue;
    }
    kept.push(det);
    console.log('[Dedup] keeping:', det.label, 'conf:', det.confidence, 'box:', det.box);
    if (kept.length >= 6) break;
  }

  console.log('[Dedup] kept count:', kept.length);
  return kept;
}

function shouldWarnClosePerson(det, frame) {
  if (det.label !== 'person') return false;
  const heightRatio = (det.box.y2 - det.box.y1) / frame.height;
  const areaRatio = boxArea(det.box) / (frame.width * frame.height);
  return heightRatio > 0.35 || areaRatio > 0.2;
}

function computeOverlayRect(det, frame, mirrored = false) {
  const frameWidth = frame.width ?? frame.frameWidth;
  const frameHeight = frame.height ?? frame.frameHeight;
  const scale = Math.min(SW / frameWidth, SH / frameHeight);
  const renderW = frameWidth * scale;
  const renderH = frameHeight * scale;
  const offsetX = (SW - renderW) / 2;
  const offsetY = (SH - renderH) / 2;

  const boxLeft = mirrored ? frameWidth - det.box.x2 : det.box.x1;
  const boxRight = mirrored ? frameWidth - det.box.x1 : det.box.x2;

  const left = clamp(offsetX + boxLeft * scale, 0, SW - 8);
  const top = clamp(offsetY + det.box.y1 * scale, 0, SH - 8);
  const width = clamp((boxRight - boxLeft) * scale, 24, SW - left);
  const height = clamp((det.box.y2 - det.box.y1) * scale, 24, SH - top);

  return {
    left,
    top,
    width,
    height,
    labelLeft: clamp(left, 4, SW - 150),
    labelTop: clamp(top - 26, 4, SH - 28),
  };
}

// ─── speech ───────────────────────────────────────────────────────────────────
let _speakDone = null;

function tts(text, onDone) {
  Speech.stop();
  _speakDone = onDone ?? null;
  Speech.speak(text, {
    language: 'ar',
    rate: 0.92,
    onDone:    () => { _speakDone?.(); _speakDone = null; },
    onStopped: () => { _speakDone?.(); _speakDone = null; },
    onError:   () => { _speakDone?.(); _speakDone = null; },
  });
}

// ─── frame capture ────────────────────────────────────────────────────────────
async function grabFrame(camRef, width = 512, quality = 0.40) {
  const photo = await camRef.current.takePictureAsync({
    quality,
    base64: true,
    skipProcessing: true,
  });
  return {
    uri: photo.uri,
    base64: photo.base64,
    width: photo.width,
    height: photo.height,
  };
}

// ─── Groq vision ─────────────────────────────────────────────────────────────
const GROQ_VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
];
const GROQ_CURRENCY_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
];
let groqVisionBlockedUntil = 0;

async function groqVision(base64, prompt, models = GROQ_VISION_MODELS) {
  if (Date.now() < groqVisionBlockedUntil) return null;
  console.log('[Groq] vision start, prompt:', prompt.slice(0, 60));
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: prompt },
          ]}],
          max_tokens: 400,
        }),
      });
      console.log('[Groq] vision status:', res.status, 'model:', model);
      if (!res.ok) {
        const body = await res.text();
        console.log('[Groq] vision error body:', body.slice(0, 200));
        if (res.status === 429) {
          const quotaExceeded = /quota|billing|exceeded/i.test(body);
          groqVisionBlockedUntil = Date.now() + (quotaExceeded ? 10 * 60 * 1000 : 35 * 1000);
          return null;
        }
        continue;
      }
      const text = ((await res.json()).choices?.[0]?.message?.content ?? '').trim();
      console.log('[Groq] vision result:', text.slice(0, 120));
      if (text) return text;
    } catch (e) {
      console.log('[Groq] vision exception:', e?.message);
      continue;
    }
  }
  return null;
}

async function yoloDetectBoxes(frame) {
  const detections = await detectObjects({
    uri: frame.uri,
    base64: `data:image/jpeg;base64,${frame.base64}`,
    mimeType: 'image/jpeg',
    fileName: 'frame.jpg',
  });

  if (!Array.isArray(detections)) return [];
  console.log('[Detect] raw detections:', detections.length);

  // Server resizes incoming image to a max width of 320 for inference.
  // Detections are returned in the resized image coordinate space. Map
  // boxes back to the original frame coordinates so overlay/dedupe math
  // uses the same reference frame.
  const serverResizedWidth = Math.min(frame.width || 320, 320);
  const scale = (serverResizedWidth > 0) ? frame.width / serverResizedWidth : 1;
  console.log('[Detect] scaling boxes by:', scale, '(serverResizedWidth:', serverResizedWidth, ')');

  const valid = detections.map((d) => {
    if (!d?.box) return null;
    const bx = { ...d.box };
    // scale coordinates from server-space to original frame-space
    bx.x1 = bx.x1 * scale;
    bx.x2 = bx.x2 * scale;
    bx.y1 = bx.y1 * scale;
    bx.y2 = bx.y2 * scale;
    return { ...d, box: bx };
  }).filter((d) => d
    && d.label
    && typeof d.box.x1 === 'number' && typeof d.box.y1 === 'number'
    && typeof d.box.x2 === 'number' && typeof d.box.y2 === 'number'
    && d.box.x2 > d.box.x1 && d.box.y2 > d.box.y1
  );

  console.log('[Detect] valid boxes before dedupe:', valid.length);
  console.log('[Detect] sample box:', valid[0]?.box ?? null);
  return dedupeDetections(valid, frame.width, frame.height);
}

// ─── Groq Whisper ─────────────────────────────────────────────────────────────
async function groqWhisper(audioUri) {
  console.log('[Groq] whisper start, uri:', audioUri);
  const fd = new FormData();
  fd.append('file', { uri: audioUri, type: 'audio/m4a', name: 'rec.m4a' });
  fd.append('model', 'whisper-large-v3-turbo');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: fd,
  });
  console.log('[Groq] whisper status:', res.status);
  if (!res.ok) {
    const body = await res.text();
    console.log('[Groq] whisper error body:', body.slice(0, 200));
    throw new Error('Whisper ' + res.status);
  }
  const result = ((await res.json()).text ?? '').trim();
  console.log('[Groq] whisper transcript:', result);
  return result;
}

// ─────────────────────────── Splash ──────────────────────────────────────────
function Splash({ onDone }) {
  const zY  = useRef(new Animated.Value(-240)).current;
  const exX = useRef(new Animated.Value(220)).current;
  const lnW = useRef(new Animated.Value(0)).current;
  const arO = useRef(new Animated.Value(0)).current;
  const byO = useRef(new Animated.Value(0)).current;
  const scO = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(zY, { toValue: 0, friction: 5, tension: 48, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(exX, { toValue: 0,   duration: 340, useNativeDriver: true }),
        Animated.timing(lnW, { toValue: 270,  duration: 520, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(arO, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(byO, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(1200),
      Animated.timing(scO, { toValue: 0, duration: 520, useNativeDriver: true }),
    ]).start(onDone);
  }, []);

  return (
    <Animated.View style={[sp.root, { opacity: scO }]}>
      <View style={sp.box}>
        <View style={sp.row}>
          <Animated.Text style={[sp.Z,    { transform: [{ translateY: zY }] }]}>Z</Animated.Text>
          <Animated.Text style={[sp.emoo, { transform: [{ translateX: exX }] }]}>emoo</Animated.Text>
        </View>
        <Animated.View style={[sp.line, { width: lnW }]} />
        <Animated.Text style={[sp.ar, { opacity: arO }]}>عيون الذكاء</Animated.Text>
        <Animated.Text style={[sp.by, { opacity: byO }]}>by Zemoo</Animated.Text>
      </View>
    </Animated.View>
  );
}
const sp = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  box:  { alignItems: 'flex-start' },
  row:  { flexDirection: 'row', alignItems: 'flex-end' },
  Z:    { fontSize: 64, fontWeight: '100', letterSpacing: 12, color: '#fff' },
  emoo: { fontSize: 64, fontWeight: '100', letterSpacing: 12, color: '#fff' },
  line: { height: 2, backgroundColor: GREEN, marginTop: 6 },
  ar:   { marginTop: 20, fontSize: 20, color: '#888', letterSpacing: 5 },
  by:   { marginTop: 6,  fontSize: 12, color: '#444', letterSpacing: 2 },
});

// ─────────────────────────── App ─────────────────────────────────────────────
export default function App() {
  const [splash,    setSplash]    = useState(true);
  const [camPerm,   reqCam]       = useCameraPermissions();
  const [modeIdx,   setModeIdx]   = useState(0);
  const [facing,    setFacing]    = useState('back');
  const [listening, setListening] = useState(false);
  const [findTgt,   setFindTgt]   = useState(null);
  const [banner,    setBanner]    = useState('');
  const [scanning,  setScanning]  = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status,       setStatus]       = useState('');
  const [overlayState, setOverlayState] = useState({
    frameWidth: 1,
    frameHeight: 1,
    detections: [],
    tone: GREEN,
  });

  const camRef       = useRef(null);
  const busy         = useRef(false);
  const isSpeaking   = useRef(false);
  const speakTimer   = useRef(null);
  const lastReadTxt  = useRef('');
  const loop         = useRef(null);
  const recRef       = useRef(null);
  const sosLoop      = useRef(null);
  const prevKey      = useRef('');
  const lastSpoke    = useRef(0);
  const lastShake    = useRef(0);
  const lastExplorePhrase = useRef('');
  const lastExploreSpokeAt = useRef(0);
  const lastClosePersonAt = useRef(0);
  const handleMicRef = useRef(null);
  const triggerRef   = useRef(null);
  const lastReadTime      = useRef(0);
  const lastFrameAt       = useRef(0);
  const lastFindVisionAt  = useRef(0);
  const lastExploreFallbackAt = useRef(0);
  const lastDetectErrorAt = useRef(0);
  const detectorDisabledUntil = useRef(0);
  const lastCallRef       = useRef(0);
  const blockedUntilRef   = useRef(0);
  const processingRef     = useRef(false);
  const epoch             = useRef(0);
  const sosPressAnim      = useRef(new Animated.Value(0)).current;
  const sosPressTimer     = useRef(null);
  const sosLongPressFired  = useRef(false);
  const bannerOp     = useRef(new Animated.Value(0)).current;
  const pulse        = useRef(new Animated.Value(1)).current;
  const scanAnim     = useRef(new Animated.Value(0)).current;

  const mode = MODES[modeIdx];

  // ── spoke helper ──
  function safeTts(text) {
    clearTimeout(speakTimer.current);
    isSpeaking.current = true;
    const release = () => { isSpeaking.current = false; };
    tts(text, release);
    speakTimer.current = setTimeout(release, Math.max(4000, text.length * 70));
  }

  // ── banner flash ──
  function flash(text) {
    setBanner(text);
    bannerOp.stopAnimation();
    Animated.sequence([
      Animated.timing(bannerOp, { toValue: 1,   duration: 160, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(bannerOp, { toValue: 0,   duration: 500, useNativeDriver: true }),
    ]).start();
  }

  function announce(text) { safeTts(text); flash(text); }

  function softAnnounce(text) {
    flash(text);

    if (isSpeaking.current) {
      console.log('[Speech] blocked');
      return;
    }

    console.log('[Speech] speaking:', text);

    isSpeaking.current = true;

    const release = () => {
      console.log('[Speech] released');
      isSpeaking.current = false;
    };

    Speech.speak(text, {
      language: 'ar',
      rate: 0.92,
      onDone: release,
      onStopped: release,
      onError: release,
    });

    clearTimeout(speakTimer.current);
    speakTimer.current = setTimeout(release, 5000);
  }

  async function startListening() {
    if (recRef.current) return;
    try {
      Speech.stop();
      const audioConfig = Platform.OS === 'ios'
        ? {
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          }
        : {
            shouldDuckAndroid: false,
            playThroughEarpiece: false,
          };
      await Audio.setAudioModeAsync(audioConfig);
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recRef.current = recording;
      setListening(true);
      console.log('[Mic] recording started');
      tts('أستمع');
    } catch (e) {
      console.log('[Mic] start error:', e?.message);
      recRef.current = null;
      setListening(false);
      announce('تعذّر تفعيل الميكروفون');
    }
  }

  async function stopListeningAndProcess() {
    setListening(false);
    try {
      const current = recRef.current;
      const uri = current?.getURI();
      if (current) await current.stopAndUnloadAsync();
      recRef.current = null;
      console.log('[Mic] recording stopped, uri:', uri);
      if (!uri) { announce('لم يُسجَّل صوت'); return; }
      announce('جاري التعرف على الصوت');
      const raw = await groqWhisper(uri);
      const text = raw
        .replace(/^\s*(?:اوعمتسا|يعمتسا|عمتسا|عمتسأ|استمعوا|استمعي|استمع|أستمع)\s*/u, '')
        .trim();
      console.log('[Mic] transcript raw:', raw, '→ clean:', text);
      if (text) processVoice(text);
      else announce('لم أفهم، حاول مرة أخرى');
    } catch (e) {
      console.log('[Mic] stop error:', e?.message);
      announce('تعذّر التعرف على الصوت');
    } finally {
      setListening(false);
    }
  }

  function beginAiTask() {
    const now = Date.now();
    const blockedUntil = Math.max(
      blockedUntilRef.current,
      groqVisionBlockedUntil,
      getGeminiBlockedUntil(),
    );
    if (processingRef.current) return false;
    if (now < blockedUntil) {
      setStatus('انتظر قليلاً، تم تجاوز الحد مؤقتاً');
      return false;
    }
    if (now - lastCallRef.current < 3000) {
      setStatus('انتظر قليلاً...');
      return false;
    }
    lastCallRef.current = now;
    processingRef.current = true;
    setIsProcessing(true);
    setStatus('');
    return true;
  }

  function endAiTask() {
    processingRef.current = false;
    setIsProcessing(false);
  }

  function syncRateLimitState() {
    const maxBlocked = Math.max(groqVisionBlockedUntil, getGeminiBlockedUntil());
    if (maxBlocked > blockedUntilRef.current) {
      blockedUntilRef.current = maxBlocked;
      setStatus('انتظر قليلاً، تم تجاوز الحد مؤقتاً');
    }
  }

  function setDetectionOverlay(frame, detections, tone, target) {
    setOverlayState({
      frameWidth: frame.width,
      frameHeight: frame.height,
      tone,
      detections: detections.map((d) => ({
        ...d,
        matched: target ? matchesTarget(d.label, target) : false,
      })),
    });
  }

  // ── location permission helper ──
  async function ensureLocationPermission() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') return true;
      const { status: s2 } = await Location.requestForegroundPermissionsAsync();
      return s2 === 'granted';
    } catch (e) {
      console.log('[Location] permission error:', e?.message);
      return false;
    }
  }

  // ── boot ──
  useEffect(() => {
    (async () => {
      await reqCam();
      await Audio.requestPermissionsAsync();
      try {
        const { error } = await supabase.from('sessions').insert({ mode: MODES[0].ar });
        console.log('[Supabase] sessions insert:', error ?? 'ok');
      } catch (e) { console.log('[Supabase] sessions error:', e); }
    })();
    return () => { clearInterval(loop.current); clearInterval(sosLoop.current); clearTimeout(speakTimer.current); };
  }, []);

  // ── live dot pulse ──
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.8, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  // ── scan bar ──
  useEffect(() => {
    if (!scanning) { scanAnim.stopAnimation(); scanAnim.setValue(0); return; }
    Animated.loop(Animated.timing(scanAnim, { toValue: 1, duration: 1600, useNativeDriver: true })).start();
  }, [scanning]);

  // ── accelerometer: shake (magnitude > 15) → open mic ──
  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    let prev = { x: 0, y: 0, z: 0 };
    let shakeCount = 0;

    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const delta = Math.sqrt((x - prev.x) ** 2 + (y - prev.y) ** 2 + (z - prev.z) ** 2);
      prev = { x, y, z };

      if (delta > 15) {
        const now = Date.now();

        if (now - lastShake.current < 1200) {
          shakeCount++;
        } else {
          shakeCount = 1;
        }

        lastShake.current = now;

        if (shakeCount === 1) {
          console.log('[Shake] first');
        }

        if (shakeCount === 2) {
          console.log('[Shake] second → mic');
          Vibration.vibrate(100);
          startListening();
          shakeCount = 0;
        }
      }
    });

    return () => sub.remove();
  }, []);

  // ── run the active mode's scan function ──
  function runCurrentMode(modeId) {
    if (modeId === 'explore')  doExplore();
    if (modeId === 'currency') doCurrency();
    if (modeId === 'find')     doFind();
    // read and describe are manual-only
  }

  // ── mode scan loop (manual only) ──
  useEffect(() => {
    clearInterval(loop.current);
    epoch.current += 1;
    busy.current = false;
    isSpeaking.current = false;
    prevKey.current = '';
    lastReadTxt.current = '';
    lastFrameAt.current = 0;
    lastFindVisionAt.current = 0;
    lastExploreFallbackAt.current = 0;
    setOverlayState((current) => ({ ...current, detections: [] }));

    const modeId = MODES[modeIdx]?.id;
    if (modeId === 'explore' || modeId === 'find' || modeId === 'currency') {
      const intervalMs = modeId === 'currency' ? 15000 : 3000;
      loop.current = setInterval(() => {
        runCurrentMode(modeId);
      }, intervalMs);
    }

    return () => clearInterval(loop.current);
  }, [modeIdx, findTgt]);

  // ── EXPLORE — YOLO vision ─────────────────────────────────────────────────
  async function doExplore() {
    const now     = Date.now();
    const myEpoch = epoch.current;
    if (busy.current || !camRef.current) return;
    if (now - lastFrameAt.current < 3000) return;
    busy.current = true;
    lastFrameAt.current = now;
    setScanning(true);
    try {
      console.log('[Explore] grabbing frame...');
      const frame = await grabFrame(camRef, 640, 0.6);
      if (epoch.current !== myEpoch) return;

      const detections = await yoloDetectBoxes(frame);
      if (epoch.current !== myEpoch) return;

      console.log('[Explore] YOLO detections:', detections.length);
      setDetectionOverlay(frame, detections, GREEN);

      const summary = detectionSummary(detections, frame.width);
      const t = Date.now();

      const closePerson = detections.find((det) => shouldWarnClosePerson(det, frame));
      if (closePerson && t - lastClosePersonAt.current > 12000) {
        lastClosePersonAt.current = t;
        softAnnounce('شخص قريب منك، انتبه');
        return;
      }

      const enoughTime = summary !== lastExplorePhrase.current
        ? t - lastExploreSpokeAt.current > 10000
        : t - lastExploreSpokeAt.current > 12000;
      if (summary && enoughTime) {
        lastExplorePhrase.current = summary;
        lastExploreSpokeAt.current = t;
        softAnnounce(summary);
      }
      if (!summary && t - lastExploreFallbackAt.current > 7000) {
        lastExploreFallbackAt.current = t;
        setStatus('لا يوجد كائن واضح حالياً');
      }
    } catch (e) {
      console.log('[Explore] exception:', e?.message);
      const t = Date.now();
      if (t - lastDetectErrorAt.current > 12000) {
        lastDetectErrorAt.current = t;
        flash('تعذر الاتصال بخادم YOLO الآن');
      }
    } finally {
      if (epoch.current === myEpoch) { busy.current = false; setScanning(false); }
    }
  }

  // ── READ — manual (mic tap) ───────────────────────────────────────────────
  async function doRead() {
    const now     = Date.now();
    const myEpoch = epoch.current;
    if (busy.current || isSpeaking.current || !camRef.current || !beginAiTask()) return;
    busy.current = true;
    lastFrameAt.current = now;
    setScanning(true);
    try {
      console.log('[Read] grabbing frame...');
      const frame = await grabFrame(camRef, 768, 0.45);
      if (epoch.current !== myEpoch) return;

      // Try Gemini first (best free OCR), fallback to Groq
      let text = await geminiReadText(frame.base64);
      if (!text) {
        console.log('[Read] Gemini failed, trying Groq...');
        text = await groqVision(
          frame.base64,
          'اقرأ جميع النصوص المرئية في الصورة. أولاً النصوص بالعربية ثم الإنجليزية. إذا لا يوجد نص قل: لا يوجد نص'
        );
      }
      if (epoch.current !== myEpoch) return;
      syncRateLimitState();

      console.log('[Read] text:', text);
      if (!text) {
        setStatus('الخدمة مشغولة الآن، حاول بعد لحظات.');
        return;
      }
      if (text === 'لا يوجد نص' || text.length < 3) return;
      if (text === lastReadTxt.current && now - lastReadTime.current < 10000) {
        console.log('[Read] skipping duplicate text');
        return;
      }
      lastReadTxt.current = text;
      lastReadTime.current = Date.now();
      setStatus('');
      flash(text);
      safeTts(text);
    } catch (e) {
      console.log('[Read] exception:', e?.message);
    } finally {
      if (epoch.current === myEpoch) { busy.current = false; setScanning(false); }
      endAiTask();
    }
  }

  // ── DESCRIBE — triggered by single mic tap ────────────────────────────────
  async function doDescribe() {
    const myEpoch = epoch.current;
    if (!camRef.current || busy.current || !beginAiTask()) return;
    busy.current = true;
    lastFrameAt.current = Date.now();
    setScanning(true);
    announce('جاري وصف المشهد');
    try {
      console.log('[Describe] grabbing frame...');
      const frame = await grabFrame(camRef, 768, 0.40);
      if (epoch.current !== myEpoch) return;

      // Try Gemini first (best quality), fallback to Groq
      let desc = await geminiDescribeScene(frame.base64, frame.width, frame.height);
      if (!desc) {
        console.log('[Describe] Gemini failed, trying Groq...');
        desc = await groqVision(
          frame.base64,
          'صف المشهد في جملة واحدة قصيرة ومفيدة للمكفوفين بالعربية فقط.'
        );
      }
      if (epoch.current !== myEpoch) return;
      syncRateLimitState();

      console.log('[Describe] result:', desc);
      if (!desc) {
        setStatus('الخدمة مشغولة الآن، حاول بعد لحظات.');
        announce('الخدمة مشغولة الآن، حاول بعد لحظات.');
        return;
      }
      setStatus('');
      announce(desc);
    } catch (e) {
      console.log('[Describe] exception:', e?.message);
      announce('تعذّر وصف المشهد');
    } finally {
      if (epoch.current === myEpoch) { busy.current = false; setScanning(false); }
      endAiTask();
    }
  }

  // ── FIND — auto-scan, orange boxes for all objects, green for match ──────────
  async function doFind() {
    const now     = Date.now();
    const myEpoch = epoch.current;
    let frame = null;
    if (busy.current || !camRef.current) return;
    if (now - lastFrameAt.current < 3000) return;
    busy.current = true;
    lastFrameAt.current = now;
    setScanning(true);
    try {
      frame = await grabFrame(camRef, 512, 0.35);
      if (epoch.current !== myEpoch) return;

      const detections = await yoloDetectBoxes(frame);
      if (epoch.current !== myEpoch) return;

      // Show all detections in orange; matched ones in green
      setDetectionOverlay(frame, detections, ORANGE, findTgt);
      console.log('[Find] YOLO detections:', detections.length, 'target:', findTgt);

      if (!findTgt) return; // scanning silently, waiting for target

      const matched = detections.filter((d) => matchesTarget(d.label, findTgt));
      if (matched.length) {
        const best = matched.sort((a, b) => b.confidence - a.confidence)[0];
        const foundText = `${translateLabel(best.label)} ${detectionPosition(best.box, frame.width)}`;
        if (foundText !== prevKey.current || now - lastSpoke.current > 7000) {
          prevKey.current   = foundText;
          lastSpoke.current = Date.now();
          softAnnounce(`وجدت ${foundText}`);
        }
        return;
      }

      if (now - lastFindVisionAt.current > 8000) {
        lastFindVisionAt.current = now;
        setStatus(`لم أجد ${findTgt} بعد`);
      }
    } catch (e) {
      console.log('[Find] exception:', e?.message);
      if (findTgt && now - lastFindVisionAt.current > 5000) {
        lastFindVisionAt.current = now;
        setStatus('تعذر الاتصال بخادم YOLO الآن');
      }
    } finally {
      if (epoch.current === myEpoch) { busy.current = false; setScanning(false); }
    }
  }

  // ── CURRENCY — Groq-only, auto every 15 s ───────────────────────────────
  async function doCurrency() {
    const now     = Date.now();
    const myEpoch = epoch.current;
    if (busy.current || isSpeaking.current || !camRef.current || !beginAiTask()) return;
    busy.current = true;
    lastFrameAt.current = now;
    setScanning(true);
    try {
      console.log('[Currency] grabbing frame...');
      const frame = await grabFrame(camRef, 800, 0.45);
      if (epoch.current !== myEpoch) return;
      const result = await groqVision(
        frame.base64,
        'Identify Tunisian currency only. Reply with ONLY ONE of these Arabic values: 100 مليم, 200 مليم, 500 مليم, 1 دينار, 2 دينار, 5 دينار, 10 دينار, 20 دينار, 50 دينار. If no Tunisian currency is visible, reply: لا يوجد نقد. No explanation.',
        GROQ_CURRENCY_MODELS
      );
      if (epoch.current !== myEpoch) return;
      syncRateLimitState();

      console.log('[Currency] result:', result);
      if (!result) {
        setStatus('الخدمة مشغولة الآن، حاول بعد لحظات.');
        return;
      }

      const allowed = [
        '100 مليم','200 مليم','500 مليم',
        '1 دينار','2 دينار','5 دينار',
        '10 دينار','20 دينار','50 دينار'
      ];

      const clean = allowed.find((v) => (result || '').includes(v));
      if (!clean) return;
      if (clean === prevKey.current && now - lastSpoke.current < 15000) return;
      prevKey.current = clean;
      lastSpoke.current = now;
      setStatus('');
      announce(clean);
    } catch (e) {
      console.log('[Currency] exception:', e?.message);
    } finally {
      if (epoch.current === myEpoch) { busy.current = false; setScanning(false); }
      endAiTask();
    }
  }

  // ── SOS ──────────────────────────────────────────────────────────────────
  async function triggerSOS() {
    clearInterval(sosLoop.current);
    Vibration.vibrate([0, 200, 100, 200, 100, 500]);
    announce('جاري إرسال نداء الاستغاثة');

    let lat = 0, lon = 0;
    try {
      const ok = await ensureLocationPermission();
      if (ok) {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
        console.log('[SOS] location:', lat, lon);
      }
    } catch (e) { console.log('[SOS] location error:', e?.message); }

    const link = `https://maps.google.com/?q=${lat},${lon}`;
    const msg  = `🆘 نداء استغاثة - AI Eyes\nالموقع: ${lat.toFixed(5)}, ${lon.toFixed(5)}\n${link}`;

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text: msg }),
      });
      console.log('[SOS] Telegram status:', tgRes.status);
    } catch (e) { console.log('[SOS] Telegram error:', e?.message); }

    try {
      const { error } = await supabase.from('sos_alerts').insert({
        latitude: lat,
        longitude: lon,
      });
      console.log('[SOS] Supabase sos_alerts:', error ?? 'ok');
    } catch (e) { console.log('[SOS] Supabase error:', e?.message); }

    announce('تم إرسال نداء الاستغاثة');

    let ticks = 0;
    sosLoop.current = setInterval(async () => {
      if (++ticks > 10) { clearInterval(sosLoop.current); return; }
      try {
        const ok = await ensureLocationPermission();
        if (!ok) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { error } = await supabase.from('location_updates').insert({
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        console.log('[SOS] location_updates tick', ticks, ':', error ?? 'ok');
      } catch (e) { console.log('[SOS] location_updates error:', e?.message); }
    }, 5_000);
  }

  triggerRef.current = triggerSOS;

  // ── MIC ──────────────────────────────────────────────────────────────────
  async function handleMic() {
    console.log('[Mic] tap, mode:', mode.id, 'listening:', listening);

    if (!listening) {
      if (mode.id === 'describe') { doDescribe(); return; }
      if (mode.id === 'read')     { doRead();     return; }
      if (mode.id === 'currency') { doCurrency(); return; }
      await startListening();
      return;
    }

    if (listening) {
      await stopListeningAndProcess();
    }
  }
  handleMicRef.current = handleMic;

  // ── voice command processor ───────────────────────────────────────────────
  function processVoice(text) {
    const t   = text.trim();
    const cleaned = t.replace(/^\s*(?:اوعمتسا|يعمتسا|عمتسا|عمتسأ|استمعوا|استمعي|استمع|أستمع)\s*/u, '').trim();
    const spoken = cleaned || t;
    const low = spoken.toLowerCase();
    console.log('[Voice] processing:', spoken);

    if (isNoisyTranscript(spoken)) {
      announce('لم أفهم، حاول مرة أخرى');
      return;
    }

    if (SOS_WORDS.some(w => spoken.includes(w) || low.includes(w))) {
      triggerSOS();
      return;
    }

    const modeAliases = {
      explore:  ['استكشاف', 'استكشف', 'explore'],
      read:     ['قراءة', 'اقرأ', 'read'],
      describe: ['وصف', 'describe'],
      find:     ['بحث', 'ابحث', 'find'],
      currency: ['عملة', 'دينار', 'currency'],
    };
    for (let i = 0; i < MODES.length; i++) {
      const aliases = modeAliases[MODES[i].id] ?? [MODES[i].ar];
      if (aliases.some(a => spoken.includes(a) || low.includes(a.toLowerCase()))) {
        switchMode(i);
        return;
      }
    }

    if (mode.id === 'find') {
      setFindTgt(spoken);
      announce(`جاري البحث عن: ${spoken}`);
      return;
    }

    announce(spoken);
  }

  function switchMode(i) {
    setModeIdx(i);
    setFindTgt(null);
    setStatus('');
    processingRef.current = false;
    setIsProcessing(false);
    epoch.current += 1;
    busy.current = false;
    isSpeaking.current = false;
    setOverlayState((current) => ({ ...current, detections: [] }));
    tts(MODES[i].ar);
  }

  // ── render guards ─────────────────────────────────────────────────────────
  if (splash) return <Splash onDone={() => setSplash(false)} />;
  if (!camPerm) return <View style={s.center}><ActivityIndicator color={GREEN} size="large" /></View>;
  if (!camPerm.granted) {
    return (
      <View style={s.center}>
        <Text style={s.permTxt}>يحتاج التطبيق إلى إذن الكاميرا</Text>
        <TouchableOpacity style={s.permBtn} onPress={reqCam}>
          <Text style={s.permBtnTxt}>منح الإذن</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-3, SH] });
  const sosRingScale = sosPressAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] });
  const sosRingOpacity = sosPressAnim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.35, 0.9] });

  return (
    <View style={s.root}>
      <StatusBar hidden />

      {/* full-screen camera */}
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing={facing} contentFit="contain"/>

      {/* detection brackets */}
      {overlayState.detections.length > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {overlayState.detections.map((det, index) => {
            const rect = computeOverlayRect(det, overlayState, facing === 'front');
            const color = det.matched ? GREEN : overlayState.tone;

            return (
              <React.Fragment key={`${det.label}-${index}`}>
                {/* BOX */}
                <View
                  style={[
                    s.cornerWrap,
                    {
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                      zIndex: 20,
                      elevation: 20,
                    },
                  ]}
                >
                  <View style={[s.corner, s.cornerTL, { borderColor: color }]} />
                  <View style={[s.corner, s.cornerTR, { borderColor: color }]} />
                  <View style={[s.corner, s.cornerBL, { borderColor: color }]} />
                  <View style={[s.corner, s.cornerBR, { borderColor: color }]} />
                </View>

                {/* LABEL (SEPARATE) */}
                <View
                  style={[
                    s.detLabelWrap,
                    {
                      left: rect.labelLeft,
                      top: rect.labelTop,
                      zIndex: 30,
                      elevation: 30,
                      maxWidth: Math.max(80, SW - rect.labelLeft - 8),
                    },
                  ]}
                >
                  <Text style={[s.detLabelTxt, { color }]}>
                    {`${translateLabel(det.label)} ${Math.round((det.confidence ?? 0) * 100)}%`}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      )}

      {/* scan line */}
      {scanning && (
        <Animated.View pointerEvents="none"
          style={[s.scanLine, { transform: [{ translateY: scanY }] }]} />
      )}

      {/* ── top bar ── */}
      <View style={s.topBar}>
        <View style={{ width: 72 }} />
        <Text style={s.topTitle}>عيون الذكاء</Text>
        <View style={s.liveWrap}>
          <Animated.View style={[s.liveDot, { transform: [{ scale: pulse }] }]} />
          <Text style={s.liveTxt}>مباشر</Text>
        </View>
      </View>

      {/* find target badge */}
      {mode.id === 'find' && findTgt && (
        <View style={s.findBadge}>
          <Text style={s.findBadgeTxt}>بحث: {findTgt}</Text>
        </View>
      )}

      {/* find quick targets */}
      {mode.id === 'find' && !findTgt && (
        <View style={s.findQuickWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.findQuickRow}>
            {FIND_QUICK_TARGETS.map((target) => (
              <TouchableOpacity
                key={target}
                style={s.findQuickChip}
                onPress={() => {
                  setFindTgt(target);
                  announce(`جاري البحث عن: ${target}`);
                }}
              >
                <Text style={s.findQuickTxt}>{target}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* describe hint */}
      {mode.id === 'describe' && !banner && (
        <View style={s.descHint} pointerEvents="none">
          <Text style={s.descHintTxt}>اضغط ◉ لوصف المشهد</Text>
        </View>
      )}

      {/* status banner */}
      <Animated.View style={[s.banner, { opacity: bannerOp }]} pointerEvents="none">
        <Text style={s.bannerTxt}>{banner}</Text>
      </Animated.View>

      {!!status && (
        <View style={s.statusBox} pointerEvents="none">
          <Text style={s.statusTxt}>{status}</Text>
        </View>
      )}

      {/* ── bottom sheet ── */}
      <View style={s.sheet}>
        <Text style={s.hint}>{mode.hint}</Text>

        {/* mode pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.pillRow} contentContainerStyle={s.pillContent}>
          {MODES.map((m, i) => (
            <TouchableOpacity key={m.id}
              style={[s.pill, i === modeIdx && s.pillOn]}
              onPress={() => switchMode(i)}>
              <Text style={[s.pillTxt, i === modeIdx && s.pillTxtOn]}>{m.ar}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* controls */}
        <View style={s.ctrl}>
          {/* DEBUG: inject fake detection (dev only) */}
          {__DEV__ && (
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: 'rgba(255,100,100,0.12)' }]}
              onPress={() => {
                const fakeFrame = { width: 640, height: 480 };
                const fakeDet = [{
                  label: 'person',
                  confidence: 0.85,
                  box: { x1: 100, y1: 80, x2: 380, y2: 420 },
                }];
                setDetectionOverlay(fakeFrame, fakeDet, GREEN);
                announce('شخص أمامك');
              }}
            >
              <Text style={s.iconTxt}>DBG</Text>
            </TouchableOpacity>
          )}
          {/* flip */}
          <TouchableOpacity style={s.iconBtn}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
            <Text style={s.iconTxt}>⟳</Text>
          </TouchableOpacity>

          {/* mic */}
          <TouchableOpacity style={[s.micBtn, listening && s.micRec]} onPress={handleMic}>
            {listening
              ? <View style={s.stopSquare} />
              : <Text style={s.micTxt}>◉</Text>}
          </TouchableOpacity>

          {/* SOS — long press 2.5 s */}
          <View style={s.sosWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                s.sosRing,
                { opacity: sosRingOpacity, transform: [{ scale: sosRingScale }] },
              ]}
            />
            <Pressable
              style={s.sosBtn}
              delayLongPress={2000}
              onPressIn={() => {
                sosLongPressFired.current = false;
                clearTimeout(sosPressTimer.current);
                sosPressAnim.stopAnimation();
                Animated.timing(sosPressAnim, {
                  toValue: 1,
                  duration: 2000,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                clearTimeout(sosPressTimer.current);
                sosPressAnim.stopAnimation();
                Animated.timing(sosPressAnim, {
                  toValue: 0,
                  duration: 180,
                  useNativeDriver: true,
                }).start();
                if (!sosLongPressFired.current) {
                  sosLongPressFired.current = false;
                }
              }}
              onLongPress={() => {
                sosLongPressFired.current = true;
                triggerSOS();
              }}
            >
              <Text style={s.sosTxt}>SOS</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  permTxt:    { color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 24, paddingHorizontal: 32 },
  permBtn:    { backgroundColor: GREEN, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14 },
  permBtnTxt: { color: '#000', fontSize: 18, fontWeight: '700' },

  // scan line
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: GREEN, opacity: 0.65,
  },

  cornerWrap: {
    position: 'absolute',
    borderWidth: 0,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  cornerTL: {
    left: -1,
    top: -1,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    right: -1,
    top: -1,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    left: -1,
    bottom: -1,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    right: -1,
    bottom: -1,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 16,
  },
  detLabelWrap: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detLabelTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  // top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 38 : 56,
    paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.80)',
  },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.8 },
  liveWrap: { width: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginRight: 5 },
  liveTxt:  { color: GREEN, fontSize: 13, fontWeight: '600' },

  // overlays
  findBadge: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 102 : 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1, borderColor: GREEN,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  findBadgeTxt: { color: GREEN, fontSize: 15, fontWeight: '600' },

  findQuickWrap: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 138 : 154,
    left: 8,
    right: 8,
  },
  findQuickRow: {
    paddingHorizontal: 4,
    gap: 8,
  },
  findQuickChip: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  findQuickTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  descHint: {
    position: 'absolute',
    top: '42%', left: 0, right: 0, alignItems: 'center',
  },
  descHintTxt: {
    color: 'rgba(255,255,255,0.45)', fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20,
  },

  // banner
  banner: {
    position: 'absolute', bottom: 174, left: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.84)',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  bannerTxt: { color: '#fff', fontSize: 17, textAlign: 'center', lineHeight: 27 },

  statusBox: {
    position: 'absolute',
    bottom: 244,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,140,0,0.20)',
    borderColor: 'rgba(255,140,0,0.55)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statusTxt: { color: '#ffd29a', fontSize: 14, textAlign: 'center' },

  // sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 14 : 28,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  hint: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11,
    textAlign: 'center', marginBottom: 7, letterSpacing: 0.4,
  },

  // pills
  pillRow:    { },
  pillContent:{ paddingHorizontal: 12, gap: 8, paddingBottom: 2 },
  pill:        { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 22,
                 backgroundColor: 'rgba(255,255,255,0.07)',
                 borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  pillOn:      { backgroundColor: GREEN, borderColor: GREEN },
  pillTxt:     { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '500' },
  pillTxtOn:   { color: '#000', fontWeight: '700' },

  // controls
  ctrl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 40, paddingTop: 10,
  },
  iconBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  iconTxt: { color: '#fff', fontSize: 22 },
  micBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: GREEN, shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 10,
  },
  micRec:     { backgroundColor: RED, shadowColor: RED },
  micTxt:     { color: '#fff', fontSize: 26 },
  stopSquare: { width: 18, height: 18, borderRadius: 3, backgroundColor: '#fff' },
  sosBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  sosWrap: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sosTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
});
