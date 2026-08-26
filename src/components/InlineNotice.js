import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Calm, inline replacement for Alert.alert on validation/error messages —
// same tokens SymptomScreen.js's original errorBanner used, centralized so
// screens don't each reinvent it. Renders nothing when there's no message.
export default function InlineNotice({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle-outline" size={15} color={colors.danger} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.retry}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: '#EDD2CE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  icon: { flexShrink: 0 },
  text: { flex: 1, color: colors.danger, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  retry: { color: colors.danger, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline', marginLeft: 4 },
});
