/**
 * AIEyes — screens/AuthScreen.js
 * Premium auth UI — electric purple eagle eye identity.
 * All Supabase auth logic preserved exactly.
 *
 * Screens: welcome → login / register / forgot / success
 * Requires: expo-linear-gradient, react-native-svg, react-native-reanimated
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, {
  Circle, Path, Defs, RadialGradient, LinearGradient as SvgLinear,
  Stop, Ellipse, Line, Filter, FeGaussianBlur, FeMerge, FeMergeNode, Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, withSpring, Easing as ReanimatedEasing, interpolate, FadeIn,
  FadeInUp, FadeInDown,
} from 'react-native-reanimated';
import { supabase } from '../utils/supabase';
import { ensureUserProfile } from '../utils/profile';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#060611',
  bg2:      '#0d0b22',
  bg3:      '#13113e',
  primary:  '#786dff',
  violet:   '#c9c2ff',
  cyan:     '#60c8ff',
  textPri:  '#F4F3FF',
  textSec:  'rgba(201,194,255,0.65)',
  muted:    'rgba(151,145,203,0.48)',
  border:   'rgba(120,109,255,0.22)',
  borderFocus: 'rgba(120,109,255,0.70)',
  card:     '#060611',
  inputBg:  'rgba(6,5,18,0.99)',
  danger:   '#FF3062',
  success:  '#22d9a0',
};

// ─── SVG paths ────────────────────────────────────────────────────────────────
// Outer angular eagle-eye shell (octagonal)
const PATH_EYE  = 'M 88 38 L 116 54 L 132 80 L 132 96 L 116 122 L 88 138 L 60 122 L 44 96 L 44 80 L 60 54 Z';
// Inner eye ring
const PATH_EYIN = 'M 88 50 L 110 63 L 122 80 L 122 96 L 110 113 L 88 126 L 66 113 L 54 96 L 54 80 L 66 63 Z';
// Zemoo Z mark
const PATH_Z    = 'M 76 78 H 102 L 76 88 H 102 L 76 98';
// Lightning left
const PATH_LT_L = 'M 44 88 L 30 76 L 35 88 L 20 82';
// Lightning right
const PATH_LT_R = 'M 132 88 L 146 100 L 141 88 L 156 94';
// Lightning top
const PATH_LT_T = 'M 88 38 L 83 22 L 88 30 L 94 14';

// ─── Error mapper (unchanged) ─────────────────────────────────────────────────
function mapError(msg = '') {
  if (/invalid.login.credentials|invalid_credentials/i.test(msg))
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (/already.registered/i.test(msg))
    return 'هذا البريد مسجل مسبقاً، جرّب تسجيل الدخول.';
  if (/email.not.confirmed/i.test(msg))
    return 'يرجى تأكيد بريدك الإلكتروني أولاً من رسالة التفعيل.';
  if (/over_email_send_rate_limit|rate.limit|too.many.request/i.test(msg))
    return 'تم تجاوز حد إرسال الرسائل. انتظر قليلاً ثم حاول مجدداً.';
  if (/weak.password|password.should.be/i.test(msg))
    return 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.';
  return 'حدث خطأ، حاول مرة أخرى';
}

// ══════════════════════════════════════════════════════════════════════════════
// Eagle Eye Orb — premium SVG hero mark
// ══════════════════════════════════════════════════════════════════════════════
function EagleEyeOrb({ size = 130 }) {
  // Pulse animation
  const pulse = useSharedValue(1);
  const lightningOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2200, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
        withTiming(1.00, { duration: 2200, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
      ),
      -1, false
    );
    lightningOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 900, easing: ReanimatedEasing.out(ReanimatedEasing.quad) }),
        withTiming(0.3, { duration: 1400, easing: ReanimatedEasing.in(ReanimatedEasing.quad) }),
      ),
      -1, false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, pulseStyle, st.orbShadow]}>
      <Svg width={size} height={size} viewBox="0 0 176 176">
        <Defs>
          <RadialGradient id="aura" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"  stopColor="#c9c2ff" stopOpacity="0.22" />
            <Stop offset="55%" stopColor="#786dff" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#786dff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="core" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"  stopColor="#f0eeff" stopOpacity="1" />
            <Stop offset="50%" stopColor="#786dff" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#3a30b0" stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="iris" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"  stopColor="#786dff" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#1e1a60" stopOpacity="0.9" />
          </RadialGradient>
          <SvgLinear id="wingL" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"  stopColor="#786dff" stopOpacity="0.50" />
            <Stop offset="100%" stopColor="#786dff" stopOpacity="0" />
          </SvgLinear>
          <SvgLinear id="wingR" x1="100%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%"  stopColor="#786dff" stopOpacity="0.50" />
            <Stop offset="100%" stopColor="#786dff" stopOpacity="0" />
          </SvgLinear>
        </Defs>

        {/* Ambient aura bloom */}
        <Circle cx={88} cy={88} r={87} fill="url(#aura)" />



        {/* Orbit rings */}
        <Circle cx={88} cy={88} r={78} fill="none"
          stroke="#786dff" strokeWidth={0.6} strokeOpacity={0.14}
          strokeDasharray="4 7" />
        <Circle cx={88} cy={88} r={65} fill="none"
          stroke="#786dff" strokeWidth={0.9} strokeOpacity={0.24} />
        <Circle cx={88} cy={88} r={52} fill="none"
          stroke="#786dff" strokeWidth={0.6} strokeOpacity={0.15} />

        {/* Eye shell */}
        <Path d={PATH_EYE}
          fill="rgba(4,3,14,0.90)"
          stroke="#786dff" strokeWidth={1.8} strokeOpacity={0.82} />
        {/* Inner eye ring */}
        <Path d={PATH_EYIN}
          fill="none"
          stroke="rgba(201,194,255,0.16)" strokeWidth={1.0} />

        {/* Iris */}
        <Circle cx={88} cy={88} r={22} fill="url(#iris)" />
        <Circle cx={88} cy={88} r={20} fill="none"
          stroke="#786dff" strokeWidth={0.8} strokeOpacity={0.40} />

        {/* Pupil */}
        <Circle cx={88} cy={88} r={13} fill="url(#core)" />

        {/* Specular highlight */}
        <Ellipse cx={83} cy={83} rx={4} ry={3} fill="rgba(255,255,255,0.68)" />

        {/* Lightning arcs */}
        <Path d={PATH_LT_L} fill="none"
          stroke="#a090ff" strokeWidth={1.2} strokeOpacity={0.65}
          strokeLinecap="round" strokeLinejoin="round" />
        <Path d={PATH_LT_R} fill="none"
          stroke="#a090ff" strokeWidth={1.2} strokeOpacity={0.65}
          strokeLinecap="round" strokeLinejoin="round" />
        <Path d={PATH_LT_T} fill="none"
          stroke="#80b8ff" strokeWidth={1.0} strokeOpacity={0.55}
          strokeLinecap="round" strokeLinejoin="round" />


      </Svg>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Wave separator SVG
// ══════════════════════════════════════════════════════════════════════════════
function WaveSep() {
  return (
    <Svg
      width={SW}
      height={56}
      viewBox={`0 0 ${SW} 56`}
      preserveAspectRatio="none"
      style={{ marginTop: -2, backgroundColor: C.bg }}
    >
      <Path
        d={`M0,38 C${SW * 0.13},16 ${SW * 0.27},56 ${SW * 0.40},32
            C${SW * 0.53},8 ${SW * 0.67},50 ${SW * 0.80},28
            C${SW * 0.93},6 ${SW * 1.0},42 ${SW},32
            L${SW},0 L0,0 Z`}
        fill="rgba(120,109,255,0.25)"
      />
    </Svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Icon helpers (inline SVG via react-native-svg)
// ══════════════════════════════════════════════════════════════════════════════
const IconMail = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.45)" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 7c0-1.7 1.3-3 3-3h14c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3V7z" />
    <Path d="m2 7 10 7 10-7" />
  </Svg>
);

const IconLock = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.45)" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <Path d="M3 11h18v11H3z" />
  </Svg>
);

const IconUser = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.45)" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={8} r={4} />
    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </Svg>
);

const IconEyeOpen = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.50)" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <Circle cx={12} cy={12} r={3} />
  </Svg>
);

const IconEyeOff = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.35)" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
    <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
    <Line x1={1} y1={1} x2={23} y2={23} />
  </Svg>
);

const IconCheck = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none"
    stroke={C.success} strokeWidth={2.2}
    strokeLinecap="round" strokeLinejoin="round">
    <Path d="m9 12 2 2 4-4" />
  </Svg>
);

const IconBack = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.60)" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round">
    <Path d="m15 18-6-6 6-6" />
  </Svg>
);

// ══════════════════════════════════════════════════════════════════════════════
// AuthInput — focused glow state
// ══════════════════════════════════════════════════════════════════════════════
function AuthInput({ icon, placeholder, value, onChangeText,
  secureTextEntry = false, showPass, onTogglePass,
  keyboardType = 'default', textAlign = 'left' }) {

  return (
    <View style={st.inputWrap}>
      <View style={st.inputIcon}>{icon}</View>
      <TextInput
        style={st.inputField}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !showPass}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={false}
        blurOnSubmit={false}
        returnKeyType={secureTextEntry ? 'done' : 'next'}
        importantForAutofill="no"
        textContentType="none"
        textAlign={textAlign}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={onTogglePass} style={st.inputEye} activeOpacity={0.7}>
          {showPass ? <IconEyeOpen /> : <IconEyeOff />}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PrimaryBtn — gradient with spring press
// ══════════════════════════════════════════════════════════════════════════════
function PrimaryBtn({ label, onPress, loading = false, disabled = false }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[st.btnOuter, pressStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1.0,  { damping: 12, stiffness: 260 }); }}
        onPress={onPress}
        disabled={disabled || loading}
        style={{ borderRadius: 18, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={['#9c8dff', '#786dff', '#5f55d5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={st.btn}
        >
          {loading
            ? <ActivityIndicator color="rgba(255,255,255,0.88)" size="small" />
            : <Text style={st.btnTxt}>{label}</Text>
          }
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GhostBtn
// ══════════════════════════════════════════════════════════════════════════════
function GhostBtn({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={st.ghostBtn}>
      <Text style={st.ghostBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OrDivider
// ══════════════════════════════════════════════════════════════════════════════
function OrDivider() {
  return (
    <View style={st.dividerRow}>
      <View style={st.dividerLine} />
      <Text style={st.dividerTxt}>or</Text>
      <View style={st.dividerLine} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// StatusMsg
// ══════════════════════════════════════════════════════════════════════════════
function StatusMsg({ type, text }) {
  if (!text) return null;
  const isErr = type === 'error';
  return (
    <View style={isErr ? st.msgError : st.msgInfo}>
      <Text style={isErr ? st.msgErrorTxt : st.msgInfoTxt}>{text}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PasswordStrengthBar
// ══════════════════════════════════════════════════════════════════════════════
function PasswordStrengthBar({ password }) {
  if (!password) return null;
  const len = password.length;
  const strength = len === 0 ? 0 : len < 6 ? 1 : len < 10 ? 2 : 3;
  const labels = ['', 'Weak', 'Good', 'Strong'];
  const colors = ['', C.danger, '#f0a500', C.success];
  return (
    <View style={st.strengthWrap}>
      <View style={st.strengthBars}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[
            st.strengthBar,
            { backgroundColor: strength >= i ? colors[strength] : 'rgba(120,109,255,0.15)' },
          ]} />
        ))}
      </View>
      <Text style={[st.strengthLabel, { color: colors[strength] }]}>
        {labels[strength]} password
      </Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HeroSection — top visual area (shared across screens)
// ══════════════════════════════════════════════════════════════════════════════
function HeroSection({ screen, onBack }) {
  const isWelcome = screen === 'welcome';
  const isSuccess = screen === 'success';
  const orbSize = isWelcome || isSuccess ? 136 : 108;

  // Float animation
  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 2600, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
        withTiming(0,  { duration: 2600, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
      ),
      -1, false
    );
  }, []);

  // Screen transition animation
  const heroOpacity = useSharedValue(1);
  const heroScale = useSharedValue(1);
  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 400, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
    heroScale.value = withTiming(1, { duration: 400, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
  }, [screen]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const heroAnimStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  return (
    <Animated.View style={[st.hero, heroAnimStyle]}>
      {/* Deep space gradient bg */}
      <LinearGradient
        colors={['#0d0b22', '#060611']}
        style={StyleSheet.absoluteFill}
      />
      {/* Purple bloom */}
      <LinearGradient
        colors={['rgba(120,109,255,0.18)', 'transparent']}
        style={st.heroBloom}
      />
      {/* Cyan accent bloom bottom-right */}
      <View style={st.heroCyanBloom} />

      {/* Back button for sub-screens */}
      {!isWelcome && !isSuccess && (
        <TouchableOpacity style={st.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IconBack />
        </TouchableOpacity>
      )}

      {/* Orb */}
      <Animated.View style={floatStyle}>
        <EagleEyeOrb size={orbSize} />
      </Animated.View>

      {/* Brand text */}
      <View style={st.brandWrap}>
        <Text style={[st.brand, isWelcome && st.brandLg]}>AIEyes</Text>
        <Text style={st.brandAr}>عيون الذكاء</Text>
      </View>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FormCard — the white-ish card below the wave
// ══════════════════════════════════════════════════════════════════════════════
function FormCard({ children, screen }) {
  const fadeScale = useSharedValue(1);
  const fadeOpacity = useSharedValue(1);
  
  useEffect(() => {
    fadeOpacity.value = withTiming(1, { duration: 400, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
    fadeScale.value = withTiming(1, { duration: 400, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
  }, [screen]);
  
  const animStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
    transform: [{ scale: fadeScale.value }],
  }));
  
  return (
    <Animated.View style={[st.formCard, animStyle]}>
      {children}
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AuthScreen — main export
// ══════════════════════════════════════════════════════════════════════════════
export default function AuthScreen({ onAuth }) {
  // Screen state: 'welcome' | 'login' | 'register' | 'forgot' | 'success'
  const [screen,   setScreen]   = useState('welcome');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');

  function clearMessages() { setError(''); setNotice(''); }
  function goTo(s) { clearMessages(); setShowPass(false); setScreen(s); }
  function goBack() {
    if (screen === 'login' || screen === 'register' || screen === 'forgot') goTo('welcome');
  }

  // ── Auth handlers (unchanged logic) ───────────────────────────────────────

  async function handleLogin() {
    clearMessages();
    if (!email.trim() || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (e) throw e;
      if (data.user) { await ensureUserProfile(data.user); onAuth(data.user); }
    } catch (e) {
      setError(mapError(e?.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    clearMessages();
    if (!email.trim() || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: e } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
      });
      if (e) throw e;
      await ensureUserProfile(data.user, name.trim());
      if (!data.session) {
        // Email confirmation required
        setScreen('success');
        return;
      }
      if (data.user) { onAuth(data.user); }
    } catch (e) {
      setError(mapError(e?.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    clearMessages();
    if (!email.trim()) {
      setError('يرجى إدخال بريدك الإلكتروني');
      return;
    }
    setLoading(true);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (e) throw e;
      setNotice('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.');
    } catch (e) {
      setError(mapError(e?.message));
    } finally {
      setLoading(false);
    }
  }

  // ── Screen content ────────────────────────────────────────────────────────

  function renderFormContent() {
    switch (screen) {

      // ── Welcome ────────────────────────────────────────────────────────
      case 'welcome':
        return (
          <FormCard screen={screen}>
            <Text style={st.byLine}>by Zemoo</Text>
            <Text style={st.heroHeading}>{'See smarter.\nMove safer.'}</Text>
            <View style={st.welcomeBtns}>
              <PrimaryBtn label="Sign In" onPress={() => goTo('login')} />
              <GhostBtn label="Create Account" onPress={() => goTo('register')} />
            </View>
          </FormCard>
        );

      // ── Login ──────────────────────────────────────────────────────────
      case 'login':
        return (
          <FormCard screen={screen}>
            <Text style={st.cardTitle}>Welcome Back</Text>
            <Text style={st.cardSub}>Sign in to continue protecting your world.</Text>

            <AuthInput
              icon={<IconMail />}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <AuthInput
              icon={<IconLock />}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPass={showPass}
              onTogglePass={() => setShowPass(v => !v)}
            />

            <TouchableOpacity
              style={st.forgotRow}
              onPress={() => goTo('forgot')}
              activeOpacity={0.7}
            >
              <Text style={st.forgotTxt}>Forgot password?</Text>
            </TouchableOpacity>

            <StatusMsg type="error" text={error} />
            <StatusMsg type="info"  text={notice} />

            <PrimaryBtn label="Sign In" onPress={handleLogin} loading={loading} />
            <OrDivider />
            <GhostBtn label="Create Account" onPress={() => goTo('register')} />
            
            <Text style={st.termsNote}>
              By continuing you agree to our{' '}
              <Text style={st.termsLink}>Terms of Service</Text>
              {' & '}
              <Text style={st.termsLink}>Privacy Policy</Text>
            </Text>
          </FormCard>
        );

      // ── Register ───────────────────────────────────────────────────────
      case 'register':
        return (
          <FormCard screen={screen}>
            <Text style={st.cardTitle}>Create Account</Text>
            <Text style={st.cardSub}>Set up your AIEyes safety profile.</Text>

            <AuthInput
              icon={<IconUser />}
              placeholder="Display name"
              value={name}
              onChangeText={setName}
            />
            <AuthInput
              icon={<IconMail />}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <AuthInput
              icon={<IconLock />}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPass={showPass}
              onTogglePass={() => setShowPass(v => !v)}
            />
            <PasswordStrengthBar password={password} />

            <StatusMsg type="error" text={error} />
            <StatusMsg type="info"  text={notice} />

            <PrimaryBtn label="Create Account" onPress={handleRegister} loading={loading} />
            <OrDivider />
            <GhostBtn label="Sign In" onPress={() => goTo('login')} />

            <Text style={st.regNote}>
              قد تحتاج إلى تأكيد بريدك الإلكتروني قبل الدخول.
            </Text>
            
            <Text style={st.termsNote}>
              By continuing you agree to our{' '}
              <Text style={st.termsLink}>Terms of Service</Text>
              {' & '}
              <Text style={st.termsLink}>Privacy Policy</Text>
            </Text>
          </FormCard>
        );

      // ── Forgot Password ────────────────────────────────────────────────
      case 'forgot':
        return (
          <FormCard screen={screen}>
            <Text style={st.cardTitle}>Reset Password</Text>
            <Text style={st.cardSub}>Enter your email and we'll send a reset link.</Text>

            <AuthInput
              icon={<IconMail />}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />

            <StatusMsg type="error"   text={error} />
            <StatusMsg type="info"    text={notice} />

            {!notice && (
              <PrimaryBtn label="Send Reset Link" onPress={handleForgot} loading={loading} />
            )}

            <TouchableOpacity
              style={st.backRow}
              onPress={() => goTo('login')}
              activeOpacity={0.75}
            >
              <Text style={st.backTxt}>← Back to Sign In</Text>
            </TouchableOpacity>
          </FormCard>
        );

      // ── Email Confirmed / Success ───────────────────────────────────────
      case 'success':
        return (
          <FormCard screen={screen}>
            <Animated.View entering={FadeInUp.duration(500).springify()} style={st.successWrap}>
              <View style={st.successRing}>
                <IconCheck />
              </View>
              <Text style={st.successTitle}>Email Confirmed!</Text>
              <Text style={st.successSub}>
                {'Your account is ready.\nGuided by intelligent vision.'}
              </Text>
              <View style={st.successDivider} />
              <View style={st.chipRow}>
                {['Object Detection', 'Scene Description', 'SOS Alerts', 'Family Dashboard'].map(f => (
                  <View key={f} style={st.chip}>
                    <Text style={st.chipTxt}>{f}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
            <PrimaryBtn label="Sign In to AIEyes" onPress={() => goTo('login')} />
          </FormCard>
        );

      default: return null;
    }
  }

  // ── Root render ────────────────────────────────────────────────────────────
  return (
    <View style={st.root}>
      <StatusBar hidden />

      {/* Deep space base gradient */}
      <LinearGradient
        colors={['#060611', '#0d0b22', '#13113e', '#0a0918', '#060611']}
        locations={[0, 0.20, 0.50, 0.80, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={st.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero top section */}
          <HeroSection screen={screen} onBack={goBack} />

          {/* Form content */}
          {renderFormContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({

  // ── Root & layout ─────────────────────────────────────────────────────────
  root:  { flex: 1, backgroundColor: C.bg },
  kav:   { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40, backgroundColor: C.bg },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    paddingTop: 56,
    paddingBottom: 0,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBloom: {
    position: 'absolute',
    top: -100, left: -80, right: -80,
    height: 340,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
  },
  heroCyanBloom: {
    position: 'absolute',
    bottom: 20, right: -40,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(96,200,255,0.055)',
  },
  backBtn: {
    position: 'absolute',
    top: 52, left: 18,
    width: 38, height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(120,109,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  orbShadow: {
    shadowColor: '#786dff',
    shadowOpacity: 0.55,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  brandWrap: { alignItems: 'center', marginTop: 14, marginBottom: 24 },
  brand: {
    color: C.textPri,
    fontSize: 26, fontWeight: '200',
    letterSpacing: 12, textAlign: 'center',
    textShadowColor: 'rgba(120,109,255,0.55)',
    textShadowRadius: 24,
  },
  brandLg: { fontSize: 34, letterSpacing: 14 },
  brandAr: {
    color: C.textSec,
    fontSize: 12, fontWeight: '500',
    textAlign: 'center', marginTop: 5,
    letterSpacing: 1,
  },
  heroTagline: {
    color: 'rgba(201,194,255,0.42)',
    fontSize: 12, textAlign: 'center',
    marginTop: 10, letterSpacing: 0.5,
    fontWeight: '400',
  },

  // ── Form card ─────────────────────────────────────────────────────────────
  formCard: {
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingTop: 128,
    paddingBottom: 32,
  },

  // ── Welcome screen ────────────────────────────────────────────────────────
  byLine: {
    color: 'rgba(201,194,255,0.32)',
    fontSize: 10, fontWeight: '500',
    letterSpacing: 3, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 32,
  },
  heroHeading: {
    color: C.textPri,
    fontSize: 34, fontWeight: '700',
    lineHeight: 37, marginBottom: 8,
    transform: [{ translateY: 30 }],
  },
  heroSub: {
    color: C.textSec,
    fontSize: 13, lineHeight: 20,
    marginBottom: 28,
  },
  welcomeBtns: { gap: 12, marginTop: 72 },
  termsNote: {
    color: 'rgba(201,194,255,0.28)',
    fontSize: 11, textAlign: 'center',
    marginTop: 20, lineHeight: 17,
  },
  termsLink: { color: 'rgba(120,109,255,0.70)' },

  // ── Card headings ─────────────────────────────────────────────────────────
  cardTitle: {
    color: C.textPri,
    fontSize: 24, fontWeight: '700',
    marginBottom: 5, marginTop: 4,
  },
  cardSub: {
    color: C.textSec,
    fontSize: 13, lineHeight: 20,
    marginBottom: 22,
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 12,
  },
  inputWrapFocused: {
    borderColor: C.borderFocus,
    shadowColor: C.primary,
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  inputIcon: { marginRight: 10 },
  inputField: {
    flex: 1,
    color: C.textPri,
    fontSize: 15,
    fontWeight: '400',
  },
  inputEye: { padding: 6 },

  // ── Password strength ─────────────────────────────────────────────────────
  strengthWrap: { marginBottom: 12, marginTop: -4 },
  strengthBars: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '500' },

  // ── Forgot / back row ─────────────────────────────────────────────────────
  forgotRow: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginBottom: 14,
    marginTop: -4,
  },
  forgotTxt: { color: C.primary, fontSize: 13, fontWeight: '500' },
  backRow:   { alignItems: 'center', marginTop: 22 },
  backTxt:   { color: C.primary, fontSize: 14, fontWeight: '500' },

  // ── Messages ──────────────────────────────────────────────────────────────
  msgError: {
    backgroundColor: 'rgba(255,48,98,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,48,98,0.28)',
    borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 12,
  },
  msgErrorTxt: {
    color: C.danger, fontSize: 13,
    textAlign: 'center', lineHeight: 20,
  },
  msgInfo: {
    backgroundColor: 'rgba(120,109,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.35)',
    borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 12,
  },
  msgInfoTxt: {
    color: C.violet, fontSize: 13,
    textAlign: 'center', lineHeight: 20,
  },

  // ── Primary button ────────────────────────────────────────────────────────
  btnOuter: {
    marginTop: 4,
    borderRadius: 18,
    shadowColor: C.primary,
    shadowOpacity: 0.50, shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  btn: {
    height: 54,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 18,
  },
  btnTxt: {
    color: '#fff', fontSize: 16,
    fontWeight: '700', letterSpacing: 0.5,
  },

  // ── Ghost button ──────────────────────────────────────────────────────────
  ghostBtn: {
    height: 50, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
  },
  ghostBtnTxt: {
    color: 'rgba(201,194,255,0.70)',
    fontSize: 15, fontWeight: '500',
  },

  // ── Or divider ────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 18, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(120,109,255,0.16)' },
  dividerTxt:  { color: 'rgba(201,194,255,0.30)', fontSize: 12 },

  // ── Footer text ───────────────────────────────────────────────────────────
  regNote: {
    color: C.muted, fontSize: 11,
    textAlign: 'center', marginTop: 14, lineHeight: 17,
  },

  // ── Success state ─────────────────────────────────────────────────────────
  successWrap: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  successRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(34,217,160,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(34,217,160,0.32)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.success, shadowOpacity: 0.25,
    shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  successTitle: {
    color: C.success, fontSize: 22, fontWeight: '700',
  },
  successSub: {
    color: C.textSec, fontSize: 13,
    textAlign: 'center', lineHeight: 20,
  },
  successDivider: {
    width: '70%', height: 1,
    backgroundColor: 'rgba(120,109,255,0.18)',
    marginVertical: 4,
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(120,109,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.28)',
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12,
  },
  chipTxt: {
    color: 'rgba(201,194,255,0.55)',
    fontSize: 11, fontWeight: '400',
  },
});
