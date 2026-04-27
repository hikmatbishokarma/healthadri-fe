import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getLatestTriage,
  getAppointments,
  getPatientReminders,
  getMessages,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function dueLabel(value) {
  const d = new Date(value);
  const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return 'today';
  if (sameDay(d, tomorrow)) return 'tomorrow';
  return d.toLocaleDateString();
}

const C = {
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  tealPale: '#E8F5F1',
  tealMid: '#B2D8CF',
  saffron: '#E8860A',
  red: '#E53935',
  redPale: '#FEE2E2',
  redBorder: '#FECACA',
  amber: '#F59E0B',
  green: '#22C55E',
  purple: '#4F46E5',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
};

export default function PatientDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [triage, setTriage] = useState(null);
  const [nextItem, setNextItem] = useState(null);
  const [urgentReminder, setUrgentReminder] = useState(null);
  const [recentNavMessage, setRecentNavMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?._id) return;
    try {
      const navId = user.assignedNavigatorId;
      const [triageRes, apptRes, remRes, msgRes] = await Promise.all([
        getLatestTriage(user._id),
        getAppointments(user._id),
        getPatientReminders(user._id),
        navId ? getMessages(user._id, navId) : Promise.resolve({ data: [] }),
      ]);
      setTriage(triageRes.data);

      const now = Date.now();
      const items = [];
      (apptRes.data || []).forEach((a) => {
        const when = new Date(a.scheduledAt).getTime();
        const finalized = ['completed', 'cancelled', 'missed'].includes(a.status);
        if (!finalized && when >= now) {
          items.push({ kind: 'appointment', when, data: a });
        }
      });
      (remRes.data || []).forEach((r) => {
        const when = new Date(r.date).getTime();
        if (when >= now) items.push({ kind: 'reminder', when, data: r });
      });
      items.sort((a, b) => a.when - b.when);
      setNextItem(items[0] || null);

      const URGENT_MS = 48 * 60 * 60 * 1000;
      const urgent = (remRes.data || [])
        .map((r) => ({ ...r, _when: new Date(r.date).getTime() }))
        .filter((r) => r._when >= now && r._when - now <= URGENT_MS)
        .sort((a, b) => a._when - b._when)[0];
      setUrgentReminder(urgent || null);

      const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
      const fromNav = (msgRes.data || [])
        .filter(
          (m) =>
            String(m.senderId) === String(navId) &&
            now - new Date(m.createdAt).getTime() <= RECENT_MS,
        )
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];
      setRecentNavMessage(fromNav || null);
    } catch {
      setTriage(null);
      setNextItem(null);
      setUrgentReminder(null);
      setRecentNavMessage(null);
    } finally {
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

  const alert = triage?.alert;
  const isFromToday = (() => {
    if (!alert?.createdAt) return false;
    const created = new Date(alert.createdAt);
    const now = new Date();
    return created.toDateString() === now.toDateString();
  })();
  const severity = isFromToday ? alert?.severity || alert?.level : null;

  const status =
    severity === 'HIGH'
      ? { face: '😞', text: 'Symptoms are high today', color: C.red }
      : severity === 'MED'
        ? { face: '😐', text: 'Some symptoms today', color: C.amber }
        : severity === 'LOW'
          ? { face: '🙂', text: 'Feeling well today', color: C.green }
          : { face: '☐', text: 'Tap to check in', color: C.muted };

  const comingSoon = (label) => Alert.alert(label, 'Coming soon');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>నమస్కారం, Good day</Text>
              <Text style={styles.name}>{user?.name || 'Patient'}</Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.langBadge}>
                <Text style={styles.langText}>EN</Text>
              </View>
              <TouchableOpacity
                style={styles.hdrBtn}
                onPress={() => navigation.navigate('Profile')}
              >
                <Text style={{ fontSize: 16 }}>👤</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statusStrip}>
            <Text style={styles.statusFace}>{status.face}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>How you're doing</Text>
              <Text style={styles.statusText}>{status.text}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        <TouchableOpacity
          style={styles.weeklyLink}
          onPress={() => navigation.navigate('WeeklyReport')}
          activeOpacity={0.7}
        >
          <Text style={styles.weeklyLinkIcon}>📊</Text>
          <Text style={styles.weeklyLinkText}>See your weekly report</Text>
          <Text style={styles.weeklyLinkChevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <QuickItem icon="🩺" label="Check Symptoms" onPress={() => navigation.navigate('Symptom')} />
          <QuickItem
            icon="💬"
            label="Message Team"
            onPress={() =>
              navigation.navigate('Chat', {
                withUserId: user?.assignedNavigatorId,
                name: 'Navigator',
              })
            }
          />
          <QuickItem icon="📅" label="Reminders" onPress={() => navigation.navigate('Reminders')} />
          <QuickItem icon="🏥" label="Find Hospital" onPress={() => navigation.navigate('Hospitals')} />
          <QuickItem icon="💰" label="Insurance Help" onPress={() => comingSoon('Insurance Help')} />
          <QuickItem icon="💚" label="My Wellbeing" onPress={() => comingSoon('My Wellbeing')} />
          <QuickItem icon="📚" label="Learn" onPress={() => comingSoon('Awareness')} />
          <QuickItem icon="🤲" label="Caregiver" onPress={() => comingSoon('Caregiver')} />
        </View>

        {(urgentReminder || recentNavMessage) && (
          <Text style={styles.sectionLabel}>Today's Alerts</Text>
        )}
        {urgentReminder && (
          <TouchableOpacity
            style={[
              styles.alertCard,
              { backgroundColor: C.redPale, borderColor: C.redBorder },
            ]}
            onPress={() => navigation.navigate('Reminders')}
            activeOpacity={0.7}
          >
            <Text style={styles.alertIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {(urgentReminder.type || 'reminder').toUpperCase()} due{' '}
                {dueLabel(urgentReminder.date)}
              </Text>
              <Text style={styles.alertDesc}>{urgentReminder.title}</Text>
            </View>
          </TouchableOpacity>
        )}
        {recentNavMessage && (
          <TouchableOpacity
            style={[
              styles.alertCard,
              { backgroundColor: C.tealPale, borderColor: C.tealMid },
            ]}
            onPress={() =>
              navigation.navigate('Chat', {
                withUserId: user?.assignedNavigatorId,
                name: 'Navigator',
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.alertIcon}>💬</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Message from your navigator</Text>
              <Text style={styles.alertDesc} numberOfLines={2}>
                "{recentNavMessage.text}"
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>Next Up</Text>
        <NextUpCard
          nextItem={nextItem}
          onPress={() => navigation.navigate('Reminders')}
        />

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function QuickItem({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.quickItem} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function NextUpCard({ nextItem, onPress }) {
  if (!nextItem) {
    return (
      <TouchableOpacity style={styles.nextEmpty} onPress={onPress} activeOpacity={0.7}>
        <Text style={styles.nextEmptyText}>
          Nothing scheduled. Tap to add an appointment or upload a prescription.
        </Text>
      </TouchableOpacity>
    );
  }

  const isAppt = nextItem.kind === 'appointment';
  const data = nextItem.data;
  const date = new Date(nextItem.when);
  const day = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];

  const subtitleParts = [];
  if (isAppt) {
    if (data.doctor) subtitleParts.push(data.doctor);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (data.location) subtitleParts.push(`🏥 ${data.location} · ${time}`);
    else subtitleParts.push(time);
  } else {
    subtitleParts.push(
      `🔔 ${(data.type || 'reminder').toUpperCase()} · Due ${date.toLocaleDateString()}`,
    );
  }

  return (
    <TouchableOpacity style={styles.apptCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.apptDate}>
        <Text style={styles.apptDay}>{day}</Text>
        <Text style={styles.apptMon}>{mon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.apptTitle} numberOfLines={2}>
          {data.title}
        </Text>
        {subtitleParts[0] ? (
          <Text style={styles.apptDoc} numberOfLines={1}>
            {subtitleParts[0]}
          </Text>
        ) : null}
        {subtitleParts[1] ? (
          <Text style={styles.apptTime} numberOfLines={1}>
            {subtitleParts[1]}
          </Text>
        ) : null}
      </View>
      <Text style={styles.nextChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.teal,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  name: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  langBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  langText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  hdrBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusFace: { fontSize: 30, lineHeight: 34 },
  statusLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 1 },
  statusChevron: { color: 'rgba(255,255,255,0.6)', fontSize: 22, fontWeight: '300' },

  weeklyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  weeklyLinkIcon: { fontSize: 18 },
  weeklyLinkText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.text },
  weeklyLinkChevron: { color: C.muted, fontSize: 22, fontWeight: '300' },

  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 32 },

  careCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: C.tealPale,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#B2D8CF',
  },
  careIcon: { fontSize: 24, marginTop: 2 },
  careTitle: { color: C.teal, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  careDesc: {
    color: C.text,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  careAction: {
    alignSelf: 'flex-start',
    backgroundColor: C.teal,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  careActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 8,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  quickItem: {
    width: '23.5%',
    backgroundColor: C.card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  quickIcon: { fontSize: 22, marginBottom: 4 },
  quickLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
    lineHeight: 12,
  },

  alertCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  alertIcon: { fontSize: 18, marginTop: 1 },
  alertTitle: { fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 3 },
  alertDesc: { fontSize: 11, color: C.muted, lineHeight: 16 },

  apptCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.teal,
    borderWidth: 1,
    borderColor: C.border,
  },
  apptDate: {
    backgroundColor: C.tealPale,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  apptDay: { fontSize: 18, fontWeight: '700', color: C.teal, lineHeight: 20 },
  apptMon: { fontSize: 9, color: C.teal, fontWeight: '600' },
  apptTitle: { fontSize: 12, fontWeight: '700', color: C.text },
  apptDoc: { fontSize: 10, color: C.muted, marginTop: 2 },
  apptTime: { fontSize: 10, color: C.muted, marginTop: 1 },
  apptBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  apptBtnPrimaryText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  apptBtnSecondaryText: { color: C.text, fontSize: 9, fontWeight: '700' },
  nextChevron: { color: C.muted, fontSize: 24, fontWeight: '300', marginLeft: 4 },
  nextEmpty: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
  },
  nextEmptyText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 16 },

  signOut: { marginTop: 24, alignItems: 'center', paddingVertical: 8 },
  signOutText: { color: C.muted, fontSize: 12 },
});
