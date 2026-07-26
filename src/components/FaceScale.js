import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';

// Wong-Baker FACES inspired: 5 faces map to numeric values 0/3/5/7/10
// so triage thresholds (>=7 high, >=4 med) keep working server-side.
export const FACES = [
  { value: 0,  icon: 'happy',                 label: 'None',     color: '#16A34A', bg: '#EAF9F0' },
  { value: 3,  icon: 'happy-outline',         label: 'A little', color: '#65A30D', bg: '#F4FAEA' },
  { value: 5,  icon: 'remove-circle-outline', label: 'Some',     color: '#D97706', bg: '#FDF3E3' },
  { value: 7,  icon: 'sad-outline',           label: 'A lot',    color: '#DC2626', bg: '#FCEAEA' },
  { value: 10, icon: 'sad',                   label: 'Severe',   color: '#7F1D1D', bg: '#F9E9E9' },
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
        toValue: f.value === value ? 1.05 : 1,
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
            activeOpacity={0.8}
            style={styles.col}
          >
            <Animated.View
              style={[
                styles.card,
                selected && {
                  backgroundColor: f.bg,
                  borderColor: f.color,
                  shadowColor: f.color,
                  shadowOpacity: 0.22,
                  elevation: 4,
                },
                { transform: [{ scale: scales[i] }] },
              ]}
            >
              <Ionicons name={f.icon} size={24} color={selected ? f.color : colors.textMuted} />
              <Text
                style={[
                  styles.label,
                  selected && { color: f.color, fontWeight: '700' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {f.label}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: { flex: 1, outlineStyle: 'none' },
  card: {
    minHeight: 84,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
