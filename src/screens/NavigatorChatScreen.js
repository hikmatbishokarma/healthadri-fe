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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getThread, sendChatMessage, markRead, navigatorHeartbeat } from '../services/api';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL      = 4000;
const HEARTBEAT_INTERVAL = 30000;

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d    = new Date(dateStr);
  const h    = d.getHours();
  const m    = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

// Context-sensitive chips — different set per recipient type
const CHIPS = {
  patient:   ["Hi, I'll check on you", 'Rest and stay hydrated', 'Call 108 if worsening'],
  caregiver: ['Noted, thank you', 'Monitor every 2 hrs', 'Visit clinic if above 39°C'],
};

// Colors driven entirely by who the navigator is replying to
const TOKEN = {
  patient: {
    replyStripBg:     '#E8F4EE',
    replyStripBorder: '#9FE1CB',
    replyStripText:   '#085041',
    chipBg:           '#E8F4EE',
    chipBorder:       '#9FE1CB',
    chipText:         '#085041',
    bubbleHighlight:  '#1C3D2E',
    replyingToColor:  '#1C3D2E',
  },
  caregiver: {
    replyStripBg:     '#F0EEFF',
    replyStripBorder: '#CECBF6',
    replyStripText:   '#3C3489',
    chipBg:           '#F0EEFF',
    chipBorder:       '#CECBF6',
    chipText:         '#3C3489',
    bubbleHighlight:  '#2D2060',
    replyingToColor:  '#2D2060',
  },
};

function getBubbleStyle(senderType) {
  if (senderType === 'navigator') return { bg: '#1C3D2E', text: '#fff',    align: 'flex-end',   borderRadius: { borderBottomRightRadius: 3 }, border: null };
  if (senderType === 'bot')       return { bg: '#EDF4FF', text: '#0C447C', align: 'flex-start', borderRadius: { borderBottomLeftRadius: 3 },  border: '#C5D9F5' };
  if (senderType === 'caregiver') return { bg: '#F3F1FE', text: '#3C3489', align: 'flex-start', borderRadius: { borderBottomLeftRadius: 3 },  border: '#CECBF6' };
  // patient
  return { bg: '#fff', text: '#2C2822', align: 'flex-start', borderRadius: { borderBottomLeftRadius: 3 }, border: '#E8E5E0' };
}

function SenderTag({ senderType, senderName, createdAt }) {
  const parts = [senderName, formatTime(createdAt)].filter(Boolean).join(' · ');
  if (senderType === 'bot')
    return <Text style={s.senderTag}>{'Assistant' + (createdAt ? ' · ' + formatTime(createdAt) : '')}</Text>;
  if (senderType === 'caregiver')
    return <Text style={[s.senderTag, { color: '#3C3489' }]}>{'Caregiver' + (parts ? ' · ' + parts : '')}</Text>;
  if (senderType === 'patient')
    return <Text style={s.senderTag}>{'Patient' + (parts ? ' · ' + parts : '')}</Text>;
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
      {(patient.caregiverName || patient.caregiverRelationship) ? (
        <View style={s.ctxRow}>
          <Text style={s.ctxKey}>Caregiver</Text>
          <Text style={s.ctxVal}>
            {[patient.caregiverName, patient.caregiverRelationship].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function NavigatorChatScreen({ route, navigation }) {
  const { user }    = useAuth();
  const patientId   = route.params?.patientId;
  const patientName = route.params?.patientName ?? 'Patient';

  const [messages, setMessages]     = useState([]);
  const [patient, setPatient]       = useState(null);
  const [convId, setConvId]         = useState(null);
  const [convStatus, setConvStatus] = useState('pending');
  const [text, setText]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);

  // replyTo: which message the navigator is currently targeting
  // { _id, senderType: 'patient'|'caregiver', senderName, body }
  const [replyTo, setReplyTo] = useState(null);

  const listRef            = useRef(null);
  const latestTimestampRef = useRef(null);
  const pollRef            = useRef(null);
  const heartbeatRef       = useRef(null);

  // Snap replyTo to the given message (called on load + on bubble tap)
  const snapReplyTo = useCallback((msg, resolvedPatient) => {
    if (!msg) return;
    const name = msg.senderType === 'patient'
      ? (resolvedPatient?.name ?? patientName)
      : (msg.senderId?.name ?? 'Caregiver');
    setReplyTo({ _id: msg._id, senderType: msg.senderType, senderName: name, body: msg.body });
  }, [patientName]);

  const fetchThread = useCallback(async (since = null) => {
    if (!patientId) return;
    try {
      const res  = await getThread(patientId, since, 'navigator');
      const data = res.data;
      const resolvedPatient = data.patient ?? null;

      if (!since) {
        setConvId(data.conversation?._id ?? null);
        setConvStatus(data.conversation?.status ?? 'pending');
        setPatient(resolvedPatient);
      }

      const incoming = Array.isArray(data.messages) ? data.messages : [];
      if (incoming.length > 0) {
        latestTimestampRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((prev) => (since ? [...prev, ...incoming] : incoming));

        // Auto-snap only on initial load — tap overrides it after that
        if (!since) {
          const lastReal = [...incoming].reverse().find(
            (m) => m.senderType === 'patient' || m.senderType === 'caregiver',
          );
          snapReplyTo(lastReal ?? null, resolvedPatient);
        }
      } else if (!since) {
        setMessages([]);
        // No messages yet — default to patient
        setReplyTo({
          _id: null,
          senderType: 'patient',
          senderName: resolvedPatient?.name ?? patientName,
          body: null,
        });
      }
    } catch {
      // silent on poll failures
    } finally {
      setLoading(false);
    }
  }, [patientId, patientName, snapReplyTo]);

  useEffect(() => {
    if (!patientId || !user?._id) return;
    fetchThread(null);
    pollRef.current      = setInterval(() => fetchThread(latestTimestampRef.current), POLL_INTERVAL);
    navigatorHeartbeat(user._id).catch(() => {});
    heartbeatRef.current = setInterval(() => navigatorHeartbeat(user._id).catch(() => {}), HEARTBEAT_INTERVAL);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(heartbeatRef.current);
    };
  }, [fetchThread, patientId, user]);

  useEffect(() => {
    if (convId) markRead(convId).catch(() => {});
  }, [convId]);

  const handleSend = async (body = text.trim()) => {
    if (!body || !patientId || !user?._id || sending) return;
    const scope = replyTo?.senderType === 'caregiver' ? 'caregiver' : 'patient';
    setText('');
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

  const tok   = TOKEN[replyTo?.senderType ?? 'patient'];
  const chips = CHIPS[replyTo?.senderType ?? 'patient'];
  const statusColor = { active: '#6FCFA0', bot_held: '#F5A623', escalated: '#DC2626', pending: '#CBD5E1' }[convStatus] ?? '#CBD5E1';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1C3D2E" />

      {/* ── Header ── */}
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

      {/* ── Linked bar ── */}
      <LinkedBar patientName={patient?.name ?? patientName} />

      {/* ── Escalated banner ── */}
      {convStatus === 'escalated' && (
        <View style={s.escalatedBar}>
          <Ionicons name="warning" size={13} color="#A32D2D" />
          <Text style={s.escalatedText}>Escalated — patient reported urgent concern</Text>
        </View>
      )}

      {/* ── Patient context card ── */}
      <PatientContextCard patient={patient} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              // Blocker placeholder (defensive — navigators normally see all)
              if (item.senderType === 'placeholder') {
                return (
                  <View style={s.placeholderRow}>
                    <Ionicons name="lock-closed-outline" size={10} color="#9A9186" />
                    <Text style={s.placeholderText}>{item.body}</Text>
                  </View>
                );
              }

              const bs         = getBubbleStyle(item.senderType);
              const isNav      = item.senderType === 'navigator';
              const isTappable = item.senderType === 'patient' || item.senderType === 'caregiver';
              const isSelected = replyTo?._id === item._id;
              const hlColor    = isTappable ? TOKEN[item.senderType]?.bubbleHighlight : null;
              const BubbleWrapper = isTappable ? TouchableOpacity : View;

              // Derive recipient from visibleTo — shown below each navigator bubble
              let recipientLabel = null;
              let recipientColor = '#9A9186';
              if (isNav) {
                const vt        = item.visibleTo ?? [];
                const toPatient = vt.includes('patient');
                const toCg      = vt.includes('caregiver');
                if (toPatient && !toCg) {
                  recipientLabel = patient?.name ?? 'Patient';
                  recipientColor = '#3D7A5C';
                } else if (toCg && !toPatient) {
                  recipientLabel = patient?.caregiverName ?? 'Caregiver';
                  recipientColor = '#534AB7';
                } else if (toPatient && toCg) {
                  recipientLabel = `${patient?.name ?? 'Patient'} & ${patient?.caregiverName ?? 'Caregiver'}`;
                }
              }

              return (
                <View style={{ alignSelf: bs.align, maxWidth: '82%', marginBottom: 6 }}>
                  {!isNav && (
                    <SenderTag
                      senderType={item.senderType}
                      senderName={item.senderId?.name ?? null}
                      createdAt={item.createdAt}
                    />
                  )}
                  <BubbleWrapper
                    activeOpacity={0.75}
                    onPress={isTappable ? () => snapReplyTo(item, patient) : undefined}
                  >
                    <View style={[
                      s.bubble,
                      { backgroundColor: bs.bg, alignSelf: bs.align },
                      bs.borderRadius,
                      bs.border && { borderWidth: 0.5, borderColor: bs.border },
                      isSelected && { borderWidth: 1.5, borderColor: hlColor },
                    ]}>
                      {item.senderType === 'bot' && (
                        <View style={s.botRow}>
                          <Ionicons name="sparkles-outline" size={11} color="#0C447C" />
                          <Text style={s.botLabel}>Assistant</Text>
                        </View>
                      )}
                      <Text style={[s.bubbleText, { color: bs.text }]}>{item.body}</Text>
                    </View>
                    {/* "replying to this" tag on selected incoming bubble */}
                    {isSelected && (
                      <View style={s.replyingTag}>
                        <Ionicons name="return-down-forward-outline" size={10} color={hlColor} />
                        <Text style={[s.replyingTagText, { color: hlColor }]}>replying to this</Text>
                      </View>
                    )}
                  </BubbleWrapper>
                  {/* Recipient citation — who this navigator message was sent to */}
                  {recipientLabel ? (
                    <View style={s.recipientRow}>
                      <Ionicons name="person-outline" size={9} color={recipientColor} />
                      <Text style={[s.recipientLabel, { color: recipientColor }]}>{recipientLabel}</Text>
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        {/* ── Input area ── */}
        <View style={s.inputArea}>

          {/* Reply strip — "Replying to [Name] · [preview]" */}
          <View style={[s.replyStrip, { backgroundColor: tok.replyStripBg, borderBottomColor: tok.replyStripBorder }]}>
            <Ionicons name="arrow-undo-outline" size={13} color={tok.replyStripText} style={{ flexShrink: 0, marginTop: 1 }} />
            <Text style={[s.replyStripText, { color: tok.replyStripText }]} numberOfLines={1}>
              Replying to <Text style={{ fontWeight: '700' }}>{replyTo?.senderName ?? 'Patient'}</Text>
              {replyTo?.body ? <Text style={{ fontWeight: '400' }}> · "{replyTo.body}"</Text> : null}
            </Text>
          </View>

          {/* Scope strip — "[Name] receives this reply" */}
          <View style={[s.scopeStrip, { borderBottomColor: '#E8E5E0' }]}>
            <Ionicons name="person-outline" size={13} color={tok.replyStripText} />
            <Text style={[s.scopeStripText, { color: tok.replyStripText }]}>
              {replyTo?.senderName ?? 'Patient'} receives this reply
            </Text>
          </View>

          {/* Context-sensitive quick chips */}
          <View style={s.chipsRow}>
            {chips.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={[s.chip, { backgroundColor: tok.chipBg, borderColor: tok.chipBorder }]}
                onPress={() => handleSend(chip)}
              >
                <Text style={[s.chipText, { color: tok.chipText }]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Text input row */}
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder={`Reply to ${replyTo?.senderName ?? 'Patient'}…`}
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
              <Ionicons name="send" size={15} color="#fff" />
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F7F5F2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
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

  // Linked bar
  linkedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1C3D2E', paddingHorizontal: 12, paddingVertical: 5,
  },
  linkedBarMuted: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  linkedBarName:  { fontSize: 10, fontWeight: '600', color: '#6FCFA0' },

  // Escalated banner
  escalatedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FCEBEB', paddingHorizontal: 14, paddingVertical: 7,
    borderBottomWidth: 0.5, borderBottomColor: '#F7C1C1',
  },
  escalatedText: { fontSize: 11, color: '#A32D2D', fontWeight: '600' },

  // Patient context card
  ctxCard: {
    backgroundColor: '#F0FDF7',
    borderWidth: 0.5, borderColor: '#9FE1CB',
    borderRadius: 10, padding: 10, margin: 8,
  },
  ctxLabel: { fontSize: 9, fontWeight: '700', color: '#085041', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  ctxRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  ctxKey:   { fontSize: 11, color: '#6B7280' },
  ctxVal:   { fontSize: 11, color: '#1C3D2E', fontWeight: '500' },

  // Messages
  msgList:   { padding: 12, flexGrow: 1 },
  senderTag: { fontSize: 10, color: '#9A9186', marginBottom: 2, paddingLeft: 2 },
  bubble:    { padding: 10, borderRadius: 12 },
  bubbleText:{ fontSize: 13, lineHeight: 19 },
  botRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  botLabel:  { fontSize: 10, color: '#0C447C', fontWeight: '600' },

  // "replying to this" tag below a selected bubble
  replyingTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 3, paddingLeft: 4,
  },
  replyingTagText: { fontSize: 10, fontWeight: '500' },

  // Recipient citation below each navigator bubble — who received that specific message
  recipientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-end', marginTop: 3, paddingRight: 2,
  },
  recipientLabel: { fontSize: 10 },

  // System confirmation pill (shown in message list after navigator sends)
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

  // ── Input area (reply strip + scope strip + chips + text row) ──
  inputArea: { backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E8E5E0' },

  replyStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderBottomWidth: 0.5,
  },
  replyStripText: { flex: 1, fontSize: 11, lineHeight: 16 },

  scopeStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5,
    borderBottomWidth: 0.5,
  },
  scopeStripText: { fontSize: 11, fontWeight: '500' },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  chip: {
    borderRadius: 14, borderWidth: 0.5,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 11 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4,
  },
  input: {
    flex: 1, backgroundColor: '#F2F0ED', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13, color: '#2C2822', maxHeight: 100,
  },
  sendBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C3D2E', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#9FD4BE' },
  emptyText:       { color: '#9A9186', fontSize: 13, textAlign: 'center', marginTop: 40 },
});
