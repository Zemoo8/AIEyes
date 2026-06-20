/**
 * AIEyes — components/AssistantTransition.js
 *
 * Breathtaking bidirectional portal transition.
 *
 *   IN  (~820ms): black vignette → spinning light vortex + 4 shockwave rings
 *                 → violet core erupts → white flash bloom → navy backdrop in → onDone
 *   OUT (~580ms): white flash → rings implode + vortex reverses → backdrop out → onDone
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line as SvgLine } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withSequence, Easing, runOnJS, interpolate,
} from 'react-native-reanimated';

const { width: SW } = Dimensions.get('window');
const RAY_COUNT = 18;
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => i * (180 / RAY_COUNT));

function RingLayer({ prog, maxScale, color }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(prog.value, [0, 0.25, 0.85, 1], [0, 1, 0.6, 0]),
    transform: [{ scale: interpolate(prog.value, [0, 1], [0.05, maxScale]) }],
  }));
  return (
    <Animated.View style={[st.ring, { borderColor: color }, style]} pointerEvents="none"/>
  );
}

export default function AssistantTransition({ direction = 'in', onDone }) {
  const isIn = direction === 'in';

  const scrim    = useSharedValue(isIn ? 0 : 0.85);
  const vortex   = useSharedValue(isIn ? 0 : 1);        // 0=start, 1=180deg
  const rayAlpha = useSharedValue(isIn ? 0 : 0.55);
  const ring1    = useSharedValue(0);
  const ring2    = useSharedValue(0);
  const ring3    = useSharedValue(0);
  const ring4    = useSharedValue(0);
  const core     = useSharedValue(0);
  const flash    = useSharedValue(0);
  const backdrop = useSharedValue(isIn ? 0 : 1);

  useEffect(() => {
    const eOut   = Easing.out(Easing.cubic);
    const eInOut = Easing.inOut(Easing.cubic);
    const eIn    = Easing.in(Easing.cubic);

    if (isIn) {
      // 1. Scrim darkens immediately
      scrim.value    = withTiming(0.88, { duration: 220, easing: eOut });
      // 2. Orb core erupts first (50ms) — this is the "hero" beat
      core.value  = withDelay(50, withSequence(
        withTiming(1,   { duration: 280, easing: eOut }),
        withTiming(0.1, { duration: 240, easing: eIn  }),
      ));
      // 3. Rays and rings follow once the orb is already visible
      rayAlpha.value = withDelay(160, withTiming(0.55, { duration: 260, easing: eOut }));
      vortex.value   = withDelay(170, withTiming(1,    { duration: 680, easing: eInOut }));

      ring1.value = withDelay(190, withTiming(1, { duration: 560, easing: eOut }));
      ring2.value = withDelay(240, withTiming(1, { duration: 580, easing: eOut }));
      ring3.value = withDelay(290, withTiming(1, { duration: 600, easing: eOut }));
      ring4.value = withDelay(340, withTiming(1, { duration: 620, easing: eOut }));

      flash.value = withDelay(500, withSequence(
        withTiming(1,   { duration: 110, easing: eOut }),
        withTiming(0,   { duration: 160, easing: eIn  }),
      ));
      backdrop.value = withDelay(530, withTiming(1, { duration: 300, easing: eOut }, (done) => {
        if (done && onDone) runOnJS(onDone)();
      }));

    } else {
      flash.value    = withSequence(
        withTiming(1, { duration: 130, easing: eOut }),
        withTiming(0, { duration: 180, easing: eIn  }),
      );
      rayAlpha.value = withDelay(50, withTiming(0, { duration: 320, easing: eIn }));
      vortex.value   = withDelay(60, withTiming(2, { duration: 480, easing: eInOut })); // extra 180deg

      ring1.value = withDelay(70,  withTiming(1, { duration: 420, easing: eOut }));
      ring2.value = withDelay(120, withTiming(1, { duration: 420, easing: eOut }));
      ring3.value = withDelay(170, withTiming(1, { duration: 420, easing: eOut }));
      ring4.value = withDelay(220, withTiming(1, { duration: 420, easing: eOut }));

      core.value     = withTiming(0, { duration: 200 });
      backdrop.value = withDelay(90, withTiming(0, { duration: 320, easing: eIn }));
      scrim.value    = withDelay(250, withTiming(0, { duration: 280, easing: eIn }, (done) => {
        if (done && onDone) runOnJS(onDone)();
      }));
    }
  }, [direction]);

  const scrimStyle    = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const vortexStyle   = useAnimatedStyle(() => ({
    transform: [{ rotate: `${vortex.value * 180}deg` }],
    opacity: rayAlpha.value,
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(core.value, [0, 0.4, 1], [0, 0.95, 1]),
    transform: [{ scale: interpolate(core.value, [0, 1], [0.05, 1]) }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.92,
    transform: [{ scale: 1 + flash.value * 0.8 }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>

      {/* ── Layer 1: dark scrim over camera ───────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]}/>

      {/* ── Layer 2: vortex + rings + core ────────────────────────── */}
      <View style={st.center} pointerEvents="none">

        {/* Spinning light rays */}
        <Animated.View style={[{ width: SW * 1.6, height: SW * 1.6, alignItems: 'center', justifyContent: 'center' }, vortexStyle]}>
          <Svg width={SW * 1.6} height={SW * 1.6} viewBox={`${-SW * 0.8} ${-SW * 0.8} ${SW * 1.6} ${SW * 1.6}`}>
            {RAYS.map((angle, i) => (
              <SvgLine
                key={i}
                x1={0} y1={-SW * 0.78}
                x2={0} y2={ SW * 0.78}
                stroke={i % 3 === 0 ? '#d7d1ff' : i % 3 === 1 ? '#b29bff' : '#786dff'}
                strokeWidth={i % 5 === 0 ? 1.8 : 0.9}
                transform={`rotate(${angle}, 0, 0)`}
              />
            ))}
          </Svg>
        </Animated.View>

        {/* Shockwave rings — staggered expand + fade */}
        <RingLayer prog={ring1} maxScale={isIn ? 5.5 : 4.8} color="rgba(178,155,255,0.9)"/>
        <RingLayer prog={ring2} maxScale={isIn ? 4.8 : 4.2} color="rgba(120,109,255,0.75)"/>
        <RingLayer prog={ring3} maxScale={isIn ? 4.1 : 3.6} color="rgba(159,233,255,0.6)"/>
        <RingLayer prog={ring4} maxScale={isIn ? 3.5 : 3.0} color="rgba(255,255,255,0.5)"/>

        {/* Violet core */}
        <Animated.View style={[st.core, coreStyle]} pointerEvents="none"/>

        {/* White flash bloom */}
        <Animated.View style={[st.flash, flashStyle]} pointerEvents="none"/>
      </View>

      {/* ── Layer 3: navy backdrop (the AI screen's sky) ───────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
        <LinearGradient
          colors={['#10295c', '#0b1230', '#02050f']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

    </View>
  );
}

const st = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 1.5,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  core: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(120,109,255,0.92)',
    shadowColor: '#b29bff',
    shadowOpacity: 1,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  flash: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(240,235,255,0.96)',
    shadowColor: '#d7d1ff',
    shadowOpacity: 1,
    shadowRadius: 100,
    shadowOffset: { width: 0, height: 0 },
    elevation: 30,
  },
});
