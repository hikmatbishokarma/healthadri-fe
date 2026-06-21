import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/api';
import Illustration from '../components/Illustration';
import { colors } from '../theme/colors';

const C = {
  primary: colors.primary,
  primaryLight: colors.primaryTint,
  text: '#0F172A',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  error: '#EF4444',
  warning: '#D97706',
  success: '#16A34A',
};

export default function CaregiverScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const [removing, setRemoving] = useState(false);

  const hasCaregiver = !!user?.caregiverName;
  const isConnected = !!user?.caregiverConnected;

  const caregiverInitials = user?.caregiverName
    ? user.caregiverName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '';

  const handleRemove = () => {
    Alert.alert(
      'Remove Caregiver',
      `Are you sure you want to remove ${user?.caregiverName || 'your caregiver'}? They will lose access to your care information.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await updateProfile({ caregiverName: '', caregiverRelationship: '', caregiverPhone: '' });
              await refresh();
            } catch {
              Alert.alert('Error', 'Could not remove caregiver. Please try again.');
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.headerBack}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Caregiver</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

          {!hasCaregiver ? (
            // ── Empty state ──────────────────────────────────────────────────
            <View style={s.emptyWrap}>
              <Illustration name="caregiver_empty" size={180} style={s.illustration} />

              <Text style={s.emptyTitle}>No Caregiver Added</Text>
              <Text style={s.emptyText}>
                Add a caregiver to share updates, appointments and important health information.
              </Text>

              <TouchableOpacity
                style={s.addBtn}
                onPress={() => navigation.navigate('AddCaregiver')}
                activeOpacity={0.88}
              >
                <Text style={s.addBtnText}>Add Caregiver</Text>
              </TouchableOpacity>
            </View>

          ) : (
            // ── Caregiver added ──────────────────────────────────────────────
            <>
              {/* Caregiver card */}
              <View style={s.caregiverCard}>
                <View style={s.caregiverAvatar}>
                  <Text style={s.caregiverAvatarText}>{caregiverInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.caregiverName}>{user.caregiverName}</Text>
                  <Text style={s.caregiverRelationship}>{user.caregiverRelationship}</Text>
                  <View style={[s.statusPill, isConnected && s.statusPillConnected]}>
                    <View style={[s.statusDot, isConnected && s.statusDotConnected]} />
                    <Text style={[s.statusText, isConnected && s.statusTextConnected]}>
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Options */}
              <View style={s.menuCard}>
                <TouchableOpacity
                  style={s.menuRow}
                  onPress={() => navigation.navigate('AddCaregiver', { editMode: true })}
                  activeOpacity={0.7}
                >
                  <View style={s.menuIconBox}>
                    <Ionicons name="people-outline" size={18} color={C.textSub} />
                  </View>
                  <Text style={s.menuText}>Caregiver Details</Text>
                  <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                </TouchableOpacity>

                <View style={s.menuDivider} />

                <TouchableOpacity
                  style={s.menuRow}
                  onPress={() => navigation.navigate('ConnectCaregiver')}
                  activeOpacity={0.7}
                >
                  <View style={s.menuIconBox}>
                    <Ionicons name="link-outline" size={18} color={C.textSub} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.menuText}>Connect Caregiver</Text>
                    <Text style={s.menuSub}>Generate invite to give access</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Remove */}
              <TouchableOpacity style={s.removeRow} onPress={handleRemove} disabled={removing} activeOpacity={0.7}>
                {removing
                  ? <ActivityIndicator size="small" color={C.error} />
                  : <Text style={s.removeText}>Remove Caregiver</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  illustration: { marginBottom: 28 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  addBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  // Caregiver card
  caregiverCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 16,
    borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1.5, borderColor: C.border,
  },
  caregiverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  caregiverAvatarText: { fontSize: 16, fontWeight: '700', color: C.primary },
  caregiverName: { fontSize: 15, fontWeight: '700', color: C.text },
  caregiverRelationship: { fontSize: 13, color: C.textSub, marginTop: 2, marginBottom: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statusPillConnected: { backgroundColor: '#DCFCE7' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.warning },
  statusDotConnected: { backgroundColor: C.success },
  statusText: { fontSize: 12, fontWeight: '600', color: C.warning },
  statusTextConnected: { color: C.success },

  // Menu card
  menuCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16,
    borderRadius: 16, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuDivider: { height: 1, backgroundColor: C.border, marginLeft: 64 },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  menuText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  menuSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  // Remove
  removeRow: { alignItems: 'center', marginTop: 32, paddingVertical: 12 },
  removeText: { fontSize: 15, color: C.error, fontWeight: '600' },
});
