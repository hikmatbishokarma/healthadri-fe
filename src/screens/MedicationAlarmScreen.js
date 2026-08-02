import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCareReminders, respondReminder } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const C = {
  bg:      '#1A1A2E',
  card:    '#252540',
  border:  '#2E2E4A',
  teal:    colors.primary,
  tealBright: colors.accent,
  red:     colors.danger,
  amber:   colors.warning,
  green:   colors.successStrong,
  muted:   colors.textMuted,
  text:    '#F1F5F9',
  textSub: colors.textMuted,
};

const SKIP_REASONS = [
  { id: 'MED_NOT_NEAR',        label: 'Med isn\'t near me' },
  { id: 'FORGOT_BUSY_ASLEEP',  label: 'Forgot / busy / asleep' },
  { id: 'RAN_OUT',             label: 'Ran out of the med' },
  { id: 'DONT_NEED_DOSE',      label: 'Don\'t need to take this dose' },
  { id: 'SIDE_EFFECTS',        label: 'Side effects / other health concerns' },
  { id: 'WORRIED_COST',        label: 'Worried about the cost' },
  { id: 'OTHER',               label: 'Other' },
];

export default function MedicationAlarmScreen({ route, navigation }) {
  const { user } = useAuth();
  const { scheduledAt, patientId: routePatientId } = route?.params ?? {};

  const [reminders, setReminders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [skipTarget, setSkipTarget] = useState(null); // 'all' | reminder._id
  const [skipReason, setSkipReason] = useState(null);

  const pid = routePatientId || user?._id;

  const load = useCallback(async () => {
    if (!pid || !scheduledAt) return;
    setLoading(true);
    try {
      const res = await getCareReminders(pid);
      const all = res.data || [];
      // Filter to the reminders matching this scheduled time slot (±30 min window)
      const slotTime = new Date(scheduledAt).getTime();
      const slot = all.filter((r) => {
        const diff = Math.abs(new Date(r.scheduledAt).getTime() - slotTime);
        return diff <= 30 * 60 * 1000;
      });
      setReminders(slot);
    } finally {
      setLoading(false);
    }
  }, [pid, scheduledAt]);

  useEffect(() => { load(); }, [load]);

  const timeLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';

  const pendingReminders = reminders.filter(
    (r) => r.status !== 'PATIENT_CONFIRMED' && r.status !== 'MISSED' && r.response !== 'TAKEN'
  );

  async function handleTakeAll() {
    if (acting) return;
    setActing(true);
    try {
      await Promise.all(pendingReminders.map((r) => respondReminder(r._id, 'TAKEN')));
      await load();
    } finally {
      setActing(false);
    }
  }

  async function handleSkipConfirm() {
    if (!skipReason || acting) return;
    setActing(true);
    try {
      if (skipTarget === 'all') {
        await Promise.all(pendingReminders.map((r) => respondReminder(r._id, 'SKIPPED', skipReason)));
      } else {
        await respondReminder(skipTarget, 'SKIPPED', skipReason);
      }
      await load();
    } finally {
      setActing(false);
      setSkipTarget(null);
      setSkipReason(null);
    }
  }

  async function handleSnooze() {
    if (acting) return;
    setActing(true);
    try {
      const snoozedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await Promise.all(
        pendingReminders.map((r) =>
          respondReminder(r._id, 'SNOOZED').catch(() => null)
        )
      );
      navigation.goBack();
    } finally {
      setActing(false);
    }
  }

  const allTaken = reminders.length > 0 && pendingReminders.length === 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={C.muted} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>
      </SafeAreaView>

      {/* Greeting */}
      <View style={s.greeting}>
        <View style={s.avatar}>
          <Ionicons name="person" size={28} color={C.muted} />
        </View>
        <Text style={s.greetingText}>
          {allTaken
            ? `Great job, ${user?.name?.split(' ')[0] || 'there'}! All meds taken.`
            : `Hello ${user?.name?.split(' ')[0] || 'there'}, it's time to take your ${timeLabel} meds.`}
        </Text>
      </View>

      {/* Medication list card */}
      <View style={s.card}>
        <Text style={s.timeHeader}>{timeLabel}</Text>

        {loading ? (
          <ActivityIndicator color={C.tealBright} style={{ marginVertical: 24 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
            {reminders.map((r) => {
              const td = r.carePlanTaskId?.taskData || {};
              const isTaken = r.response === 'TAKEN' || r.status === 'PATIENT_CONFIRMED';
              const isSkipped = r.response === 'SKIPPED' || r.status === 'SKIPPED';
              return (
                <View key={r._id} style={s.medRow}>
                  <View style={[s.medIcon, isTaken && s.medIconTaken]}>
                    <Ionicons
                      name={isTaken ? 'checkmark' : 'medkit-outline'}
                      size={18}
                      color={isTaken ? C.green : C.muted}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.medName, (isTaken || isSkipped) && s.medNameDone]}>
                      {r.taskTitle}
                    </Text>
                    {td.timing && (
                      <Text style={s.medSub}>
                        {td.dosage ? `${td.dosage} · ` : ''}{td.timing}
                      </Text>
                    )}
                  </View>
                  {isSkipped && (
                    <Text style={s.skippedBadge}>Skipped</Text>
                  )}
                  {!isTaken && !isSkipped && (
                    <TouchableOpacity
                      onPress={() => setSkipTarget(r._id)}
                      style={s.skipOneBtn}
                    >
                      <Text style={s.skipOneBtnText}>Skip</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Action buttons */}
      {!allTaken && !loading && (
        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => setSkipTarget('all')} disabled={acting}>
            <View style={[s.actionCircle, s.actionCircleSkip]}>
              <Ionicons name="close" size={26} color={C.red} />
            </View>
            <Text style={[s.actionLabel, { color: C.red }]}>SKIP ALL</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={handleTakeAll} disabled={acting}>
            <View style={[s.actionCircle, s.actionCircleTake]}>
              {acting
                ? <ActivityIndicator color="#fff" />
                : <Ionicons name="checkmark" size={26} color="#fff" />}
            </View>
            <Text style={[s.actionLabel, { color: C.tealBright }]}>TAKE ALL</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={handleSnooze} disabled={acting}>
            <View style={[s.actionCircle, s.actionCircleSnooze]}>
              <Ionicons name="alarm-outline" size={24} color={C.amber} />
            </View>
            <Text style={[s.actionLabel, { color: C.amber }]}>SNOOZE</Text>
          </TouchableOpacity>
        </View>
      )}

      {allTaken && !loading && (
        <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}

      {/* Skip reason modal */}
      <Modal visible={skipTarget !== null} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Can you please indicate why you're skipping this dose?</Text>
            <ScrollView style={{ marginBottom: 16 }}>
              {SKIP_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={s.reasonRow}
                  onPress={() => setSkipReason(r.id)}
                >
                  <View style={[s.radio, skipReason === r.id && s.radioSelected]}>
                    {skipReason === r.id && <View style={s.radioDot} />}
                  </View>
                  <Text style={s.reasonLabel}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[s.confirmBtn, !skipReason && s.confirmBtnDisabled]}
              disabled={!skipReason || acting}
              onPress={handleSkipConfirm}
            >
              {acting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.confirmBtnText}>Confirm Skip</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => { setSkipTarget(null); setSkipReason(null); }}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },

  greeting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  greetingText: {
    flex: 1,
    color: C.text,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginTop: 4,
  },

  card: {
    marginHorizontal: 16,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  timeHeader: {
    color: C.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  medIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2E2E4A',
    alignItems: 'center', justifyContent: 'center',
  },
  medIconTaken: { backgroundColor: '#14532D33' },
  medName: { color: C.text, fontSize: 15, fontWeight: '600' },
  medNameDone: { color: C.muted, textDecorationLine: 'line-through' },
  medSub: { color: C.textSub, fontSize: 12, marginTop: 2 },
  skippedBadge: { color: C.muted, fontSize: 11, fontWeight: '600' },
  skipOneBtn: {
    borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  skipOneBtnText: { color: C.muted, fontSize: 11, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  actionCircleSkip:  { backgroundColor: '#FEE2E2' },
  actionCircleTake:  { backgroundColor: C.tealBright },
  actionCircleSnooze:{ backgroundColor: colors.warningTint },
  actionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  doneBtn: {
    margin: 24,
    backgroundColor: C.tealBright,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  // Skip reason modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    lineHeight: 26,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: C.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: C.tealBright },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.tealBright,
  },
  reasonLabel: { color: C.text, fontSize: 15 },
  confirmBtn: {
    backgroundColor: C.tealBright,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: C.muted, fontSize: 14 },
});
