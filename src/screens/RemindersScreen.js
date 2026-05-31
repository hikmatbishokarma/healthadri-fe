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
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  getPatientReminders,
  getCareReminders,
  respondReminder,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = {
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  tealPale: '#E8F5F1',
  purple: '#7C3AED',
  purplePale: '#F5F3FF',
  blue: '#2563EB',
  bluePale: '#EFF6FF',
  amber: '#F59E0B',
  red: '#EF4444',
  green: '#22C55E',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
};

const TYPE_STYLES = {
  chemo:        { color: C.teal,   pale: C.tealPale },
  consultation: { color: C.teal,   pale: C.tealPale },
  surgery:      { color: C.red,    pale: '#FEE2E2' },
  radiation:    { color: C.amber,  pale: '#FEF9C3' },
  counselling:  { color: C.purple, pale: C.purplePale },
  lab:          { color: C.blue,   pale: C.bluePale },
  other:        { color: C.muted,  pale: '#F1F5F9' },
};

const TYPE_LABELS = {
  chemo: 'Chemo',
  consultation: 'Consult',
  surgery: 'Surgery',
  radiation: 'Radiation',
  counselling: 'Counselling',
  lab: 'Lab',
  other: 'Other',
};

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export default function RemindersScreen({ navigation, embedded = false }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [careReminders, setCareReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [aRes, rRes, cRes] = await Promise.all([
        getAppointments(user._id).catch(() => ({ data: [] })),
        getPatientReminders(user._id).catch(() => ({ data: [] })),
        getCareReminders(user._id).catch(() => ({ data: [] })),
      ]);
      setAppointments(aRes.data || []);
      setReminders(rRes.data || []);
      setCareReminders(cRes.data || []);
    } catch {
      setAppointments([]);
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

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const items = [];

    appointments.forEach((a) => {
      const when = new Date(a.scheduledAt).getTime();
      const isFinalized = ['completed', 'cancelled', 'missed'].includes(a.status);
      items.push({ kind: 'appointment', when, isPast: isFinalized || when < now, data: a });
    });

    reminders.forEach((r) => {
      const when = new Date(r.date).getTime();
      items.push({ kind: 'reminder', when, isPast: when < now, data: r });
    });

    // Group care reminders by calendar date
    const careByDate = new Map();
    careReminders.forEach((r) => {
      const dateKey = new Date(r.scheduledAt).toLocaleDateString();
      if (!careByDate.has(dateKey)) careByDate.set(dateKey, []);
      careByDate.get(dateKey).push(r);
    });
    careByDate.forEach((dayReminders, dateKey) => {
      const when = new Date(dayReminders[0].scheduledAt).getTime();
      const allDone = dayReminders.every(r =>
        ['PATIENT_CONFIRMED', 'CAREGIVER_CONFIRMED', 'MISSED', 'CANCELLED'].includes(r.status)
      );
      items.push({ kind: 'careGroup', when, isPast: allDone || when < now - 24*60*60*1000, data: { date: dateKey, reminders: dayReminders } });
    });

    const up = items.filter((i) => !i.isPast).sort((a, b) => a.when - b.when);
    const pa = items.filter((i) => i.isPast).sort((a, b) => b.when - a.when);
    return { upcoming: up, past: pa };
  }, [appointments, reminders, careReminders]);

  const handleMarkCompleted = async (id) => {
    try {
      await updateAppointment(id, { status: 'completed' });
      fetchAll();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message?.toString() || 'Could not update');
    }
  };

  const handleRespond = async (id, response) => {
    try {
      await respondReminder(id, response);
      fetchAll();
    } catch {
      Alert.alert('Error', 'Could not update reminder');
    }
  };

  return (
    <View style={styles.container}>
      {!embedded && (
        <>
          <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
          <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>My Reminders</Text>
              {/* DEV: tap to test alarm screen */}
              {__DEV__ && careReminders.length > 0 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('MedicationAlarm', {
                    scheduledAt: careReminders[0].scheduledAt,
                    patientId: user._id,
                  })}
                  style={{ paddingHorizontal: 8 }}
                >
                  <Ionicons name="alarm-outline" size={20} color="#fff" />
                </TouchableOpacity>
              )}
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
          <Text style={styles.sectionLabel}>Upcoming</Text>
          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Illustration name="appointment_empty" size={160} style={styles.emptyIllustration} />
              <Text style={styles.emptyTitle}>No Upcoming Appointments</Text>
              <Text style={styles.emptyText}>
                Tap + to add an appointment, or upload a prescription to get auto-extracted reminders.
              </Text>
            </View>
          ) : (
            upcoming.map((item) =>
              item.kind === 'appointment' ? (
                <ApptCard
                  key={`a:${item.data._id}`}
                  appt={item.data}
                  onComplete={() => handleMarkCompleted(item.data._id)}
                />
              ) : item.kind === 'careGroup' ? (
                <MedGroupCard
                  key={`cg:${item.data.date}`}
                  date={item.data.date}
                  reminders={item.data.reminders}
                  onRespond={handleRespond}
                />
              ) : (
                <ReminderCard key={`r:${item.data._id}`} reminder={item.data} />
              ),
            )
          )}

          {past.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Past</Text>
              {past.map((item) =>
                item.kind === 'appointment' ? (
                  <ApptCard key={`a:${item.data._id}`} appt={item.data} past />
                ) : item.kind === 'careGroup' ? (
                  <MedGroupCard
                    key={`cg:${item.data.date}`}
                    date={item.data.date}
                    reminders={item.data.reminders}
                    onRespond={handleRespond}
                    past
                  />
                ) : (
                  <ReminderCard key={`r:${item.data._id}`} reminder={item.data} past />
                ),
              )}
            </>
          )}
        </ScrollView>
      )}

      <AddAppointmentModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={() => {
          setModalVisible(false);
          fetchAppts();
        }}
        patientId={user?._id}
      />
    </View>
  );
}

function ApptCard({ appt, past, onComplete }) {
  const date = new Date(appt.scheduledAt);
  const day = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const t = TYPE_STYLES[appt.type] || TYPE_STYLES.other;
  const accentColor = past ? C.muted : t.color;
  const accentPale = past ? '#F1F5F9' : t.pale;

  return (
    <View
      style={[
        styles.apptCard,
        { borderLeftColor: accentColor, opacity: past ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.apptDate, { backgroundColor: accentPale }]}>
        <Text style={[styles.apptDay, { color: accentColor }]}>{day}</Text>
        <Text style={[styles.apptMon, { color: accentColor }]}>{mon}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.apptTitle}>{appt.title}</Text>
        {appt.doctor ? <Text style={styles.apptDoc}>{appt.doctor}</Text> : null}
        <Text style={styles.apptMeta}>
          {appt.location ? `${appt.location} · ` : ''}
          {past && appt.status === 'completed' ? 'Completed' : time}
        </Text>
      </View>

      <View style={{ gap: 4 }}>
        {past ? (
          <TouchableOpacity style={[styles.btn, { backgroundColor: C.border }]}>
            <Text style={styles.btnSecondaryText}>View Notes</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.btn, { backgroundColor: accentColor }]}>
              <Text style={styles.btnPrimaryText}>
                {appt.type === 'counselling' ? 'Join Call' : 'Navigate'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onComplete}
              style={[styles.btn, { backgroundColor: C.border }]}
            >
              <Text style={styles.btnSecondaryText}>Mark Done</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function ReminderCard({ reminder, past }) {
  const date = new Date(reminder.date);
  const day = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];
  const isVisit = reminder.type === 'visit';
  const accentColor = past ? C.muted : isVisit ? C.blue : C.amber;
  const accentPale = past ? '#F1F5F9' : isVisit ? C.bluePale : '#FEF3C7';

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
            <Ionicons name="alarm-outline" size={11} color="#7C3AED" />
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

function AddAppointmentModal({ visible, onClose, onCreated, patientId }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('consultation');
  const [doctor, setDoctor] = useState('');
  const [location, setLocation] = useState('');
  const [whenOffsetDays, setWhenOffsetDays] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle(''); setType('consultation'); setDoctor('');
    setLocation(''); setWhenOffsetDays('1');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing', 'Please enter a title.');
      return;
    }
    const offset = parseInt(whenOffsetDays, 10);
    if (isNaN(offset) || offset < 0) {
      Alert.alert('Missing', 'Please enter days from now (0 or more).');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(10, 0, 0, 0);

    setSubmitting(true);
    try {
      await createAppointment({
        patientId,
        title: title.trim(),
        type,
        doctor: doctor.trim(),
        location: location.trim(),
        scheduledAt: d.toISOString(),
      });
      reset();
      onCreated();
    } catch (err) {
      Alert.alert(
        'Error',
        err.response?.data?.message?.toString() || 'Could not create',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>New Appointment</Text>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Chemotherapy — Session 4"
            placeholderTextColor={C.muted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {Object.keys(TYPE_LABELS).map((id) => {
              const active = type === id;
              const ts = TYPE_STYLES[id];
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setType(id)}
                  style={[
                    styles.typeChip,
                    active
                      ? { backgroundColor: ts.color, borderColor: ts.color }
                      : { backgroundColor: ts.pale, borderColor: 'transparent' },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: active ? '#fff' : ts.color },
                    ]}
                  >
                    {TYPE_LABELS[id]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Doctor (optional)</Text>
          <TextInput
            value={doctor}
            onChangeText={setDoctor}
            placeholder="e.g. Dr. Anand Rao"
            placeholderTextColor={C.muted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Location (optional)</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Basavatarakam"
            placeholderTextColor={C.muted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Days from now</Text>
          <TextInput
            value={whenOffsetDays}
            onChangeText={setWhenOffsetDays}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={C.muted}
            style={styles.input}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, styles.modalCancel]}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.modalBtn, styles.modalSubmit]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSubmitText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MedGroupCard({ date, reminders, onRespond, past }) {
  const d = new Date(reminders[0].scheduledAt);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTHS[d.getMonth()];
  const doneCount = reminders.filter(r =>
    r.response === 'TAKEN' || r.status === 'PATIENT_CONFIRMED'
  ).length;
  const total = reminders.length;
  const allDone = doneCount === total;

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
        <View style={[styles.medGroupPill, { backgroundColor: allDone ? '#DCFCE7' : C.tealPale }]}>
          <Text style={[styles.medGroupPillText, { color: allDone ? C.green : C.teal }]}>
            {allDone ? 'Done' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Each medication row */}
      {reminders.map((r) => {
        const td = r.carePlanTaskId?.taskData || {};
        const isTaken   = r.response === 'TAKEN' || r.status === 'PATIENT_CONFIRMED';
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
            {isMissed  && <Text style={[styles.medRowStatus, { color: C.red   }]}>Missed</Text>}
            {isSkipped && <Text style={[styles.medRowStatus, { color: C.muted }]}>Skipped</Text>}
            {!past && !isTaken && !isMissed && !isSkipped && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => onRespond(r._id, 'TAKEN')}
                  style={[styles.medBtn, { backgroundColor: C.teal }]}
                >
                  <Text style={styles.medBtnPrimary}>Taken</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onRespond(r._id, 'SKIPPED')}
                  style={[styles.medBtn, { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }]}
                >
                  <Text style={styles.medBtnSecondary}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
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
  backIcon: { color: '#fff', fontSize: 18, lineHeight: 20 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, lineHeight: 24, fontWeight: '300' },

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
  },
  emptyIllustration: { marginBottom: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyText: { color: C.muted, fontSize: 12 },

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
  apptDoc: { fontSize: 10, color: C.muted, marginTop: 2 },
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
    color: '#7C3AED',
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

  btn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 76,
  },
  btnPrimaryText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  btnSecondaryText: { color: C.text, fontSize: 9, fontWeight: '700' },

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
  medGroupDay: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
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
  medBtnPrimary: { color: '#fff', fontSize: 11, fontWeight: '700' },
  medBtnSecondary: { color: C.text, fontSize: 11, fontWeight: '600' },

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
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    marginTop: 10,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: C.text,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 10, fontWeight: '700' },

  modalActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancel: { backgroundColor: C.border },
  modalCancelText: { color: C.text, fontWeight: '700', fontSize: 13 },
  modalSubmit: { backgroundColor: C.teal },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
