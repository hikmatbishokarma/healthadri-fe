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
import { getThread, sendChatMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL = 4000;

// Theme tokens per role — caregiver gets purple, patient gets forest green
const THEME = {
  patient:   { header: '#1C3D2E', avatarBg: '#3D7A5C', ownBubble: '#1C3D2E', sendDisabled: '#9FD4BE' },
  caregiver: { header: '#2D2060', avatarBg: '#534AB7', ownBubble: '#2D2060', sendDisabled: '#B0ACDF' },
};

// Bubble styles matching the design reference exactly
function getBubbleStyle(senderType, isMe, theme) {
  if (senderType === 'bot')
    return { bg: '#EDF4FF', text: '#0C447C', align: 'flex-start', extraStyle: s.bubbleIn, radius: { borderBottomLeftRadius: 3 } };
  if (senderType === 'navigator')
    // Spec §12: navigator reply = light green tint, not plain white
    return { bg: '#E8F4EE', text: '#1C3D2E', align: 'flex-start', extraStyle: s.bubbleInNav, radius: { borderBottomLeftRadius: 3 } };
  if (isMe)
    return { bg: theme.ownBubble, text: '#fff', align: 'flex-end', extraStyle: null, radius: { borderBottomRightRadius: 3 } };
  // caregiver message seen in patient view — spec §12: #F3F1FE / border #CECBF6
  return { bg: '#F3F1FE', text: '#3C3489', align: 'flex-start', extraStyle: s.bubbleInCg, radius: { borderBottomLeftRadius: 3 } };
}

function SenderLabel({ senderType }) {
  if (senderType === 'bot')       return <Text style={s.senderLabel}>Assistant</Text>;
  if (senderType === 'navigator') return <Text style={s.senderLabel}>Navigator</Text>;
  if (senderType === 'caregiver') return <Text style={[s.senderLabel, { color: '#3C3489' }]}>Your caregiver</Text>;
  return null;
}

// Amber system pill — shown after every bot message ("Navigator notified")
function NavNotifiedPill() {
  return (
    <View style={s.sysPillAmber}>
      <Ionicons name="notifications-outline" size={10} color="#633806" style={{ marginRight: 4 }} />
      <Text style={s.sysPillAmberText}>Navigator notified via in-app alert</Text>
    </View>
  );
}

export default function ChatScreen({ navigation }) {
  const { user } = useAuth();

  const isCaregiver = user?.role === 'caregiver';
  const senderType  = isCaregiver ? 'caregiver' : 'patient';
  const theme       = THEME[senderType] ?? THEME.patient;

  const patientId = isCaregiver
    ? user?.linkedPatientId?.toString?.() ?? null
    : user?._id ?? null;

  const [messages, setMessages]           = useState([]);
  const [patientName, setPatientName]     = useState('');
  const [navigatorOnline, setNavigatorOnline] = useState(false);
  const [convStatus, setConvStatus]       = useState('pending');
  const [text, setText]                   = useState('');
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);

  const listRef            = useRef(null);
  const latestTimestampRef = useRef(null);
  const pollRef            = useRef(null);

  const fetchThread = useCallback(async (since = null) => {
    if (!patientId) return;
    try {
      const res  = await getThread(patientId, since, senderType);
      const data = res.data;
      setNavigatorOnline(data.navigatorOnline ?? false);
      setConvStatus(data.conversation?.status ?? 'pending');
      if (data.patient?.name) setPatientName(data.patient.name);

      const incoming = Array.isArray(data.messages) ? data.messages : [];
      if (incoming.length > 0) {
        latestTimestampRef.current = incoming[incoming.length - 1].createdAt;
        setMessages((prev) => (since ? [...prev, ...incoming] : incoming));
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
    fetchThread(null);
    pollRef.current = setInterval(() => fetchThread(latestTimestampRef.current), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchThread]);

  const handleSend = async () => {
    if (!text.trim() || !patientId || !user?._id || sending) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await sendChatMessage(patientId, user._id, senderType, body);
      const { message, botMessage } = res.data;
      setMessages((prev) => {
        const next = [...prev, message];
        if (botMessage) next.push(botMessage);
        return next;
      });
      if (botMessage) setConvStatus('bot_held');
      latestTimestampRef.current = (botMessage ?? message).createdAt;
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  if (!patientId) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={s.emptyText}>Account not linked to a patient yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onlineDot = navigatorOnline ? '#6FCFA0' : '#F5A623';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.header} />

      {/* ── Header ───────────────────────────────────────────── */}
      <View style={[s.hdr, { backgroundColor: theme.header }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={[s.hdrAvatar, { backgroundColor: theme.avatarBg }]}>
          <Text style={s.hdrAvatarText}>SN</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrName}>Your Navigator</Text>
          <Text style={s.hdrSub}>
            {navigatorOnline ? 'Online' : 'Offline · replies when available'}
          </Text>
        </View>
        <View style={[s.statusDot, { backgroundColor: onlineDot }]} />
      </View>

      {/* ── Caregiver banner ─────────────────────────────────── */}
      {isCaregiver && (
        <View style={s.cgBanner}>
          <Ionicons name="people-outline" size={13} color="#3C3489" />
          <Text style={s.cgBannerText}>
            Messaging as caregiver
            {patientName ? <Text style={s.cgBannerBold}> of {patientName}</Text> : ' of your linked patient'}
          </Text>
        </View>
      )}

      {/* ── Escalated banner ─────────────────────────────────── */}
      {convStatus === 'escalated' && (
        <View style={s.urgentBanner}>
          <Ionicons name="warning-outline" size={13} color="#633806" />
          <Text style={s.urgentBannerText}>Urgent alert sent to navigator</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={theme.header} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m, i) => m._id || String(i)}
            contentContainerStyle={s.msgList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={s.emptyText}>Send a message to start the conversation.</Text>
            }
            renderItem={({ item }) => {
              // Blocker placeholder — message existed but caller can't see it
              if (item.senderType === 'placeholder') {
                return (
                  <View style={s.placeholderRow}>
                    <Ionicons name="lock-closed-outline" size={10} color="#9A9186" />
                    <Text style={s.placeholderText}>{item.body}</Text>
                  </View>
                );
              }

              // senderId may be a populated object { _id, name } or a plain string ID
              const isMe  = (item.senderId?._id?.toString?.() ?? item.senderId) === user?._id;
              const style = getBubbleStyle(item.senderType, isMe, theme);
              const isBot = item.senderType === 'bot';

              return (
                <View style={{ marginBottom: 6 }}>
                  <View style={{ alignSelf: style.align, maxWidth: '82%' }}>
                    {!isMe && <SenderLabel senderType={item.senderType} />}
                    <View style={[s.bubble, { backgroundColor: style.bg, alignSelf: style.align }, style.radius, style.extraStyle]}>
                      {isBot && (
                        <View style={s.botIconRow}>
                          <Ionicons name="sparkles-outline" size={11} color="#0C447C" />
                          <Text style={s.botLabel}>Assistant</Text>
                        </View>
                      )}
                      <Text style={[s.bubbleText, { color: style.text }, isBot && { fontSize: 12 }]}>
                        {item.body}
                      </Text>
                    </View>
                  </View>
                  {/* Amber pill after every bot message */}
                  {isBot && <NavNotifiedPill />}
                </View>
              );
            }}
          />
        )}

        {/* ── Input bar ────────────────────────────────────────── */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Type a message…"
            placeholderTextColor="#9A9186"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: (!text.trim() || sending) ? theme.sendDisabled : theme.header }]}
            onPress={handleSend}
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

  // Header
  hdr:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  backBtn:       { padding: 2 },
  hdrAvatar:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  hdrAvatarText: { color: '#E8F4EE', fontSize: 11, fontWeight: '700' },
  hdrName:       { fontSize: 14, fontWeight: '600', color: '#fff' },
  hdrSub:        { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },

  // Caregiver banner
  cgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0EEFF', borderBottomWidth: 0.5, borderBottomColor: '#CECBF6',
    paddingHorizontal: 14, paddingVertical: 7,
  },
  cgBannerText: { fontSize: 11, color: '#3C3489', flex: 1 },
  cgBannerBold: { fontWeight: '600' },

  // Escalated banner
  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FDF4E4', paddingHorizontal: 14, paddingVertical: 7,
  },
  urgentBannerText: { fontSize: 11, color: '#633806' },

  // Message list
  msgList:    { padding: 12, flexGrow: 1 },
  senderLabel: { fontSize: 10, color: '#9A9186', marginBottom: 2, paddingLeft: 2 },

  // Bubbles — base
  bubble:      { padding: 10, borderRadius: 12 },
  bubbleText:  { fontSize: 13, lineHeight: 19 },

  // Incoming bubble variants
  bubbleIn:    { borderWidth: 0.5, borderColor: '#E8E5E0' },
  bubbleInNav: { borderWidth: 0.5, borderColor: '#9FE1CB' },
  bubbleInCg:  { borderWidth: 0.5, borderColor: '#CECBF6' },

  // Bot icon row inside bubble
  botIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  botLabel:   { fontSize: 10, color: '#0C447C', fontWeight: '600' },

  // "Navigator notified" amber system pill
  sysPillAmber: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center', backgroundColor: '#FDF4E4',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, marginTop: 4,
  },
  sysPillAmberText: { fontSize: 10, color: '#633806' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, backgroundColor: '#fff',
    borderTopWidth: 0.5, borderTopColor: '#E8E5E0',
  },
  input: {
    flex: 1, backgroundColor: '#F2F0ED', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13, color: '#2C2822', maxHeight: 100,
  },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9A9186', fontSize: 13, textAlign: 'center', marginTop: 40 },

  // Rule 14: blocker placeholder for hidden messages
  placeholderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', backgroundColor: '#F2F0ED',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, marginBottom: 6,
    borderWidth: 0.5, borderColor: '#E0DDD8',
  },
  placeholderText: { fontSize: 10, color: '#9A9186', fontStyle: 'italic' },
});
