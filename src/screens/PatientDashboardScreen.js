import { useEffect, useState, useCallback, useMemo } from 'react';
import Illustration from '../components/Illustration';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LogoMark from '../../assets/logo.svg';
import {
  getLatestTriage,
  getLatestSymptomEntry,
  getSymptomHistory,
  getPatientReminders,
  getCareReminders,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';
import SeverityGauge from '../components/SeverityGauge';
import CheckInIllustration from '../components/CheckInIllustration';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// "Tue · 2 days ago" — used only for a check-in that isn't from today.
function relativeDayLabel(dateValue) {
  const d = new Date(dateValue);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startOfToday - startOfDay) / 86400000);
  const dayName = d.toLocaleDateString([], { weekday: 'short' });
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return `${dayName} · Yesterday`;
  return `${dayName} · ${diffDays} days ago`;
}

// Same tiering the app already uses elsewhere (WeeklyReportScreen's getColor,
// TopSymptoms) — ≥8 needs attention, ≥5 moderate, else steady. Reused here so
// this doesn't become a second severity scale for the same underlying data.
function worstSeverityTier(responses) {
  const withValues = (responses || []).filter((r) => r.value > 0);
  if (withValues.length === 0) return { tier: 'steady' };
  const worst = withValues.reduce((a, b) => (b.value > a.value ? b : a));
  if (worst.value >= 8) return { tier: 'attention', name: worst.name };
  if (worst.value >= 5) return { tier: 'moderate', name: worst.name };
  return { tier: 'steady' };
}

const MED_DONE_STATUSES = ['TAKEN', 'PATIENT_CONFIRMED', 'CAREGIVER_CONFIRMED'];

// Counts *distinct calendar days* with a check-in in the last 7 days — not raw
// entry count, so resubmitting the same day (SymptomScreen allows "submit
// again if symptoms changed") doesn't inflate the number.
function checkinDaysThisWeek(entries) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const days = new Set();
  (entries || []).forEach((e) => {
    const d = new Date(e.createdAt);
    if (d >= sevenDaysAgo) days.add(d.toDateString());
  });
  return days.size;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  tealPale: colors.primaryTint,
  tealMid: '#B2D8CF',
  red: colors.danger,
  amber: colors.warning,
  green: colors.successStrong,
  bg: colors.background,
  text: '#111827',
  textSub: '#4B5563',
  muted: '#9CA3AF',
  border: '#E5E7EB',
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PatientDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [triage, setTriage] = useState(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [lastCheckinDate, setLastCheckinDate] = useState(null);
  const [latestResponses, setLatestResponses] = useState([]);
  const [nextItem, setNextItem] = useState(null);
  const [careReminders, setCareReminders] = useState([]);
  const [checkinDays, setCheckinDays] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?._id) return;
    try {
      const nil = { data: null };
      const [triageRes, entryRes, historyRes, remRes, careRes] = await Promise.all([
        getLatestTriage(user._id).catch(() => nil),
        getLatestSymptomEntry(user._id).catch(() => nil),
        getSymptomHistory(user._id, 20).catch(() => ({ data: [] })),
        getPatientReminders(user._id).catch(() => ({ data: [] })),
        getCareReminders(user._id).catch(() => ({ data: [] })),
      ]);
      setTriage(triageRes.data);
      setCheckinDays(checkinDaysThisWeek(historyRes.data));

      const entry = entryRes.data;
      if (entry?.createdAt) {
        const entryDate = new Date(entry.createdAt);
        const today = new Date();
        setCheckedInToday(entryDate.toDateString() === today.toDateString());
        setLastCheckinDate(entry.createdAt);
        setLatestResponses(entry.responses || []);
      } else {
        setCheckedInToday(false);
        setLastCheckinDate(null);
        setLatestResponses([]);
      }

      setCareReminders(careRes.data || []);

      // "Next Up" — navigator-verified visit/test reminders only. Appointments
      // are not patient-created and are not sourced from here (see
      // RemindersScreen.js — the old Appointment collection has no creation
      // path anywhere in the system and has been retired).
      const now = Date.now();
      const upcoming = (remRes.data || [])
        .map((r) => ({ when: new Date(r.date).getTime(), data: r }))
        .filter((r) => r.when >= now)
        .sort((a, b) => a.when - b.when);
      setNextItem(upcoming[0] || null);
    } catch {
      setTriage(null);
      setCheckedInToday(false);
      setLastCheckinDate(null);
      setLatestResponses([]);
      setCareReminders([]);
      setCheckinDays(0);
      setNextItem(null);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const alert = triage?.alert;
  const severity = alert?.severity || alert?.level || null;

  const status =
    severity === 'HIGH'
      ? { icon: 'sad-outline',   text: 'Symptoms are high today', color: C.red }
      : severity === 'MED'
        ? { icon: 'remove-circle-outline', text: 'Some symptoms today', color: C.amber }
        : { icon: 'happy-outline', text: 'Feeling well today', color: C.green };

  const statusHint =
    severity === 'HIGH' ? 'Please take care and rest well.' :
    severity === 'MED'  ? 'Monitor your symptoms closely.' :
    "You're doing great, keep it up!";

  const greeting = timeGreeting();

  // "Talk to your Care Team" only shows when today's alert is real and still
  // unresolved — `triage` is inherently today-only (TriageService.findLatestForPatient
  // filters to today server-side), and an alert can't exist without a today
  // check-in, so this condition alone correctly excludes stale/past entries.
  const worst = worstSeverityTier(latestResponses);
  const showCareTeamCta = checkedInToday && alert?.status === 'pending' && worst.tier === 'attention';

  const medsToday = useMemo(() => {
    const todayStr = new Date().toDateString();
    const items = careReminders
      .filter((r) => r.taskType === 'MEDICATION' && new Date(r.scheduledAt).toDateString() === todayStr)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .map((r) => ({
        id: r._id,
        title: r.taskTitle,
        time: new Date(r.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        taken: MED_DONE_STATUSES.includes(r.response) || MED_DONE_STATUSES.includes(r.status),
      }));
    const doneCount = items.filter((i) => i.taken).length;
    return { items, total: items.length, doneCount };
  }, [careReminders]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header — always visible */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.white }}>
        <View style={s.header}>
          <View style={s.headerLogoMark}>
            <LogoMark width={28} height={28} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.greeting}>{greeting},</Text>
            <Text style={s.name}>{user?.name || 'Patient'}</Text>
          </View>
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => Alert.alert('Notifications', 'No new notifications')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
      >
        {/* ── Today hero: the single door to check-in ── */}
        <TouchableOpacity
          style={checkedInToday ? s.todayHero : s.todayHeroTouchable}
          onPress={() => checkedInToday ? navigation.navigate('WeeklyReport') : navigation.navigate('Symptom')}
          activeOpacity={0.92}
        >
          {checkedInToday ? (
            <>
              <View style={s.heroRow}>
                <SeverityGauge severity={severity} size={52} strokeWidth={5} color={status.color}>
                  <Ionicons name={status.icon} size={24} color={status.color} />
                </SeverityGauge>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.heroEyebrow}>Today</Text>
                  <Text style={s.heroTitle}>{status.text}</Text>
                  <Text style={s.heroHint}>{statusHint}</Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </View>
              {latestResponses.length > 0 && (
                <LastCheckin
                  lastCheckinDate={lastCheckinDate}
                  worst={worst}
                  showCareTeamCta={showCareTeamCta}
                  onPressCareTeam={() => navigation.navigate('CareTeam')}
                />
              )}
            </>
          ) : (
            <LinearGradient
              colors={['#E7F8F2', '#F8FDFC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.todayHeroGradient}
            >
              <View style={s.heroIllustration} pointerEvents="none">
                <CheckInIllustration size={58} />
              </View>

              <View style={s.heroTextWrap}>
                <Text style={s.heroTitle}>How are you feeling today?</Text>
                <Text style={s.heroHint}>Your daily check-in helps your care team understand how you're doing.</Text>
              </View>

              <View style={s.heroCta}>
                <Text style={s.heroCtaText}>Check In</Text>
                <View style={s.heroCtaIcon}>
                  <Ionicons name="arrow-forward" size={14} color={C.teal} />
                </View>
              </View>

              {latestResponses.length > 0 && (
                <LastCheckin
                  lastCheckinDate={lastCheckinDate}
                  worst={worst}
                  showCareTeamCta={showCareTeamCta}
                  onPressCareTeam={() => navigation.navigate('CareTeam')}
                />
              )}
            </LinearGradient>
          )}
        </TouchableOpacity>

        {/* ── Medications Today: adherence, elevated out of a generic tile.
             Always shown — never disappears when empty, matches how every
             other card on this screen (e.g. Next Up) handles no-data. ── */}
        <View style={s.medsCard}>
          <View style={s.medsHead}>
            <Text style={s.sectionLabel}>MEDICATIONS TODAY</Text>
            {medsToday.total > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Reminders')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.medsViewAll}>View All ›</Text>
              </TouchableOpacity>
            )}
          </View>
          {medsToday.total === 0 ? (
            <Text style={s.medsEmptyText}>No medications scheduled for today.</Text>
          ) : (
            medsToday.items.map((m) => (
              <View key={m.id} style={s.medItemRow}>
                <Text style={s.medItemTime}>{m.time}</Text>
                <Text style={s.medItemName} numberOfLines={1}>{m.title}</Text>
                {m.taken ? (
                  <View style={s.medStatusDone}>
                    <Ionicons name="checkmark" size={12} color={C.green} />
                    <Text style={s.medStatusDoneText}>Taken</Text>
                  </View>
                ) : (
                  <View style={s.medStatusPending}>
                    <Ionicons name="time-outline" size={12} color={C.amber} />
                    <Text style={s.medStatusPendingText}>Pending</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* ── Weekly Report + Care Team: two pure navigation rows, no own
             per-item status — merged into one plain list per Design DNA v2
             §14.3/14.4 (identical bordered-box repetition was the flagged
             violation), instead of two separate bordered cards. ── */}
        <View style={s.navList}>
          <TouchableOpacity style={s.navRow} onPress={() => navigation.navigate('WeeklyReport')} activeOpacity={0.7}>
            <View style={[s.navIconBox, { backgroundColor: colors.primaryTint }]}>
              <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.navRowTitle}>{checkinDays} of 7 days checked in this week</Text>
              <Text style={s.navRowSub}>Consistency helps your care team understand you better</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>

          <View style={s.navDivider} />

          <TouchableOpacity
            style={s.navRow}
            onPress={() => navigation.navigate('Chat', { withUserId: user?.assignedNavigatorId, name: 'Navigator' })}
            activeOpacity={0.7}
          >
            <View style={[s.navIconBox, { backgroundColor: colors.marigoldTint }]}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.accentViolet} />
            </View>
            <Text style={[s.navRowTitle, { flex: 1, marginLeft: 12 }]}>Message your Care Guide</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionLabel}>NEXT UP</Text>
        <NextUpCard nextItem={nextItem} onPress={() => navigation.navigate('Reminders')} />
      </ScrollView>

      <BottomNav active="Home" navigation={navigation} />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Below-the-divider severity summary of the patient's most recent check-in.
// Shared by both Today-hero states — "not checked in today" (may point at a
// stale entry) and "checked in today" (points at today's own entry) — so the
// four states in 05-home.md §5.2 render identically in either case instead of
// only existing in one branch.
function LastCheckin({ lastCheckinDate, worst, showCareTeamCta, onPressCareTeam }) {
  return (
    <View style={s.lastCheckin}>
      <View style={s.lastCheckinRow}>
        <Ionicons name="time-outline" size={13} color={C.muted} style={{ marginTop: 2 }} />
        {worst.tier === 'steady' && (
          <Text style={s.lastCheckinText}>
            Last check-in <Text style={s.bold}>{relativeDayLabel(lastCheckinDate)}</Text> — feeling steady, nothing stood out.
          </Text>
        )}
        {worst.tier === 'moderate' && (
          <Text style={s.lastCheckinText}>
            Last check-in <Text style={s.bold}>{relativeDayLabel(lastCheckinDate)}</Text> — {worst.name} felt a bit tougher than usual.
          </Text>
        )}
        {worst.tier === 'attention' && (
          <Text style={s.lastCheckinText}>
            Last check-in <Text style={s.bold}>{relativeDayLabel(lastCheckinDate)}</Text> — {worst.name} needed extra attention.
          </Text>
        )}
      </View>
      {showCareTeamCta && (
        <TouchableOpacity
          style={s.careTeamLink}
          onPress={onPressCareTeam}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chatbubble-outline" size={13} color={C.teal} />
          <Text style={s.careTeamLinkText}>Talk to your Care Team</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function NextUpCard({ nextItem, onPress }) {
  if (!nextItem) {
    return (
      <View style={s.nextEmpty}>
        <Illustration name="appointment_empty" size={72} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.nextEmptyTitle}>No upcoming appointments</Text>
          <Text style={s.nextEmptySub}>Your appointments will appear here</Text>
        </View>
      </View>
    );
  }

  const data = nextItem.data;
  const date = new Date(nextItem.when);
  const day = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];
  const subtitle = `${(data.type || 'Reminder').toUpperCase()} · Due ${date.toLocaleDateString()}`;

  return (
    <TouchableOpacity style={s.apptCard} onPress={onPress} activeOpacity={0.7}>
      <View style={s.apptDateBox}>
        <Text style={s.apptDay}>{day}</Text>
        <Text style={s.apptMon}>{mon}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={s.apptTitle} numberOfLines={2}>{data.title}</Text>
        <Text style={s.apptSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerLogoMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  greeting: { color: C.muted, fontSize: 12, lineHeight: 16 },
  name: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 2, lineHeight: 22 },
  bellBtn: { padding: 4 },

  // ── Body ──
  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 40 },

  // ── Today hero ──
  todayHero: {
    backgroundColor: '#EDF7F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  todayHeroTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  todayHeroGradient: {
    borderRadius: 16,
    padding: 16,
  },
  heroIllustration: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  heroTextWrap: { paddingRight: 72 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: C.teal, textTransform: 'uppercase', marginBottom: 2 },
  heroTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 3, lineHeight: 21 },
  heroHint: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: C.teal,
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 14,
  },
  heroCtaText: { color: colors.white, fontSize: 12, fontWeight: '800', marginRight: 10 },
  heroCtaIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },

  lastCheckin: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,116,158,0.12)',
  },
  lastCheckinRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  lastCheckinText: { flex: 1, fontSize: 11.5, color: C.textSub, lineHeight: 17 },
  bold: { fontWeight: '700', color: C.text },
  careTeamLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  careTeamLinkText: { fontSize: 12, fontWeight: '700', color: C.teal },

  // ── Medications Today ── tinted fill + real elevation, no border: this is
  // a status/data card (per-item taken/pending), not a bare wayfinding link.
  medsCard: {
    backgroundColor: colors.marigoldTint,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    ...shadows.sm,
  },
  medsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  medsViewAll: { fontSize: 12, fontWeight: '700', color: C.teal },
  medsEmptyText: { fontSize: 12, color: C.muted, paddingVertical: 4 },
  medItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    gap: 10,
  },
  medItemTime: { fontSize: 11, color: C.muted, width: 62 },
  medItemName: { flex: 1, fontSize: 13, fontWeight: '600', color: C.text },
  medStatusDone: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  medStatusDoneText: { fontSize: 11, fontWeight: '700', color: C.green },
  medStatusPending: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  medStatusPendingText: { fontSize: 11, fontWeight: '700', color: C.amber },

  // ── Weekly Report + Care Team: one plain list, no card chrome at all — two
  // pure navigation rows collapsed per Design DNA v2 §14.3/14.4 (the flagged
  // "three identical bordered boxes" was the medsCard/weeklyCard/careRow trio).
  navList: { marginBottom: 18 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  navDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  navIconBox: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  navRowTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  navRowSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  // ── Section label ──
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // ── Next Up ──
  nextEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    ...shadows.sm,
  },
  nextEmptyTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 3 },
  nextEmptySub: { fontSize: 12, color: C.muted },

  apptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: C.teal,
    ...shadows.sm,
  },
  apptDateBox: {
    backgroundColor: C.tealPale,
    borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', minWidth: 48,
  },
  apptDay: { fontSize: 20, fontWeight: '700', color: C.teal, lineHeight: 22 },
  apptMon: { fontSize: 9, color: C.teal, fontWeight: '700', letterSpacing: 0.5 },
  apptTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 3 },
  apptSub: { fontSize: 11, color: C.muted, marginTop: 1 },

  // ── Shared ──
  chevron: { color: C.muted, fontSize: 24, fontWeight: '300', marginLeft: 4 },
});
