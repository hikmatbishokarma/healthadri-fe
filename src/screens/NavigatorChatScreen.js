import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getThread, sendChatMessage, markRead, navigatorHeartbeat } from '../services/api';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL   = 4000;
const HEARTBEAT_INTERVAL = 30000;

const QUICK_REPLIES = [
  "Acknowledged, I'll review your case.",
  'This is not an emergency. Continue monitoring.',
  'Please call the helpline: 108',
  "I'll follow up with you tomorrow.",
];

function getBubbleStyle(senderType) {
  if (senderType === 'navigator') return { bg: '#1C3D2E', text: '#fff',    align: 'flex-end',   radius: { borderBottomRightRadius: 3 } };
  if (senderType === 'bot')       return { bg: '#EDF4FF', text: '#0C447C', align: 'flex-start', radius: { borderBottomLeftRadius: 3 } };
  if (senderType === 'caregiver') return { bg: '#EEEDFE', text: '#3C3489', align: 'flex-start', radius: { borderBottomLeftRadius: 3 } };
  return { bg: '#fff', text: '#2C2822', align: 'flex-start', radius: { borderBottomLeftRadius: 3 } };
}

function SenderTag({ senderType }) {
  if (senderType === 'bot')       return <Text style={s.senderTag}>Assistant</Text>;
  if (senderType === 'caregiver') return <Text style={[s.senderTag, { color: '#3C3489' }]}>Caregiver</Text>;
  if (senderType === 'patient')   return <Text style={s.senderTag}>Patient</Text>;
  return null;
}

function LinkedBar({ patientName }) {
  return (
    <View style={s.linkedBar}>
      <Ionicons name="link-outline" size={12} color="#6FCFA0" />
      <Text style={s.linkedBarMuted}>Thread belongs to patient · </Text>
      <Text style={s.linkedBarName}>{patientName}</Text>
    </View>
  );
}

function PatientContextCard({ patient }) {
  if (!patient) return null;
  const cycle = patient.chemoSessionsTotal > 0
    ? `Cycle ${patient.chemoSessionsCompleted} of ${patient.chemoSessionsTotal}`
    : null;
  const diagnosis = [patient.cancerType, patient.cancerStage ? `Stage ${patient.cancerStage}` : null]
    .filter(Boolean).join(' · ') || null;
  return (
    <View style={s.ctxCard}>
      <Text style={s.ctxLabel}>Patient context</Text>
      <View style={s.ctxRow}>
        <Text style={s.ctxKey}>{patient.name}</Text>
        {diagnosis ? <Text style={s.ctxVal}>{diagnosis}</Text> : null}
      </View>
      {patient.hospitalName ? (
        <View style={s.ctxRow}>
          <Text style={s.ctxKey}>{patient.hospitalName}</Text>
          {cycle ? <Text style={s.ctxVal}>{cycle}</Text> : null}
        </View>
      ) : null}
      {patient.caregiverRelationship ? (
        <View style={s.ctxRow}>
          <Text style={s.ctxKey}>Caregiver</Text>
          <Text style={s.ctxVal}>{patient.caregiverRelationship}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function NavigatorChatScreen({ route, navigation }) {
  const { user }       = useAuth();
  const patientId      = route.params?.patientId;
  const patientName    = route.params?.patientName ?? 'Patient';

  const [messages, setMessages]   = useState([]);
  const [patient, setPatient]     = useState(null);
  const [convId, setConvId]       = useState(null);
  const [convStatus, setConvStatus] = useState('pending');
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [scope, setScope]               = useState('both'); // 'both' | 'patient' | 'caregiver'

  const listRef            = useRef(null);
  const latestTimestampRef = useRef(null);
  const pollRef            = useRef(null);
  const heartbeatRef       = useRef(null);

  const fetchThread = useCallback(async (since = null) => {
    if (!patientId) return;
    try {
      const res  = await getThread(patientId, since, 'navigator');
      const data = res.data;
      if (!since) {
        setConvId(data.conversation?._id ?? null);
        setConvStatus(data.conversation?.status ?? 'pending');
        setPatient(data.patient ?? null);
      }
      const incoming = Array.isArray(data.messages) ? data.messages : [];
      if (incoming.length > 0) {
        latestTimestampRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((prev) => {
          const next = since ? [...prev, ...incoming] : incoming;
          // Auto-snap scope to last non-bot, non-system sender
          const lastReal = [...next].reverse().find(
            (m) => m.senderType === 'patient' || m.senderType === 'caregiver',
          );
          if (lastReal) {
            setScope(lastReal.senderType === 'caregiver' ? 'both' : 'patient');
          }
          return next;
        });
      } else if (!since) {
        setMessages([]);
      }
    } catch {
      // silent on poll failures
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!patientId || !user?._id) return;

    fetchThread(null);
    pollRef.current = setInterval(() => fetchThread(latestTimestampRef.current), POLL_INTERVAL);

    // Heartbeat to mark navigator as online
    navigatorHeartbeat(user._id).catch(() => {});
    heartbeatRef.current = setInterval(() => navigatorHeartbeat(user._id).catch(() => {}), HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(heartbeatRef.current);
    };
  }, [fetchThread, patientId, user]);

  // Mark messages as read when conversation ID is known
  useEffect(() => {
    if (convId) markRead(convId).catch(() => {});
  }, [convId]);

  const handleSend = async (body = text.trim()) => {
    if (!body || !patientId || !user?._id || sending) return;
    setText('');
    setShowTemplates(false);
    setSending(true);
    try {
      const res = await sendChatMessage(patientId, user._id, 'navigator', body, scope);
      const { message, scopeMessage } = res.data;
      setMessages((prev) => {
        const next = [...prev, message];
        if (scopeMessage) next.push(scopeMessage);
        return next;
      });
      latestTimestampRef.current = message.createdAt;
      setConvStatus('active');
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const statusColor = {
    active: '#6FCFA0',
    bot_held: '#F5A623',
    escalated: '#DC2626',
    pending: '#CBD5E1',
  }[convStatus] ?? '#CBD5E1';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1C3D2E" />

      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={s.hdrAvatar}>
          <Text style={s.hdrAvatarText}>
            {patientName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrName}>{patientName}</Text>
          <Text style={s.hdrSub}>Patient thread</Text>
        </View>
        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
      </View>

      {/* Linked bar — always shown so navigator knows which patient this thread belongs to */}
      <LinkedBar patientName={patient?.name ?? patientName} />

      {/* Escalated banner */}
      {convStatus === 'escalated' && (
        <View style={s.escalatedBar}>
          <Ionicons name="warning" size={13} color="#A32D2D" />
          <Text style={s.escalatedText}>Escalated — patient reported urgent concern</Text>
        </View>
      )}

      {/* Patient context card */}
      <PatientContextCard patient={patient} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#1C3D2E" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => m._id || String(i)}
            contentContainerStyle={s.msgList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={s.emptyText}>No messages yet. Say hello to {patientName}.</Text>
            }
            renderItem={({ item }) => {
              // System scope confirmation pill
              if (item.isSystem || item.senderType === 'system') {
                return (
                  <View style={s.sysPill}>
                    <Ionicons name="checkmark-circle-outline" size={10} color="#085041" />
                    <Text style={s.sysPillText}>{item.body}</Text>
                  </View>
                );
              }
              // Blocker placeholder (shouldn't normally appear for navigator, but defensive)
              if (item.senderType === 'placeholder') {
                return (
                  <View style={s.placeholderRow}>
                    <Ionicons name="lock-closed-outline" size={10} color="#9A9186" />
                    <Text style={s.placeholderText}>{item.body}</Text>
                  </View>
                );
              }
              const style = getBubbleStyle(item.senderType);
              const isNav = item.senderType === 'navigator';
              return (
                <View style={{ alignSelf: style.align, maxWidth: '82%', marginBottom: 6 }}>
                  {!isNav && <SenderTag senderType={item.senderType} />}
                  <View style={[s.bubble, { backgroundColor: style.bg, alignSelf: style.align }, style.radius,
                    item.senderType !== 'navigator' && s.bubbleBorder]}>
                    <Text style={[s.bubbleText, { color: style.text }]}>{item.body}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Quick reply templates */}
        {showTemplates && (
          <View style={s.templates}>
            <Text style={s.templatesLabel}>Quick replies</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templatesRow}>
              {QUICK_REPLIES.map((reply) => (
                <TouchableOpacity key={reply} style={s.templateBtn} onPress={() => handleSend(reply)}>
                  <Text style={s.templateText}>{reply}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Scope selector — who receives this reply */}
        <View style={s.scopeBar}>
          <Text style={s.scopeLabel}>Reply to:</Text>
          {[
            { key: 'both',      label: 'Both' },
            { key: 'patient',   label: 'Patient only' },
            { key: 'caregiver', label: 'Caregiver only' },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[s.scopeChip, scope === key && s.scopeChipActive]}
              onPress={() => setScope(key)}
            >
              <Text style={[s.scopeChipText, scope === key && s.scopeChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input bar */}
        <View style={s.inputBar}>
          <TouchableOpacity
            style={[s.iconBtn, showTemplates && s.iconBtnActive]}
            onPress={() => setShowTemplates((v) => !v)}
          >
            <Ionicons name="list-outline" size={18} color={showTemplates ? '#1C3D2E' : '#9A9186'} />
          </TouchableOpacity>
          <TextInput
            style={s.input}
            placeholder={`Reply to ${patientName}…`}
            placeholderTextColor="#9A9186"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F7F5F2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1C3D2E', paddingHorizontal: 14, paddingVertical: 12,
  },
  backBtn: { padding: 2 },
  hdrAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#3D7A5C', alignItems: 'center', justifyContent: 'center',
  },
  hdrAvatarText: { color: '#E8F4EE', fontSize: 11, fontWeight: '700' },
  hdrName:       { fontSize: 14, fontWeight: '600', color: '#fff' },
  hdrSub:        { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },

  // Dark green linked bar (Screen E design)
  linkedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1C3D2E', paddingHorizontal: 12, paddingVertical: 5,
  },
  linkedBarMuted: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  linkedBarName:  { fontSize: 10, fontWeight: '600', color: '#6FCFA0' },

  escalatedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FCEBEB', paddingHorizontal: 14, paddingVertical: 7,
    borderBottomWidth: 0.5, borderBottomColor: '#F7C1C1',
  },
  escalatedText: { fontSize: 11, color: '#A32D2D', fontWeight: '600' },

  // Context card — floating card with margin + border-radius (matches .ctx-card CSS)
  ctxCard: {
    backgroundColor: '#F0FDF7',
    borderWidth: 0.5, borderColor: '#9FE1CB',
    borderRadius: 10, padding: 10, margin: 8,
  },
  ctxLabel: { fontSize: 9, fontWeight: '700', color: '#085041', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  ctxRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  ctxKey:   { fontSize: 11, color: '#6B7280' },
  ctxVal:   { fontSize: 11, color: '#1C3D2E', fontWeight: '500' },

  msgList:    { padding: 12, flexGrow: 1 },
  senderTag:  { fontSize: 10, color: '#9A9186', marginBottom: 2, paddingLeft: 2 },
  bubble:     { padding: 10, borderRadius: 12 },
  bubbleBorder: { borderWidth: 0.5, borderColor: '#E8E5E0' },
  bubbleText: { fontSize: 13, lineHeight: 19 },

  templates: {
    backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E8E5E0',
    paddingTop: 10, paddingBottom: 6,
  },
  templatesLabel: {
    fontSize: 10, fontWeight: '700', color: '#9A9186',
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 14, marginBottom: 6,
  },
  templatesRow:  { paddingHorizontal: 10, gap: 8 },
  templateBtn: {
    backgroundColor: '#F2F0ED', borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 0.5, borderColor: '#E0DDD8',
  },
  templateText: { fontSize: 12, color: '#2C2822' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, backgroundColor: '#fff',
    borderTopWidth: 0.5, borderTopColor: '#E8E5E0',
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F2F0ED', alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: '#E1F5EE' },
  input: {
    flex: 1, backgroundColor: '#F2F0ED', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13, color: '#2C2822', maxHeight: 100,
  },
  sendBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1C3D2E', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#9FD4BE' },
  emptyText: { color: '#9A9186', fontSize: 13, textAlign: 'center', marginTop: 40 },

  // Scope selector bar
  scopeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#F7F5F2', borderTopWidth: 0.5, borderTopColor: '#E8E5E0',
  },
  scopeLabel:         { fontSize: 10, color: '#9A9186', fontWeight: '600', marginRight: 2 },
  scopeChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 0.5, borderColor: '#E0DDD8',
    backgroundColor: '#fff',
  },
  scopeChipActive:     { backgroundColor: '#1C3D2E', borderColor: '#1C3D2E' },
  scopeChipText:       { fontSize: 11, color: '#6B7280' },
  scopeChipTextActive: { color: '#fff', fontWeight: '600' },

  // Scope confirmation system pill
  sysPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', backgroundColor: '#EBF7F2',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, marginBottom: 6,
    borderWidth: 0.5, borderColor: '#9FE1CB',
  },
  sysPillText: { fontSize: 10, color: '#085041' },

  // Blocker placeholder
  placeholderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', backgroundColor: '#F2F0ED',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, marginBottom: 6,
    borderWidth: 0.5, borderColor: '#E0DDD8',
  },
  placeholderText: { fontSize: 10, color: '#9A9186', fontStyle: 'italic' },
});
