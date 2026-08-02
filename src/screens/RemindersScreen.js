import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Illustration from '../components/Illustration';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPatientReminders,
  getCareReminders,
  respondReminder,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  tealPale: colors.primaryTint,
  purple: colors.accentViolet,
  purplePale: '#F5F3FF',
  blue: colors.accentBlue,
  bluePale: colors.accentBlueTint,
  amber: colors.warning,
  amberPale: colors.warningTint,
  red: colors.danger,
  green: colors.successStrong,
  bg: colors.background,
  card: colors.white,
  text: colors.textBody,
  muted: colors.textSecondary,
  border: colors.border,
};

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const MED_DONE_STATUSES = ['TAKEN', 'PATIENT_CONFIRMED', 'CAREGIVER_CONFIRMED'];

const SKIP_REASONS = [
  { value: 'MED_NOT_NEAR', label: "Wasn't near my medicine" },
  { value: 'FORGOT_BUSY_ASLEEP', label: 'Forgot, was busy, or asleep' },
  { value: 'RAN_OUT', label: 'Ran out of medicine' },
  { value: 'DONT_NEED_DOSE', label: "Didn't feel I needed it" },
  { value: 'SIDE_EFFECTS', label: 'Side effects' },
  { value: 'WORRIED_COST', label: 'Worried about cost' },
  { value: 'OTHER', label: 'Other' },
];

export default function RemindersScreen({ navigation, embedded = false }) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [careReminders, setCareReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [skipTargetId, setSkipTargetId] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [rRes, cRes] = await Promise.all([
        getPatientReminders(user._id).catch(() => ({ data: [] })),
        getCareReminders(user._id).catch(() => ({ data: [] })),
      ]);
      setReminders(rRes.data || []);
      setCareReminders(cRes.data || []);
    } catch {
      setReminders([]);
      setCareReminders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  // ── Medications: grouped by calendar day, split upcoming / past ──
  const { medUpcoming, medPast } = useMemo(() => {
    const now = Date.now();
    const byDate = new Map();
    careReminders.forEach((r) => {
      const dateKey = new Date(r.scheduledAt).toLocaleDateString();
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey).push(r);
    });
    const groups = [];
    byDate.forEach((dayReminders, dateKey) => {
      const when = new Date(dayReminders[0].scheduledAt).getTime();
      const allDone = dayReminders.every((r) =>
        ['MISSED', 'CANCELLED'].includes(r.status) || MED_DONE_STATUSES.includes(r.response) || MED_DONE_STATUSES.includes(r.status),
      );
      groups.push({ date: dateKey, when, reminders: dayReminders, isPast: allDone || when < now - 24 * 60 * 60 * 1000 });
    });
    return {
      medUpcoming: groups.filter((g) => !g.isPast).sort((a, b) => a.when - b.when),
      medPast: groups.filter((g) => g.isPast).sort((a, b) => b.when - a.when),
    };
  }, [careReminders]);

  // ── Appointments & tests: navigator-verified visit/test tasks ──
  const { apptUpcoming, apptPast } = useMemo(() => {
    const now = Date.now();
    const items = reminders.map((r) => ({ when: new Date(r.date).getTime(), isPast: new Date(r.date).getTime() < now, data: r }));
    return {
      apptUpcoming: items.filter((i) => !i.isPast).sort((a, b) => a.when - b.when),
      apptPast: items.filter((i) => i.isPast).sort((a, b) => b.when - a.when),
    };
  }, [reminders]);

  const handleRespond = async (id, response, skipReason) => {
    try {
      await respondReminder(id, response, skipReason);
      fetchAll();
    } catch {
      Alert.alert('Error', 'Could not update reminder');
    }
  };

  const handleSkipReason = (reason) => {
    const id = skipTargetId;
    setSkipTargetId(null);
    if (id) handleRespond(id, 'SKIPPED', reason);
  };

  return (
    <View style={styles.container}>
      {!embedded && (
        <>
          <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
          <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color={colors.white} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>My Reminders</Text>
              <View style={{ width: 32 }} />
            </View>
          </SafeAreaView>
        </>
      )}

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* ── Medications ── */}
          <Text style={styles.sectionLabel}>Medications</Text>
          {medUpcoming.length === 0 && medPast.length === 0 ? (
            <View style={styles.emptyCard}>
              <Illustration name="medication_empty" size={140} style={styles.emptyIllustration} />
              <Text style={styles.emptyTitle}>No medications tracked yet</Text>
              <Text style={styles.emptyText}>
                Once your care plan includes medications, your daily doses will show up here.
              </Text>
            </View>
          ) : (
            <>
              {medUpcoming.map((g) => (
                <MedGroupCard key={`cg:${g.date}`} date={g.date} reminders={g.reminders} onTaken={(id) => handleRespond(id, 'TAKEN')} onSkip={(id) => setSkipTargetId(id)} />
              ))}
              {medPast.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 6 }]}>Past</Text>
                  {medPast.map((g) => (
                    <MedGroupCard key={`cg:${g.date}`} date={g.date} reminders={g.reminders} past />
                  ))}
                </>
              )}
            </>
          )}

          {/* ── Appointments & Tests ── */}
          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Appointments & Tests</Text>
          {apptUpcoming.length === 0 && apptPast.length === 0 ? (
            <View style={styles.emptyCard}>
              <Illustration name="appointment_empty" size={140} style={styles.emptyIllustration} />
              <Text style={styles.emptyTitle}>Nothing scheduled yet</Text>
              <Text style={styles.emptyText}>
                Your care team adds appointments and tests here once your prescriptions and reports have been reviewed.
              </Text>
            </View>
          ) : (
            <>
              {apptUpcoming.map((item) => (
                <ReminderCard key={`r:${item.data._id}`} reminder={item.data} />
              ))}
              {apptPast.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 6 }]}>Past</Text>
                  {apptPast.map((item) => (
                    <ReminderCard key={`r:${item.data._id}`} reminder={item.data} past />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      <SkipReasonModal
        visible={!!skipTargetId}
        onClose={() => setSkipTargetId(null)}
        onSelect={handleSkipReason}
      />
    </View>
  );
}

function ReminderCard({ reminder, past }) {
  const date = new Date(reminder.date);
  const day = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];
  const isVisit = reminder.type === 'visit';
  const accentColor = past ? C.muted : isVisit ? C.blue : C.amber;
  const accentPale = past ? colors.surfaceSubtle : isVisit ? C.bluePale : colors.warningTint;

  return (
    <View
      style={[
        styles.apptCard,
        { borderLeftColor: accentColor, opacity: past ? 0.65 : 1 },
      ]}
    >
      <View style={[styles.apptDate, { backgroundColor: accentPale }]}>
        <Text style={[styles.apptDay, { color: accentColor }]}>{day}</Text>
        <Text style={[styles.apptMon, { color: accentColor }]}>{mon}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.reminderRow}>
          <View style={[styles.reminderBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons name="alarm-outline" size={11} color={colors.accentViolet} />
            <Text style={styles.reminderBadgeText}>REMINDER</Text>
          </View>
          <Text style={[styles.reminderTypePill, { color: accentColor, backgroundColor: accentPale }]}>
            {isVisit ? 'VISIT' : 'TEST'}
          </Text>
        </View>
        <Text style={styles.apptTitle}>{reminder.title}</Text>
        <Text style={styles.apptMeta}>
          {past ? 'Was due' : 'Due'} {date.toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
}

function MedGroupCard({ date, reminders, onTaken, onSkip, past }) {
  const d = new Date(reminders[0].scheduledAt);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()];
  const doneCount = reminders.filter((r) => MED_DONE_STATUSES.includes(r.response) || MED_DONE_STATUSES.includes(r.status)).length;
  const total = reminders.length;
  const allDone = doneCount === total;

  const escalationLevel = reminders
    .map((r) => r.escalationLevel)
    .find((lvl) => lvl === 'NAVIGATOR') ||
    reminders.map((r) => r.escalationLevel).find((lvl) => lvl === 'CAREGIVER');

  return (
    <View style={[styles.medGroupCard, past && { opacity: 0.7 }]}>
      {/* Date header */}
      <View style={styles.medGroupHeader}>
        <View style={styles.medGroupDateBox}>
          <Text style={styles.medGroupDay}>{day}</Text>
          <Text style={styles.medGroupMon}>{mon}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.medGroupTitle}>Medications</Text>
          <Text style={styles.medGroupSub}>
            {allDone ? '✓ All taken' : `${doneCount}/${total} taken`}
          </Text>
        </View>
        <View style={[styles.medGroupPill, { backgroundColor: allDone ? colors.successTint : C.tealPale }]}>
          <Text style={[styles.medGroupPillText, { color: allDone ? C.green : C.teal }]}>
            {allDone ? 'Done' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Each medication row */}
      {reminders.map((r) => {
        const td = r.carePlanTaskId?.taskData || {};
        const isTaken   = MED_DONE_STATUSES.includes(r.response) || MED_DONE_STATUSES.includes(r.status);
        const isMissed  = r.status === 'MISSED';
        const isSkipped = r.response === 'SKIPPED' || r.status === 'SKIPPED';
        const timing = td.timing || '';

        return (
          <View key={r._id} style={styles.medRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.medRowName} numberOfLines={1}>{r.taskTitle}</Text>
              {timing ? <Text style={styles.medRowTiming}>{timing}</Text> : null}
              {td.dosage ? <Text style={styles.medRowTiming}>{td.dosage}</Text> : null}
            </View>
            {isTaken   && <Text style={[styles.medRowStatus, { color: C.green }]}>✓ Taken</Text>}
            {isMissed  && <Text style={[styles.medRowStatus, { color: C.muted }]}>Missed — that's okay</Text>}
            {isSkipped && <Text style={[styles.medRowStatus, { color: C.muted }]}>Skipped</Text>}
            {!past && !isTaken && !isMissed && !isSkipped && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => onTaken(r._id)}
                  style={[styles.medBtn, { backgroundColor: C.teal }]}
                >
                  <Text style={styles.medBtnPrimary}>Taken</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSkip(r._id)}
                  style={[styles.medBtn, { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }]}
                >
                  <Text style={styles.medBtnSecondary}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {escalationLevel && (
        <View style={styles.escalationNote}>
          <Ionicons name="information-circle-outline" size={14} color={C.muted} />
          <Text style={styles.escalationText}>
            {escalationLevel === 'NAVIGATOR'
              ? 'Your care team has been notified about these doses.'
              : 'Your caregiver has been notified about these doses.'}
          </Text>
        </View>
      )}
    </View>
  );
}

function SkipReasonModal({ visible, onClose, onSelect }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>What happened?</Text>
          <Text style={styles.modalSub}>This helps your care team understand, not to judge — pick whatever fits.</Text>
          {SKIP_REASONS.map((r) => (
            <TouchableOpacity key={r.value} style={styles.reasonRow} onPress={() => onSelect(r.value)} activeOpacity={0.7}>
              <Text style={styles.reasonText}>{r.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

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
  bodyContent: { padding: 12, paddingBottom: 32 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyIllustration: { marginBottom: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 17 },

  apptCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  apptDate: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 44,
  },
  apptDay: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
  apptMon: { fontSize: 9, fontWeight: '600' },
  apptTitle: { fontSize: 12, fontWeight: '700', color: C.text },
  apptMeta: { fontSize: 10, color: C.muted, marginTop: 1 },

  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accentViolet,
    letterSpacing: 0.5,
  },
  reminderTypePill: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },

  medGroupCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  medGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.tealPale,
  },
  medGroupDateBox: {
    backgroundColor: C.teal,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 44,
  },
  medGroupDay: { color: colors.white, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  medGroupMon: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  medGroupTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  medGroupSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  medGroupPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  medGroupPillText: { fontSize: 11, fontWeight: '700' },

  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 10,
  },
  medRowName: { fontSize: 13, fontWeight: '600', color: C.text },
  medRowTiming: { fontSize: 11, color: C.muted, marginTop: 2 },
  medRowStatus: { fontSize: 12, fontWeight: '600' },
  medBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  medBtnPrimary: { color: colors.white, fontSize: 11, fontWeight: '700' },
  medBtnSecondary: { color: C.text, fontSize: 11, fontWeight: '600' },

  escalationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.backgroundAlt,
  },
  escalationText: { flex: 1, fontSize: 11, color: C.muted, lineHeight: 15 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 28,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  modalSub: { fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 17 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  reasonText: { fontSize: 14, color: C.text, fontWeight: '500' },
  modalCancelBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 6 },
  modalCancelText: { fontSize: 13, fontWeight: '700', color: C.muted },
});
