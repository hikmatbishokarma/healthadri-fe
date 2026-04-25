import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Wong-Baker FACES inspired: 5 faces map to numeric values 0/3/5/7/10
// so triage thresholds (>=7 high, >=4 med) keep working server-side.
export const FACES = [
  { value: 0,  emoji: '😄', label: 'None' },
  { value: 3,  emoji: '🙂', label: 'A little' },
  { value: 5,  emoji: '😐', label: 'Some' },
  { value: 7,  emoji: '😞', label: 'A lot' },
  { value: 10, emoji: '😣', label: 'Severe' },
];

// Pick the closest face for a stored numeric value (so old data still renders)
export function faceForValue(v) {
  let best = FACES[0];
  let bestDiff = Math.abs(FACES[0].value - v);
  for (const f of FACES) {
    const d = Math.abs(f.value - v);
    if (d < bestDiff) {
      best = f;
      bestDiff = d;
    }
  }
  return best;
}

const C = {
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
  selected: '#1A6B5A',
  selectedBg: '#E8F5F1',
};

export default function FaceScale({ value, onChange, size = 'normal' }) {
  const isBig = size === 'big';
  return (
    <View style={styles.row}>
      {FACES.map((f) => {
        const selected = f.value === value;
        return (
          <TouchableOpacity
            key={f.value}
            onPress={() => onChange(f.value)}
            style={[
              styles.face,
              isBig && styles.faceBig,
              selected && styles.faceSelected,
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.emoji, isBig && styles.emojiBig]}>
              {f.emoji}
            </Text>
            <Text
              style={[
                styles.label,
                isBig && styles.labelBig,
                selected && styles.labelSelected,
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
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  face: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 10,
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  faceBig: { paddingVertical: 14, gap: 6, borderRadius: 14 },
  faceSelected: {
    backgroundColor: C.selectedBg,
    borderColor: C.selected,
  },
  emoji: { fontSize: 30, lineHeight: 36 },
  emojiBig: { fontSize: 44, lineHeight: 52 },
  label: { fontSize: 9, color: C.muted, fontWeight: '600', textAlign: 'center' },
  labelBig: { fontSize: 11 },
  labelSelected: { color: C.selected, fontWeight: '700' },
});
