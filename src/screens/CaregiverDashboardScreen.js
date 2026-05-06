import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCaregiverPatient } from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = {
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  tealPale: '#E8F5F1',
  saffron: '#E8860A',
  saffronDark: '#A85A00',
  saffronPale: '#FFF3E0',
  amber: '#F59E0B',
  amberPale: '#FFFBEB',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
  red: '#E53935',
  redPale: '#FEE2E2',
  green: '#22C55E',
  greenPale: '#DCFCE7',
};

function acuityColor(score) {
  if (score >= 7) return C.red;
  if (score >= 4) return C.saffron;
  return C.green;
}

function acuityLabel(score) {
  if (score >= 7) return 'High';
  if (score >= 4) return 'Moderate';
  return 'Low';
}

function moodEmoji(val) {
  const map = { great: '😄', good: '🙂', neutral: '😐', bad: '😔', terrible: '😢' };
  return map[val?.toLowerCase()] ?? '😐';
}

function fatigueEmoji(val) {
  const map = { none: '💪', mild: '🙂', moderate: '😐', high: '😴', severe: '😩' };
  return map[val?.toLowerCase()] ?? '😐';
}

export default function CaregiverDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getCaregiverPatient();
      setData(res.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load patient data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  const { patient, navigator, latestEntry, recentAlerts } = data ?? {};
  const mood = latestEntry?.responses?.find(r => r.symptomName?.toLowerCase().includes('mood'));
  const fatigue = latestEntry?.responses?.find(r => r.symptomName?.toLowerCase().includes('fatigue'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.saffronDark} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Caregiver View</Text>
          <Text style={styles.headerName}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Sign out?', '', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: signOut },
        ])}>
          <Text style={styles.headerAction}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
      >
        {/* Supporting banner */}
        <View style={styles.supportBanner}>
          <Text style={styles.supportEmoji}>🤲</Text>
          <View style={styles.supportText}>
            <Text style={styles.supportTitle}>You are supporting {patient?.name}</Text>
            <Text style={styles.supportSub}>
              {[patient?.cancerType, patient?.cancerStage].filter(Boolean).join(' · ')}
              {navigator ? ` · Navigator: ${navigator.name}` : ''}
            </Text>
          </View>
        </View>

        {/* Status today */}
        <Text style={styles.sectionTitle}>{patient?.name?.split(' ')[0]?.toUpperCase()}'S STATUS TODAY</Text>

        <View style={styles.card}>
          <View style={styles.acuityRow}>
            <View style={styles.acuityDot} />
            <Text style={styles.acuityLabel}>Today's Acuity Score</Text>
            <Text style={[styles.acuityScore, { color: acuityColor(patient?.acuityScore ?? 0) }]}>
              {(patient?.acuityScore ?? 0).toFixed(1)} — {acuityLabel(patient?.acuityScore ?? 0)}
            </Text>
          </View>

          {latestEntry ? (
            <View style={styles.statusGrid}>
              <View style={[styles.statusTile, { backgroundColor: C.tealPale }]}>
                <Text style={styles.tileEmoji}>{moodEmoji(mood?.value)}</Text>
                <Text style={[styles.tileLabel, { color: C.teal }]}>
                  Mood: {mood?.value ?? 'N/A'}
                </Text>
              </View>
              <View style={[styles.statusTile, { backgroundColor: C.amberPale }]}>
                <Text style={styles.tileEmoji}>{fatigueEmoji(fatigue?.value)}</Text>
                <Text style={[styles.tileLabel, { color: C.saffron }]}>
                  Fatigue: {fatigue?.value ?? 'N/A'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noEntry}>No check-in today yet</Text>
          )}
        </View>

        {/* Alerts */}
        {recentAlerts?.length > 0 && recentAlerts.map((alert) => (
          <View key={alert._id} style={styles.alertCard}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <View style={styles.alertText}>
              <Text style={styles.alertTitle}>{alert.message}</Text>
              <Text style={styles.alertSub}>{alert.severity} priority</Text>
            </View>
          </View>
        ))}

        {/* Caregiver resources */}
        <Text style={styles.sectionTitle}>CAREGIVER RESOURCES</Text>

        <TouchableOpacity style={styles.resourceCard}>
          <Text style={styles.resourceTitle}>🤝 How to Support During Treatment</Text>
          <Text style={styles.resourceDesc}>
            A practical guide for caregivers — in Telugu, English and Hindi
          </Text>
        </TouchableOpacity>

        {navigator && (
          <View style={styles.resourceCard}>
            <Text style={styles.resourceTitle}>💬 Talk to {navigator.name} (Navigator)</Text>
            <Text style={styles.resourceDesc}>
              You can message the care team directly with any questions or concerns
            </Text>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => navigation.navigate('Chat', {
                userId: user?._id,
                withUserId: navigator._id,
                name: navigator.name,
              })}
            >
              <Text style={styles.messageButtonText}>Message Navigator</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.resourceCard}>
          <Text style={styles.resourceTitle}>🧠 Caregiver Wellbeing Check</Text>
          <Text style={styles.resourceDesc}>
            Caring for someone with cancer is hard. How are YOU doing today?
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.saffronDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header: {
    backgroundColor: C.saffronDark,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  headerName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 },
  headerAction: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  supportBanner: {
    backgroundColor: C.saffron,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  supportEmoji: { fontSize: 28 },
  supportText: { flex: 1 },
  supportTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  supportSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  acuityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  acuityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.amber,
  },
  acuityLabel: { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  acuityScore: { fontSize: 14, fontWeight: '700' },
  statusGrid: { flexDirection: 'row', gap: 10 },
  statusTile: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  tileEmoji: { fontSize: 24 },
  tileLabel: { fontSize: 13, fontWeight: '600' },
  noEntry: { color: C.muted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  alertCard: {
    backgroundColor: C.amberPale,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
  },
  alertIcon: { fontSize: 18, marginTop: 1 },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  alertSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  resourceCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  resourceTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  resourceDesc: { fontSize: 13, color: C.muted, lineHeight: 18 },
  messageButton: {
    backgroundColor: C.saffron,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  messageButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
