import { Image, TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BOT_ICON = require('../../assets/bot-icon.png');

export default function AiChatFab({ onPress, extraBottom = 0 }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: 16 + (insets.bottom || 0) + extraBottom }]}
    >
      <TouchableOpacity
        onPress={onPress}
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open AI medical explainer"
      >
        <Image source={BOT_ICON} style={styles.icon} resizeMode="cover" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A6B5A',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 10 },
      web: { boxShadow: '0 4px 20px rgba(26,107,90,0.3)' },
    }),
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});
