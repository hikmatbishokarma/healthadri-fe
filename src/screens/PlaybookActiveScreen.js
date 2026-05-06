import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { getNavigatorPlaybookRun } from '../services/api';

const SEVERITY_PILL = {
  HIGH: { bg: '#FEE2E2', fg: '#DC2626' },
  MED: { bg: '#FEF3C7', fg: '#B45309' },
  LOW: { bg: '#DCFCE7', fg: '#15803D' },
};

function formatTime(d) {
  if (!d) return '';
  const date = new Date(d);
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function iconForType(type) {
  if (!type) return '📋';
  if (type.includes('FEVER')) return '💊';
  if (type.includes('FATIGUE')) return '🤖';
  if (type.includes('PAIN')) return '⚠️';
  if (type.includes('MISSED')) return '📅';
  return '📋';
}

export default function PlaybookActiveScreen({ route, navigation }) {
  const { patientId } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualChecked, setManualChecked] = useState({});

  const fetch = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await getNavigatorPlaybookRun(patientId);
      setData(res.data);
    } catch (err) {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const onRefresh = () => {
    setRefreshing(true);
    fetch();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1A6B5A" />
      </View>
    );
  }

  if (!data || !data.alert || !data.playbook) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBox}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>AI Playbook Active</Text>
              <Text style={styles.title}>{data?.patient?.name || 'Patient'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.center}>
          <Text style={styles.empty}>No active playbook for this patient.</Text>
        </View>
      </View>
    );
  }

  const { patient, alert, playbook, otherActive } = data;
  const autoDone = playbook.autoCompletedCount || 0;
  const triggeredAt = formatTime(alert.createdAt);
  const headerSubtitle = playbook.title.replace(' Protocol', '');

  const callPatient = () => {
    if (patient?.phone) {
      Linking.openURL(`tel:${patient.phone}`);
    } else {
      Alert.alert('No phone number', 'Patient phone is not available.');
    }
  };

  const escalate = () => {
    Alert.alert(
      'Escalation sent',
      'Dr. Anand Rao has been notified. They will reach out shortly.',
    );
  };

  const toggleManual = (idx) => {
    if (idx < autoDone) return;
    setManualChecked((s) => ({ ...s, [idx]: !s[idx] }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>AI Playbook Active</Text>
            <Text style={styles.title}>
              {patient.name} — {headerSubtitle}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.protocolCard}>
          <View style={styles.protocolHeader}>
            <Text style={styles.protocolTitle}>
              {iconForType(alert.type)} {playbook.title}
            </Text>
            <View style={styles.protocolPill}>
              <Text style={styles.protocolPillText}>
                AI Triggered · {triggeredAt}
              </Text>
            </View>
          </View>

          {playbook.steps.map((step, idx) => {
            const auto = idx < autoDone;
            const checked = auto || !!manualChecked[idx];
            return (
              <TouchableOpacity
                key={idx}
                style={styles.stepRow}
                activeOpacity={auto ? 1 : 0.6}
                onPress={() => toggleManual(idx)}
              >
                <View
                  style={[
                    styles.stepBadge,
                    checked ? styles.stepBadgeDone : styles.stepBadgePending,
                  ]}
                >
                  <Text
                    style={
                      checked ? styles.stepBadgeDoneText : styles.stepBadgePendingText
                    }
                  >
                    {checked ? '✓' : idx + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepText,
                    checked && styles.stepTextDone,
                  ]}
                >
                  {step}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.escalateCard}>
          <Text style={styles.escalateIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.escalateTitle}>Escalation Trigger Ready</Text>
            <Text style={styles.escalateBody}>
              If patient confirms pain {'>'}8/10 on call, one-tap escalation to Dr.
              Anand Rao is available below.
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.callBtn} onPress={callPatient}>
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.actionLabel}>Call Patient</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.escalateBtn} onPress={escalate}>
            <Text style={styles.actionIcon}>🚨</Text>
            <Text style={styles.actionLabel}>Escalate to Doctor</Text>
          </TouchableOpacity>
        </View>

        {otherActive && otherActive.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>OTHER ACTIVE PLAYBOOKS</Text>
            {otherActive.map((o, idx) => (
              <TouchableOpacity
                key={`${o.patientId}-${idx}`}
                style={styles.otherRow}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.replace('PlaybookActive', {
                    patientId: o.patientId,
                    patientName: o.patientName,
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.otherTitle}>
                    {iconForType(o.type)} {o.title} — {o.patientName}
                  </Text>
                  <Text style={styles.otherMeta}>
                    {o.triggeredAt ? `Triggered ${formatTime(o.triggeredAt)} · ` : ''}
                    Step {o.stepIndex}/{o.stepTotal}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        (SEVERITY_PILL[o.severity] || SEVERITY_PILL.LOW).bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: (SEVERITY_PILL[o.severity] || SEVERITY_PILL.LOW).fg },
                    ]}
                  >
                    {o.severity}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerBox: { padding: 16, backgroundColor: '#1E3A5F' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  empty: { fontSize: 13, color: '#64748B' },

  protocolCard: {
    backgroundColor: '#1F6B5A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  protocolTitle: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
  protocolPill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  protocolPillText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeDone: { backgroundColor: '#22C55E' },
  stepBadgePending: { backgroundColor: 'rgba(255,255,255,0.2)' },
  stepBadgeDoneText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepBadgePendingText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, color: '#fff', fontSize: 13, lineHeight: 18 },
  stepTextDone: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.5)',
  },

  escalateCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  escalateIcon: { fontSize: 18 },
  escalateTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B', marginBottom: 4 },
  escalateBody: { fontSize: 12, color: '#7F1D1D', lineHeight: 17 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  callBtn: {
    flex: 1,
    backgroundColor: '#1F6B5A',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  escalateBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionIcon: { fontSize: 18, color: '#fff' },
  actionLabel: { color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  otherRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otherTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  otherMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
