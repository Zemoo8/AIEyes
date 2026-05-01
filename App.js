import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Pressable,
  ScrollView, Animated, Easing, Dimensions, Platform,
  ActivityIndicator, Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Canvas,
  Circle as SkiaCircle,
  Fill as SkiaFill,
  Group as SkiaGroup,
  Paint as SkiaPaint,
  Path as SkiaPath,
  Rect as SkiaRect,
  Blur as SkiaBlur,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, G, Path, Circle, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import AnimatedReanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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
  { id: 'read',     ar: 'قراءة',   hint: 'قراءة النصوص' },
  { id: 'describe', ar: 'وصف',     hint: 'اضغط ◉ لوصف المشهد' },
  { id: 'explore',  ar: 'استكشاف', hint: 'كشف تلقائي للأشياء' },   // index 2 — center
  { id: 'find',     ar: 'بحث',     hint: 'يبحث تلقائياً - اضغط ◉ لتحديد الهدف' },
  { id: 'currency', ar: 'عملة',    hint: 'كشف الأوراق النقدية التونسية' },
];

const SOS_WORDS = [
  'نجدة', 'النجدة', 'ساعدني', 'أغثني', 'مساعدة',
  'خطر', 'الله', 'يا ناس',
  'help', 'help me', 'urgence', 'urgent', 'sos',
];
const C = {
  bg:          '#090814',
  surface:     '#151331',
  glass:       'rgba(18, 16, 41, 0.94)',
  primary:     '#786dff',
  primaryGlow: 'rgba(120, 109, 255, 0.36)',
  primaryDim:  'rgba(120, 109, 255, 0.12)',
  found:       '#9b92ff',
  foundGlow:   'rgba(155, 146, 255, 0.30)',
  danger:      '#FF3062',
  dangerGlow:  'rgba(255, 48, 98, 0.38)',
  warn:        '#ffb86b',
  warnDim:     'rgba(255, 184, 107, 0.16)',
  textPri:     '#F4F3FF',
  textSec:     'rgba(214, 210, 255, 0.80)',
  textMuted:   'rgba(151, 145, 203, 0.48)',
  border:      'rgba(120, 109, 255, 0.18)',
};
const GREEN  = C.found;
const ORANGE = C.warn;
const RED    = C.danger;

const AnimatedPath = AnimatedReanimated.createAnimatedComponent(Path);

// Speech-optimised recording: mono, smaller bitrate → faster Whisper upload
const SPEECH_RECORDING_OPTIONS = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: { ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android, numberOfChannels: 1, bitRate: 32000 },
  ios:     { ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,     numberOfChannels: 1, bitRate: 32000 },
};

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
  chair: ['كرسي', 'كورسي', 'كُرسي', 'chair', 'corsi', 'kursi', 'korsi'],
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
  
  // Try normalized matching first
  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) continue;
    if (
      normalizedAlias === normalizedTarget
      || normalizedTarget.includes(normalizedAlias)
      || normalizedAlias.includes(normalizedTarget)
    ) return true;
  }
  
  // Try direct substring match (for cases like Latin "Corsi" matching Arabic "كرسي")
  const targetLower = target.toLowerCase().trim();
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase().trim();
    if (aliasLower.includes(targetLower) || targetLower.includes(aliasLower)) {
      return true;
    }
  }
  
  return false;
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

const BOX_Y_OFFSET = -100;

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

  // Apply Y offset to move boxes up, add padding, and clamp
  const xPadding = 8;
  const yPadding = 12;
  let left = offsetX + boxLeft * scale - xPadding;
  let top = offsetY + det.box.y1 * scale + BOX_Y_OFFSET - yPadding;
  let width = (boxRight - boxLeft) * scale + (xPadding * 2);
  let height = (det.box.y2 - det.box.y1) * scale + (yPadding * 2);

  left = clamp(left, 0, SW - 8);
  top = clamp(top, 0, SH - 8);
  width = clamp(width, 24, SW - left);
  height = clamp(height, 24, SH - top);

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

async function groqVision(base64, prompt, models = GROQ_VISION_MODELS, maxTokens = 400) {
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
          max_tokens: maxTokens,
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
const LOGO_SIZE = 180;
const SP_EM   = '#7a6cff';
const SP_NEON = '#c9c2ff';
const SP_CY   = '#f5f3ff';
const SP_BG   = '#060611';
const Z_PATH = 'M 48 50 H 126 L 58 88 H 126 L 48 126';
const EYE_PATH = 'M 24 88 L 46 56 L 84 40 L 130 47 L 152 88 L 130 129 L 84 136 L 46 120 Z';
const INNER_EYE_PATH = 'M 40 88 L 56 68 L 84 60 L 116 66 L 136 88 L 116 110 L 84 116 L 56 108 Z';

function SkiaBackdrop() {
  return (
    <Canvas style={StyleSheet.absoluteFill} opaque>
      <SkiaFill color={SP_BG} />

      <SkiaGroup layer={<SkiaPaint><SkiaBlur blur={52} /></SkiaPaint>} blendMode="screen">
        <SkiaCircle cx={SW * 0.5} cy={SH * 0.46} r={240} color="rgba(120,109,255,0.20)" />
        <SkiaCircle cx={SW * 0.5} cy={SH * 0.49} r={150} color="rgba(201,194,255,0.24)" />
        <SkiaCircle cx={SW * 0.48} cy={SH * 0.53} r={92} color="rgba(245,243,255,0.44)" />
        <SkiaCircle cx={SW * 0.28} cy={SH * 0.26} r={170} color="rgba(98,76,255,0.10)" />
        <SkiaCircle cx={SW * 0.74} cy={SH * 0.28} r={160} color="rgba(135,126,255,0.12)" />
        <SkiaCircle cx={SW * 0.5} cy={SH * 0.75} r={165} color="rgba(120,109,255,0.08)" />
      </SkiaGroup>

      <SkiaGroup origin={vec(SW / 2, SH * 0.48)} transform={[{ rotate: -0.22 }]} opacity={0.88}>
        <SkiaRect x={-SW * 0.34} y={SH * 0.50} width={SW * 1.68} height={7} radius={999} color="rgba(120,109,255,0.24)" />
        <SkiaRect x={-SW * 0.26} y={SH * 0.38} width={SW * 1.52} height={4} radius={999} color="rgba(201,194,255,0.18)" />
        <SkiaRect x={-SW * 0.30} y={SH * 0.60} width={SW * 1.58} height={5} radius={999} color="rgba(98,76,255,0.16)" />
        <SkiaRect x={SW * 0.06} y={SH * 0.14} width={8} height={SH * 0.50} radius={999} color="rgba(245,243,255,0.08)" />
      </SkiaGroup>

      <SkiaGroup origin={vec(SW / 2, SH * 0.5)}>
        <SkiaCircle cx={SW / 2} cy={SH * 0.5} r={116} color="rgba(120,109,255,0.16)" />
        <SkiaCircle cx={SW / 2} cy={SH * 0.5} r={78} color="rgba(201,194,255,0.12)" />
        <SkiaCircle cx={SW / 2} cy={SH * 0.5} r={34} color="rgba(245,243,255,0.90)" />
        <SkiaCircle cx={SW / 2} cy={SH * 0.5} r={16} color="rgba(255,255,255,0.94)" />
      </SkiaGroup>
    </Canvas>
  );
}

const SPLASH_LOTTIE = {
  v: '5.10.0',
  fr: 60,
  ip: 0,
  op: 180,
  w: 1080,
  h: 1920,
  nm: 'AIEyes Reactor',
  ddd: 0,
  assets: [],
  layers: [
    {
      ty: 4,
      nm: 'reactor ring',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 16, s: [100] }, { t: 150, s: [100] }, { t: 180, s: [0] }] },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 180, s: [360] }] },
        p: { a: 0, k: [540, 960, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [760, 760] }, nm: 'ring ellipse' },
            { ty: 'st', c: { a: 0, k: [0.137, 0.961, 0.533, 1] }, o: { a: 0, k: 60 }, w: { a: 0, k: 4 }, lc: 2, lj: 2, ml: 4, nm: 'ring stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
          ],
        },
      ],
    },
    {
      ty: 4,
      nm: 'slash beam',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 8, s: [100] }, { t: 20, s: [100] }, { t: 40, s: [0] }] },
        r: { a: 0, k: -13 },
        p: { a: 1, k: [{ t: 0, s: [140, 890, 0] }, { t: 40, s: [540, 960, 0] }, { t: 84, s: [940, 1030, 0] }, { t: 140, s: [1180, 1080, 0] }] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [12, 12, 100] }, { t: 14, s: [132, 132, 100] }, { t: 28, s: [108, 108, 100] }, { t: 40, s: [24, 24, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [1240, 18] }, r: { a: 0, k: 9 }, nm: 'beam rect' },
            { ty: 'fl', c: { a: 0, k: [0.227, 1, 0.533, 1] }, o: { a: 0, k: 100 }, nm: 'beam fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
          ],
        },
      ],
    },
    {
      ty: 4,
      nm: 'core pulse',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 16, s: [90] }, { t: 90, s: [100] }, { t: 154, s: [86] }, { t: 180, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [540, 960, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [40, 40, 100] }, { t: 24, s: [118, 118, 100] }, { t: 88, s: [104, 104, 100] }, { t: 140, s: [132, 132, 100] }, { t: 180, s: [86, 86, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [190, 190] }, nm: 'core ellipse' },
            { ty: 'fl', c: { a: 0, k: [0.137, 0.961, 0.533, 1] }, o: { a: 0, k: 85 }, nm: 'core fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
          ],
        },
      ],
    },
    {
      ty: 4,
      nm: 'glitch band 1',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 28, s: [0] }, { t: 40, s: [100] }, { t: 58, s: [0] }, { t: 180, s: [0] }] },
        r: { a: 0, k: -18 },
        p: { a: 1, k: [{ t: 0, s: [160, 760, 0] }, { t: 44, s: [540, 790, 0] }, { t: 78, s: [920, 820, 0] }, { t: 180, s: [1000, 840, 0] }] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [{ ty: 'gr', it: [{ ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [1180, 8] }, r: { a: 0, k: 999 } }, { ty: 'fl', c: { a: 0, k: [0.137, 0.961, 0.533, 1] }, o: { a: 0, k: 78 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }] }],
    },
    {
      ty: 4,
      nm: 'glitch band 2',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 42, s: [0] }, { t: 52, s: [100] }, { t: 70, s: [0] }, { t: 180, s: [0] }] },
        r: { a: 0, k: 11 },
        p: { a: 1, k: [{ t: 0, s: [960, 980, 0] }, { t: 54, s: [540, 990, 0] }, { t: 88, s: [140, 1000, 0] }, { t: 180, s: [40, 1010, 0] }] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [{ ty: 'gr', it: [{ ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [1180, 6] }, r: { a: 0, k: 999 } }, { ty: 'fl', c: { a: 0, k: [0.243, 0.953, 1, 1] }, o: { a: 0, k: 70 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }] }],
    },
  ],
};

function Splash({ onDone }) {
  // Phase 1 — black screen, then laser slash
  const slash = useSharedValue(0);
  const streakA = useSharedValue(0);
  const streakB = useSharedValue(0);
  const streakC = useSharedValue(0);

  // Ambient motion — makes the intro feel alive instead of static.
  const cameraDrift = useSharedValue(0);
  const orbitSpin = useSharedValue(0);
  const orbitPulse = useSharedValue(0);
  const glitchBurst = useSharedValue(0);

  // Phase 2 — Z glitches into existence
  const zReveal = useSharedValue(0);
  const zJitter = useSharedValue(0);

  // Phase 3 — angular eye frame draws around the Z
  const frameReveal = useSharedValue(0);
  const coreReveal = useSharedValue(0);
  const corePulse = useSharedValue(0);

  // Phase 4 — scanline, flash, and text reveal
  const scanReveal = useSharedValue(0);
  const flashReveal = useSharedValue(0);
  const textOne = useSharedValue(0);
  const textTwo = useSharedValue(0);
  const textThree = useSharedValue(0);

  // Phase 5 — cinematic fade/zoom exit
  const rootOpacity = useSharedValue(1);
  const rootScale = useSharedValue(1);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
    transform: [
      { translateY: interpolate(cameraDrift.value, [0, 1], [10, -8]) },
      { translateX: interpolate(cameraDrift.value, [0, 1], [-4, 5]) },
      { rotate: `${interpolate(cameraDrift.value, [0, 1], [-0.35, 0.35])}deg` },
      { scale: rootScale.value },
    ],
  }));

  const slashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slash.value, [0, 0.12, 1], [0, 1, 0]),
    transform: [
      { translateX: interpolate(slash.value, [0, 1], [-SW * 0.42, SW * 0.24]) },
      { scaleX: interpolate(slash.value, [0, 1], [0.16, 1]) },
      { rotate: '-13deg' },
    ],
  }));

  const streak1Style = useAnimatedStyle(() => ({
    opacity: interpolate(streakA.value, [0, 0.08, 0.72, 1], [0, 1, 0.95, 0]),
    transform: [
      { translateX: interpolate(streakA.value, [0, 1], [-SW * 0.56, SW * 0.9]) },
      { translateY: -4 },
      { skewX: '-17deg' },
    ],
    top: SH * 0.36,
  }));

  const streak2Style = useAnimatedStyle(() => ({
    opacity: interpolate(streakB.value, [0, 0.08, 0.72, 1], [0, 1, 0.95, 0]),
    transform: [
      { translateX: interpolate(streakB.value, [0, 1], [-SW * 0.56, SW * 0.9]) },
      { translateY: 0 },
      { skewX: '-21deg' },
    ],
    top: SH * 0.50,
  }));

  const streak3Style = useAnimatedStyle(() => ({
    opacity: interpolate(streakC.value, [0, 0.08, 0.72, 1], [0, 1, 0.95, 0]),
    transform: [
      { translateX: interpolate(streakC.value, [0, 1], [-SW * 0.56, SW * 0.9]) },
      { translateY: 5 },
      { skewX: '-14deg' },
    ],
    top: SH * 0.64,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(zReveal.value, [0, 0.12, 1], [0, 1, 1]),
    transform: [
      { translateX: interpolate(zJitter.value, [0, 1], [0, 6]) },
      { translateY: interpolate(zJitter.value, [0, 1], [0, -1]) },
      { scale: interpolate(zReveal.value, [0, 1], [1.16, 1]) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frameReveal.value, [0, 0.2, 1], [0, 0.28, 0.95]),
    transform: [{ scale: interpolate(orbitPulse.value, [0, 1], [0.92, 1.14]) }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flashReveal.value, [0, 0.2, 0.55, 1], [0, 0.98, 0.34, 0]),
  }));

  const lottieStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frameReveal.value, [0, 0.14, 0.72, 1], [0, 1, 0.9, 0.18]),
    transform: [
      { scale: interpolate(corePulse.value, [0, 1], [1.08, 0.98]) },
      { rotate: `${interpolate(cameraDrift.value, [0, 1], [-1.5, 1.5])}deg` },
    ],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glitchBurst.value, [0, 0.12, 0.55, 1], [0, 1, 0.52, 0]),
  }));

  const burstTop1 = useAnimatedStyle(() => ({
    opacity: interpolate(glitchBurst.value, [0, 0.12, 0.55, 1], [0, 0.95, 0.45, 0]),
    transform: [
      { translateX: interpolate(glitchBurst.value, [0, 1], [-SW * 0.48, SW * 0.28]) },
      { scaleX: interpolate(glitchBurst.value, [0, 1], [0.2, 1.05]) },
      { skewX: '-22deg' },
    ],
    top: SH * 0.28,
  }));

  const burstTop2 = useAnimatedStyle(() => ({
    opacity: interpolate(glitchBurst.value, [0, 0.1, 0.5, 1], [0, 1, 0.36, 0]),
    transform: [
      { translateX: interpolate(glitchBurst.value, [0, 1], [SW * 0.22, -SW * 0.24]) },
      { scaleX: interpolate(glitchBurst.value, [0, 1], [0.15, 1.12]) },
      { skewX: '16deg' },
    ],
    top: SH * 0.42,
  }));

  const burstTop3 = useAnimatedStyle(() => ({
    opacity: interpolate(glitchBurst.value, [0, 0.15, 0.6, 1], [0, 0.88, 0.42, 0]),
    transform: [
      { translateX: interpolate(glitchBurst.value, [0, 1], [-SW * 0.18, SW * 0.36]) },
      { scaleX: interpolate(glitchBurst.value, [0, 1], [0.18, 0.92]) },
      { skewX: '-12deg' },
    ],
    top: SH * 0.59,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frameReveal.value, [0, 0.2, 1], [0, 0.3, 1]),
    transform: [
      { rotate: `${interpolate(orbitSpin.value, [0, 1], [0, 360])}deg` },
      { scale: interpolate(orbitPulse.value, [0, 1], [0.92, 1.05]) },
    ],
  }));

  const ringDotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frameReveal.value, [0, 0.25, 1], [0, 0.7, 1]),
    transform: [
      { rotate: `${interpolate(orbitSpin.value, [0, 1], [0, 360])}deg` },
      { translateX: 72 },
    ],
  }));

  const ringDotInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frameReveal.value, [0, 0.25, 1], [0, 0.55, 0.95]),
    transform: [
      { rotate: `${interpolate(orbitSpin.value, [0, 1], [0, -360])}deg` },
      { translateX: 48 },
    ],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scanReveal.value, [0, 0.08, 1], [0, 1, 0]),
    transform: [
      { translateX: interpolate(scanReveal.value, [0, 1], [-70, LOGO_SIZE + 70]) },
      { rotate: '-8deg' },
    ],
  }));

  const textOneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(textOne.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(textOne.value, [0, 1], [18, 0]) }],
  }));
  const textTwoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(textTwo.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(textTwo.value, [0, 1], [16, 0]) }],
  }));
  const textThreeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(textThree.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(textThree.value, [0, 1], [14, 0]) }],
  }));

  const frameAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 620 * (1 - frameReveal.value),
    opacity: interpolate(frameReveal.value, [0, 0.1, 1], [0, 1, 1]),
  }));

  const innerFrameAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 420 * (1 - frameReveal.value),
    opacity: interpolate(frameReveal.value, [0, 0.2, 1], [0, 0.55, 0.85]),
  }));

  useEffect(() => {
    const easeOut = ReanimatedEasing.out(ReanimatedEasing.cubic);
    const easeIn = ReanimatedEasing.in(ReanimatedEasing.quad);
    const easeBack = ReanimatedEasing.out(ReanimatedEasing.back(1.35));

    slash.value = 0;
    streakA.value = 0;
    streakB.value = 0;
    streakC.value = 0;
    cameraDrift.value = 0;
    orbitSpin.value = 0;
    orbitPulse.value = 0;
    glitchBurst.value = 0;
    zReveal.value = 0;
    zJitter.value = 0;
    frameReveal.value = 0;
    coreReveal.value = 0;
    corePulse.value = 0;
    scanReveal.value = 0;
    flashReveal.value = 0;
    textOne.value = 0;
    textTwo.value = 0;
    textThree.value = 0;
    rootOpacity.value = 1;
    rootScale.value = 1;

    cameraDrift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
        withTiming(0, { duration: 1400, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) })
      ),
      -1,
      false
    );
    orbitSpin.value = withRepeat(
      withTiming(1, { duration: 2600, easing: ReanimatedEasing.linear }),
      -1,
      false
    );
    orbitPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
        withTiming(0, { duration: 900, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) })
      ),
      -1,
      false
    );
    glitchBurst.value = withDelay(910, withSequence(
      withTiming(1, { duration: 70, easing: easeOut }),
      withTiming(0.35, { duration: 40, easing: easeIn }),
      withTiming(1, { duration: 55, easing: easeOut }),
      withTiming(0, { duration: 160, easing: easeIn })
    ));

    // Phase 1 — a hard emerald slash establishes the brand tone.
    slash.value = withSequence(
      withTiming(1, { duration: 92, easing: easeOut }),
      withTiming(0, { duration: 120, easing: easeIn })
    );

    // Phase 2 — staggered scan streaks sweep across the frame.
    streakA.value = withDelay(150, withSequence(
      withTiming(1, { duration: 180, easing: easeOut }),
      withTiming(0, { duration: 100, easing: easeIn })
    ));
    streakB.value = withDelay(205, withSequence(
      withTiming(1, { duration: 190, easing: easeOut }),
      withTiming(0, { duration: 100, easing: easeIn })
    ));
    streakC.value = withDelay(255, withSequence(
      withTiming(1, { duration: 190, easing: easeOut }),
      withTiming(0, { duration: 110, easing: easeIn })
    ));

    // Phase 3 — the Z glitches in with chromatic jitter.
    zReveal.value = withDelay(430, withSequence(
      withTiming(0.18, { duration: 28 }),
      withTiming(1, { duration: 92, easing: easeBack }),
      withTiming(0.78, { duration: 42 }),
      withTiming(1, { duration: 72, easing: easeOut })
    ));
    zJitter.value = withDelay(430, withSequence(
      withTiming(0, { duration: 22 }),
      withTiming(1, { duration: 18 }),
      withTiming(0.18, { duration: 16 }),
      withTiming(1, { duration: 20 }),
      withTiming(0.08, { duration: 18 }),
      withTiming(0, { duration: 72, easing: easeOut })
    ));

    // Phase 4 — the angular eye outline draws around the Z.
    frameReveal.value = withDelay(760, withTiming(1, { duration: 390, easing: easeOut }));

    // Phase 5 — the bright center pulse and halo breathe once the logo lands.
    coreReveal.value = withDelay(1030, withTiming(1, { duration: 170, easing: easeOut }));
    corePulse.value = withDelay(1120, withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
        withTiming(0, { duration: 520, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) })
      ),
      2,
      false
    ));

    // Phase 6 — a clean scanline sweeps across the eye.
    scanReveal.value = withDelay(1420, withSequence(
      withTiming(1, { duration: 220, easing: easeOut }),
      withTiming(0, { duration: 80, easing: easeIn })
    ));

    // Phase 7 — impact flash, then staggered text reveal.
    flashReveal.value = withDelay(1600, withSequence(
      withTiming(1, { duration: 24, easing: easeOut }),
      withTiming(0.32, { duration: 60, easing: easeIn }),
      withTiming(1, { duration: 28, easing: easeOut }),
      withTiming(0, { duration: 172, easing: easeIn })
    ));
    textOne.value = withDelay(1730, withTiming(1, { duration: 240, easing: easeOut }));
    textTwo.value = withDelay(1850, withTiming(1, { duration: 220, easing: easeOut }));
    textThree.value = withDelay(1955, withTiming(1, { duration: 220, easing: easeOut }));

    // Phase 8 — hold the hero frame briefly, then fade/zoom into the app.
    const finishSplash = () => onDone?.();
    rootOpacity.value = withDelay(2960, withTiming(0, { duration: 440, easing: easeIn }, (finished) => {
      if (finished) runOnJS(finishSplash)();
    }));
    rootScale.value = withDelay(2960, withTiming(1.12, { duration: 440, easing: easeOut }));

    return () => {
      cancelAnimation(slash);
      cancelAnimation(streakA);
      cancelAnimation(streakB);
      cancelAnimation(streakC);
      cancelAnimation(cameraDrift);
      cancelAnimation(orbitSpin);
      cancelAnimation(orbitPulse);
      cancelAnimation(glitchBurst);
      cancelAnimation(zReveal);
      cancelAnimation(zJitter);
      cancelAnimation(frameReveal);
      cancelAnimation(coreReveal);
      cancelAnimation(corePulse);
      cancelAnimation(scanReveal);
      cancelAnimation(flashReveal);
      cancelAnimation(textOne);
      cancelAnimation(textTwo);
      cancelAnimation(textThree);
      cancelAnimation(rootOpacity);
      cancelAnimation(rootScale);
    };
  }, [onDone]);

  const stageSparks = [
    { left: 32, top: 56, size: 5 },
    { left: 136, top: 46, size: 4 },
    { left: 148, top: 96, size: 5 },
    { left: 40, top: 132, size: 4 },
  ];

  return (
    <AnimatedReanimated.View style={[sp.root, rootStyle]}>
      <LinearGradient
        colors={[SP_BG, '#121126', '#2a2660', SP_BG]}
        locations={[0, 0.4, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(120,109,255,0.0)', 'rgba(120,109,255,0.22)', 'rgba(201,194,255,0.0)']}
        locations={[0, 0.5, 1]}
        style={sp.backGlow}
      />

      {/* Phase 1 — indigo slash */}
      <AnimatedReanimated.View style={[sp.slash, slashStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(120,109,255,0)', 'rgba(201,194,255,0.98)', 'rgba(120,109,255,0.95)', 'rgba(120,109,255,0)']}
          locations={[0, 0.42, 0.56, 1]}
          style={StyleSheet.absoluteFill}
        />
      </AnimatedReanimated.View>

      {/* Phase 1.5 — native Skia reactor rig */}
      <View style={sp.skiaWrap} pointerEvents="none">
        <SkiaBackdrop />
      </View>

      {/* Phase 2 — three scan streaks */}
      <AnimatedReanimated.View style={[sp.streak, streak1Style]} pointerEvents="none">
        <LinearGradient colors={['rgba(120,109,255,0)', 'rgba(120,109,255,0.95)', 'rgba(201,194,255,0)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </AnimatedReanimated.View>
      <AnimatedReanimated.View style={[sp.streak, streak2Style]} pointerEvents="none">
        <LinearGradient colors={['rgba(98,76,255,0)', 'rgba(98,76,255,0.9)', 'rgba(120,109,255,0)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </AnimatedReanimated.View>
      <AnimatedReanimated.View style={[sp.streak, streak3Style]} pointerEvents="none">
        <LinearGradient colors={['rgba(201,194,255,0)', 'rgba(245,243,255,0.86)', 'rgba(120,109,255,0)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </AnimatedReanimated.View>

      {/* Phase 7 — impact flash */}
      <AnimatedReanimated.View style={[sp.flash, flashStyle]} pointerEvents="none" />

      {/* Phase 6.5 — glitch burst bars */}
      <AnimatedReanimated.View style={[sp.burstBar, burstStyle]} pointerEvents="none" />
      <AnimatedReanimated.View style={[sp.burstBand, sp.burstBandA, burstTop1]} pointerEvents="none" />
      <AnimatedReanimated.View style={[sp.burstBand, sp.burstBandB, burstTop2]} pointerEvents="none" />
      <AnimatedReanimated.View style={[sp.burstBand, sp.burstBandC, burstTop3]} pointerEvents="none" />

      {/* Main hero lockup */}
      <View style={sp.content}>
        <AnimatedReanimated.View style={[sp.logoWrap, logoStyle]}>
          <AnimatedReanimated.View style={[sp.glowOrb, glowStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(120,109,255,0.03)', 'rgba(201,194,255,0.18)', 'rgba(98,76,255,0.04)']}
              locations={[0, 0.52, 1]}
              style={StyleSheet.absoluteFill}
            />
          </AnimatedReanimated.View>

            <AnimatedReanimated.View style={[sp.orbitRing, ringStyle]} pointerEvents="none">
              <Svg width={LOGO_SIZE + 78} height={LOGO_SIZE + 78} viewBox={`0 0 ${LOGO_SIZE + 78} ${LOGO_SIZE + 78}`}>
                <Circle
                  cx={(LOGO_SIZE + 78) / 2}
                  cy={(LOGO_SIZE + 78) / 2}
                  r={LOGO_SIZE / 2 + 22}
                  fill="none"
                  stroke="rgba(201,194,255,0.20)"
                  strokeWidth={2}
                  strokeDasharray="16 8"
                />
                <Circle
                  cx={(LOGO_SIZE + 78) / 2}
                  cy={(LOGO_SIZE + 78) / 2}
                  r={LOGO_SIZE / 2 + 10}
                  fill="none"
                  stroke="rgba(120,109,255,0.16)"
                  strokeWidth={1.5}
                  strokeDasharray="6 12"
                />
              </Svg>
            </AnimatedReanimated.View>

            <AnimatedReanimated.View style={[sp.orbitDot, ringDotStyle]} pointerEvents="none" />
            <AnimatedReanimated.View style={[sp.orbitDotInner, ringDotInnerStyle]} pointerEvents="none" />

          <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}>
            <Defs>
              <SvgLinearGradient id="eyeGrad" x1="22" y1="34" x2="156" y2="148" gradientUnits="userSpaceOnUse">
                <Stop offset="0%" stopColor="#5148ff" stopOpacity="0.62" />
                <Stop offset="55%" stopColor={SP_EM} stopOpacity="0.98" />
                <Stop offset="100%" stopColor={SP_NEON} stopOpacity="0.95" />
              </SvgLinearGradient>
              <SvgLinearGradient id="scanGrad" x1="22" y1="0" x2="154" y2="0" gradientUnits="userSpaceOnUse">
                <Stop offset="0%" stopColor="rgba(201,194,255,0)" />
                <Stop offset="48%" stopColor="rgba(201,194,255,0.96)" />
                <Stop offset="100%" stopColor="rgba(120,109,255,0)" />
              </SvgLinearGradient>
            </Defs>

            <AnimatedPath
              d={EYE_PATH}
              fill="rgba(10, 10, 24, 0.92)"
              stroke="url(#eyeGrad)"
              strokeWidth={2.4}
              strokeLinejoin="miter"
              strokeLinecap="square"
              strokeDasharray={620}
              animatedProps={frameAnimatedProps}
            />
            <AnimatedPath
              d={INNER_EYE_PATH}
              fill="none"
              stroke={SP_NEON}
              strokeOpacity={0.42}
              strokeWidth={1.4}
              strokeLinejoin="miter"
              strokeLinecap="square"
              strokeDasharray={420}
              animatedProps={innerFrameAnimatedProps}
            />

            <G>
              <Path
                d={Z_PATH}
                fill="none"
                stroke={SP_CY}
                strokeOpacity={0.24}
                strokeWidth={15}
                strokeLinejoin="miter"
                strokeLinecap="square"
                transform="translate(-5,1)"
              />
              <Path
                d={Z_PATH}
                fill="none"
                stroke={SP_EM}
                strokeOpacity={0.96}
                strokeWidth={15}
                strokeLinejoin="miter"
                strokeLinecap="square"
              />
              <Path
                d={Z_PATH}
                fill="none"
                stroke="#f3f2ff"
                strokeOpacity={0.94}
                strokeWidth={2.25}
                strokeLinejoin="miter"
                strokeLinecap="square"
                transform="translate(2,-2)"
              />
            </G>

            <Circle cx={88} cy={88} r={7} fill={SP_NEON} opacity={0.92} />
            <Circle cx={88} cy={88} r={14} fill="rgba(201,194,255,0.18)" opacity={0.92} />
            <Rect x={26} y={84} width={126} height={8} rx={4} fill="url(#scanGrad)" opacity={0.55} />
          </Svg>

          {stageSparks.map((spark, index) => (
            <View
              key={index}
              style={[
                sp.spark,
                {
                  left: spark.left,
                  top: spark.top,
                  width: spark.size,
                  height: spark.size,
                  borderRadius: spark.size / 2,
                },
              ]}
            />
          ))}

          {/* Phase 6 — scanline sweep */}
          <AnimatedReanimated.View style={[sp.scanBeam, scanStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(98,243,255,0)', 'rgba(98,243,255,0.96)', 'rgba(98,243,255,0)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </AnimatedReanimated.View>

          {/* Phase 5 — bright center pulse */}
          <AnimatedReanimated.View style={[sp.core, { opacity: interpolate(coreReveal.value, [0, 0.18, 1], [0, 0.8, 1]), transform: [{ scale: interpolate(corePulse.value, [0, 1], [0.92, 1.18]) }] }]} pointerEvents="none" />
        </AnimatedReanimated.View>

        {/* Phase 8 — staggered text reveal */}
        <AnimatedReanimated.Text style={[sp.zemoo, textOneStyle]} allowFontScaling={false}>ZEMOO</AnimatedReanimated.Text>
        <AnimatedReanimated.Text style={[sp.aiEyes, textTwoStyle]} allowFontScaling={false}>AIEyes</AnimatedReanimated.Text>
        <AnimatedReanimated.View style={[sp.arBlock, textThreeStyle]}>
          <Text style={sp.arText} allowFontScaling={false}>عيون الذكاء</Text>
          <View style={sp.divider} />
        </AnimatedReanimated.View>
      </View>
    </AnimatedReanimated.View>
  );
}

const sp = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SP_BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: { alignItems: 'center', justifyContent: 'center' },

  backGlow: {
    position: 'absolute',
    width: Math.max(SW * 1.08, 520),
    height: Math.max(SH * 0.72, 360),
    left: SW * -0.04,
    top: SH * 0.08,
    opacity: 0.86,
    transform: [{ rotate: '-7deg' }],
  },

  slash: {
    position: 'absolute',
    width: SW * 1.45,
    height: 4,
    left: SW * -0.22,
    top: SH * 0.47,
    borderRadius: 999,
    overflow: 'hidden',
  },

  streak: {
    position: 'absolute',
    left: SW * -0.26,
    width: SW * 1.54,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },

  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,243,255,0.88)',
  },

  skiaWrap: {
    ...StyleSheet.absoluteFillObject,
    left: -SW * 0.12,
    right: -SW * 0.12,
    top: -SH * 0.06,
    bottom: -SH * 0.08,
  },

  lottie: {
    width: '100%',
    height: '100%',
  },

  burstBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 6, 17, 0.32)',
  },

  burstBand: {
    position: 'absolute',
    left: SW * -0.3,
    width: SW * 1.7,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },

  burstBandA: { backgroundColor: 'rgba(120,109,255,0.96)' },
  burstBandB: { backgroundColor: 'rgba(98,76,255,0.90)' },
  burstBandC: { backgroundColor: 'rgba(201,194,255,0.88)' },

  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  glowOrb: {
    position: 'absolute',
    width: LOGO_SIZE + 118,
    height: LOGO_SIZE + 118,
    left: -59,
    top: -59,
    borderRadius: (LOGO_SIZE + 118) / 2,
    overflow: 'hidden',
  },

  orbitRing: {
    position: 'absolute',
    width: LOGO_SIZE + 78,
    height: LOGO_SIZE + 78,
    left: -(39),
    top: -(39),
  },

  orbitDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SP_NEON,
    shadowColor: SP_NEON,
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
    left: LOGO_SIZE / 2 + 35,
    top: LOGO_SIZE / 2 - 4,
  },

  orbitDotInner: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SP_CY,
    shadowColor: SP_CY,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
    left: LOGO_SIZE / 2 + 12,
    top: LOGO_SIZE / 2 - 2,
  },

  spark: {
    position: 'absolute',
    backgroundColor: SP_NEON,
    shadowColor: SP_NEON,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 4,
  },

  scanBeam: {
    position: 'absolute',
    width: 118,
    height: 10,
    left: 0,
    top: LOGO_SIZE / 2 - 5,
    borderRadius: 999,
    overflow: 'hidden',
  },

  core: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SP_NEON,
    shadowColor: SP_NEON,
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 5,
  },

  zemoo: {
    marginTop: 30,
    fontSize: 35,
    fontWeight: '200',
    color: '#f4f3ff',
    letterSpacing: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(120,109,255,0.22)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  aiEyes: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '500',
    color: '#c9c2ff',
    letterSpacing: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(120,109,255,0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  arBlock: { alignItems: 'center', marginTop: 3 },
  arText: {
    fontSize: 14,
    color: 'rgba(201,194,255,0.92)',
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 7,
  },
  divider: {
    width: 42,
    height: 1.5,
    backgroundColor: '#786dff',
    opacity: 0.72,
  },
});

// ─────────────────────────── App ─────────────────────────────────────────────
export default function App() {
  const [splash,    setSplash]    = useState(true);
  const [camPerm,   reqCam]       = useCameraPermissions();
  const [modeIdx,   setModeIdx]   = useState(2);
  const [facing,    setFacing]    = useState('back');
  const [listening, setListening] = useState(false);
  const [findTgt,   setFindTgt]   = useState(null);
  const [banner,    setBanner]    = useState('');
  const [scanning,  setScanning]  = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status,       setStatus]       = useState('');
  const shakeVoiceModeRef = useRef(false);
  const [overlayState, setOverlayState] = useState({
    frameWidth: 1,
    frameHeight: 1,
    detections: [],
    tone: GREEN,
  });

  const camRef        = useRef(null);
  const modeScrollRef    = useRef(null);
  const pillLayouts      = useRef([]);
  const modeContentWidth = useRef(0);
  const momentumExpected = useRef(false);
  const initialCentered  = useRef(false);
  const busy          = useRef(false);
  const isSpeaking   = useRef(false);
  const speakTimer   = useRef(null);
  const lastReadTxt  = useRef('');
  const loop         = useRef(null);
  const recRef              = useRef(null);
  const stoppingRef         = useRef(false);
  const voiceAutoStopTimer  = useRef(null);
  const sosLoop             = useRef(null);
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

  async function startListening(autoStopMs = null) {
    if (recRef.current) return;
    stoppingRef.current = false; // reset in case a prior stop left it stuck
    try {
      Speech.stop();
      // Brief pause so any in-flight TTS audio finishes before the mic opens
      await new Promise(r => setTimeout(r, 150));
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpiece: false,
      });
      const { recording } = await Audio.Recording.createAsync(SPEECH_RECORDING_OPTIONS);
      recRef.current = recording;
      setListening(true);
      console.log('[Mic] recording started');
      Vibration.vibrate(50);
      if (autoStopMs != null) {
        clearTimeout(voiceAutoStopTimer.current);
        voiceAutoStopTimer.current = setTimeout(() => stopListeningAndProcess(), autoStopMs);
      }
    } catch (e) {
      console.log('[Mic] start error:', e?.message);
      recRef.current = null;
      setListening(false);
      announce('تعذّر تفعيل الميكروفون');
    }
  }

  async function stopListeningAndProcess() {
    // Prevent double-stop: auto-stop timer and manual press can race
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    clearTimeout(voiceAutoStopTimer.current);
    voiceAutoStopTimer.current = null;
    setListening(false);

    // Atomically take ownership of the recording so no other caller can grab it
    const rec = recRef.current;
    recRef.current = null;

    try {
      if (!rec) {
        console.log('[Mic] stopListeningAndProcess: no recording in ref');
        announce('لم يُسجَّل صوت');
        return;
      }
      // Grab URI before unloading — unavailable after stopAndUnloadAsync on some platforms
      const uri = rec.getURI();
      console.log('[Mic] stopping recording, uri:', uri);
      try { await rec.stopAndUnloadAsync(); } catch (unloadErr) {
        console.log('[Mic] unload warning (non-fatal):', unloadErr?.message);
      }
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
      stoppingRef.current = false;
    }
  }

  function centerActiveMode(idx = modeIdx, animated = true) {
    const layout = pillLayouts.current[idx];
    if (!layout || !modeScrollRef.current) return;
    const targetX = layout.x + layout.width / 2 - SW / 2;
    const maxScrollX = Math.max(0, modeContentWidth.current - SW);
    const x = Math.min(Math.max(0, targetX), maxScrollX);
    modeScrollRef.current.scrollTo({ x, animated });
  }

  function handleModeScrollEnd(e) {
    const scrollX = e.nativeEvent.contentOffset.x;
    const center  = scrollX + SW / 2;
    let closest = 0, closestDist = Infinity;
    pillLayouts.current.forEach((layout, i) => {
      if (!layout) return;
      const dist = Math.abs((layout.x + layout.width / 2) - center);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    switchMode(closest);
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
    return () => {
      clearInterval(loop.current);
      clearInterval(sosLoop.current);
      clearTimeout(speakTimer.current);
      clearTimeout(voiceAutoStopTimer.current);
    };
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

  // ── center active mode in camera carousel ──
  useEffect(() => {
    const t = setTimeout(() => centerActiveMode(modeIdx), 80);
    return () => clearTimeout(t);
  }, [modeIdx]);

  // ── accelerometer: double shake (within 2 s) → open voice control ──
  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    let prev = { x: 0, y: 0, z: 0 };
    let shakeCount = 0;
    let shakeCooldown = 0; // timestamp before which further triggers are ignored

    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const delta = Math.sqrt((x - prev.x) ** 2 + (y - prev.y) ** 2 + (z - prev.z) ** 2);
      prev = { x, y, z };

      if (delta > 4.5) {
        const now = Date.now();

        // Ignore all shakes during the post-trigger cooldown period
        if (now < shakeCooldown) return;

        if (now - lastShake.current < 2000) {
          shakeCount++;
        } else {
          shakeCount = 1;
        }

        lastShake.current = now;

        if (shakeCount === 1) {
          console.log('[Shake] first shake detected');
        }

        if (shakeCount === 2) {
          console.log('[Shake] second shake → voice control mode');
          shakeCount = 0;
          shakeCooldown = now + 3000; // 3 s cooldown prevents accidental re-trigger
          Vibration.vibrate(100);
          shakeVoiceModeRef.current = true;
          startListening(3500);
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

      // Try Groq first (reliable, no quota limits), fallback to Gemini
      let text = await groqVision(
        frame.base64,
        'اقرأ جميع النصوص المرئية في الصورة. أولاً النصوص بالعربية ثم الإنجليزية. إذا لا يوجد نص قل: لا يوجد نص'
      );
      if (!text) {
        console.log('[Read] Groq failed, trying Gemini...');
        text = await geminiReadText(frame.base64);
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

      // Try Groq first (reliable, no quota limits), fallback to Gemini
      let desc = await groqVision(
        frame.base64,
        'صف المشهد بالعربية في 2 إلى 3 جمل قصيرة ومفيدة للمكفوفين. اذكر نوع المكان إن أمكن، أهم الأشياء، وأي ملاحظات مهمة للحركة أو السلامة. لا تطل كثيراً.'
      );
      if (!desc) {
        console.log('[Describe] Groq failed, trying Gemini...');
        desc = await geminiDescribeScene(frame.base64, frame.width, frame.height);
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
      const frame = await grabFrame(camRef, 1024, 0.82);
      if (epoch.current !== myEpoch) return;
      const result = await groqVision(
        frame.base64,
        'You are identifying Tunisian money. Reply with EXACTLY one value from this list and nothing else: 100 مليم, 200 مليم, 500 مليم, 1 دينار, 2 دينار, 5 دينار, 10 دينار, 20 دينار, 50 دينار. If the note is not clearly visible, reply exactly: لا يوجد نقد. Do not explain.',
        GROQ_CURRENCY_MODELS,
        50
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

      // Extract the allowed value only when it matches a full token.
      const normalizedResult = normalizeText(result);
      const clean = allowed.find((v) => {
        const token = normalizeText(v);
        return new RegExp(`(^|\\s)${token}(\\s|$)`, 'u').test(normalizedResult);
      });
      if (!clean) {
        console.log('[Currency] no valid currency detected');
        return;
      }
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
    const isShakeMode = shakeVoiceModeRef.current;
    console.log('[Voice] processing:', spoken, 'shakeMode:', isShakeMode);

    if (isNoisyTranscript(spoken)) {
      announce('لم أفهم، حاول مرة أخرى');
      shakeVoiceModeRef.current = false;
      return;
    }

    if (SOS_WORDS.some(w => spoken.includes(w) || low.includes(w))) {
      triggerSOS();
      shakeVoiceModeRef.current = false;
      return;
    }

    // Search command — MUST run before normal mode switching
    const searchPatterns = [
      /(?:ابحث|أبحث|بحث)\s+(?:عن|على)?\s*(.+)/u,
      /(?:دور|فتش)\s+(?:عن|على)?\s*(.+)/u,
      /(?:search|find|look)\s+(?:for)?\s*(.+)/i,
    ];
    for (const pattern of searchPatterns) {
      const match = spoken.match(pattern);
      if (match) {
        const target = match[1]?.trim();
        if (target && !['عن', 'على', 'for'].includes(target.toLowerCase())) {
          const findIdx = MODES.findIndex(mo => mo.id === 'find');
          switchMode(findIdx);
          setTimeout(() => {
            setFindTgt(target);
            prevKey.current = '';
            lastSpoke.current = 0;
            announce(`جاري البحث عن: ${target}`);
          }, 300);
          shakeVoiceModeRef.current = false;
          return;
        }
      }
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
        // If in shake voice mode, auto-trigger the mode action
        if (isShakeMode) {
          shakeVoiceModeRef.current = false;
          switchMode(i);
          // Delay slightly to let switchMode complete
          setTimeout(() => {
            if (i === 0) doExplore();
            else if (i === 1) doRead();
            else if (i === 2) doDescribe();
            else if (i === 3) { /* find: wait for target */ }
            else if (i === 4) doCurrency();
          }, 250);
        } else {
          switchMode(i);
        }
        return;
      }
    }

    if (mode.id === 'find') {
      setFindTgt(spoken);
      announce(`جاري البحث عن: ${spoken}`);
      shakeVoiceModeRef.current = false;
      return;
    }

    announce(spoken);
    shakeVoiceModeRef.current = false;
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

      {/* scan beam */}
      {scanning && (
        <Animated.View pointerEvents="none"
          style={[s.scanBeamWrap, { transform: [{ translateY: scanY }] }]}>
          <View style={s.scanBeamCore} />
          <View style={s.scanBeamGlow} />
        </Animated.View>
      )}

      {/* ── top bar ── */}
      <View style={s.topBar}>
        <View style={s.topLogoWrap}>
          <View style={s.topEye}>
            <View style={s.topEyePupil} />
          </View>
          <View style={s.topBrandCopy}>
            <Text style={s.topTitle}>عيون الذكاء</Text>
            <Text style={s.topSubTitle}>السلامة العائلية</Text>
          </View>
        </View>
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
        <View style={s.sheetHandle} />
        <Text style={s.hint}>{mode.hint}</Text>

        {/* iPhone-style mode dial */}
        <View style={s.cameraModeWrap}>
          <ScrollView
            ref={modeScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentContainerStyle={s.cameraModeContent}
            onContentSizeChange={(w) => {
              modeContentWidth.current = w;
              if (!initialCentered.current) {
                // Defer one tick so all child onLayout callbacks have fired first
                setTimeout(() => {
                  initialCentered.current = true;
                  centerActiveMode(2, false);
                }, 0);
              }
            }}
            onScrollBeginDrag={() => { momentumExpected.current = false; }}
            onMomentumScrollBegin={() => { momentumExpected.current = true; }}
            onScrollEndDrag={(e) => { if (!momentumExpected.current) handleModeScrollEnd(e); }}
            onMomentumScrollEnd={handleModeScrollEnd}>
            {MODES.map((m, i) => {
              const active = i === modeIdx;
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.75}
                  onPress={() => switchMode(i)}
                  onLayout={(e) => { pillLayouts.current[i] = e.nativeEvent.layout; }}
                  style={[s.cameraModeItem, active && s.cameraModeItemActive]}>
                  <Text style={[s.cameraModeText, active && s.cameraModeTextActive]}>
                    {m.ar}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* controls */}
        <View style={s.ctrl}>
          {/* flip */}
          <TouchableOpacity style={s.iconBtn}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
            <Text style={s.iconTxt}>⟳</Text>
          </TouchableOpacity>

          {/* mic */}
          <TouchableOpacity style={[s.micBtn, listening && s.micRec, isProcessing && !listening && s.micProc]} onPress={handleMic}>
            {listening
              ? <View style={s.stopSquare} />
              : isProcessing
              ? <ActivityIndicator size="small" color={C.primary} />
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
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  permTxt:    { color: C.textPri, fontSize: 20, textAlign: 'center', marginBottom: 24, paddingHorizontal: 32 },
  permBtn:    { backgroundColor: C.primary, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14 },
  permBtnTxt: { color: C.bg, fontSize: 18, fontWeight: '700' },

  // scan beam (replaces flat scan line)
  scanBeamWrap: { position: 'absolute', left: 0, right: 0, height: 18 },
  scanBeamCore: { height: 1.5, backgroundColor: C.primary, opacity: 0.88 },
  scanBeamGlow: {
    position: 'absolute', left: 0, right: 0, top: -8,
    height: 18, backgroundColor: C.primary, opacity: 0.07, borderRadius: 9,
  },

  // detection brackets
  cornerWrap: { position: 'absolute', borderWidth: 0 },
  corner:     { position: 'absolute', width: 20, height: 20 },
  cornerTL: { left: -1, top: -1, borderLeftWidth: 2, borderTopWidth: 2, borderTopLeftRadius: 6 },
  cornerTR: { right: -1, top: -1, borderRightWidth: 2, borderTopWidth: 2, borderTopRightRadius: 6 },
  cornerBL: { left: -1, bottom: -1, borderLeftWidth: 2, borderBottomWidth: 2, borderBottomLeftRadius: 6 },
  cornerBR: { right: -1, bottom: -1, borderRightWidth: 2, borderBottomWidth: 2, borderBottomRightRadius: 6 },

  detLabelWrap: {
    position: 'absolute',
    backgroundColor: 'rgba(16, 15, 38, 0.86)',
    borderWidth: 1, borderColor: 'rgba(120, 109, 255, 0.22)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  detLabelTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  // top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Platform.OS === 'android' ? 10 : 14,
    marginHorizontal: 10,
    paddingTop: Platform.OS === 'android' ? 14 : 18,
    paddingBottom: 12, paddingHorizontal: 14,
    backgroundColor: 'rgba(18, 16, 41, 0.82)',
    borderWidth: 1, borderColor: 'rgba(120, 109, 255, 0.18)',
    borderRadius: 22,
    shadowColor: C.primary, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topLogoWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  topEye: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOpacity: 0.55, shadowRadius: 6, elevation: 4,
  },
  topEyePupil: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  topBrandCopy: { marginLeft: 10, flexShrink: 1 },
  topTitle: { color: C.textPri, fontSize: 15, fontWeight: '700', letterSpacing: 1.2 },
  topSubTitle: { color: C.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 2.1, marginTop: 2 },
  liveWrap: {
    minWidth: 82,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(120, 109, 255, 0.10)',
    borderWidth: 1, borderColor: 'rgba(120, 109, 255, 0.16)',
  },
  liveDot:  {
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary, marginRight: 5,
    shadowColor: C.primary, shadowOpacity: 0.8, shadowRadius: 5, elevation: 3,
  },
  liveTxt:  { color: C.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },

  // overlays
  findBadge: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 102 : 120,
    alignSelf: 'center',
    backgroundColor: C.primaryDim,
    borderWidth: 1, borderColor: `${C.primary}66`,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  findBadgeTxt: { color: C.primary, fontSize: 14, fontWeight: '600' },

  findQuickWrap: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 138 : 154,
    left: 8, right: 8,
  },
  findQuickRow:  { paddingHorizontal: 4, gap: 8 },
  findQuickChip: {
    backgroundColor: 'rgba(18, 16, 41, 0.80)',
    borderWidth: 1, borderColor: `${C.primary}28`,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  findQuickTxt:  { color: C.textSec, fontSize: 14, fontWeight: '600' },

  descHint: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' },
  descHintTxt: {
    color: C.textSec, fontSize: 15,
    backgroundColor: 'rgba(18, 16, 41, 0.58)',
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, letterSpacing: 0.5,
  },

  // banner
  banner: {
    position: 'absolute', bottom: 174, left: 12, right: 12,
    backgroundColor: 'rgba(16, 15, 38, 0.90)',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.primary, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  bannerTxt: { color: C.textPri, fontSize: 17, textAlign: 'center', lineHeight: 28 },

  statusBox: {
    position: 'absolute', bottom: 244, left: 12, right: 12,
    backgroundColor: C.warnDim,
    borderColor: `${C.warn}88`, borderWidth: 1,
    borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12,
  },
  statusTxt: { color: C.warn, fontSize: 14, textAlign: 'center' },

  // sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.glass,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 16 : 30,
    borderTopWidth: 1, borderTopColor: C.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 194, 255, 0.20)',
    marginBottom: 8,
  },
  hint: {
    color: C.textMuted, fontSize: 11,
    textAlign: 'center', marginBottom: 8, letterSpacing: 0.7,
  },

  // pills
  pillRow:     {},
  pillContent: { paddingHorizontal: SW / 2, gap: 8, paddingBottom: 2 },
  pill: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
    backgroundColor: 'rgba(120, 109, 255, 0.08)',
    borderWidth: 1, borderColor: 'rgba(120, 109, 255, 0.16)',
  },
  pillOn: {
    backgroundColor: C.primary, borderColor: C.primary,
    shadowColor: C.primary, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4,
  },
  pillTxt:   { color: C.textSec, fontSize: 14, fontWeight: '500' },
  pillTxtOn: { color: C.bg, fontWeight: '700' },

  // camera-style mode dial
  cameraModeWrap: {
    height: 48,
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'visible',
  },
  cameraModeContent: {
    paddingHorizontal: SW / 2,
    alignItems: 'center',
    gap: 20,
  },
  cameraModeItem: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    opacity: 0.4,
  },
  cameraModeItemActive: {
    opacity: 1,
  },
  cameraModeText: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '500',
  },
  cameraModeTextActive: {
    fontSize: 17,
    color: C.textPri,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // controls
  ctrl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 40, paddingTop: 12,
  },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(120, 109, 255, 0.10)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(120, 109, 255, 0.18)',
  },
  iconTxt: { color: C.textSec, fontSize: 20 },

  micBtn: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 10,
    shadowColor: C.primary, shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 14,
  },
  micRec:  { backgroundColor: C.danger, shadowColor: C.danger },
  micProc: { backgroundColor: C.surface, shadowColor: C.primary, shadowOpacity: 0.25 },
  micTxt:  { color: C.bg, fontSize: 26 },
  stopSquare: { width: 18, height: 18, borderRadius: 3, backgroundColor: '#fff' },

  sosBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255, 48, 98, 0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: `${C.danger}55`,
  },
  sosWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  sosRing: {
    position: 'absolute',
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: C.danger,
    shadowColor: C.danger, shadowOpacity: 0.7, shadowRadius: 8,
  },
  sosTxt: { color: C.danger, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
});
