import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, fontWeights } from '../../../theme';
import Button from '../Button';

// Friendly placeholder when a list/section has no data.
//
//   <EmptyState title="No reminders yet"
//               message="Your care team hasn't added any."
//               icon={<SomeIcon />}
//               actionLabel="Refresh" onAction={reload} />
export default function EmptyState({ title, message, icon, actionLabel, onAction, style }) {
  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" size="sm" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: { marginBottom: spacing.md },
  title: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
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
