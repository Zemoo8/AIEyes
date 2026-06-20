/**
 * AIEyes — screens/IntroScreen.js
 * First-run onboarding. 3 pages, swipe/tap through, writes AsyncStorage flag on done.
 * Public API: export default function IntroScreen({ onDone })
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, {
  Circle, Path, Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Ellipse, Line,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing as RE, FadeInUp, FadeIn,
} from 'react-native-reanimated';

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  bg:        '#090814',
  primary:   '#786dff',
  primaryHi: '#b29bff',
  textPri:   '#F4F3FF',
  textSec:   'rgba(220,210,255,0.72)',
  textMuted: 'rgba(180,170,220,0.5)',
};

// ─── Animated hero orb ───────────────────────────────────────────────────────
function HeroOrb({ size = 160 }) {
  const pulse = useSharedValue(1);
  const float = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 2600, easing: RE.inOut(RE.sin) }),
        withTiming(1.00, { duration: 2600, easing: RE.inOut(RE.sin) }),
      ), -1, false);
    float.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 3000, easing: RE.inOut(RE.sin) }),
        withTiming( 0, { duration: 3000, easing: RE.inOut(RE.sin) }),
      ), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }, { translateY: float.value }],
  }));
  return (
    <Animated.View style={[{ width: size, height: size, alignSelf: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 240 240">
        <Defs>
          <RadialGradient id="oi" cx="50%" cy="42%" r="60%">
            <Stop offset="0%"   stopColor="#0a0816"/>
            <Stop offset="22%"  stopColor="#251a55"/>
            <Stop offset="56%"  stopColor="#5a48ce"/>
            <Stop offset="84%"  stopColor="#9c8bff"/>
            <Stop offset="100%" stopColor="#cabfff"/>
          </RadialGradient>
          <RadialGradient id="op" cx="50%" cy="42%" r="55%">
            <Stop offset="0%"   stopColor="#040210"/>
            <Stop offset="70%"  stopColor="#0a0620"/>
            <Stop offset="100%" stopColor="#1a0f3a"/>
          </RadialGradient>
          <RadialGradient id="oc" cx="50%" cy="50%" r="60%">
            <Stop offset="55%"  stopColor="rgba(0,0,0,0)"/>
            <Stop offset="78%"  stopColor="rgba(140,110,255,0.42)"/>
            <Stop offset="100%" stopColor="rgba(140,110,255,0)"/>
          </RadialGradient>
          <SvgLinear id="or" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="rgba(220,210,255,0.95)"/>
            <Stop offset="100%" stopColor="rgba(140,110,255,0.4)"/>
          </SvgLinear>
          <RadialGradient id="oii" cx="50%" cy="50%" r="50%">
            <Stop offset="60%"  stopColor="rgba(0,0,0,0)"/>
            <Stop offset="100%" stopColor="rgba(0,0,0,0.55)"/>
          </RadialGradient>
        </Defs>
        <Circle cx={120} cy={120} r={118} fill="url(#oc)"/>
        <Circle cx={120} cy={120} r={78}  fill="url(#oi)"/>
        <Circle cx={120} cy={120} r={78}  fill="url(#oii)"/>
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
        <Circle cx={120} cy={120} r={26} fill="url(#op)"/>
        <Circle cx={120} cy={120} r={26} fill="none" stroke="rgba(180,150,255,0.5)" strokeWidth={0.6}/>
        <Ellipse cx={113} cy={113} rx={5} ry={3.5} fill="rgba(220,210,255,0.85)"/>
        <Circle cx={125} cy={128} r={1.5} fill="rgba(220,210,255,0.6)"/>
        <Circle cx={120} cy={120} r={78} fill="none" stroke="url(#or)" strokeWidth={1.1}/>
        <Path d="M 56 70 L 86 56 L 154 56 L 184 70"
              fill="none" stroke="rgba(220,210,255,0.7)" strokeWidth={1.2}
              strokeLinecap="round" strokeLinejoin="round" opacity={0.75}/>
      </Svg>
    </Animated.View>
  );
}

// ─── Drifting background particles ───────────────────────────────────────────
const BG_PARTICLES = [
  { x: 0.1, y: 0.12, s: 2, d: 7200 }, { x: 0.88, y: 0.08, s: 1.5, d: 8800 },
  { x: 0.32, y: 0.22, s: 2, d: 6600 }, { x: 0.74, y: 0.18, s: 1.5, d: 9100 },
  { x: 0.55, y: 0.06, s: 2, d: 7600 }, { x: 0.22, y: 0.72, s: 1.5, d: 8200 },
  { x: 0.91, y: 0.62, s: 2, d: 7000 },
];
function BGParticle({ x, y, s, d }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: d, easing: RE.inOut(RE.sin) }), -1, true);
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: 0.15 + t.value * 0.4,
    transform: [{ translateY: t.value * -16 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: 'absolute', left: x * SW, top: y * SH,
      width: s, height: s, borderRadius: s, backgroundColor: '#cabaff',
    }, st]}/>
  );
}

// ─── Feature item ─────────────────────────────────────────────────────────────
function Feature({ icon, title, titleAr }) {
  return (
    <View style={st.featureItem}>
      <Text style={st.featureIcon}>{icon}</Text>
      <Text style={st.featureTitle}>{title}</Text>
      <Text style={st.featureTitleAr}>{titleAr}</Text>
    </View>
  );
}

// ─── Pages ───────────────────────────────────────────────────────────────────
const PAGES = [
  {
    key: 'hero',
    eyebrow: 'BY ZEMOO',
    title: 'See smarter.\nMove safer.',
    titleAr: 'أبصِر بثقة.\nتحرّك بأمان.',
    sub: 'AI-powered visual guidance for everyone.',
    subAr: 'مساعدك البصري الذكي في كل لحظة.',
  },
  {
    key: 'features',
    headline: 'Everything you need.',
    headlineAr: 'كل ما تحتاجه.',
    features: [
      { icon: '👁', title: 'Detect objects', titleAr: 'كشف الأشياء' },
      { icon: '📖', title: 'Read text',      titleAr: 'قراءة النصوص' },
      { icon: '🗺', title: 'Describe scenes', titleAr: 'وصف المشاهد' },
      { icon: '💰', title: 'Read currency',  titleAr: 'تمييز العملات' },
    ],
  },
  {
    key: 'ready',
    title: 'Your guardian eye\nis ready.',
    titleAr: 'عيونك الذكية جاهزة.',
    sub: 'Shake the phone anytime to activate voice commands.',
    subAr: 'هز الهاتف في أي وقت لتفعيل الأوامر الصوتية.',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// IntroScreen
// ══════════════════════════════════════════════════════════════════════════════
export default function IntroScreen({ onDone }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef(null);

  function goTo(p) {
    setPage(p);
    scrollRef.current?.scrollTo({ x: p * SW, animated: true });
  }

  function next() {
    if (page < PAGES.length - 1) {
      goTo(page + 1);
    } else {
      onDone();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar hidden/>
      <LinearGradient
        colors={['#10295c', '#0b1230', '#090814', '#02030c']}
        locations={[0, 0.28, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* top aurora */}
      <View style={st.aurora} pointerEvents="none"/>
      {/* bg particles */}
      {BG_PARTICLES.map((p, i) => <BGParticle key={i} {...p}/>)}

      {/* skip */}
      <TouchableOpacity onPress={onDone} activeOpacity={0.7} style={st.skipBtn}>
        <Text style={st.skipTxt}>SKIP</Text>
      </TouchableOpacity>

      {/* pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: SW * PAGES.length }}
      >
        {/* ─── Page 0: Hero ─── */}
        <View style={[st.page, { width: SW }]}>
          <View style={st.heroOrb}>
            <HeroOrb size={180}/>
          </View>
          <Animated.View entering={FadeInUp.duration(500).delay(200)} style={st.heroText}>
            <Text style={st.eyebrow}>{PAGES[0].eyebrow}</Text>
            <Text style={st.heroTitle}>{PAGES[0].title}</Text>
            <Text style={st.heroTitleAr}>{PAGES[0].titleAr}</Text>
            <Text style={st.heroSub}>{PAGES[0].sub}</Text>
            <Text style={st.heroSubAr}>{PAGES[0].subAr}</Text>
          </Animated.View>
        </View>

        {/* ─── Page 1: Features ─── */}
        <View style={[st.page, { width: SW }]}>
          <View style={st.featuresBlock}>
            <View style={st.smallOrbWrap}>
              <HeroOrb size={80}/>
            </View>
            <Text style={st.featuresHeadline}>{PAGES[1].headline}</Text>
            <Text style={st.featuresHeadlineAr}>{PAGES[1].headlineAr}</Text>
            <View style={st.featureGrid}>
              {PAGES[1].features.map((f, i) => <Feature key={i} {...f}/>)}
            </View>
          </View>
        </View>

        {/* ─── Page 2: Ready ─── */}
        <View style={[st.page, { width: SW }]}>
          <View style={st.readyBlock}>
            <HeroOrb size={120}/>
            <Animated.View entering={FadeInUp.duration(500).delay(100)} style={{ alignItems: 'center', marginTop: 28 }}>
              <Text style={st.readyTitle}>{PAGES[2].title}</Text>
              <Text style={st.readyTitleAr}>{PAGES[2].titleAr}</Text>
              <Text style={st.readySub}>{PAGES[2].sub}</Text>
              <Text style={st.readySubAr}>{PAGES[2].subAr}</Text>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* dots + CTA */}
      <View style={st.footer}>
        <View style={st.dots}>
          {PAGES.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)} style={[st.dot, i === page && st.dotActive]}/>
          ))}
        </View>
        <TouchableOpacity onPress={next} activeOpacity={0.88} style={st.ctaWrap}>
          <LinearGradient
            colors={['#9c8bff', '#7a6dff', '#5e51d6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={st.cta}
          >
            <Text style={st.ctaTxt}>
              {page < PAGES.length - 1 ? 'NEXT →' : 'GET STARTED'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {page === PAGES.length - 1 && (
          <Text style={st.ctaSubAr}>أبدأ رحلتك الآن</Text>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  aurora: {
    position: 'absolute',
    left: SW / 2 - 260, top: -80,
    width: 520, height: 280, borderRadius: 160,
    backgroundColor: 'rgba(140,110,255,0.20)',
    opacity: 0.65,
  },
  skipBtn: {
    position: 'absolute', top: 54, right: 22, zIndex: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  skipTxt: {
    color: 'rgba(200,190,255,0.6)',
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
  },

  page: {
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 80,
  },

  // hero
  heroOrb: { alignItems: 'center', marginBottom: 32 },
  heroText: { alignItems: 'flex-start' },
  eyebrow: {
    color: 'rgba(200,184,255,0.55)',
    fontSize: 10, fontWeight: '700', letterSpacing: 3.5,
    textTransform: 'uppercase', marginBottom: 14,
  },
  heroTitle: {
    color: '#F4F3FF', fontSize: 36, fontWeight: '700',
    lineHeight: 42, letterSpacing: -0.6,
  },
  heroTitleAr: {
    color: 'rgba(220,210,255,0.85)',
    fontSize: 20, fontWeight: '600', lineHeight: 30,
    marginTop: 8, textAlign: 'right', writingDirection: 'rtl',
  },
  heroSub: {
    color: 'rgba(200,190,255,0.55)',
    fontSize: 13.5, fontWeight: '500', marginTop: 18, lineHeight: 20,
  },
  heroSubAr: {
    color: 'rgba(200,190,255,0.45)',
    fontSize: 12, fontWeight: '500', marginTop: 6,
    textAlign: 'right', writingDirection: 'rtl',
  },

  // features
  featuresBlock: { alignItems: 'center' },
  smallOrbWrap: { marginBottom: 22 },
  featuresHeadline: {
    color: '#F4F3FF', fontSize: 26, fontWeight: '700',
    letterSpacing: -0.4, textAlign: 'center',
  },
  featuresHeadlineAr: {
    color: 'rgba(220,210,255,0.72)', fontSize: 13, fontWeight: '500',
    textAlign: 'center', marginTop: 4, writingDirection: 'rtl',
  },
  featureGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 14, marginTop: 28, justifyContent: 'center',
  },
  featureItem: {
    width: (SW - 28*2 - 14) / 2,
    padding: 18, borderRadius: 20,
    backgroundColor: 'rgba(120,109,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(120,109,255,0.18)',
    alignItems: 'flex-start', gap: 8,
  },
  featureIcon: { fontSize: 26 },
  featureTitle: {
    color: '#F4F3FF', fontSize: 13.5, fontWeight: '700',
  },
  featureTitleAr: {
    color: 'rgba(220,210,255,0.65)', fontSize: 11, fontWeight: '500',
    writingDirection: 'rtl',
  },

  // ready
  readyBlock: { alignItems: 'center' },
  readyTitle: {
    color: '#F4F3FF', fontSize: 30, fontWeight: '700',
    lineHeight: 38, letterSpacing: -0.4, textAlign: 'center',
  },
  readyTitleAr: {
    color: 'rgba(220,210,255,0.72)', fontSize: 16, fontWeight: '500',
    textAlign: 'center', marginTop: 8, writingDirection: 'rtl',
  },
  readySub: {
    color: 'rgba(200,190,255,0.55)', fontSize: 13,
    textAlign: 'center', lineHeight: 20, marginTop: 18, paddingHorizontal: 12,
  },
  readySubAr: {
    color: 'rgba(200,190,255,0.45)', fontSize: 12,
    textAlign: 'center', marginTop: 6, writingDirection: 'rtl',
  },

  // footer
  footer: {
    paddingBottom: 40, paddingHorizontal: 28, gap: 16, alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(180,150,255,0.22)',
  },
  dotActive: {
    width: 24, backgroundColor: '#b29bff',
  },
  ctaWrap: {
    width: '100%', borderRadius: 18,
    shadowColor: '#786dff', shadowOpacity: 0.5, shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 }, elevation: 10,
  },
  cta: {
    height: 54, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaTxt: {
    color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1.4,
  },
  ctaSubAr: {
    color: 'rgba(200,184,255,0.55)',
    fontSize: 11, fontWeight: '500', letterSpacing: 0.3,
  },
});
