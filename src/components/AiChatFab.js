import { Image, TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const BOT_ICON = require('../../assets/bot-icon.png');

// Single source of truth for the fab's own footprint, so any screen that
// needs to reserve scroll space for it (see PatientDashboardScreen,
// CareTeamScreen, MedicalRecordsScreen, ProfileScreen) can't drift out of
// sync with the actual rendered size like the old hardcoded paddingBottom did.
export const FAB_SIZE = 64;
export const FAB_BOTTOM_MARGIN = 16;
// How far above BottomNav the fab sits on every screen that docks it
// (PatientDashboard, CareTeam, MedicalRecords, Profile — see AppNavigator's
// TABBED_ROUTES). BottomNav is a real layout sibling with its own height, so
// this only needs to clear the bar itself — screens must NOT add this on top
// of FAB_TABBED_CLEARANCE below, or the fab's own footprint gets reserved
// twice (once for the lift, once for the button) and eats a huge dead strip
// out of the content above it.
export const FAB_TABBED_LIFT = 72;
// Vertical space the fab's own button occupies above wherever it's anchored
// — screens reserve exactly this much (not the lift too) so the button
// can't land on their last visible content, without over-reserving.
export const FAB_TABBED_CLEARANCE = FAB_SIZE + FAB_BOTTOM_MARGIN;

export default function AiChatFab({ onPress, extraBottom = 0 }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: FAB_BOTTOM_MARGIN + (insets.bottom || 0) + extraBottom }]}
    >
      <TouchableOpacity
        onPress={onPress}
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open AI medical explainer"
      >
        {/* backgroundColor is the fallback face while the icon loads (or if it
            ever fails to) — without it a slow/broken image reads as a bare
            white disc instead of a branded button. */}
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
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 10 },
      web: { boxShadow: `0 4px 20px ${colors.primaryShadowStrong}` },
    }),
  },
  icon: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
  },
});
