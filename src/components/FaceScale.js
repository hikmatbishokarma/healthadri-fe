import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

// Wong-Baker FACES inspired: 5 faces map to numeric values 0/3/5/7/10
// so triage thresholds (>=7 high, >=4 med) keep working server-side.
export const FACES = [
  { value: 0,  emoji: '😄', label: 'None',    color: '#16A34A', bg: '#F0FDF4' },
  { value: 3,  emoji: '🙂', label: 'A little', color: '#65A30D', bg: '#F7FEE7' },
  { value: 5,  emoji: '😐', label: 'Some',     color: '#D97706', bg: '#FFFBEB' },
  { value: 7,  emoji: '😞', label: 'A lot',    color: '#DC2626', bg: '#FEF2F2' },
  { value: 10, emoji: '😣', label: 'Severe',   color: '#7F1D1D', bg: '#FFF1F2' },
];

export function faceForValue(v) {
  let best = FACES[0];
  let bestDiff = Math.abs(FACES[0].value - v);
  for (const f of FACES) {
    const d = Math.abs(f.value - v);
    if (d < bestDiff) { best = f; bestDiff = d; }
  }
  return best;
}

export default function FaceScale({ value, onChange }) {
  const scales = useRef(FACES.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    FACES.forEach((f, i) => {
      Animated.spring(scales[i], {
        toValue: f.value === value ? 1.28 : 1,
        useNativeDriver: true,
        tension: 320,
        friction: 14,
      }).start();
    });
  }, [value]);

  return (
    <View style={styles.row}>
      {FACES.map((f, i) => {
        const selected = f.value === value;
        return (
          <TouchableOpacity
            key={f.value}
            onPress={() => onChange(f.value)}
            activeOpacity={0.75}
            style={styles.col}
          >
            <Animated.View
              style={[
                styles.bubble,
                selected && { backgroundColor: f.bg, borderColor: f.color },
                { transform: [{ scale: scales[i] }] },
              ]}
            >
              <Text style={styles.emoji}>{f.emoji}</Text>
            </Animated.View>
            <Text
              style={[
                styles.label,
                selected && { color: f.color, fontWeight: '700' },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  col: { alignItems: 'center', flex: 1 },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 7,
  },
  emoji: { fontSize: 28, lineHeight: 33 },
  label: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
});
