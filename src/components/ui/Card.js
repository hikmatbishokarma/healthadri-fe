import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadows } from '../../theme';

// A surface container with consistent padding, radius, and elevation.
//
//   <Card><Text>...</Text></Card>
//   <Card elevation="md" padded={false}>...</Card>

function Card({ children, style, elevation = 'sm', padded = true }) {
  return (
    <View style={[styles.card, padded && styles.padded, shadows[elevation] ?? shadows.sm, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  padded: { padding: spacing.md },
});

export default memo(Card);
