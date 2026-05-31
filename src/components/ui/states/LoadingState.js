import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '../../../theme';

// Full-area loading indicator for screens/sections while data is fetching.
export default function LoadingState({ message, color = colors.primary, style }) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={color} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  message: { marginTop: spacing.md, fontSize: fontSizes.body, color: colors.textSecondary },
});
