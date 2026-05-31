import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, fontWeights } from '../../../theme';
import Button from '../Button';

// Error placeholder with an optional retry. Pair with err.userMessage from the
// API layer so patients never see a raw backend error.
//
//   <ErrorState message={err.userMessage} onRetry={reload} />
export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  retryLabel = 'Try again',
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? (
        <Button title={retryLabel} variant="secondary" size="sm" onPress={onRetry} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.danger,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.xs,
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  action: { marginTop: spacing.lg },
});
