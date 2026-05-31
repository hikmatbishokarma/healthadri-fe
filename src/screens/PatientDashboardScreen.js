import { useEffect, useState, useCallback } from 'react';
import Illustration from '../components/Illustration';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getLatestTriage,
  getLatestSymptomEntry,
  getAppointments,
  getPatientReminders,
  getThread,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import RemindersScreen from './RemindersScreen';
import ChatScreen from './ChatScreen';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  tealPale: '#E8F5F1',
  tealMid: '#B2D8CF',
  red: '#E53935',
  redPale: '#FEE2E2',
  redBorder: '#FECACA',
  amber: '#F59E0B',
  green: '#22C55E',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#111827',
  textSub: '#4B5563',
  muted: '#9CA3AF',
  border: '#E5E7EB',
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PatientDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [triage, setTriage] = useState(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [nextItem, setNextItem] = useState(null);
  const [urgentReminder, setUrgentReminder] = useState(null);
  const [recentNavMessage, setRecentNavMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?._id) return;
    try {
      const navId = user.assignedNavigatorId;
      const nil = { data: null };
      const [triageRes, entryRes, apptRes, remRes, msgRes] = await Promise.all([
        getLatestTriage(user._id).catch(() => nil),
        getLatestSymptomEntry(user._id).catch(() => nil),
        getAppointments(user._id).catch(() => nil),
        getPatientReminders(user._id).catch(() => nil),
        navId ? getThread(user._id).catch(() => nil) : Promise.resolve(nil),
      ]);
      setTriage(triageRes.data);

      const entry = entryRes.data;
      if (entry?.createdAt) {
        const entryDate = new Date(entry.createdAt);
        const today = new Date();
        setCheckedInToday(entryDate.toDateString() === today.toDateString());
      } else {
        setCheckedInToday(false);
      }

      // ── secondary: appointments / reminders / messages ──
      try {
        const now = Date.now();
        const items = [];
        (apptRes.data || []).forEach((a) => {
          const when = new Date(a.scheduledAt).getTime();
          const finalized = ['completed', 'cancelled', 'missed'].includes(a.status);
          if (!finalized && when >= now) items.push({ kind: 'appointment', when, data: a });
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
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setRecentNavMessage(fromNav || null);
      } catch {
        setNextItem(null);
        setUrgentReminder(null);
        setRecentNavMessage(null);
      }
    } catch {
      setTriage(null);
      setCheckedInToday(false);
      setNextItem(null);
      setUrgentReminder(null);
      setRecentNavMessage(null);
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
        : severity === 'LOW' || (!severity && checkedInToday)
          ? { icon: 'happy-outline', text: 'Feeling well today', color: C.green }
          : { icon: 'happy-outline', text: 'Tap to check in', color: C.muted };

  const [activeTab, setActiveTab] = useState('Home');

  const comingSoon = (label) => Alert.alert(label, 'Coming soon');

  const initials = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('') ?? 'P';
  const greeting = timeGreeting();
  const statusHint =
    severity === 'HIGH' ? 'Please take care and rest well.' :
    severity === 'MED'  ? 'Monitor your symptoms closely.' :
    severity === 'LOW' || (!severity && checkedInToday) ? "You're doing great, keep it up!" :
    'Log your symptoms to get started.';

  const quickActions = [
    { img: require('../../assets/icons/stethoscope.png'),      label: 'Check\nSymptoms', bg: '#E8F5F1', tint: '#1A6B5A', onPress: () => navigation.navigate('Symptom') },
    { ionIcon: 'chatbubble-outline', iconColor: '#7C3AED',       label: 'Message\nTeam',   bg: '#EDE9FE',                  onPress: () => navigation.navigate('Chat', { withUserId: user?.assignedNavigatorId, name: 'Navigator' }) },
    { ionIcon: 'alarm-outline',      iconColor: '#EF4444',       label: 'Reminders',        bg: '#FEE2E2',                  onPress: () => navigation.navigate('Reminders') },
    // { img: require('../../assets/icons/hospital.png'),       label: 'Find\nHospital',   bg: '#DBEAFE', tint: '#1D4ED8', onPress: () => navigation.navigate('Hospitals') },
    { img: require('../../assets/icons/insurance-card.png'), label: 'Insurance\nHelp',  bg: '#FEF3C7', tint: '#D97706', onPress: () => comingSoon('Insurance Help') },
    { img: require('../../assets/icons/health.png'),          label: 'My\nWellbeing',    bg: '#DCFCE7', tint: '#16A34A', onPress: () => comingSoon('My Wellbeing') },
    { img: require('../../assets/icons/book.png'),            label: 'Learn',             bg: '#EEF2FF', tint: '#4338CA', onPress: () => comingSoon('Awareness') },
    { ionIcon: 'people-outline',     iconColor: '#EA580C',       label: 'Caregiver',         bg: '#FFEDD5',                  onPress: () => comingSoon('Caregiver') },
  ];

  const PATIENT_TABS = [
    { id: 'Home',      icon: 'home-outline',       iconActive: 'home',       label: 'Home' },
    { id: 'CheckIn',   icon: 'pulse-outline',       iconActive: 'pulse',      label: 'Check In' },
    { id: 'Reminders', icon: 'alarm-outline',       iconActive: 'alarm',      label: 'Reminders' },
    { id: 'Messages',  icon: 'chatbubble-outline',  iconActive: 'chatbubble', label: 'Messages' },
    { id: 'Profile',   icon: 'person-outline',      iconActive: 'person',     label: 'Profile' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header — always visible */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View style={s.header}>
          <View style={s.headerLogoMark}>
            <View style={s.miniCrossH} />
            <View style={s.miniCrossV} />
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
            <Ionicons name="notifications-outline" size={22} color="#1A3C34" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── HOME TAB ── */}
      {activeTab === 'Home' && (
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
        >
          <TouchableOpacity
            style={s.statusCard}
            onPress={() => (severity || checkedInToday)
              ? navigation.navigate('WeeklyReport')
              : navigation.navigate('Symptom')}
            activeOpacity={0.92}
          >
            <View style={s.statusDeco} pointerEvents="none">
              <Ionicons name="heart" size={22} color="#4CAF50" style={s.decoHeart} />
              <Text style={s.decoPlus}>+</Text>
            </View>
            <Ionicons name={status.icon} size={36} color={status.color} style={s.statusFace} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.statusLabel}>How you're feeling today?</Text>
              <Text style={s.statusTitle}>{status.text}</Text>
              <Text style={s.statusHint}>{statusHint}</Text>
            </View>
            <View style={s.logBtn}>
              <Text style={s.logBtnText}>
                {(severity || checkedInToday) ? 'View Report ›' : 'Log Symptoms ›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.weeklyCard} onPress={() => navigation.navigate('WeeklyReport')} activeOpacity={0.7}>
            <View style={s.weeklyIconBox}>
              <Ionicons name="bar-chart-outline" size={22} color="#1A6B5A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.weeklyTitle}>See your weekly report</Text>
              <Text style={s.weeklySub}>Track your health progress</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>

          <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
          <View style={s.quickGrid}>
            {quickActions.map((item, i) => (
              <TouchableOpacity key={i} style={s.quickItem} onPress={item.onPress} activeOpacity={0.7}>
                <View style={[s.quickIconBox, { backgroundColor: item.bg }]}>
                  {item.img
                    ? <Image source={item.img} style={[s.quickIconImg, item.tint && { tintColor: item.tint }]} />
                    : <Ionicons name={item.ionIcon} size={24} color={item.iconColor || '#374151'} />}
                </View>
                <Text style={s.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {urgentReminder && (
            <TouchableOpacity
              style={[s.alertCard, { backgroundColor: C.redPale, borderColor: C.redBorder }]}
              onPress={() => navigation.navigate('Reminders')}
              activeOpacity={0.7}
            >
              <Ionicons name="warning-outline" size={22} color="#B45309" style={s.alertIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>
                  {(urgentReminder.type || 'Reminder').toUpperCase()} due {dueLabel(urgentReminder.date)}
                </Text>
                <Text style={s.alertDesc}>{urgentReminder.title}</Text>
              </View>
            </TouchableOpacity>
          )}
          {recentNavMessage && (
            <TouchableOpacity
              style={[s.alertCard, { backgroundColor: C.tealPale, borderColor: C.tealMid }]}
              onPress={() => navigation.navigate('Chat', { withUserId: user?.assignedNavigatorId, name: 'Navigator' })}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={22} color="#1A6B5A" style={s.alertIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>Message from your navigator</Text>
                <Text style={s.alertDesc} numberOfLines={2}>"{recentNavMessage.text}"</Text>
              </View>
            </TouchableOpacity>
          )}

          <Text style={s.sectionLabel}>NEXT UP</Text>
          <NextUpCard nextItem={nextItem} onPress={() => navigation.navigate('Reminders')} />

          <TouchableOpacity
            style={s.navCard}
            onPress={() => navigation.navigate('Chat', { withUserId: user?.assignedNavigatorId, name: 'Navigator' })}
            activeOpacity={0.75}
          >
            <View style={s.navIconBox}>
              <Ionicons name="shield-checkmark-outline" size={26} color="#1A6B5A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.navTitle}>Speak to your care navigator</Text>
              <Text style={s.navSub}>We're here to support you every step of the way</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── CHECK IN TAB ── */}
      {activeTab === 'CheckIn' && (
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={s.checkinHeader}>
            <Text style={s.checkinTitle}>Daily Check-in</Text>
            <Text style={s.checkinSubtitle}>
              {(severity || checkedInToday) ? 'Checked in today' : 'How are you feeling today?'}
            </Text>
          </View>

          <TouchableOpacity
            style={s.checkinCard}
            onPress={() => (severity || checkedInToday)
              ? navigation.navigate('WeeklyReport')
              : navigation.navigate('Symptom')}
            activeOpacity={0.88}
          >
            <View style={s.statusDeco} pointerEvents="none">
              <Ionicons name="heart" size={22} color="#4CAF50" style={s.decoHeart} />
              <Text style={s.decoPlus}>+</Text>
            </View>
            <Ionicons name={status.icon} size={36} color={status.color} style={s.checkinFace} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.checkinCardLabel}>Today's status</Text>
              <Text style={s.checkinCardTitle}>{status.text}</Text>
              <Text style={s.checkinCardHint}>{statusHint}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.checkinStartBtn, (severity || checkedInToday) && s.checkinUpdateBtn]}
            onPress={() => navigation.navigate('Symptom')}
            activeOpacity={0.85}
          >
            <Ionicons name="pulse" size={20} color="#fff" />
            <Text style={s.checkinStartText}>
              {(severity || checkedInToday) ? 'Update Check-in' : "Start Today's Check-in"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={s.weeklyCard} onPress={() => navigation.navigate('WeeklyReport')} activeOpacity={0.7}>
            <View style={s.weeklyIconBox}>
              <Ionicons name="bar-chart-outline" size={22} color="#1A6B5A" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.weeklyTitle}>See your weekly report</Text>
              <Text style={s.weeklySub}>View your symptom trends</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'Profile' && (
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={s.profileCard}>
            <View style={s.profileAvatar}>
              <Text style={s.profileAvatarText}>{initials}</Text>
            </View>
            <Text style={s.profileName}>{user?.name || 'Patient'}</Text>
            {user?.patientCode && (
              <View style={s.profileCodeBadge}>
                <Text style={s.profileCodeText}>{user.patientCode}</Text>
              </View>
            )}
            <Text style={s.profilePhone}>{user?.phone || ''}</Text>
          </View>

          <View style={s.profileSection}>
            {[
              { icon: 'person-outline', label: 'Edit Profile', onPress: () => navigation.navigate('Profile') },
              { icon: 'document-text-outline', label: 'Medical Records', onPress: () => navigation.navigate('MedicalRecords') },
              { icon: 'notifications-outline', label: 'Reminders', onPress: () => navigation.navigate('Reminders') },
            ].map((item, i, arr) => (
              <TouchableOpacity
                key={item.label}
                style={[s.profileRow, i < arr.length - 1 && s.profileRowBorder]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={s.profileRowIcon}>
                  <Ionicons name={item.icon} size={18} color={C.teal} />
                </View>
                <Text style={s.profileRowLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.signOut} onPress={signOut}>
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── REMINDERS TAB ── */}
      {activeTab === 'Reminders' && (
        <View style={{ flex: 1 }}>
          <RemindersScreen navigation={navigation} route={{ params: {} }} embedded />
        </View>
      )}

      {/* ── MESSAGES TAB ── */}
      {activeTab === 'Messages' && (
        <View style={{ flex: 1 }}>
          <ChatScreen
            navigation={navigation}
            route={{ params: { withUserId: user?.assignedNavigatorId, name: 'Care Team' } }}
            embedded
          />
        </View>
      )}

      {/* ── BOTTOM TAB BAR ── */}
      <SafeAreaView edges={['bottom']} style={s.tabBar}>
        {PATIENT_TABS.map((tab) => {
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
      </SafeAreaView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

  const isAppt = nextItem.kind === 'appointment';
  const data = nextItem.data;
  const date = new Date(nextItem.when);
  const day = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];

  const subtitleParts = [];
  if (isAppt) {
    if (data.doctor) subtitleParts.push(data.doctor);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    subtitleParts.push(data.location ? `${data.location} · ${time}` : time);
  } else {
    subtitleParts.push(`${(data.type || 'Reminder').toUpperCase()} · Due ${date.toLocaleDateString()}`);
  }

  return (
    <TouchableOpacity style={s.apptCard} onPress={onPress} activeOpacity={0.7}>
      <View style={s.apptDateBox}>
        <Text style={s.apptDay}>{day}</Text>
        <Text style={s.apptMon}>{mon}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={s.apptTitle} numberOfLines={2}>{data.title}</Text>
        {subtitleParts[0] ? <Text style={s.apptSub} numberOfLines={1}>{subtitleParts[0]}</Text> : null}
        {subtitleParts[1] ? <Text style={s.apptSub} numberOfLines={1}>{subtitleParts[1]}</Text> : null}
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerLogoMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  miniCrossH: { position: 'absolute', width: 24, height: 6, borderRadius: 3, backgroundColor: C.teal },
  miniCrossV: { position: 'absolute', width: 6, height: 24, borderRadius: 3, backgroundColor: C.teal },
  greeting: { color: C.muted, fontSize: 12 },
  name: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 1 },
  bellBtn: { padding: 4 },

  // ── Status card (body) ──
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF7F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statusDeco: {
    position: 'absolute',
    right: -14,
    top: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decoHeart: { fontSize: 90, opacity: 0.18 },
  decoPlus: {
    position: 'absolute',
    fontSize: 32,
    fontWeight: '900',
    color: '#1A6B5A',
    opacity: 0.25,
    top: 20,
    right: 18,
  },
  statusFace: { fontSize: 40, lineHeight: 46 },
  statusLabel: { fontSize: 11, color: C.muted, marginBottom: 3 },
  statusTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 3, lineHeight: 22 },
  statusHint: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  logBtn: {
    alignSelf: 'center',
    marginLeft: 10,
    borderWidth: 1.5,
    borderColor: C.teal,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logBtnText: { color: C.teal, fontSize: 11, fontWeight: '700' },

  // ── Body ──
  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 40 },

  // ── Weekly report card ──
  weeklyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  weeklyIconBox: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  weeklyTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  weeklySub: { fontSize: 12, color: C.muted, marginTop: 2 },

  // ── Section label ──
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // ── Quick actions grid ──
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  quickItem: {
    width: '22%',
    flexGrow: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  quickIconBox: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  quickIcon: { fontSize: 22 },
  quickIconImg: { width: 26, height: 26, resizeMode: 'contain' },
  quickLabel: {
    fontSize: 10, fontWeight: '600', color: C.text,
    textAlign: 'center', lineHeight: 13,
  },

  // ── Alert cards ──
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10,
  },
  alertIcon: { fontSize: 16, marginTop: 1 },
  alertTitle: { fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 3 },
  alertDesc: { fontSize: 11, color: C.muted, lineHeight: 16 },

  // ── Next Up ──
  nextEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nextEmptyIcon: { fontSize: 36 },
  nextEmptyTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 3 },
  nextEmptySub: { fontSize: 12, color: C.muted },

  apptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: C.teal,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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

  // ── Navigator contact card ──
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.tealPale,
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
  },
  navIconBox: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: 'rgba(26,107,90,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 14, fontWeight: '700', color: C.teal, marginBottom: 3 },
  navSub: { fontSize: 12, color: C.textSub, lineHeight: 17 },

  // ── Shared ──
  chevron: { color: C.muted, fontSize: 24, fontWeight: '300', marginLeft: 4 },
  signOut: { alignItems: 'center', paddingVertical: 6, marginTop: 4 },
  signOutText: { color: C.muted, fontSize: 12 },

  // ── Bottom tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingTop: 10,
    paddingBottom: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 10, color: C.muted, fontWeight: '500' },
  tabLabelActive: { color: C.teal, fontWeight: '700' },

  // ── Profile tab ──
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  profileName: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 6 },
  profileCodeBadge: {
    backgroundColor: C.tealPale, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 99, marginBottom: 6,
  },
  profileCodeText: { fontSize: 12, color: C.teal, fontWeight: '700', letterSpacing: 0.5 },
  profilePhone: { fontSize: 13, color: C.muted },
  profileSection: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  profileRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  profileRowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.tealPale, alignItems: 'center', justifyContent: 'center',
  },
  profileRowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },

  // ── Check In tab ──
  checkinHeader: { alignItems: 'center', marginBottom: 20 },
  checkinTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  checkinSubtitle: { fontSize: 14, color: C.muted },
  checkinCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDF7F2', borderRadius: 18, padding: 18,
    marginBottom: 16, overflow: 'hidden',
  },
  checkinFace: { fontSize: 44, lineHeight: 50 },
  checkinCardLabel: { fontSize: 11, color: C.muted, marginBottom: 3 },
  checkinCardTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 3 },
  checkinCardHint: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  checkinStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.teal, borderRadius: 16, paddingVertical: 16, gap: 10,
    marginBottom: 16,
    shadowColor: C.teal, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  checkinStartText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  checkinUpdateBtn: {
    backgroundColor: C.tealDark,
    shadowOpacity: 0.15,
  },
});
