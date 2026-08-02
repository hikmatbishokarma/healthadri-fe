import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

const C = {
  text: colors.textBody,
  muted: colors.textSecondary,
  border: colors.border,
  selected: colors.primary,
  selectedBg: colors.primaryTint,
};

export default function ChipSelect({ value, options, onChange }) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        const selected = value === optValue;
        return (
          <TouchableOpacity
            key={optValue}
            onPress={() => onChange(optValue)}
            activeOpacity={0.7}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text
              style={[styles.chipText, selected && styles.chipTextSelected]}
            >
              {optLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: colors.white,
  },
  chipSelected: {
    backgroundColor: C.selectedBg,
    borderColor: C.selected,
  },
  chipText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  chipTextSelected: { color: C.selected, fontWeight: '700' },
});
