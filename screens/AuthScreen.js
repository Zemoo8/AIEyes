/**
 * AIEyes — screens/AuthScreen.js  (refined)
 *
 * DROP-IN REPLACEMENT for the existing AuthScreen.
 * Public API is unchanged: `export default function AuthScreen({ onAuth })`.
 * All Supabase logic (signInWithPassword, signUp, resetPasswordForEmail,
 * ensureUserProfile, mapError) is preserved exactly.
 *
 * Design changes vs previous version (per the brief):
 *   • Welcome: removed the heavy FormCard + WaveSep that crowded the lower
 *     section. Single clean vertical structure now — orb → wordmark →
 *     tagline → CTAs. Background circle dimmed. No CTA / text overlap.
 *   • Sign In: smaller hero orb, tighter consistent field heights, biometric
 *     hint is a subtle text-link (not a heavy card), Forgot moved into the
 *     row with Remember-me.
 *   • Create Account: STEP 1 / 2 indicator, name → email → password with
 *     more vertical room, password helper inline, Terms row clearly
 *     separated from the Continue button.
 *   • Forgot / Success: cleaned typography hierarchy, same logic.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, {
  Circle, Path, Defs, RadialGradient, LinearGradient as SvgLinear,
  Stop, Ellipse, Line,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, withSpring, Easing as ReanimatedEasing, FadeInUp,
} from 'react-native-reanimated';
import { supabase } from '../utils/supabase';
import { ensureUserProfile } from '../utils/profile';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        '#090814',
  bg2:       '#0b1230',
  bg3:       '#10295c',
  primary:   '#786dff',
  primaryHi: '#b29bff',
  violet:    '#c9c2ff',
  cyan:      '#7ec9ff',
  textPri:   '#F4F3FF',
  textSec:   'rgba(220,210,255,0.72)',
  textMuted: 'rgba(180,170,220,0.5)',
  border:    'rgba(180,160,255,0.18)',
  borderHi:  'rgba(180,160,255,0.42)',
  inputBg:   'rgba(255,255,255,0.025)',
  danger:    '#FF3062',
  success:   '#22d9a0',
};

// ─── mapError (unchanged) ─────────────────────────────────────────────────────
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
// EagleEyeOrb3D — dimensional iris-style mark (replaces the older flat orb)
// ══════════════════════════════════════════════════════════════════════════════
function EagleEyeOrb3D({ size = 96 }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2400, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
        withTiming(1.00, { duration: 2400, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
      ), -1, false);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, pulseStyle, st.orbShadow]}>
      <Svg width={size} height={size} viewBox="0 0 240 240">
        <Defs>
          <RadialGradient id="iris3d" cx="50%" cy="42%" r="60%">
            <Stop offset="0%"   stopColor="#0a0816"/>
            <Stop offset="20%"  stopColor="#251a55"/>
            <Stop offset="55%"  stopColor="#5a48ce"/>
            <Stop offset="82%"  stopColor="#9c8bff"/>
            <Stop offset="100%" stopColor="#cabfff"/>
          </RadialGradient>
          <RadialGradient id="irisInner" cx="50%" cy="50%" r="50%">
            <Stop offset="60%"  stopColor="rgba(0,0,0,0)"/>
            <Stop offset="100%" stopColor="rgba(0,0,0,0.55)"/>
          </RadialGradient>
          <RadialGradient id="pupil3d" cx="50%" cy="42%" r="55%">
            <Stop offset="0%"   stopColor="#040210"/>
            <Stop offset="70%"  stopColor="#0a0620"/>
            <Stop offset="100%" stopColor="#1a0f3a"/>
          </RadialGradient>
          <RadialGradient id="corona" cx="50%" cy="50%" r="60%">
            <Stop offset="55%"  stopColor="rgba(0,0,0,0)"/>
            <Stop offset="78%"  stopColor="rgba(140,110,255,0.42)"/>
            <Stop offset="100%" stopColor="rgba(140,110,255,0)"/>
          </RadialGradient>
          <SvgLinear id="rimStroke" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="rgba(220,210,255,0.95)"/>
            <Stop offset="100%" stopColor="rgba(140,110,255,0.4)"/>
          </SvgLinear>
        </Defs>
        <Circle cx={120} cy={120} r={118} fill="url(#corona)"/>
        <Circle cx={120} cy={120} r={78} fill="url(#iris3d)"/>
        <Circle cx={120} cy={120} r={78} fill="url(#irisInner)"/>
        {/* simplified iris striations */}
        {Array.from({ length: 18 }).map((_, i) => {
          const a = (i / 18) * Math.PI * 2;
          return (
            <Line key={i}
              x1={120 + Math.cos(a) * 30} y1={120 + Math.sin(a) * 30}
              x2={120 + Math.cos(a) * 76} y2={120 + Math.sin(a) * 76}
              stroke="rgba(220,200,255,0.5)" strokeWidth={0.6} strokeLinecap="round"/>
          );
        })}
        <Circle cx={120} cy={120} r={55} fill="none" stroke="rgba(220,200,255,0.18)" strokeWidth={0.8}/>
        <Circle cx={120} cy={120} r={26} fill="url(#pupil3d)"/>
        <Circle cx={120} cy={120} r={26} fill="none" stroke="rgba(180,150,255,0.5)" strokeWidth={0.6}/>
        <Ellipse cx={113} cy={113} rx={5} ry={3.5} fill="rgba(220,210,255,0.85)"/>
        <Circle cx={125} cy={128} r={1.5} fill="rgba(220,210,255,0.6)"/>
        <Circle cx={120} cy={120} r={78} fill="none" stroke="url(#rimStroke)" strokeWidth={1.1}/>
        <Path d="M 56 70 L 86 56 L 154 56 L 184 70"
              fill="none" stroke="rgba(220,210,255,0.7)" strokeWidth={1.2}
              strokeLinecap="round" strokeLinejoin="round" opacity={0.75}/>
      </Svg>
    </Animated.View>
  );
}

// ─── Atmosphere ─── soft top aurora + sparse particles ───────────────────────
const PARTICLES = [
  { x: 0.12, y: 140, size: 3, dur: 7000 },
  { x: 0.78, y: 80,  size: 2, dur: 8500 },
  { x: 0.45, y: 200, size: 2, dur: 6500 },
  { x: 0.22, y: 320, size: 3, dur: 9000 },
  { x: 0.65, y: 260, size: 2, dur: 7800 },
  { x: 0.88, y: 380, size: 2, dur: 8200 },
  { x: 0.34, y: 440, size: 3, dur: 6800 },
];
function DriftParticle({ x, y, size, dur }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: dur, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
      -1, true);
  }, []);
  const driftStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + t.value * 0.35,
    transform: [{ translateY: t.value * -18 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: 'absolute', left: x * SW, top: y,
      width: size, height: size, borderRadius: size,
      backgroundColor: '#cabaff',
    }, driftStyle]}/>
  );
}
function AuthBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#10295c', '#0b1230', '#090814', '#02030c']}
        locations={[0, 0.28, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* top aurora */}
      <View style={st.aurora} pointerEvents="none"/>
      {/* asymmetric dimmed orb on right */}
      <View style={st.bgOrb} pointerEvents="none"/>
      {/* drifting particles */}
      {PARTICLES.map((p, i) => (
        <DriftParticle key={i} x={p.x} y={p.y} size={p.size} dur={p.dur}/>
      ))}
      {/* faint bottom horizon glow */}
      <LinearGradient
        colors={['transparent', 'rgba(80,120,255,0.05)', 'rgba(120,109,255,0.08)']}
        locations={[0, 0.5, 1]}
        style={st.bottomGlow}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── Icons (inline) ──────────────────────────────────────────────────────────
const IconMail = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.55)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 7c0-1.7 1.3-3 3-3h14c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3V7z"/>
    <Path d="m2 7 10 7 10-7"/>
  </Svg>
);
const IconLock = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.55)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 11V7a5 5 0 0 1 10 0v4"/><Path d="M3 11h18v11H3z"/>
  </Svg>
);
const IconUser = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.55)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={8} r={4}/><Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </Svg>
);
const IconEyeOpen = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.55)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><Circle cx={12} cy={12} r={3}/>
  </Svg>
);
const IconEyeOff = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(201,194,255,0.40)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <Line x1={1} y1={1} x2={23} y2={23}/>
  </Svg>
);
const IconBack = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="rgba(220,210,255,0.85)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m15 18-6-6 6-6"/>
  </Svg>
);
const IconCheck = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none"
    stroke={C.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m9 12 2 2 4-4"/>
  </Svg>
);
const IconFingerprint = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke={C.primaryHi} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 12c0-3.3 1.3-6.3 3.4-8.6"/>
    <Path d="M22 12c0-2.6-.8-5-2.1-7"/>
    <Path d="M5.5 12c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5v.5"/>
    <Path d="M9 12.5c0-1.7 1.3-3 3-3s3 1.3 3 3v1.5c0 2.5-.5 5-1.5 7.5"/>
  </Svg>
);

// ══════════════════════════════════════════════════════════════════════════════
// Field — glass input with bilingual micro-label above
// ══════════════════════════════════════════════════════════════════════════════
function Field({ label, ar, icon, value, onChangeText, placeholder,
                 secure = false, showPass, onTogglePass, keyboardType }) {
  return (
    <View style={st.fieldWrap}>
      <View style={st.fieldLabelRow}>
        <Text style={st.fieldLabel}>{label.toUpperCase()}</Text>
        {!!ar && <Text style={st.fieldLabelAr}>{ar}</Text>}
      </View>
      <View style={st.input}>
        {icon ? <View style={{ marginRight: 10 }}>{icon}</View> : null}
        <TextInput
          style={st.inputField}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !showPass}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          returnKeyType={secure ? 'done' : 'next'}
        />
        {secure ? (
          <TouchableOpacity onPress={onTogglePass} style={{ padding: 4 }} activeOpacity={0.7}>
            {showPass ? <IconEyeOpen/> : <IconEyeOff/>}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PrimaryBtn / GhostBtn — preserved API
// ══════════════════════════════════════════════════════════════════════════════
function PrimaryBtn({ label, onPress, loading = false, disabled = false }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[st.btnShadow, style]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1.0,  { damping: 12, stiffness: 260 }); }}
        onPress={onPress}
        disabled={disabled || loading}
        style={{ borderRadius: 18, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={['#9c8bff', '#7a6dff', '#5e51d6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={st.btn}
        >
          {loading
            ? <ActivityIndicator color="rgba(255,255,255,0.92)" size="small"/>
            : <Text style={st.btnTxt}>{label}</Text>}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
function GhostBtn({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={st.ghostBtn}>
      <Text style={st.ghostBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Status messages (unchanged behaviour, refreshed visual) ──────────────────
function StatusMsg({ type, text }) {
  if (!text) return null;
  const isErr = type === 'error';
  return (
    <View style={isErr ? st.msgError : st.msgInfo}>
      <Text style={isErr ? st.msgErrorTxt : st.msgInfoTxt}>{text}</Text>
    </View>
  );
}

// ─── Step indicator (Create Account) ──────────────────────────────────────────
function StepIndicator({ step = 1, total = 2 }) {
  return (
    <View style={st.stepWrap}>
      <Text style={st.stepLabel}>STEP {step} OF {total}</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={{
            width: 18, height: 3, borderRadius: 2,
            backgroundColor: i < step ? C.primaryHi : 'rgba(180,150,255,0.18)',
          }}/>
        ))}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AuthScreen
// ══════════════════════════════════════════════════════════════════════════════
export default function AuthScreen({ onAuth }) {
  const [screen,   setScreen]   = useState('welcome'); // 'welcome' | 'login' | 'register' | 'forgot' | 'success'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agree,    setAgree]    = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');

  function clearMessages() { setError(''); setNotice(''); }
  function goTo(s) { clearMessages(); setShowPass(false); setScreen(s); }

  // ── Supabase handlers (logic unchanged) ──────────────────────────────────
  async function handleLogin() {
    clearMessages();
    if (!email.trim() || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return;
    }
    setLoading(true);
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (e) throw e;
      if (data.user) { await ensureUserProfile(data.user); onAuth(data.user); }
    } catch (e) { setError(mapError(e?.message)); }
    finally     { setLoading(false); }
  }

  async function handleRegister() {
    clearMessages();
    if (!email.trim() || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return;
    }
    if (password.length < 6) {
      setError('كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.'); return;
    }
    if (!agree) {
      setError('يرجى الموافقة على الشروط أوّلاً'); return;
    }
    setLoading(true);
    try {
      const { data, error: e } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
      });
      if (e) throw e;
      await ensureUserProfile(data.user, name.trim());
      if (!data.session) { setScreen('success'); return; }
      if (data.user)      { onAuth(data.user); }
    } catch (e) { setError(mapError(e?.message)); }
    finally     { setLoading(false); }
  }

  async function handleForgot() {
    clearMessages();
    if (!email.trim()) { setError('يرجى إدخال بريدك الإلكتروني'); return; }
    setLoading(true);
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (e) throw e;
      setNotice('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.');
    } catch (e) { setError(mapError(e?.message)); }
    finally     { setLoading(false); }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar hidden/>
      <AuthBackdrop/>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {screen === 'welcome'  && <WelcomeView  onSignIn={() => goTo('login')} onCreate={() => goTo('register')}/>}
          {screen === 'login'    && <LoginView
                                      email={email} setEmail={setEmail}
                                      password={password} setPassword={setPassword}
                                      showPass={showPass} setShowPass={setShowPass}
                                      error={error} notice={notice} loading={loading}
                                      onBack={() => goTo('welcome')} onForgot={() => goTo('forgot')}
                                      onSubmit={handleLogin} onCreate={() => goTo('register')}/>}
          {screen === 'register' && <RegisterView
                                      name={name} setName={setName}
                                      email={email} setEmail={setEmail}
                                      password={password} setPassword={setPassword}
                                      showPass={showPass} setShowPass={setShowPass}
                                      agree={agree} setAgree={setAgree}
                                      error={error} notice={notice} loading={loading}
                                      onBack={() => goTo('welcome')} onSubmit={handleRegister}
                                      onSignIn={() => goTo('login')}/>}
          {screen === 'forgot'   && <ForgotView
                                      email={email} setEmail={setEmail}
                                      error={error} notice={notice} loading={loading}
                                      onBack={() => goTo('login')} onSubmit={handleForgot}/>}
          {screen === 'success'  && <SuccessView onContinue={() => goTo('login')}/>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WELCOME — clean vertical structure, no overlap
// ══════════════════════════════════════════════════════════════════════════════
function WelcomeView({ onSignIn, onCreate }) {
  return (
    <View style={st.welcomeRoot}>
      {/* hero block */}
      <View style={st.welcomeHero}>
        <EagleEyeOrb3D size={108}/>
        <View style={{ marginTop: 22, alignItems: 'center' }}>
          <Text style={st.brand}>AIEyes</Text>
          <Text style={st.brandAr}>عيون الذكاء</Text>
        </View>
      </View>
      {/* tagline block — pushed down so it doesn't fight CTAs */}
      <View style={st.welcomeBody}>
        <Text style={st.eyebrow}>BY ZEMOO</Text>
        <Text style={st.tagline}>{'See smarter.\nMove safer.'}</Text>
        <Text style={st.taglineAr}>أبصِر بثقة. تحرّك بأمان.</Text>
      </View>
      {/* CTAs at the bottom */}
      <View style={st.welcomeCtas}>
        <PrimaryBtn label="Sign In"        onPress={onSignIn}/>
        <GhostBtn   label="Create Account" onPress={onCreate}/>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════
function LoginView({
  email, setEmail, password, setPassword, showPass, setShowPass,
  error, notice, loading, onBack, onForgot, onSubmit, onCreate,
}) {
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <View style={st.formRoot}>
      <TopBar onBack={onBack}/>
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <EagleEyeOrb3D size={80}/>
      </View>
      <View style={st.formHeader}>
        <Text style={st.eyebrow}>WELCOME BACK</Text>
        <Text style={st.title}>Sign in to AIEyes</Text>
        <Text style={st.titleAr}>سجّل دخولك إلى عيون الذكاء</Text>
      </View>

      <View style={{ gap: 14 }}>
        <Field icon={<IconMail/>} label="Email"    ar="البريد الإلكتروني"
               value={email} onChangeText={setEmail}
               placeholder="you@example.com" keyboardType="email-address"/>
        <Field icon={<IconLock/>} label="Password" ar="كلمة المرور"
               value={password} onChangeText={setPassword}
               placeholder="••••••••" secure
               showPass={showPass} onTogglePass={() => setShowPass(v => !v)}/>
        <View style={st.rowBetween}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setRememberMe((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View style={rememberMe ? st.checkboxOn : st.checkboxOff}>
              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                {rememberMe ? <Path d="m4 12 6 6 10-12"/> : null}
              </Svg>
            </View>
            <Text style={st.smallTxt}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onForgot} activeOpacity={0.7}>
            <Text style={st.linkTxt}>Forgot?</Text>
          </TouchableOpacity>
        </View>
      </View>

      <StatusMsg type="error" text={error}/>
      <StatusMsg type="info"  text={notice}/>

      <View style={{ marginTop: 18, gap: 18 }}>
        <PrimaryBtn label="Sign In" onPress={onSubmit} loading={loading}/>
        {/* biometric — quiet text link, no card */}
        <TouchableOpacity activeOpacity={0.7} style={st.biometricLink}>
          <IconFingerprint/>
          <Text style={st.biometricTxt}>Use Face ID / fingerprint</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={onCreate} style={{ alignSelf: 'center' }}>
          <Text style={st.smallTxt}>
            New here? <Text style={st.linkTxt}>Create account</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REGISTER
// ══════════════════════════════════════════════════════════════════════════════
function RegisterView({
  name, setName, email, setEmail, password, setPassword,
  showPass, setShowPass, agree, setAgree,
  error, notice, loading, onBack, onSubmit, onSignIn,
}) {
  return (
    <View style={st.formRoot}>
      <TopBar onBack={onBack} right={<StepIndicator step={1} total={2}/>}/>
      <View style={{ marginTop: 22 }}>
        <EagleEyeOrb3D size={56}/>
      </View>
      <View style={st.formHeader}>
        <Text style={st.eyebrow}>JOIN AIEYES</Text>
        <Text style={st.title}>{'Create your\nguardian eye.'}</Text>
        <Text style={st.titleAr}>أنشئ حسابك واصنع عيناً تحرسك.</Text>
      </View>

      <View style={{ gap: 13 }}>
        <Field icon={<IconUser/>} label="Name"     ar="الاسم"
               value={name} onChangeText={setName}     placeholder="Your name"/>
        <Field icon={<IconMail/>} label="Email"    ar="البريد الإلكتروني"
               value={email} onChangeText={setEmail}    placeholder="you@example.com" keyboardType="email-address"/>
        <Field icon={<IconLock/>} label="Password" ar="كلمة المرور"
               value={password} onChangeText={setPassword} placeholder="At least 8 characters" secure
               showPass={showPass} onTogglePass={() => setShowPass(v => !v)}/>
        <Text style={st.helperTxt}>Use 8+ characters with a number.  ·  8 أحرف ورقم</Text>
      </View>

      <StatusMsg type="error" text={error}/>
      <StatusMsg type="info"  text={notice}/>

      {/* Terms — calm row, visually separated from CTA */}
      <TouchableOpacity onPress={() => setAgree(v => !v)} activeOpacity={0.8} style={st.termsRow}>
        <View style={agree ? st.checkboxOn : st.checkboxOff}>
          {agree ? (
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m4 12 6 6 10-12"/>
            </Svg>
          ) : null}
        </View>
        <Text style={st.termsTxt}>
          I agree to the <Text style={st.linkTxt}>Terms</Text> and{' '}
          <Text style={st.linkTxt}>Privacy Policy</Text>.
        </Text>
      </TouchableOpacity>

      {/* CTA, breathing */}
      <View style={{ marginTop: 22, gap: 12 }}>
        <PrimaryBtn label="Continue" onPress={onSubmit} loading={loading}/>
        <TouchableOpacity activeOpacity={0.7} onPress={onSignIn} style={{ alignSelf: 'center' }}>
          <Text style={st.smallTxt}>
            Already have an account? <Text style={st.linkTxt}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORGOT
// ══════════════════════════════════════════════════════════════════════════════
function ForgotView({ email, setEmail, error, notice, loading, onBack, onSubmit }) {
  return (
    <View style={st.formRoot}>
      <TopBar onBack={onBack}/>
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <EagleEyeOrb3D size={72}/>
      </View>
      <View style={st.formHeader}>
        <Text style={st.eyebrow}>RESET ACCESS</Text>
        <Text style={st.title}>Reset your password</Text>
        <Text style={st.titleAr}>سنرسل لك رابط إعادة التعيين.</Text>
      </View>
      <Field icon={<IconMail/>} label="Email" ar="البريد الإلكتروني"
             value={email} onChangeText={setEmail}
             placeholder="you@example.com" keyboardType="email-address"/>
      <StatusMsg type="error" text={error}/>
      <StatusMsg type="info"  text={notice}/>
      {!notice && (
        <View style={{ marginTop: 18 }}>
          <PrimaryBtn label="Send reset link" onPress={onSubmit} loading={loading}/>
        </View>
      )}
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ alignSelf: 'center', marginTop: 18 }}>
        <Text style={st.linkTxt}>← Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUCCESS
// ══════════════════════════════════════════════════════════════════════════════
function SuccessView({ onContinue }) {
  return (
    <View style={st.formRoot}>
      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <EagleEyeOrb3D size={108}/>
      </View>
      <Animated.View entering={FadeInUp.duration(500).springify()} style={{ alignItems: 'center', marginTop: 28, gap: 10 }}>
        <View style={st.successRing}><IconCheck/></View>
        <Text style={st.successTitle}>You're in.</Text>
        <Text style={st.successSub}>{'Your AIEyes account is ready.\nGuided by intelligent vision.'}</Text>
      </Animated.View>
      <View style={{ marginTop: 28 }}>
        <PrimaryBtn label="Sign in to AIEyes" onPress={onContinue}/>
      </View>
    </View>
  );
}

// ─── Shared top bar ──────────────────────────────────────────────────────────
function TopBar({ onBack, right }) {
  return (
    <View style={st.topBar}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={st.iconBtn}>
        <IconBack/>
      </TouchableOpacity>
      <View style={{ flex: 1 }}/>
      {right ?? null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // backdrop
  aurora: {
    position: 'absolute',
    left: SW / 2 - 260, top: -100,
    width: 520, height: 300, borderRadius: 160,
    backgroundColor: 'rgba(140,110,255,0.22)',
    opacity: 0.7,
  },
  bgOrb: {
    position: 'absolute',
    right: -90, top: '30%',
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(60,40,120,0.18)',
    opacity: 0.32,
  },
  bottomGlow: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 200,
  },

  // orb
  orbShadow: {
    shadowColor: '#786dff', shadowOpacity: 0.45,
    shadowRadius: 30, shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },

  // welcome
  welcomeRoot: {
    flex: 1, minHeight: 720,
    paddingTop: 56, paddingHorizontal: 24, paddingBottom: 36,
  },
  welcomeHero:   { alignItems: 'center', marginTop: 36 },
  welcomeBody:   { marginTop: 64 },
  welcomeCtas:   { gap: 12, marginTop: 'auto' },
  brand: {
    color: C.textPri, fontSize: 30, fontWeight: '500',
    letterSpacing: 8, textAlign: 'center',
    textShadowColor: 'rgba(180,150,255,0.45)', textShadowRadius: 22,
  },
  brandAr: {
    color: C.textSec, fontSize: 13, fontWeight: '500',
    textAlign: 'center', marginTop: 10, letterSpacing: 0.5,
  },
  eyebrow: {
    color: 'rgba(200,184,255,0.55)',
    fontSize: 10, fontWeight: '700', letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
  tagline: {
    color: C.textPri, fontSize: 34, fontWeight: '700',
    lineHeight: 38, letterSpacing: -0.6, marginTop: 14,
  },
  taglineAr: {
    color: C.textSec, fontSize: 13.5, fontWeight: '500',
    marginTop: 10, writingDirection: 'rtl',
  },

  // form
  formRoot: {
    flex: 1, minHeight: 720,
    paddingTop: 16, paddingHorizontal: 24, paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 40, paddingBottom: 8,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(180,150,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  stepLabel: {
    color: 'rgba(200,184,255,0.55)',
    fontSize: 10, fontWeight: '700', letterSpacing: 1.4,
  },
  formHeader: { marginTop: 18, marginBottom: 24 },
  title: {
    color: C.textPri, fontSize: 26, fontWeight: '700',
    lineHeight: 30, letterSpacing: -0.4, marginTop: 6,
  },
  titleAr: {
    color: C.textSec, fontSize: 13, fontWeight: '500',
    marginTop: 4, writingDirection: 'rtl',
  },

  // field
  fieldWrap: {},
  fieldLabelRow: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 7,
  },
  fieldLabel: {
    color: 'rgba(200,184,255,0.65)',
    fontSize: 10, fontWeight: '700', letterSpacing: 1.6,
  },
  fieldLabelAr: {
    color: 'rgba(200,184,255,0.4)',
    fontSize: 10.5, fontWeight: '500',
    writingDirection: 'rtl',
  },
  input: {
    height: 52, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: C.inputBg,
    borderWidth: 1, borderColor: C.border,
  },
  inputField: {
    flex: 1, color: C.textPri,
    fontSize: 15, fontWeight: '400', paddingVertical: 0,
  },
  helperTxt: {
    color: 'rgba(200,184,255,0.42)',
    fontSize: 10.5, fontWeight: '500', marginTop: 2, marginLeft: 2,
  },

  // rows / small
  rowBetween: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 2,
  },
  smallTxt:  { color: 'rgba(220,210,255,0.72)', fontSize: 12, fontWeight: '500' },
  linkTxt:   { color: C.primaryHi, fontSize: 12.5, fontWeight: '700' },

  checkboxOn: {
    width: 18, height: 18, borderRadius: 5,
    backgroundColor: '#7a6dff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  checkboxOff: {
    width: 18, height: 18, borderRadius: 5,
    backgroundColor: 'rgba(180,150,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(180,150,255,0.3)',
  },

  // terms (register)
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 18,
  },
  termsTxt: {
    flex: 1, color: 'rgba(220,210,255,0.72)',
    fontSize: 12, lineHeight: 18,
  },

  // biometric (login)
  biometricLink: {
    flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  biometricTxt: {
    color: 'rgba(200,184,255,0.7)',
    fontSize: 12.5, fontWeight: '500',
  },

  // status
  msgError: {
    marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,48,98,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,48,98,0.28)',
  },
  msgErrorTxt: {
    color: C.danger, fontSize: 13, lineHeight: 20, textAlign: 'center',
  },
  msgInfo: {
    marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(120,109,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.32)',
  },
  msgInfoTxt: {
    color: C.violet, fontSize: 13, lineHeight: 20, textAlign: 'center',
  },

  // buttons
  btnShadow: {
    borderRadius: 18,
    shadowColor: C.primary, shadowOpacity: 0.5, shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 }, elevation: 10,
  },
  btn: {
    height: 54, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  ghostBtn: {
    height: 54, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(180,150,255,0.32)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  ghostBtnTxt: {
    color: 'rgba(232,223,255,0.92)',
    fontSize: 15, fontWeight: '600', letterSpacing: 0.3,
  },

  // success
  successRing: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(34,217,160,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(34,217,160,0.4)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.success, shadowOpacity: 0.25, shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  successTitle: { color: C.success, fontSize: 24, fontWeight: '700' },
  successSub:   { color: C.textSec, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
