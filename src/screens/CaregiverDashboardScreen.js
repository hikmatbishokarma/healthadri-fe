import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCaregiverPatient } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#111827',
  textSub: '#4B5563',
  muted: '#9CA3AF',
  border: '#E5E7EB',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  red: '#DC2626',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  teal: '#1A6B5A',
  tealPale: '#E8F5F1',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ALERT_MESSAGES = {
  HIGH_FATIGUE: 'High fatigue was reported in today\'s check-in',
  HIGH_FEVER: 'An elevated fever was reported today',
  HIGH_PAIN_LEVEL: 'Pain levels are higher than usual today',
  MISSED_APPOINTMENT: 'A scheduled appointment was missed',
};

function scaleToLabel(value) {
  if (value == null) return null;
  if (value >= 8) return 'Very High';
  if (value >= 6) return 'High';
  if (value >= 4) return 'Moderate';
  if (value >= 2) return 'Mild';
  return 'Low';
}

function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function relativeDate(dateStr) {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 6) return `In ${diff} days`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const PRIORITY_ORDER = ['pain', 'fatigue', 'fever', 'nausea', 'appetite', 'mood'];
const SYMPTOM_ALERT_TYPES = new Set(['HIGH_FATIGUE', 'HIGH_FEVER', 'HIGH_PAIN_LEVEL', 'HIGH_NAUSEA']);

function formatLabel(name) {
  return (name ?? '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function sortByPriority(symptoms) {
  return [...symptoms].sort((a, b) => {
    const ai = PRIORITY_ORDER.findIndex(p => a.name.toLowerCase().includes(p));
    const bi = PRIORITY_ORDER.findIndex(p => b.name.toLowerCase().includes(p));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function valueColor(value) {
  if (value == null) return C.muted;
  if (value >= 6) return C.red;
  if (value >= 4) return C.amber;
  return C.green;
}

function mapToUIState(raw) {
  const { patient, navigator, latestEntry, recentAlerts, upcomingAppointments } = raw;
  const firstName = patient?.name?.split(' ')[0] ?? 'Patient';
  const score = patient?.acuityScore ?? 0;

  let status, statusColor, statusBg, statusBorder, statusMessage, statusExplanation;
  if (score >= 7) {
    status = 'critical';
    statusColor = C.red;
    statusBg = C.redBg;
    statusBorder = C.redBorder;
    statusMessage = `${firstName} may need attention right now`;
    statusExplanation = 'Symptoms are higher than usual. Monitor closely and reach out if needed.';
  } else if (score >= 4) {
    status = 'needs_attention';
    statusColor = C.amber;
    statusBg = C.amberBg;
    statusBorder = C.amberBorder;
    statusMessage = `Keep an eye on ${firstName} today`;
    statusExplanation = 'Some symptoms need watching. Reach out to the navigator if you have concerns.';
  } else {
    status = 'stable';
    statusColor = C.green;
    statusBg = C.greenBg;
    statusBorder = C.greenBorder;
    statusMessage = `${firstName} is doing okay today`;
    statusExplanation = 'No urgent concerns at this time. Continue with the regular care routine.';
  }

  const responses = latestEntry?.responses ?? [];
  const symptoms = responses.map(r => ({ name: r.name, value: r.value ?? null }));
  const hasEntryToday = latestEntry ? isToday(latestEntry.createdAt) : false;
  const lastCheckinDate = latestEntry?.createdAt ? formatDate(latestEntry.createdAt) : null;
  const lastCheckinTime = latestEntry?.createdAt ? formatTime(latestEntry.createdAt) : null;

  const things = (recentAlerts ?? [])
    .filter(a => a.status === 'pending' && !SYMPTOM_ALERT_TYPES.has(a.type))
    .map(a => ALERT_MESSAGES[a.type] ?? a.reason ?? 'An issue was flagged today');
  if (!hasEntryToday) things.push(`${firstName} hasn't submitted a symptom check-in today`);

  const events = (upcomingAppointments ?? []).slice(0, 4).map(a => ({
    id: a._id,
    rawDate: a.scheduledAt,
    type: a.type ?? 'appointment',
    label: a.title ?? 'Appointment',
  }));

  return {
    status, statusColor, statusBg, statusBorder, statusMessage, statusExplanation,
    symptoms, hasEntryToday, lastCheckinDate, lastCheckinTime, things, events,
    patient, navigator,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ patient, onBell }) {
  return (
    <View style={s.header}>
      <View style={s.headerLogoMark}>
        <View style={s.miniCrossH} />
        <View style={s.miniCrossV} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.headerLabel}>You are supporting</Text>
        <Text style={s.headerName}>{patient?.name ?? '—'}</Text>
      </View>
      <TouchableOpacity
        onPress={onBell}
        style={s.bellBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="notifications-outline" size={22} color="#1A3C34" />
      </TouchableOpacity>
    </View>
  );
}

function AlertCard({ ui, onContact }) {
  return (
    <View style={[s.alertCard, { backgroundColor: ui.statusBg, borderColor: ui.statusBorder }]}>
      <View style={[s.alertIconBox, { backgroundColor: ui.statusColor + '22' }]}>
        <Text style={s.alertIconText}>🔔</Text>
      </View>
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <Text style={[s.alertTitle, { color: ui.statusColor }]}>{ui.statusMessage}</Text>
        <Text style={s.alertSub}>{ui.statusExplanation}</Text>
      </View>
      {ui.status !== 'stable' && (
        <TouchableOpacity style={[s.contactBtn, { borderColor: ui.statusColor }]} onPress={onContact} activeOpacity={0.8}>
          <Text style={[s.contactBtnText, { color: ui.statusColor }]}>Contact Care Team</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function OverviewCol({ icon, iconBg, label, value, valueColor: vc, valueSub, valueSubColor, arrow, last }) {
  return (
    <View style={[s.overviewCol, !last && s.overviewColBorder]}>
      <View style={[s.overviewIconBox, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      </View>
      <Text style={s.overviewLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[s.overviewValue, vc && { color: vc }]} numberOfLines={1}>{value}</Text>
        {arrow ? <Text style={{ color: vc, fontSize: 11, fontWeight: '800' }}>{arrow}</Text> : null}
      </View>
      {valueSub ? <Text style={[s.overviewSub, valueSubColor && { color: valueSubColor }]}>{valueSub}</Text> : null}
    </View>
  );
}

function OverviewCard({ ui }) {
  const sorted = sortByPriority(ui.symptoms ?? []);
  const top = sorted[0];
  const sympLabel = top?.value != null ? scaleToLabel(top.value) : 'N/A';
  const sympColor = top ? valueColor(top.value) : C.muted;

  const nextEvent = ui.events?.[0];
  const nextLabel = nextEvent ? relativeDate(nextEvent.rawDate) : '–';
  const nextSub = nextEvent ? nextEvent.label : 'No upcoming';

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Overview</Text>
        <TouchableOpacity><Text style={s.viewAll}>View all ›</Text></TouchableOpacity>
      </View>
      <View style={s.overviewRow}>
        <OverviewCol
          icon="📈" iconBg="#DCFCE7"
          label="Symptoms" value={sympLabel} valueColor={sympColor}
          arrow={top?.value >= 6 ? '↑' : null}
        />
        <OverviewCol
          icon="📅" iconBg="#DBEAFE"
          label="Next Visit" value={nextLabel} valueSub={nextSub}
        />
        <OverviewCol
          icon="📋" iconBg="#EDE9FE"
          label="Last Check-in" value={ui.lastCheckinDate ?? '–'} valueSub={ui.lastCheckinTime}
        />
        <OverviewCol
          icon="🛡️" iconBg="#FEF3C7"
          label="Treatment Phase" value={ui.patient?.cancerStage ?? '–'}
          valueSub="On Track" valueSubColor={C.green} last
        />
      </View>
    </View>
  );
}

function ThingsToNote({ ui }) {
  const sorted = sortByPriority(ui.symptoms ?? []).filter(s => s.value != null);
  const tipText = sorted[0]?.name?.toLowerCase().includes('fatigue')
    ? 'Encourage short walks and balanced rest. Small steps make a big difference.'
    : 'Check in with a gentle conversation and monitor any changes.';

  const rows = [...sorted.slice(0, 3)];

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Things to note</Text>
        <TouchableOpacity><Text style={s.viewAll}>View history ›</Text></TouchableOpacity>
      </View>
      {rows.map((sym, i) => (
        <TouchableOpacity key={i} style={[s.noteRow, s.noteRowBorder]} activeOpacity={0.7}>
          <View style={[s.noteIconBox, { backgroundColor: '#FEE2E2' }]}>
            <Text style={{ fontSize: 14 }}>❤️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.noteSymName}>{formatLabel(sym.name)}</Text>
              {sym.value >= 6 && (
                <View style={[s.severityBadge, { backgroundColor: valueColor(sym.value) + '22' }]}>
                  <Text style={[s.severityBadgeText, { color: valueColor(sym.value) }]}>
                    {scaleToLabel(sym.value)}
                  </Text>
                </View>
              )}
            </View>
            {ui.lastCheckinDate && <Text style={s.noteSymSub}>Updated {ui.lastCheckinDate}</Text>}
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      ))}
      {rows.length === 0 && (
        <Text style={s.emptyText}>No symptoms recorded today</Text>
      )}
      {/* Caregiver Tip */}
      <TouchableOpacity style={s.noteRow} activeOpacity={0.7}>
        <View style={[s.noteIconBox, { backgroundColor: '#FEF9C3' }]}>
          <Text style={{ fontSize: 14 }}>💡</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[s.noteSymName, { color: C.teal }]}>Caregiver Tip</Text>
          <Text style={s.noteSymSub}>{tipText}</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const PATIENT_MOODS = [
  { key: 'very_good', emoji: '😊', label: 'Very Good', accent: '#16A34A' },
  { key: 'good',      emoji: '🙂', label: 'Good',      accent: '#65A30D' },
  { key: 'okay',      emoji: '😐', label: 'Okay',      accent: '#D97706' },
  { key: 'not_good',  emoji: '😕', label: 'Not Good',  accent: '#EA580C' },
  { key: 'very_bad',  emoji: '😞', label: 'Very Bad',  accent: '#DC2626' },
];

function PatientMoodCheck() {
  const [selected, setSelected] = useState(null);
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>How are you feeling today?</Text>
      <Text style={s.moodSub}>Caring for someone is hard. You matter too.</Text>
      <View style={s.moodRow}>
        {PATIENT_MOODS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.moodItem, selected === m.key && { borderColor: m.accent, borderWidth: 2, backgroundColor: m.accent + '11' }]}
            onPress={() => setSelected(m.key)}
            activeOpacity={0.75}
          >
            <Text style={s.moodEmoji}>{m.emoji}</Text>
            <Text style={[s.moodLabel, selected === m.key && { color: m.accent, fontWeight: '700' }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={s.addNoteBtn} activeOpacity={0.75}>
        <Text style={s.addNoteBtnText}>✎  Add Note (Optional)</Text>
      </TouchableOpacity>
    </View>
  );
}

function HelpfulForCaregivers({ patient }) {
  const cancerType = patient?.cancerType ?? 'oral';
  const items = [
    { icon: '📖', iconBg: '#EDE9FE', title: `Understanding ${cancerType} cancer`, sub: 'Learn about symptoms, treatment and care.' },
    { icon: '🤝', iconBg: '#DCFCE7', title: 'Emotional support for caregivers', sub: 'Tips to manage stress and stay strong.' },
  ];
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Helpful for caregivers</Text>
        <TouchableOpacity><Text style={s.viewAll}>View all ›</Text></TouchableOpacity>
      </View>
      {items.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={[s.helpRow, i < items.length - 1 && s.helpRowBorder]}
          activeOpacity={0.7}
        >
          <View style={[s.helpIconBox, { backgroundColor: item.iconBg }]}>
            <Text style={{ fontSize: 18 }}>{item.icon}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.helpTitle}>{item.title}</Text>
            <Text style={s.helpSub}>{item.sub}</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CaregiverDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const load = useCallback(async () => {
    try {
      const res = await getCaregiverPatient();
      setRaw(res.data);
    } catch {
      // silently fail; show stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  const ui = raw ? mapToUIState(raw) : null;

  const handleContact = () => {
    if (ui?.navigator) {
      navigation.navigate('Chat', {
        userId: user?._id,
        withUserId: ui.navigator._id,
        name: ui.navigator.name,
      });
    } else {
      Alert.alert('Care Team', 'No navigator assigned yet.');
    }
  };

  const CG_TABS = [
    { id: 'Home',     icon: 'home-outline',      iconActive: 'home',      label: 'Home' },
    { id: 'Schedule', icon: 'calendar-outline',  iconActive: 'calendar',  label: 'Schedule' },
    { id: 'Messages', icon: 'chatbubble-outline', iconActive: 'chatbubble', label: 'Messages',
      onPress: () => handleContact() },
    { id: 'Profile',  icon: 'person-outline',    iconActive: 'person',    label: 'Profile' },
  ];

  const cgInitials = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('') ?? 'C';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Header
        patient={ui?.patient}
        onBell={() => Alert.alert('Notifications', 'No new notifications')}
      />

      {/* ── HOME TAB ── */}
      {activeTab === 'Home' && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
        >
          {ui ? (
            <>
              <AlertCard ui={ui} onContact={handleContact} />
              <OverviewCard ui={ui} />
              <ThingsToNote ui={ui} />
              <PatientMoodCheck />
              <HelpfulForCaregivers patient={ui.patient} />
            </>
          ) : (
            <Text style={s.errorText}>Could not load patient data. Pull down to retry.</Text>
          )}
        </ScrollView>
      )}

      {/* ── SCHEDULE TAB ── */}
      {activeTab === 'Schedule' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.tabSectionTitle}>Upcoming Appointments</Text>
          {(ui?.events ?? []).length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="calendar-outline" size={36} color={C.muted} />
              <Text style={s.emptyBoxText}>No upcoming appointments</Text>
            </View>
          ) : (
            (ui?.events ?? []).map((ev) => (
              <View key={ev.id} style={s.scheduleCard}>
                <View style={s.scheduleDate}>
                  <Text style={s.scheduleDateDay}>
                    {new Date(ev.rawDate).getDate().toString().padStart(2, '0')}
                  </Text>
                  <Text style={s.scheduleDateMon}>
                    {new Date(ev.rawDate).toLocaleString('en', { month: 'short' }).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.scheduleLabel}>{ev.label}</Text>
                  <Text style={s.scheduleType}>{ev.type}</Text>
                </View>
                <Text style={s.scheduleRelative}>{relativeDate(ev.rawDate)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'Profile' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.cgProfileCard}>
            <View style={s.cgProfileAvatar}>
              <Text style={s.cgProfileAvatarText}>{cgInitials}</Text>
            </View>
            <Text style={s.cgProfileName}>{user?.name || 'Caregiver'}</Text>
            <Text style={s.cgProfileSub}>Supporting {ui?.patient?.name || 'your patient'}</Text>
          </View>
          <TouchableOpacity style={s.signOut} onPress={signOut}>
            <Ionicons name="log-out-outline" size={16} color={C.muted} />
            <Text style={[s.signOutText, { marginLeft: 6 }]}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── BOTTOM TAB BAR ── */}
      <View style={s.tabBar}>
        {CG_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={s.tabItem}
              onPress={() => {
                if (tab.onPress) { tab.onPress(); }
                else { setActiveTab(tab.id); }
              }}
            >
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? C.teal : C.muted}
              />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#FFFFFF' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  scroll:  { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, paddingBottom: 56, gap: 14 },
  errorText: { color: C.muted, marginTop: 48, fontSize: 14, textAlign: 'center' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerLogoMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  miniCrossH: { position: 'absolute', width: 24, height: 6, borderRadius: 3, backgroundColor: C.teal },
  miniCrossV: { position: 'absolute', width: 6, height: 24, borderRadius: 3, backgroundColor: C.teal },
  headerLabel: { color: C.muted, fontSize: 11 },
  headerName:  { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 1 },
  bellBtn: { padding: 4 },

  // ── Alert card ──
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  alertIconBox: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  alertIconText: { fontSize: 18 },
  alertTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3, lineHeight: 18 },
  alertSub:   { fontSize: 11, color: C.textSub, lineHeight: 16 },
  contactBtn: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 7,
    flexShrink: 0,
  },
  contactBtnText: { fontSize: 11, fontWeight: '700' },

  // ── Generic card ──
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle:  { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  viewAll:    { fontSize: 12, color: C.teal, fontWeight: '600' },
  chevron:    { color: C.muted, fontSize: 20, marginLeft: 6 },

  // ── Overview ──
  overviewRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingTop: 14,
  },
  overviewCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  overviewColBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.border,
  },
  overviewIconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  overviewLabel: { fontSize: 9, color: C.muted, textAlign: 'center', fontWeight: '500' },
  overviewValue: { fontSize: 12, fontWeight: '700', color: C.text, textAlign: 'center' },
  overviewSub:   { fontSize: 9, color: C.muted, textAlign: 'center' },

  // ── Things to note ──
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  noteRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  noteIconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  noteSymName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  noteSymSub:  { fontSize: 11, color: C.muted, lineHeight: 16 },
  severityBadge: {
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  severityBadgeText: { fontSize: 10, fontWeight: '700' },
  emptyText: { fontSize: 13, color: C.muted, paddingVertical: 8 },

  // ── Patient mood ──
  moodSub: { fontSize: 12, color: C.muted, marginBottom: 16, marginTop: 4 },
  moodRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  moodItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#F9FAFB',
  },
  moodEmoji: { fontSize: 22, marginBottom: 4 },
  moodLabel: { fontSize: 9, color: C.muted, textAlign: 'center', fontWeight: '500' },
  addNoteBtn: {
    borderWidth: 1.5,
    borderColor: C.teal,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addNoteBtnText: { color: C.teal, fontSize: 13, fontWeight: '600' },

  // ── Helpful for caregivers ──
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  helpRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  helpIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  helpTitle: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 2 },
  helpSub:   { fontSize: 11, color: C.muted, lineHeight: 15 },

  // ── Sign out ──
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  signOutText: { color: C.muted, fontSize: 12 },

  // ── Bottom tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingBottom: 16,
    paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 10, color: C.muted, fontWeight: '500' },
  tabLabelActive: { color: C.teal, fontWeight: '700' },

  // ── Schedule tab ──
  tabSectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
  emptyBox: { alignItems: 'center', padding: 32, gap: 10 },
  emptyBoxText: { fontSize: 14, color: C.muted },
  scheduleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
    elevation: 1,
  },
  scheduleDate: {
    backgroundColor: C.tealPale, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 44,
  },
  scheduleDateDay: { fontSize: 18, fontWeight: '700', color: C.teal },
  scheduleDateMon: { fontSize: 9, fontWeight: '700', color: C.teal, letterSpacing: 0.5 },
  scheduleLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2 },
  scheduleType: { fontSize: 11, color: C.muted, textTransform: 'capitalize' },
  scheduleRelative: { fontSize: 11, fontWeight: '600', color: C.teal },

  // ── Profile tab ──
  cgProfileCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  cgProfileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  cgProfileAvatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  cgProfileName: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 4 },
  cgProfileSub: { fontSize: 13, color: C.muted },
});
