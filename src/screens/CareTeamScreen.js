import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Illustration from '../components/Illustration';
import BottomNav from '../components/BottomNav';
import { getUserById, getHospitalById } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  tealPale: colors.primaryTint,
  bg: colors.background,
  card: colors.white,
  text: colors.textBody,
  muted: colors.textSecondary,
  border: colors.border,
};

function initialsOf(name) {
  return (name || '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function callNumber(phone) {
  if (!phone) return;
  Linking.openURL(`tel:+91${phone}`).catch(() =>
    Alert.alert('Could not place call', 'Please try again.'),
  );
}

export default function CareTeamScreen({ navigation }) {
  const { user } = useAuth();
  const [navigatorUser, setNavigatorUser] = useState(null);
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [navRes, hospRes] = await Promise.all([
        user?.assignedNavigatorId
          ? getUserById(user.assignedNavigatorId).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
        user?.hospitalId
          ? getHospitalById(user.hospitalId).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);
      setNavigatorUser(navRes.data);
      setHospital(hospRes.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.assignedNavigatorId, user?.hospitalId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const openChat = (withUserId, name) => {
    navigation.navigate('Chat', { withUserId, name });
  };

  const hasCaregiver = !!user?.caregiverName;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.navigate('PatientDashboard')} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Care Team</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
        >
          {/* ── Card 1: Care Guide ── */}
          <Text style={s.sectionLabel}>YOUR CARE GUIDE</Text>
          {navigatorUser ? (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initialsOf(navigatorUser.name)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.name}>{navigatorUser.name}</Text>
                  <Text style={s.role}>Care Guide</Text>
                </View>
              </View>
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => openChat(navigatorUser._id, navigatorUser.name)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={C.teal} />
                  <Text style={s.actionText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, !navigatorUser.phone && s.actionBtnDisabled]}
                  onPress={() => callNumber(navigatorUser.phone)}
                  disabled={!navigatorUser.phone}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={16} color={navigatorUser.phone ? C.teal : C.muted} />
                  <Text style={[s.actionText, !navigatorUser.phone && s.actionTextDisabled]}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No care guide assigned yet.</Text>
            </View>
          )}

          {/* ── Card 2: Caregiver ── */}
          <Text style={s.sectionLabel}>YOUR CAREGIVER</Text>
          {hasCaregiver ? (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initialsOf(user.caregiverName)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.name}>{user.caregiverName}</Text>
                  <Text style={s.role}>{user.caregiverRelationship || 'Caregiver'}</Text>
                </View>
              </View>
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => openChat(user?.assignedNavigatorId, 'Care Team')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={C.teal} />
                  <Text style={s.actionText}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, !user.caregiverPhone && s.actionBtnDisabled]}
                  onPress={() => callNumber(user.caregiverPhone)}
                  disabled={!user.caregiverPhone}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={16} color={user.caregiverPhone ? C.teal : C.muted} />
                  <Text style={[s.actionText, !user.caregiverPhone && s.actionTextDisabled]}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Illustration name="caregiver_empty" size={100} />
              <Text style={s.emptyTitle}>No caregiver added</Text>
              <TouchableOpacity
                style={s.addBtn}
                onPress={() => navigation.navigate('AddCaregiver')}
                activeOpacity={0.85}
              >
                <Text style={s.addBtnText}>Add Caregiver</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Card 3: Hospital ── */}
          <Text style={s.sectionLabel}>YOUR HOSPITAL</Text>
          {user?.hospitalId ? (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={[s.avatar, s.avatarSquare]}>
                  <Ionicons name="business" size={22} color={colors.white} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.name}>{hospital?.name || user.hospitalName}</Text>
                  {hospital?.city ? <Text style={s.role}>{hospital.city}</Text> : null}
                </View>
              </View>
              {hospital ? (
                <TouchableOpacity
                  style={s.viewDetailsBtn}
                  onPress={() => navigation.navigate('HospitalDetail', { hospitalId: user.hospitalId })}
                  activeOpacity={0.8}
                >
                  <Text style={s.viewDetailsText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.teal} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : user?.hospitalName ? (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={[s.avatar, s.avatarSquare]}>
                  <Ionicons name="business" size={22} color={colors.white} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.name}>{user.hospitalName}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Illustration name="hospital_empty" size={100} />
              <Text style={s.emptyTitle}>No hospital added yet</Text>
            </View>
          )}
        </ScrollView>
      )}

      <BottomNav active="CareTeam" navigation={navigation} />
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.teal,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700', flex: 1 },

  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center',
  },
  avatarSquare: { borderRadius: 12 },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  role: { fontSize: 12, color: C.muted, marginTop: 2 },

  actionRow: {
    flexDirection: 'row', gap: 10, marginTop: 14,
    borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.tealPale,
  },
  actionBtnDisabled: { backgroundColor: colors.surfaceSubtle },
  actionText: { fontSize: 13, fontWeight: '700', color: C.teal },
  actionTextDisabled: { color: C.muted },

  viewDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12,
  },
  viewDetailsText: { fontSize: 13, fontWeight: '700', color: C.teal },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginTop: 8, marginBottom: 12 },
  emptyText: { fontSize: 13, color: C.muted },
  addBtn: {
    backgroundColor: C.teal, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  addBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
