import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getNavigatorDashboard, getNavigatorPatients, getNavigatorDrafts, getInbox } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── helpers ─────────────────────────────────────────────────────────────────

const SEVERITY = {
  HIGH: { bg: '#FEE2E2', fg: '#DC2626', label: 'HIGH' },
  MED:  { bg: '#FEF3C7', fg: '#D97706', label: 'MED' },
  LOW:  { bg: '#DCFCE7', fg: '#16A34A', label: 'LOW' },
};

const AVATAR_COLORS = [
  { bg: '#E8F5F0', fg: '#1A6B5A' },
  { bg: '#EFF6FF', fg: '#2563EB' },
  { bg: '#F5F3FF', fg: '#7C3AED' },
  { bg: '#FEF3C7', fg: '#D97706' },
  { bg: '#FCE7F3', fg: '#DB2777' },
  { bg: '#FFF7ED', fg: '#EA580C' },
];

function avatarColor(name = '') {
  const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || '?').toUpperCase();
}

function formatMsgTime(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const diff = now - d;
  if (diff < 2 * 24 * 60 * 60 * 1000) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── main component ───────────────────────────────────────────────────────────

export default function NavigatorDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');

  // Dashboard state
  const [summary, setSummary] = useState({
    totalPatients: 0, highPriority: 0, highPriorityChange: 0,
    alerts: 0, alertsChange: 0, followupsDue: 0, followupsDueChange: 0,
  });
  const [priorityText, setPriorityText] = useState('');
  const [highPriorityPatients, setHighPriorityPatients] = useState([]);
  const [draftCount, setDraftCount] = useState(0);
  const [inbox, setInbox] = useState([]);

  // Patients tab state
  const [allPatients, setAllPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [dashRes, patientsRes, draftsRes] = await Promise.all([
        getNavigatorDashboard(user._id),
        getNavigatorPatients(user._id),
        getNavigatorDrafts(user._id),
      ]);
      const dash = dashRes.data || {};
      setSummary(dash.summary || {});
      setPriorityText(dash.priorityQueueText || '');
      setHighPriorityPatients(dash.highPriorityPatients || []);
      setAllPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
      setDraftCount(Array.isArray(draftsRes.data) ? draftsRes.data.length : 0);
    } catch {
      setAllPatients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  useEffect(() => {
    if (activeTab === 'Messages' && user?._id) {
      getInbox(user._id)
        .then((res) => setInbox(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }
  }, [activeTab, user]);

  const openPatient = (item) =>
    navigation.navigate('PlaybookActive', {
      patientId: item._id,
      patientName: item.name,
    });

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#1A6B5A" size="large" />
      </View>
    );
  }

  // Filter logic for patients tab
  const filteredPatients = allPatients.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const today = new Date().toDateString();
    const matchFilter =
      activeFilter === 'All' ||
      (activeFilter === 'High' && p.priority === 'HIGH') ||
      (activeFilter === 'Medium' && p.priority === 'MED') ||
      (activeFilter === 'Low' && p.priority === 'LOW') ||
      (activeFilter === 'Due Today' &&
        !!p.followupDate &&
        new Date(p.followupDate).toDateString() === today);
    return matchSearch && matchFilter;
  });

  const filterCounts = {
    All: allPatients.length,
    High: allPatients.filter((p) => p.priority === 'HIGH').length,
    Medium: allPatients.filter((p) => p.priority === 'MED').length,
    Low: allPatients.filter((p) => p.priority === 'LOW').length,
    'Due Today': 0,
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── HOME TAB ─────────────────────────────────────────── */}
      {activeTab === 'Home' && (
        <>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLogoMark}>
              <View style={s.miniCrossH} />
              <View style={s.miniCrossV} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.greeting}>{getGreeting()}, {(user?.name || '').split(' ')[0]} 👋</Text>
              <Text style={s.headerTitle}>Home</Text>
            </View>
            <TouchableOpacity style={s.bellBtn}>
              <Ionicons name="notifications-outline" size={22} color="#1A3C34" />
              <View style={s.bellBadge}><Text style={s.bellBadgeText}>3</Text></View>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B5A" />}
            showsVerticalScrollIndicator={false}
          >
            {/* Today at a glance */}
            <View style={s.glanceHeader}>
              <Text style={s.glanceTitle}>Today at a glance</Text>
              <Text style={s.glanceDate}>{formatDate()}</Text>
            </View>

            <View style={s.statsGrid}>
              <StatCard
                icon="people-outline" iconBg="#E8F5F0" iconColor="#1A6B5A"
                value={summary.totalPatients} label="My Patients"
                change={summary.highPriorityChange} period="vs last 7 days"
                changeColor="#16A34A"
              />
              <StatCard
                icon="alert-circle-outline" iconBg="#FEE2E2" iconColor="#DC2626"
                value={summary.highPriority} label="High Priority"
                change={summary.highPriorityChange} period="vs yesterday"
                changeColor="#DC2626"
              />
              <StatCard
                icon="time-outline" iconBg="#FFF7ED" iconColor="#EA580C"
                value={summary.followupsDue} label="Follow-ups Due"
                change={summary.followupsDueChange} period="vs yesterday"
                changeColor="#EA580C"
              />
              <StatCard
                icon="chatbubble-outline" iconBg="#F5F3FF" iconColor="#7C3AED"
                value={summary.alerts} label="Alerts"
                change={summary.alertsChange} period="vs yesterday"
                changeColor="#7C3AED"
              />
            </View>

            {/* AI Priority Queue */}
            <TouchableOpacity
              style={s.aiCard}
              activeOpacity={0.85}
              onPress={() => highPriorityPatients[0] && openPatient(highPriorityPatients[0])}
            >
              <View style={s.aiCardTop}>
                <View style={s.aiIconCircle}>
                  <Ionicons name="sparkles" size={16} color="#7C3AED" />
                </View>
                <Text style={s.aiCardTitle}>AI Priority Queue — Today</Text>
                {summary.highPriority > 0 && (
                  <View style={s.aiHighBadge}>
                    <Text style={s.aiHighBadgeText}>{summary.highPriority} High Priority</Text>
                  </View>
                )}
              </View>
              <Text style={s.aiCardBody}>
                {priorityText || 'No active playbooks today.'}
              </Text>
              <View style={s.aiChevronRow}>
                <Text style={s.aiChevronText}>Review and take action.</Text>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
              </View>
            </TouchableOpacity>

            {/* High Priority Patients */}
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>High Priority Patients</Text>
              <TouchableOpacity onPress={() => setActiveTab('Patients')}>
                <Text style={s.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={highPriorityPatients.slice(0, 3)}
              keyExtractor={(item, idx) => item._id || String(idx)}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <HomePatientRow item={item} onPress={() => openPatient(item)} />
              )}
              ListEmptyComponent={
                <View style={s.emptyCard}>
                  <Ionicons name="checkmark-circle-outline" size={28} color="#1A6B5A" />
                  <Text style={s.emptyText}>No high priority alerts right now</Text>
                </View>
              }
            />

            {/* Drafts banner */}
            {draftCount > 0 && (
              <TouchableOpacity
                style={s.draftsBanner}
                onPress={() => navigation.navigate('DraftsList')}
                activeOpacity={0.85}
              >
                <View style={s.draftsIconCircle}>
                  <Ionicons name="document-text-outline" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.draftsBannerTitle}>
                    {draftCount} draft{draftCount === 1 ? '' : 's'} to review
                  </Text>
                  <Text style={s.draftsBannerSub}>
                    Verify AI-extracted reminders before publishing to patients.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D97706" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      )}

      {/* ── PATIENTS TAB ─────────────────────────────────────── */}
      {activeTab === 'Patients' && (
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <View style={s.patientsHeader}>
            <Text style={s.patientsHeaderTitle}>My Patients</Text>
            <TouchableOpacity style={s.filterIconBtn}>
              <Ionicons name="options-outline" size={22} color="#1A3C34" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Search patients by name or ID..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              underlineColorAndroid="transparent"
            />
          </View>

          {/* Filter pills */}
          <View style={s.pillsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.pillsRow}
            >
              {['All', 'High', 'Medium', 'Low', 'Due Today'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[s.pill, activeFilter === f && s.pillActive]}
                  onPress={() => setActiveFilter(f)}
                >
                  <Text style={[s.pillText, activeFilter === f && s.pillTextActive]}>
                    {f} ({filterCounts[f] ?? 0})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredPatients}
            keyExtractor={(item, idx) => item._id || String(idx)}
            contentContainerStyle={s.patientsList}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B5A" />}
            ListHeaderComponent={
              <View style={s.assignedRow}>
                <Text style={s.assignedLabel}>Assigned to you</Text>
                <Text style={s.assignedCount}>{filteredPatients.length} patients</Text>
              </View>
            }
            renderItem={({ item }) => (
              <PatientCard item={item} onPress={() => openPatient(item)} />
            )}
            ListEmptyComponent={
              <View style={s.emptyCard}>
                <Ionicons name="people-outline" size={28} color="#94A3B8" />
                <Text style={s.emptyText}>No patients found</Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── ALERTS TAB ───────────────────────────────────────── */}
      {activeTab === 'Alerts' && (
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <View style={s.patientsHeader}>
            <Text style={s.patientsHeaderTitle}>Alerts</Text>
            {summary.highPriority > 0 && (
              <View style={[s.badge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[s.badgeText, { color: '#DC2626' }]}>{summary.highPriority} HIGH</Text>
              </View>
            )}
          </View>
          <FlatList
            data={allPatients.filter(p => p.priority !== 'LOW' || p.topSymptom)}
            keyExtractor={(item, idx) => item._id || String(idx)}
            contentContainerStyle={s.patientsList}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B5A" />}
            renderItem={({ item }) => {
              const sev = { HIGH: { bg: '#FEE2E2', fg: '#DC2626' }, MED: { bg: '#FEF3C7', fg: '#D97706' }, LOW: { bg: '#DCFCE7', fg: '#16A34A' } }[item.priority] || { bg: '#DCFCE7', fg: '#16A34A' };
              const av = avatarColor(item.name);
              return (
                <TouchableOpacity style={s.alertRow} onPress={() => openPatient(item)} activeOpacity={0.8}>
                  <View style={[s.avatarCircle, { backgroundColor: av.bg }]}>
                    <Text style={[s.avatarText, { color: av.fg }]}>{getInitials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{item.name}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {[item.cancerType, item.stage].filter(Boolean).join(' • ') || 'No cancer info'}
                    </Text>
                    {item.topSymptom && (
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{item.topSymptom}</Text>
                    )}
                  </View>
                  <View style={[s.badge, { backgroundColor: sev.bg }]}>
                    <Text style={[s.badgeText, { color: sev.fg }]}>{item.priority}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={s.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#1A6B5A" />
                <Text style={s.emptyText}>No active alerts right now</Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── MESSAGES TAB ─────────────────────────────────────── */}
      {activeTab === 'Messages' && (
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <View style={s.patientsHeader}>
            <Text style={s.patientsHeaderTitle}>Messages</Text>
            <Text style={s.assignedCount}>{inbox.length} conversations</Text>
          </View>
          <FlatList
            data={inbox}
            keyExtractor={(item, idx) => item.conversation?._id || String(idx)}
            contentContainerStyle={s.patientsList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const name   = item.patient?.name ?? 'Patient';
              const av     = avatarColor(name);
              const who    = item.lastMessage?.senderType;
              const last   = item.lastMessage?.body ?? 'Tap to open thread';
              const preview = who === 'navigator' ? `You: ${last}` : last;
              const via    = who === 'caregiver' ? 'via caregiver' : who === 'bot' ? 'assistant reply' : 'direct message';
              const time   = formatMsgTime(item.conversation?.lastMessageAt);
              const unread = item.unreadCount ?? 0;
              const status = item.conversation?.status;
              const isEscalated = status === 'escalated';

              return (
                <TouchableOpacity
                  style={[s.alertRow, isEscalated && { borderLeftWidth: 3, borderLeftColor: '#DC2626' },
                    unread > 0 && !isEscalated && { borderLeftWidth: 3, borderLeftColor: '#1C3D2E' }]}
                  onPress={() => navigation.navigate('NavigatorChat', { patientId: item.patient?._id, patientName: name })}
                  activeOpacity={0.8}
                >
                  <View style={[s.avatarCircle, { backgroundColor: av.bg }]}>
                    <Text style={[s.avatarText, { color: av.fg }]}>{getInitials(name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* Name row with type tag */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <Text style={[s.rowName, unread > 0 && { fontWeight: '700' }]}>{name}</Text>
                      {who === 'caregiver'
                        ? <View style={s.tagCg}><Text style={s.tagCgText}>caregiver</Text></View>
                        : <View style={s.tagPt}><Text style={s.tagPtText}>patient</Text></View>}
                    </View>
                    {/* Message preview */}
                    <Text style={[s.rowMeta, unread > 0 && { color: '#2C2822' }]} numberOfLines={1}>{preview}</Text>
                    {/* Via sub-text */}
                    <Text style={s.inboxVia}>{via}</Text>
                  </View>
                  {/* Time + unread */}
                  <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    {time ? <Text style={s.inboxTime}>{time}</Text> : null}
                    {unread > 0 && (
                      <View style={s.unreadBadge}>
                        <Text style={s.unreadBadgeText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={s.emptyCard}>
                <Ionicons name="chatbubble-outline" size={32} color="#94A3B8" />
                <Text style={s.emptyText}>No conversations yet</Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── PROFILE TAB ──────────────────────────────────────── */}
      {activeTab === 'Profile' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Avatar card */}
          <View style={s.navProfileCard}>
            <View style={s.navProfileAvatar}>
              <Text style={s.navProfileAvatarText}>
                {(user?.name || 'N').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
            <Text style={s.navProfileName}>{user?.name || 'Navigator'}</Text>
            <View style={s.navRoleBadge}>
              <Text style={s.navRoleText}>Navigator</Text>
            </View>
            {user?.phone && <Text style={s.navProfilePhone}>{user.phone}</Text>}
          </View>

          {/* Stats row */}
          <View style={s.navProfileStats}>
            <View style={s.navProfileStat}>
              <Text style={s.navProfileStatValue}>{summary.totalPatients}</Text>
              <Text style={s.navProfileStatLabel}>Patients</Text>
            </View>
            <View style={s.navProfileStatDivider} />
            <View style={s.navProfileStat}>
              <Text style={s.navProfileStatValue}>{summary.highPriority}</Text>
              <Text style={s.navProfileStatLabel}>High Priority</Text>
            </View>
            <View style={s.navProfileStatDivider} />
            <View style={s.navProfileStat}>
              <Text style={s.navProfileStatValue}>{summary.alerts}</Text>
              <Text style={s.navProfileStatLabel}>Active Alerts</Text>
            </View>
          </View>

          {/* Sign out */}
          <TouchableOpacity style={s.navSignOut} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={s.navSignOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── BOTTOM TAB BAR ───────────────────────────────────── */}
      <View style={s.tabBar}>
        {[
          { id: 'Home',     icon: 'home-outline',           iconActive: 'home' },
          { id: 'Patients', icon: 'people-outline',         iconActive: 'people' },
          { id: 'Alerts',   icon: 'notifications-outline',  iconActive: 'notifications', badge: summary.highPriority },
          { id: 'Messages', icon: 'chatbubble-outline',     iconActive: 'chatbubble' },
          { id: 'Profile',  icon: 'person-outline',         iconActive: 'person' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={s.tabItem}
              onPress={() => setActiveTab(tab.id)}
            >
              <View>
                <Ionicons
                  name={active ? tab.iconActive : tab.icon}
                  size={24}
                  color={active ? '#1A6B5A' : '#94A3B8'}
                />
                {tab.badge > 0 && (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.id}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ── sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, iconBg, iconColor, value, label, change, period, changeColor }) {
  const up = change > 0;
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {change !== 0 && (
        <Text style={[s.statChange, { color: changeColor }]}>
          {up ? '↑' : '↓'} {Math.abs(change)} {period}
        </Text>
      )}
    </View>
  );
}

function HomePatientRow({ item, onPress }) {
  const sev = SEVERITY[item.severity || item.priority] || SEVERITY.LOW;
  const av = avatarColor(item.name);
  const parts = [item.cancerType, item.stage, item.reason || item.topSymptom].filter(Boolean);
  return (
    <TouchableOpacity style={s.homeRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.avatarCircle, { backgroundColor: av.bg }]}>
        <Text style={[s.avatarText, { color: av.fg }]}>{getInitials(item.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName}>{item.name}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>{parts.join(' • ')}</Text>
      </View>
      <View style={[s.badge, { backgroundColor: sev.bg }]}>
        <Text style={[s.badgeText, { color: sev.fg }]}>{sev.label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

function PatientCard({ item, onPress }) {
  const priority = item.priority || 'LOW';
  const sev = SEVERITY[priority] || SEVERITY.LOW;
  const av = avatarColor(item.name);
  const timeAgo = getTimeAgo(item.lastUpdatedAt);
  const symptomLabel = item.topSymptom || '—';

  return (
    <TouchableOpacity style={s.patientCard} onPress={onPress} activeOpacity={0.8}>
      <View style={s.patientCardTop}>
        <View style={[s.avatarLg, { backgroundColor: av.bg }]}>
          <Text style={[s.avatarLgText, { color: av.fg }]}>{getInitials(item.name)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={s.nameRow}>
            <Text style={s.cardName}>{item.name}</Text>
            <View style={[s.badge, { backgroundColor: sev.bg, marginLeft: 8 }]}>
              <Text style={[s.badgeText, { color: sev.fg }]}>{sev.label}</Text>
            </View>
          </View>
          <Text style={s.cardSub}>
            {[item.cancerType, item.stage].filter(Boolean).join(' • ') || '—'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      </View>

      <View style={s.patientInfoRow}>
        <InfoCol icon="pulse-outline" iconColor="#DC2626" label="Symptom" value={symptomLabel} />
        <View style={s.infoDivider} />
        <InfoCol icon="calendar-outline" iconColor="#2563EB" label="Follow-up" value="—" />
        <View style={s.infoDivider} />
        <InfoCol icon="time-outline" iconColor="#94A3B8" label="Updated" value={timeAgo} />
      </View>
    </TouchableOpacity>
  );
}

function InfoCol({ icon, iconColor, label, value }) {
  return (
    <View style={s.infoCol}>
      <Ionicons name={icon} size={13} color={iconColor} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#F7F9F8', overflow: 'hidden',
    ...Platform.select({ web: { maxWidth: '100vw' } }),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F4F2',
  },
  miniCrossH: { position: 'absolute', width: 24, height: 6, borderRadius: 3, backgroundColor: '#1A6B5A' },
  miniCrossV: { position: 'absolute', width: 6, height: 24, borderRadius: 3, backgroundColor: '#1A6B5A' },
  headerLogoMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 12, color: '#7A9E96' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A3C34' },
  bellBtn: { padding: 4, position: 'relative' },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  // Scroll content
  scroll: { padding: 16, paddingBottom: 100 },

  // Glance
  glanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  glanceTitle: { fontSize: 14, fontWeight: '700', color: '#1A3C34' },
  glanceDate: { fontSize: 12, color: '#94A3B8' },

  // Stats grid 2x2
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statCard: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 12,
    padding: 10,
    ...Platform.select({
      ios: { shadowColor: '#1A6B5A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5 },
      android: { elevation: 2 },
    }),
  },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1A3C34', marginBottom: 1 },
  statLabel: { fontSize: 11, color: '#7A9E96', marginBottom: 2 },
  statChange: { fontSize: 10, fontWeight: '600' },
  statChangeNeutral: { fontSize: 10, color: '#94A3B8' },

  // AI card
  aiCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#EDE9FE',
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  aiCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiIconCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center',
  },
  aiCardTitle: { fontSize: 13, fontWeight: '700', color: '#1A3C34', flex: 1 },
  aiHighBadge: { backgroundColor: '#F5F3FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  aiHighBadgeText: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },
  aiCardBody: { fontSize: 12, color: '#6B8F86', lineHeight: 18, marginBottom: 8 },
  aiChevronRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiChevronText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },

  // Section headers
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A3C34' },
  viewAll: { fontSize: 12, color: '#1A6B5A', fontWeight: '600' },

  // Home patient row
  homeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  rowName: { fontSize: 14, fontWeight: '600', color: '#1A3C34' },
  rowMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  // Drafts banner
  draftsBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, gap: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  draftsIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center',
  },
  draftsBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  draftsBannerSub: { fontSize: 11, color: '#78350F', lineHeight: 16 },

  // Empty card
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 8,
  },
  emptyText: { fontSize: 13, color: '#94A3B8' },

  // Patients tab header
  patientsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F4F2',
  },
  patientsHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#1A3C34' },
  filterIconBtn: { padding: 4 },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#E8F0ED',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A3C34', padding: 0 },

  // Filter pills
  pillsWrap: { height: 52, backgroundColor: '#F7F9F8' },
  pillsRow: { paddingHorizontal: 16, alignItems: 'center', gap: 8, paddingVertical: 10 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8F0ED',
    flexShrink: 0,
  },
  pillActive: { backgroundColor: '#1A6B5A', borderColor: '#1A6B5A' },
  pillText: { fontSize: 12, color: '#6B9E90', fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  // Patients list
  patientsList: { paddingHorizontal: 16, paddingBottom: 100, width: '100%' },
  assignedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  assignedLabel: { fontSize: 13, fontWeight: '700', color: '#1A3C34' },
  assignedCount: { fontSize: 12, color: '#94A3B8' },

  // Patient card
  patientCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#1A6B5A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(26,107,90,0.08)' },
    }),
  },
  patientCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarLg: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarLgText: { fontSize: 17, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1A3C34' },
  cardSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Info row in patient card
  patientInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F9F8', borderRadius: 10, padding: 10,
  },
  infoCol: { flex: 1, alignItems: 'center', gap: 3 },
  infoLabel: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#1A3C34' },
  infoDivider: { width: 1, height: 28, backgroundColor: '#E8F0ED' },

  // Bottom tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F4F2',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 10, color: '#94A3B8' },
  tabLabelActive: { color: '#1A6B5A', fontWeight: '600' },
  tabBadge: {
    position: 'absolute', top: -4, right: -6,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 8, color: '#fff', fontWeight: '700' },

  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1C3D2E', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5, marginTop: 3,
  },
  unreadBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  // Inbox type tags (patient = blue, caregiver = purple)
  tagPt:     { backgroundColor: '#E6F1FB', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagPtText: { fontSize: 9, fontWeight: '700', color: '#0C447C', textTransform: 'uppercase', letterSpacing: 0.4 },
  tagCg:     { backgroundColor: '#EEEDFE', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  tagCgText: { fontSize: 9, fontWeight: '700', color: '#3C3489', textTransform: 'uppercase', letterSpacing: 0.4 },
  inboxVia:  { fontSize: 10, color: '#B4B2A9', marginTop: 2 },
  inboxTime: { fontSize: 10, color: '#9A9186' },

  // Alerts tab
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    }),
  },

  // Profile tab
  navProfileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 14,
    ...Platform.select({
      ios: { shadowColor: '#1A6B5A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(26,107,90,0.08)' },
    }),
  },
  navProfileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#1A6B5A', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  navProfileAvatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  navProfileName: { fontSize: 20, fontWeight: '700', color: '#1A3C34', marginBottom: 6 },
  navRoleBadge: {
    backgroundColor: '#E8F5F0', paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 99, marginBottom: 6,
  },
  navRoleText: { fontSize: 12, color: '#1A6B5A', fontWeight: '700' },
  navProfilePhone: { fontSize: 13, color: '#94A3B8' },
  navProfileStats: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    padding: 16, marginBottom: 14, alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#1A6B5A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(26,107,90,0.08)' },
    }),
  },
  navProfileStat: { flex: 1, alignItems: 'center', gap: 2 },
  navProfileStatValue: { fontSize: 22, fontWeight: '800', color: '#1A3C34' },
  navProfileStatLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
  navProfileStatDivider: { width: 1, height: 36, backgroundColor: '#E8F0ED' },
  navSignOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14,
  },
  navSignOutText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
});
