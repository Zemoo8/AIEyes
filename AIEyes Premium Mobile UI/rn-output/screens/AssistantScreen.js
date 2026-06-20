/**
 * AIEyes — screens/AssistantScreen.js
 *
 * New AI Assistant mode. Mount this when `mode === 'assistant'`.
 * Bring-up: shake-to-listen → keyword "AI" / "assistant" → setMode('assistant').
 *
 * Stack used (all already in package.json):
 *   react-native-svg, react-native-reanimated, expo-speech,
 *   expo-linear-gradient. No new packages required.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import Svg, {
  Circle, Path, Defs, RadialGradient, LinearGradient as SvgLinear,
  Stop, Ellipse,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, withRepeat,
  withTiming, withSequence, Easing, interpolate, FadeIn, FadeOut,
} from 'react-native-reanimated';

// ─── Tokens (extends your C{} with cooler hues for the assistant) ─────────────
const C = {
  bg:        '#02030c',
  bg2:       '#050818',
  bg3:       '#082244',
  primary:   '#786dff',
  blue:      '#2b6fff',
  cyan:      '#7ec9ff',
  ice:       '#aedcff',
  textPri:   '#F0F7FF',
  textSec:   'rgba(220,234,255,0.65)',
  textMuted: 'rgba(170,200,255,0.45)',
  border:    'rgba(140,200,255,0.18)',
  inputBg:   'rgba(12,20,48,0.55)',
};

// ══════════════════════════════════════════════════════════════════════════════
// AnimatedAssistantOrb — translucent sphere with light bands.
// state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
// ══════════════════════════════════════════════════════════════════════════════
export function AnimatedAssistantOrb({ size = 200, state = 'idle' }) {
  const spin   = useSharedValue(0);
  const float  = useSharedValue(0);
  const pulse  = useSharedValue(1);
  const ring   = useSharedValue(0);

  // base spin/float
  useEffect(() => {
    spin.value  = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false);
    float.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming( 0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ), -1, false);
  }, []);

  // state-driven amplification
  useEffect(() => {
    const target = state === 'thinking' ? 1.18 : state === 'listening' ? 1.10 : state === 'speaking' ? 1.06 : 1;
    pulse.value = withRepeat(
      withSequence(
        withTiming(target, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,      { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ), -1, false);
    if (state === 'listening' || state === 'speaking') {
      ring.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false);
    } else {
      ring.value = withTiming(0, { duration: 240 });
    }
  }, [state]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: float.value },
      { scale: pulse.value },
      { rotate: `${spin.value * 360}deg` },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 1], [0.7, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 1.55]) }],
  }));

  const haloColor = state === 'error' ? 'rgba(255,80,108,0.45)'
                  : state === 'thinking' ? 'rgba(140,180,255,0.55)'
                  : 'rgba(120,180,255,0.45)';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* halo */}
      <View style={[StyleSheet.absoluteFill, {
        borderRadius: size,
        shadowColor: '#3a8bff',
        shadowOpacity: 0.7,
        shadowRadius: size * 0.35,
        shadowOffset: { width: 0, height: 0 },
      }]} />
      {/* expanding ring for listening / speaking */}
      {(state === 'listening' || state === 'speaking') && (
        <Animated.View style={[{
          position: 'absolute',
          width: size, height: size, borderRadius: size,
          borderWidth: 1,
          borderColor: haloColor,
        }, ringStyle]}/>
      )}
      <Animated.View style={orbStyle}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="base" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#0a0e1f"/>
              <Stop offset="55%"  stopColor="#04060f"/>
              <Stop offset="100%" stopColor="#01020a"/>
            </RadialGradient>
            <RadialGradient id="shadow" cx="50%" cy="58%" r="48%">
              <Stop offset="65%"  stopColor="rgba(0,0,0,0)"/>
              <Stop offset="100%" stopColor="rgba(0,0,0,0.9)"/>
            </RadialGradient>
            <RadialGradient id="rim" cx="50%" cy="50%" r="50%">
              <Stop offset="85%" stopColor="rgba(0,0,0,0)"/>
              <Stop offset="96%" stopColor="rgba(120,180,255,0.6)"/>
              <Stop offset="100%" stopColor="rgba(80,130,255,0)"/>
            </RadialGradient>
            <SvgLinear id="band-blue" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%"   stopColor="#7dd5ff" stopOpacity="0"/>
              <Stop offset="35%"  stopColor="#4aa8ff" stopOpacity="0.95"/>
              <Stop offset="65%"  stopColor="#2b6fff" stopOpacity="0.9"/>
              <Stop offset="100%" stopColor="#7a6aff" stopOpacity="0"/>
            </SvgLinear>
            <SvgLinear id="band-cyan" x1="0" y1="0" x2="1" y2="0.6">
              <Stop offset="0%"   stopColor="#9fe9ff" stopOpacity="0"/>
              <Stop offset="40%"  stopColor="#7ec9ff" stopOpacity="0.9"/>
              <Stop offset="100%" stopColor="#4a7dff" stopOpacity="0"/>
            </SvgLinear>
            <RadialGradient id="spec" cx="35%" cy="32%" r="22%">
              <Stop offset="0%"   stopColor="rgba(220,235,255,0.7)"/>
              <Stop offset="100%" stopColor="rgba(160,200,255,0)"/>
            </RadialGradient>
          </Defs>
          {/* base sphere */}
          <Circle cx={100} cy={100} r={86} fill="url(#base)"/>
          {/* light bands */}
          <Path d="M 22 92 C 60 60, 140 60, 178 95 C 165 130, 80 138, 30 110 Z"
                fill="url(#band-blue)" fillOpacity={0.85}/>
          <Path d="M 26 90 C 65 58, 145 62, 175 100 C 158 128, 76 134, 28 108 Z"
                fill="none" stroke="url(#band-blue)" strokeWidth={3} opacity={0.95}/>
          <Path d="M 36 70 C 80 50, 130 55, 168 86"
                fill="none" stroke="url(#band-cyan)" strokeWidth={2.4} opacity={0.95}/>
          <Path d="M 32 130 C 80 156, 138 152, 172 122"
                fill="none" stroke="url(#band-cyan)" strokeWidth={2} opacity={0.75}/>
          <Path d="M 50 50 C 80 78, 130 82, 168 60"
                fill="none" stroke="rgba(140,210,255,0.8)" strokeWidth={1.3} opacity={0.7}/>
          {/* shadow + rim */}
          <Circle cx={100} cy={100} r={86} fill="url(#shadow)"/>
          <Circle cx={100} cy={100} r={86} fill="url(#rim)"/>
          {/* specular */}
          <Ellipse cx={80} cy={72} rx={22} ry={14} fill="url(#spec)" transform="rotate(-22 80 72)"/>
        </Svg>
      </Animated.View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Voice waveform inside the input pill (listening state)
// ══════════════════════════════════════════════════════════════════════════════
function VoiceWave() {
  const bars = [7, 14, 9, 18, 12, 20, 11, 16, 8, 13, 6];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 }}>
      {bars.map((h, i) => <Bar key={i} h={h} delay={i * 80}/>)}
    </View>
  );
}
function Bar({ h, delay }) {
  const s = useSharedValue(0.4);
  useEffect(() => {
    s.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 550 + delay % 200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 550 + delay % 200, easing: Easing.inOut(Easing.sin) }),
      ), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return <Animated.View style={[{
    width: 2.5, height: h, borderRadius: 2,
    backgroundColor: C.ice,
  }, style]}/>;
}

// ══════════════════════════════════════════════════════════════════════════════
// AssistantInputBar — bottom glass pill
// ══════════════════════════════════════════════════════════════════════════════
function AssistantInputBar({ state, value, onChangeText, onSend, onMic }) {
  const placeholder = state === 'thinking' ? 'Thinking…'
                    : state === 'speaking' ? 'Speaking…'
                    : 'Ask anything · اسأل أيّ شيء';
  const isVoice = state === 'listening';
  return (
    <View style={st.inputWrap}>
      <View style={[st.inputPill, isVoice && st.inputPillActive]}>
        <View style={{ flex: 1 }}>
          {isVoice ? (
            <VoiceWave/>
          ) : (
            <TextInput
              style={st.input}
              placeholder={placeholder}
              placeholderTextColor="rgba(220,234,255,0.45)"
              value={value}
              onChangeText={onChangeText}
              onSubmitEditing={onSend}
              returnKeyType="send"
              blurOnSubmit={false}
              autoCorrect={false}
            />
          )}
        </View>
        <TouchableOpacity onPress={onMic} activeOpacity={0.85} style={[st.micBtn, isVoice && st.micBtnActive]}>
          <Svg width={20} height={13} viewBox="0 0 22 14" fill="none" stroke={isVoice ? '#0a0816' : '#0a0816'} strokeWidth={2} strokeLinecap="round">
            <Path d="M2 7L2 7"/><Path d="M5 5L5 9"/><Path d="M8 2L8 12"/>
            <Path d="M11 4L11 10"/><Path d="M14 1L14 13"/><Path d="M17 5L17 9"/>
            <Path d="M20 7L20 7"/>
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AssistantScreen — main export
// ══════════════════════════════════════════════════════════════════════════════
export default function AssistantScreen({ onBack, onSendQuery, lastAnswer }) {
  // state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'answer'
  const [state, setState]   = useState('idle');
  const [input, setInput]   = useState('');
  const [query, setQuery]   = useState('');
  const [answer, setAnswer] = useState('');

  // backdrop fade-in on mount (transition)
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // map external lastAnswer into our state if parent pipes it in
  useEffect(() => {
    if (lastAnswer && lastAnswer.text) {
      setQuery(lastAnswer.query || '');
      setAnswer(lastAnswer.text);
      setState('speaking');
      Speech.speak(lastAnswer.text, { language: 'ar-TN', rate: 0.95, onDone: () => setState('answer') });
    }
  }, [lastAnswer]);

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t) return;
    setQuery(t); setInput(''); setAnswer(''); setState('thinking');
    try {
      const reply = await onSendQuery?.(t);
      setAnswer(reply || 'لم أستطع الإجابة الآن.');
      setState('speaking');
      Speech.speak(reply || 'لم أستطع الإجابة الآن.', {
        language: 'ar-TN', rate: 0.95, onDone: () => setState('answer'),
      });
    } catch (e) {
      setAnswer('حدث خطأ، حاول مرة أخرى.');
      setState('answer');
    }
  }

  function toggleMic() {
    if (state === 'listening') {
      setState('idle');
    } else {
      setState('listening');
      // hook: your parent already has voice recording wired — call it here.
      // when speech finishes & you have a transcript, call: send(transcript)
    }
  }

  return (
    <Animated.View style={[st.root, fadeStyle]}>
      <StatusBar hidden/>
      {/* deep gradient backdrop */}
      <LinearGradient
        colors={[C.bg, C.bg2, C.bg3]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* bottom blue glow */}
      <View style={st.glow}/>

      {/* top bar */}
      <View style={st.topBar}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={st.iconBtn}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#e8efff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18L9 12L15 6"/>
          </Svg>
        </TouchableOpacity>
        <Text style={st.topTitle}>ASSISTANT</Text>
        <View style={{ width: 36 }}/>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* ─── idle / listening / thinking — orb is hero ────────── */}
        {state !== 'answer' && (
          <View style={st.heroBlock}>
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <AnimatedAssistantOrb size={210} state={state}/>
            </View>
            <View style={{ marginTop: 36, paddingHorizontal: 28, alignItems: 'flex-start', alignSelf: 'stretch' }}>
              {state === 'idle' && (
                <>
                  <Text style={st.eyebrowAr}>أهلاً</Text>
                  <Text style={st.heroTitleAr}>{'كيف يمكنني\nأن أُساعدك؟'}</Text>
                  <Text style={st.heroSubtitle}>How can I help you today?</Text>
                </>
              )}
              {state === 'listening' && (
                <>
                  <Text style={st.eyebrow}>LISTENING · أستمع</Text>
                  <Text style={st.heroQuote}>{`"${input || query || '…'}"`}</Text>
                </>
              )}
              {state === 'thinking' && (
                <>
                  <Text style={st.eyebrow}>THINKING · أفكّر</Text>
                  <Text style={st.heroQuoteSm}>{query}</Text>
                </>
              )}
              {state === 'speaking' && !!answer && (
                <>
                  <Text style={st.eyebrow}>SPEAKING · يتحدّث</Text>
                  <Text style={st.heroQuoteSm}>{query}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* ─── answer view — editorial copy, no chips ─────────────── */}
        {state === 'answer' && (
          <ScrollView contentContainerStyle={st.answerScroll} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <AnimatedAssistantOrb size={56} state="idle"/>
              <Text style={st.smallTag}>AIEYES</Text>
            </View>
            <Text style={st.eyebrow}>YOU · أنت</Text>
            <Text style={st.qText}>{query}</Text>
            <Text style={[st.eyebrow, { marginTop: 22, color: C.ice }]}>AIEYES</Text>
            <Text style={st.aText}>{answer}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={st.replayBtn}
              onPress={() => {
                setState('speaking');
                Speech.speak(answer, { language: 'ar-TN', rate: 0.95, onDone: () => setState('answer') });
              }}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.ice} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M1 12a11 11 0 0119-7.5"/><Path d="M20 4.5v5h-5"/>
              </Svg>
              <Text style={st.replayTxt}>Replay · إعادة الاستماع</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        <AssistantInputBar
          state={state}
          value={input}
          onChangeText={setInput}
          onSend={() => send()}
          onMic={toggleMic}
        />
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  glow: {
    position: 'absolute',
    left: '50%', bottom: -120, marginLeft: -260,
    width: 520, height: 340, borderRadius: 260,
    backgroundColor: 'rgba(80,160,255,0.18)',
    transform: [{ scaleX: 1 }],
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 18, paddingBottom: 4,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: {
    color: 'rgba(228,234,255,0.55)',
    fontSize: 11, fontWeight: '700', letterSpacing: 2.4,
  },

  heroBlock: { flex: 1, paddingTop: 32, alignItems: 'center' },

  eyebrow: {
    color: C.ice, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.8,
  },
  eyebrowAr: {
    color: 'rgba(220,234,255,0.55)',
    fontSize: 13, fontWeight: '500',
    textAlign: 'left',
  },
  heroTitleAr: {
    color: '#f0f7ff', fontSize: 38, fontWeight: '700',
    lineHeight: 42, letterSpacing: -0.4,
    marginTop: 12, writingDirection: 'rtl',
  },
  heroSubtitle: {
    color: 'rgba(170,200,255,0.55)',
    fontSize: 13, fontWeight: '500', marginTop: 8,
  },
  heroQuote: {
    color: '#f0f7ff', fontSize: 24, fontWeight: '600',
    lineHeight: 34, writingDirection: 'rtl', marginTop: 12,
  },
  heroQuoteSm: {
    color: 'rgba(220,234,255,0.85)', fontSize: 18, fontWeight: '500',
    lineHeight: 27, writingDirection: 'rtl', marginTop: 12,
  },

  answerScroll: {
    paddingTop: 24, paddingHorizontal: 28, paddingBottom: 24,
  },
  smallTag: {
    color: 'rgba(220,234,255,0.6)',
    fontSize: 11, fontWeight: '700', letterSpacing: 2.4,
  },
  qText: {
    color: '#dceaff', fontSize: 16, fontWeight: '600', lineHeight: 24,
    marginTop: 6, writingDirection: 'rtl',
  },
  aText: {
    color: '#f0f7ff', fontSize: 15, fontWeight: '500', lineHeight: 26,
    marginTop: 6, writingDirection: 'rtl',
  },
  replayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', marginTop: 18,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(174,220,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(174,220,255,0.2)',
  },
  replayTxt: { color: C.ice, fontSize: 12, fontWeight: '600' },

  inputWrap: { paddingHorizontal: 18, paddingBottom: 24, paddingTop: 10 },
  inputPill: {
    height: 60, borderRadius: 30, paddingHorizontal: 8, paddingLeft: 22,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.inputBg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  inputPillActive: {
    borderColor: 'rgba(140,200,255,0.55)',
    backgroundColor: 'rgba(40,80,160,0.45)',
  },
  input: {
    flex: 1, color: '#f0f7ff', fontSize: 14, fontWeight: '500',
    paddingVertical: 0,
  },
  micBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244,238,255,0.95)',
  },
  micBtnActive: { backgroundColor: C.ice },
});
