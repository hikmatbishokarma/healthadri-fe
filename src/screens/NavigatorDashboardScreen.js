import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { getNavigatorDashboard, getNavigatorDrafts } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SEVERITY_COLORS = {
  HIGH: { bg: '#FEE2E2', fg: '#DC2626' },
  MED: { bg: '#FEF3C7', fg: '#B45309' },
  LOW: { bg: '#DCFCE7', fg: '#15803D' },
};

const AVATAR_TINTS = [
  { bg: '#E2E8F0', emoji: '👤' },
  { bg: '#FCE7F3', emoji: '👩' },
  { bg: '#FEF3C7', emoji: '🙂' },
  { bg: '#DCFCE7', emoji: '👩' },
];

function avatarFor(item, idx) {
  if (item.gender === 'female') return { bg: '#FCE7F3', emoji: '👩' };
  if (item.gender === 'male') return { bg: '#E2E8F0', emoji: '👤' };
  return AVATAR_TINTS[idx % AVATAR_TINTS.length];
}

export default function NavigatorDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [summary, setSummary] = useState({
    activePatients: 0,
    highPriorityToday: 0,
    actionsPending: 0,
  });
  const [priorityText, setPriorityText] = useState('');
  const [items, setItems] = useState([]);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [dashRes, draftsRes] = await Promise.all([
        getNavigatorDashboard(user._id),
        getNavigatorDrafts(user._id),
      ]);
      const data = dashRes.data || {};
      setSummary(
        data.summary || { activePatients: 0, highPriorityToday: 0, actionsPending: 0 },
      );
      setPriorityText(data.priorityQueueText || '');
      setItems(Array.isArray(data.patients) ? data.patients : []);
      setDraftCount(Array.isArray(draftsRes.data) ? draftsRes.data.length : 0);
    } catch (err) {
      setItems([]);
      setDraftCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1A6B5A" />
      </View>
    );
  }

  const openPatient = (item) => {
    navigation.navigate('PlaybookActive', {
      patientId: item._id || item.patientId,
      patientName: item.name,
    });
  };

  const topPatient = items[0];

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Navigator Dashboard</Text>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          <TouchableOpacity style={styles.bell} onPress={signOut}>
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsRow}>
          <StatCard value={summary.activePatients} label="Active Patients" color="#15803D" />
          <StatCard value={summary.highPriorityToday} label="High Acuity Today" color="#DC2626" />
          <StatCard value={summary.actionsPending} label="Actions Pending" color="#E8860A" />
        </View>

        <TouchableOpacity
          style={styles.aiCard}
          activeOpacity={0.85}
          onPress={() => topPatient && openPatient(topPatient)}
        >
          <View style={styles.aiCardRow}>
            <Text style={styles.aiBot}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiCardTitle}>AI Priority Queue — Today</Text>
              <Text style={styles.aiCardBody}>
                {priorityText || 'No active playbooks today.'}
              </Text>
              {topPatient ? (
                <View style={styles.aiPill}>
                  <Text style={styles.aiPillText}>View All Playbooks →</Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>

        {draftCount > 0 ? (
          <TouchableOpacity
            style={styles.draftsBanner}
            onPress={() => navigation.navigate('DraftsList')}
            activeOpacity={0.85}
          >
            <Text style={styles.draftsBannerIcon}>📝</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.draftsBannerTitle}>
                {draftCount} draft{draftCount === 1 ? '' : 's'} to review
              </Text>
              <Text style={styles.draftsBannerSubtitle}>
                Verify AI-extracted reminders before publishing to patients
              </Text>
            </View>
            <Text style={styles.draftsBannerChevron}>›</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionLabel}>HIGH PRIORITY PATIENTS</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No patient alerts right now.</Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <PatientRow
              key={item._id || item.patientId || idx}
              item={item}
              idx={idx}
              onPress={() => openPatient(item)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ value, label, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PatientRow({ item, idx, onPress }) {
  const name = item.name || 'Patient';
  const cancerType = item.cancerType || '—';
  const stage = item.stage || item.cancerStage || '';
  const severity = item.severity || 'LOW';
  const reason = item.reason || '';
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.LOW;
  const av = avatarFor(item, idx);

  const subtitleParts = [cancerType];
  if (stage) subtitleParts.push(stage);
  if (reason) subtitleParts.push(reason);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.avatar, { backgroundColor: av.bg }]}>
        <Text style={styles.avatarEmoji}>{av.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.patientName}>{name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {subtitleParts.join(' · ')}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: colors.bg }]}>
        <Text style={[styles.badgeText, { color: colors.fg }]}>{severity}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBox: { padding: 16, backgroundColor: '#1E3A5F' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 18 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },

  aiCard: {
    backgroundColor: '#6D5BD0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  aiCardRow: { flexDirection: 'row', gap: 10 },
  aiBot: { fontSize: 22 },
  aiCardTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 6 },
  aiCardBody: { color: 'rgba(255,255,255,0.92)', fontSize: 12, lineHeight: 17 },
  aiPill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
  },
  aiPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
  },

  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  patientName: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  draftsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  draftsBannerIcon: { fontSize: 22 },
  draftsBannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  draftsBannerSubtitle: { fontSize: 11, color: '#78350F', marginTop: 2, lineHeight: 15 },
  draftsBannerChevron: { fontSize: 22, color: '#92400E', fontWeight: '300' },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
