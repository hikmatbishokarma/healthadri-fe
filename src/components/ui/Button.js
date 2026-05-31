import { memo } from 'react';
import { Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, fontSizes, fontWeights } from '../../theme';

// Reusable button with variants and a built-in loading state, so screens stop
// re-implementing styled TouchableOpacity + spinner over and over.
//
//   <Button title="Save" onPress={onSave} loading={saving} />
//   <Button title="Cancel" variant="secondary" onPress={onClose} />
//   <Button title="Delete" variant="danger" onPress={onDelete} />

const VARIANT_STYLES = {
  primary: { container: { backgroundColor: colors.primary }, label: { color: colors.textOnPrimary } },
  secondary: {
    container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    label: { color: colors.textPrimary },
  },
  danger: { container: { backgroundColor: colors.danger }, label: { color: colors.textOnPrimary } },
  ghost: { container: { backgroundColor: colors.transparent }, label: { color: colors.primary } },
};

const SIZE_STYLES = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: fontSizes.sm },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontSize: fontSizes.body },
  lg: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl, fontSize: fontSizes.md },
};

function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}) {
  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  const s = SIZE_STYLES[size] ?? SIZE_STYLES.md;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
      style={[
        styles.base,
        { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
        v.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.label.color} />
      ) : (
        <Text style={[styles.label, { fontSize: s.fontSize }, v.label, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  label: { fontWeight: fontWeights.semibold },
});

export default memo(Button);
