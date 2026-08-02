import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Compact, lightweight visual scene shown above each symptom question —
// soft glow + thin rings + a few floating particles, no illustrations.
// Keyed by symptom name (case-insensitive); unknown symptoms fall back
// to a neutral brand-colored scene so new backend symptoms never break this.
const SCENES = {
  pain: { icon: 'pulse', color: colors.danger, tint: '#FDEDED' },
  fatigue: { icon: 'moon', color: colors.accentViolet, tint: '#F1EBFC' },
  nausea: { icon: 'water', color: colors.accent, tint: '#E9F7FC' },
  fever: { icon: 'thermometer', color: colors.warningStrong, tint: '#FDF3E6' },
  appetite: { icon: 'restaurant', color: colors.successStrong, tint: '#EAFAF0' },
};
const DEFAULT_SCENE = { icon: 'medkit', color: colors.primary, tint: colors.primaryTint };

const PARTICLES = [
  { top: 4, left: 14, size: 4, opacity: 0.5 },
  { top: 18, right: 6, size: 3, opacity: 0.4 },
  { bottom: 10, left: 2, size: 3, opacity: 0.35 },
  { bottom: 2, right: 18, size: 4, opacity: 0.45 },
];

function sceneFor(name) {
  const key = (name || '').toLowerCase();
  const match = Object.keys(SCENES).find((k) => key.includes(k));
  return match ? SCENES[match] : DEFAULT_SCENE;
}

export default function SymptomIconScene({ name, size = 112 }) {
  const scene = sceneFor(name);
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.85] });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: scene.tint,
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: size * 0.82,
            height: size * 0.82,
            borderRadius: (size * 0.82) / 2,
            borderColor: scene.color,
            opacity: 0.18,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: size * 0.64,
            height: size * 0.64,
            borderRadius: (size * 0.64) / 2,
            borderColor: scene.color,
            opacity: 0.14,
            transform: [{ translateX: 3 }, { translateY: -2 }],
          },
        ]}
      />

      {PARTICLES.map((p, i) => (
        <View
          key={i}
          style={[
            styles.particle,
            {
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: scene.color,
              opacity: p.opacity,
              top: p.top,
              left: p.left,
              right: p.right,
              bottom: p.bottom,
            },
          ]}
        />
      ))}

      <View style={[styles.core, { backgroundColor: scene.tint, borderColor: scene.color }]}>
        <Ionicons name={scene.icon} size={size * 0.26} color={scene.color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  glow: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  particle: {
    position: 'absolute',
  },
  core: {
    width: '52%',
    height: '52%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
