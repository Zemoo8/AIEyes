/**
 * AIEyes — components/AssistantTransition.js  (cinematic, bidirectional)
 *
 * Usage:
 *   // Camera → Assistant:
 *   <AssistantTransition direction="in"  onDone={() => setAssistantOpen(true)}/>
 *
 *   // Assistant → Camera:
 *   <AssistantTransition direction="out" onDone={() => setAssistantOpen(false)}/>
 *
 * Duration ~1.0s. Layered choreography:
 *   IN  (camera → assistant)
 *     0 – 250 ms   blur + dim the screen below
 *     200 – 700 ms light streak sweeps across center
 *     250 – 900 ms 16 inward-flying particle streaks
 *     300 – 900 ms double ring expands outward from center
 *     400 – 950 ms deep-navy backdrop fades in
 *     950 – 1000ms bright bloom flash, then `onDone`
 *
 *   OUT (assistant → camera)
 *     0 – 200 ms   bloom flash from center
 *     150 – 800 ms rings collapse INWARD (inverse expansion)
 *     200 – 850 ms 12 outward-flying particle streaks
 *     300 – 950 ms navy backdrop fades OUT
 *     950 – 1000ms blur/dim layer fades off, then `onDone`
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Defs, LinearGradient as SvgLinear, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  Easing, runOnJS, interpolate,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function AssistantTransition({
  direction = 'in',         // 'in' | 'out'
  duration  = 1000,
  onDone,
}) {
  const isIn = direction === 'in';

  // shared progress 0 → 1 drives every layer below
  const t = useSharedValue(0);
  // ring 0 → 1 maps to scale + opacity envelope
  const ring = useSharedValue(0);
  // flash 0 → 1 is a quick bloom at the seam
  const flash = useSharedValue(0);
  // backdrop fade
  const fade = useSharedValue(isIn ? 0 : 1);
  // dim/blur layer that hides the screen below
  const dim = useSharedValue(isIn ? 0 : 1);
  // sweep line opacity + position
  const sweep = useSharedValue(0);
  // particles
  const parts = useSharedValue(0);

  useEffect(() => {
    const easeOut    = Easing.out(Easing.cubic);
    const easeInOut  = Easing.inOut(Easing.cubic);

    if (isIn) {
      dim.value   = withTiming(1, { duration: 250, easing: easeOut });
      sweep.value = withDelay(200, withTiming(1, { duration: 500, easing: easeInOut }));
      parts.value = withDelay(250, withTiming(1, { duration: 650, easing: easeOut }));
      ring.value  = withDelay(300, withTiming(1, { duration: 600, easing: easeInOut }));
      fade.value  = withDelay(400, withTiming(1, { duration: 550, easing: easeOut }));
      flash.value = withDelay(900, withTiming(1, { duration: 100, easing: easeOut }, (done) => {
        if (done && onDone) runOnJS(onDone)();
      }));
    } else {
      flash.value = withTiming(1, { duration: 200, easing: easeOut });
      ring.value  = withDelay(150, withTiming(1, { duration: 650, easing: easeInOut }));
      parts.value = withDelay(200, withTiming(1, { duration: 650, easing: easeOut }));
      fade.value  = withDelay(300, withTiming(0, { duration: 650, easing: easeOut }));
      dim.value   = withDelay(950, withTiming(0, { duration: 50, easing: easeOut }, (done) => {
        if (done && onDone) runOnJS(onDone)();
      }));
    }
    t.value = withTiming(1, { duration });
  }, [direction, duration]);

  // ─── layer styles ─────────────────────────────────────────────
  const dimStyle = useAnimatedStyle(() => ({
    opacity: dim.value * 0.65,
  }));
  const blurStyle = useAnimatedStyle(() => ({
    opacity: dim.value * 0.55,
  }));
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  // ring choreography: IN = expand outward, OUT = collapse inward
  const ringScaleA = useAnimatedStyle(() => {
    const r = isIn
      ? interpolate(ring.value, [0, 1], [0.3, 2.8])
      : interpolate(ring.value, [0, 1], [2.8, 0.4]);
    const a = isIn
      ? interpolate(ring.value, [0, 0.6, 1], [0.0, 0.95, 0])
      : interpolate(ring.value, [0, 0.4, 1], [0.0, 0.85, 0]);
    return { opacity: a, transform: [{ scale: r }] };
  });
  const ringScaleB = useAnimatedStyle(() => {
    const r = isIn
      ? interpolate(ring.value, [0, 1], [0.15, 2.2])
      : interpolate(ring.value, [0, 1], [2.2, 0.2]);
    const a = isIn
      ? interpolate(ring.value, [0.1, 0.7, 1], [0.0, 0.75, 0])
      : interpolate(ring.value, [0, 0.5, 1], [0.0, 0.65, 0]);
    return { opacity: a, transform: [{ scale: r }] };
  });
  const flashStyle = useAnimatedStyle(() => {
    // single bloom at the seam
    const a = isIn
      ? interpolate(flash.value, [0, 0.4, 1], [0, 0.9, 0])
      : interpolate(flash.value, [0, 0.4, 1], [0.9, 0.5, 0]);
    const s = isIn
      ? interpolate(flash.value, [0, 1], [0.3, 1.6])
      : interpolate(flash.value, [0, 1], [1.4, 0.6]);
    return { opacity: a, transform: [{ scale: s }] };
  });

  // sweep line: horizontal streak that fades through center
  const sweepStyle = useAnimatedStyle(() => {
    const a = interpolate(sweep.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
    const x = interpolate(sweep.value, [0, 1], [-180, 180]);
    return { opacity: a, transform: [{ translateX: x }, { skewY: '-3deg' }] };
  });

  // particles
  const partStyle = useAnimatedStyle(() => ({
    opacity: interpolate(parts.value, [0, 0.2, 0.9, 1], [0, 1, 1, 0]),
  }));

  const particles = useMemo(() => generateParticles(isIn ? 16 : 14), [isIn]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* dim/black layer for the screen below */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, dimStyle]}/>
      {/* slight chromatic blur hint */}
      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]}>
        <LinearGradient
          colors={['rgba(80,40,160,0.18)', 'rgba(20,10,50,0.4)', 'rgba(80,40,160,0.18)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* navy reveal backdrop (assistant target) */}
      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
        <LinearGradient
          colors={['#02030c', '#050818', '#082244']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* center reveal */}
      <View style={st.center} pointerEvents="none">
        {/* outer ring */}
        <Animated.View style={[st.ring, st.ringOuter, ringScaleA]}/>
        {/* inner ring */}
        <Animated.View style={[st.ring, st.ringInner, ringScaleB]}/>
        {/* particles */}
        <Animated.View style={[StyleSheet.absoluteFill, partStyle]}>
          <Svg width={520} height={520} viewBox="-260 -260 520 520" style={st.partsSvg}>
            <Defs>
              <SvgLinear id="streak" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%"   stopColor="rgba(174,220,255,0)"/>
                <Stop offset="100%" stopColor="rgba(174,220,255,1)"/>
              </SvgLinear>
            </Defs>
            {particles.map((p, i) => {
              const cx = Math.cos(p.a) * p.r;
              const cy = Math.sin(p.a) * p.r;
              const tx = Math.cos(p.a) * (p.r * 0.4);
              const ty = Math.sin(p.a) * (p.r * 0.4);
              // IN: lines point inward (tip at center). OUT: tip outward.
              return (
                <Line
                  key={i}
                  x1={isIn ? cx : tx} y1={isIn ? cy : ty}
                  x2={isIn ? tx : cx} y2={isIn ? ty : cy}
                  stroke="url(#streak)"
                  strokeWidth={p.w}
                  strokeOpacity={p.o}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        </Animated.View>
        {/* center sweep line */}
        <Animated.View style={[st.sweepWrap, sweepStyle]}>
          <LinearGradient
            colors={[
              'rgba(160,200,255,0)',
              'rgba(160,200,255,0.85)',
              'rgba(220,235,255,1)',
              'rgba(160,200,255,0.85)',
              'rgba(160,200,255,0)',
            ]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={st.sweep}
          />
        </Animated.View>
        {/* final bloom flash */}
        <Animated.View style={[st.flash, flashStyle]}/>
      </View>
    </View>
  );
}

function generateParticles(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i * 0.137);
    const r = 110 + (i % 4) * 28 + ((i * 31) % 18);
    const w = 1.4 + ((i * 7) % 10) * 0.12;
    const o = 0.55 + ((i * 13) % 7) * 0.06;
    out.push({ a, r, w, o });
  }
  return out;
}

const st = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute', borderRadius: 999,
  },
  ringOuter: {
    width: 240, height: 240,
    borderWidth: 2, borderColor: 'rgba(160,200,255,0.9)',
    shadowColor: '#aedcff', shadowOpacity: 1, shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  ringInner: {
    width: 140, height: 140,
    borderWidth: 1.4, borderColor: 'rgba(220,235,255,0.95)',
    shadowColor: '#dceaff', shadowOpacity: 0.95, shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  flash: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(220,235,255,0.95)',
    shadowColor: '#aedcff', shadowOpacity: 1, shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  sweepWrap: {
    position: 'absolute',
    width: 600, height: 90,
    alignItems: 'center', justifyContent: 'center',
  },
  sweep: {
    width: '100%', height: 2.5,
    shadowColor: '#aedcff', shadowOpacity: 1, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  partsSvg: {
    position: 'absolute',
    left: '50%', top: '50%',
    marginLeft: -260, marginTop: -260,
  },
});
