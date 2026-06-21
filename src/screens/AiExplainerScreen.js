import React, { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { explainAi } from '../services/api';
import { colors } from '../theme/colors';

const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  tealPale: colors.primaryTint,
  tealMid: '#B2D8CF',
  amber: '#F59E0B',
  amberPale: '#FEF3C7',
  red: '#EF4444',
  redPale: '#FEE2E2',
  green: '#22C55E',
  greenPale: '#DCFCE7',
  gray: '#64748B',
  grayPale: '#F1F5F9',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
};

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const TYPE_STYLES = {
  safe: {
    label: 'Medical info',
    icon: 'medkit-outline',
    bg: C.greenPale,
    color: '#15803D',
  },
  abusive: {
    label: 'Please be respectful',
    icon: 'warning-outline',
    bg: C.redPale,
    color: '#B91C1C',
  },
  'non-medical': {
    label: 'Not a medical question',
    icon: 'ban-outline',
    bg: C.amberPale,
    color: '#B45309',
  },
};

const WELCOME = {
  id: 'welcome',
  kind: 'bot',
  type: 'safe',
  text:
    "Hi! I'm a medical explainer. Ask me about a symptom or medical term, or attach a report (PDF/JPG/PNG) for a simple explanation. I don't diagnose or recommend treatment — please consult your doctor for that.",
};

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function AiExplainerScreen({ navigation }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      if (asset.mimeType && !ALLOWED_TYPES.includes(asset.mimeType)) {
        Alert.alert('Unsupported file', 'Please pick a PDF, JPG, or PNG.');
        return;
      }
      setAttachedFile(asset);
    } catch (err) {
      Alert.alert('Could not pick file', err?.message || 'Try again.');
    }
  };

  const buildFormData = async (message, asset) => {
    const formData = new FormData();
    formData.append('message', message);
    if (!asset) return formData;

    if (Platform.OS === 'web') {
      let blob;
      if (asset.file) {
        blob = asset.file;
      } else {
        const response = await fetch(asset.uri);
        blob = await response.blob();
      }
      formData.append('file', blob, asset.name || 'upload');
    } else {
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || 'upload',
        type: asset.mimeType || 'application/octet-stream',
      });
    }
    return formData;
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      kind: 'user',
      text: trimmed,
      fileName: attachedFile?.name,
    };
    const fileForRequest = attachedFile;
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setAttachedFile(null);
    setSending(true);
    scrollToEnd();

    try {
      const formData = await buildFormData(trimmed, fileForRequest);
      const res = await explainAi(formData);
      const data = res.data || {};
      setMessages((m) => [
        ...m,
        {
          id: `b-${Date.now()}`,
          kind: 'bot',
          type: data.type || 'non-medical',
          text:
            typeof data.response === 'string' && data.response.trim()
              ? data.response
              : "Sorry, I couldn't understand. Please ask a medical-related question.",
        },
      ]);
    } catch (err) {
      const message =
        err?.response?.data?.message?.toString() ||
        'Could not reach the assistant. Please check your connection and try again.';
      setMessages((m) => [
        ...m,
        {
          id: `b-${Date.now()}`,
          kind: 'bot',
          type: 'non-medical',
          text: message,
        },
      ]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const canSend = input.trim().length > 0 && !sending;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Ask the AI Explainer</Text>
            <Text style={styles.headerSub}>Simple medical info — not advice</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          onContentSizeChange={scrollToEnd}
        >
          {messages.map((m) =>
            m.kind === 'user' ? (
              <UserBubble key={m.id} text={m.text} fileName={m.fileName} />
            ) : (
              <BotBubble key={m.id} text={m.text} type={m.type} />
            ),
          )}
          {sending && <TypingBubble />}
        </ScrollView>

        {attachedFile && (
          <View style={styles.fileChip}>
            <Text style={styles.fileChipIcon}>📎</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileChipName} numberOfLines={1}>
                {attachedFile.name || 'Selected file'}
              </Text>
              <Text style={styles.fileChipMeta}>
                {(attachedFile.mimeType || 'file')} ·{' '}
                {formatBytes(attachedFile.size)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setAttachedFile(null)}
              style={styles.fileChipClose}
            >
              <Ionicons name="close" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.card }}>
          <View style={styles.composer}>
            <TouchableOpacity
              onPress={pickFile}
              style={styles.attachBtn}
              disabled={sending}
            >
              <Text style={styles.attachIcon}>📎</Text>
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={
                attachedFile
                  ? 'Describe your question about this file…'
                  : 'Ask about a symptom or medical term…'
              }
              placeholderTextColor={C.muted}
              style={styles.input}
              multiline
              editable={!sending}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!canSend}
              style={[
                styles.sendBtn,
                !canSend && { backgroundColor: C.tealMid },
              ]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function UserBubble({ text, fileName }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        {fileName ? (
          <View style={styles.userFileRow}>
            <Text style={styles.userFileIcon}>📎</Text>
            <Text style={styles.userFileName} numberOfLines={1}>
              {fileName}
            </Text>
          </View>
        ) : null}
        <Text style={styles.userText}>{text}</Text>
      </View>
    </View>
  );
}

function BotBubble({ text, type }) {
  const meta = TYPE_STYLES[type] || TYPE_STYLES['non-medical'];
  return (
    <View style={styles.botRow}>
      <View style={styles.botAvatar}>
        <Ionicons name="sparkles-outline" size={18} color="#fff" />
      </View>
      <View style={styles.botBubble}>
        <View style={[styles.typePill, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.typePillText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.botText}>{text}</Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={styles.botRow}>
      <View style={styles.botAvatar}>
        <Ionicons name="sparkles-outline" size={18} color="#fff" />
      </View>
      <View style={[styles.botBubble, styles.typingBubble]}>
        <ActivityIndicator color={C.teal} size="small" />
        <Text style={styles.typingText}>Thinking…</Text>
      </View>
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
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },

  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 8, gap: 10 },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    backgroundColor: C.teal,
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: '82%',
  },
  userText: { color: '#fff', fontSize: 14, lineHeight: 19 },
  userFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  userFileIcon: { fontSize: 12 },
  userFileName: { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1 },

  botRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.tealPale,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.tealMid,
  },
  botAvatarText: { fontSize: 14 },
  botBubble: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '82%',
    borderWidth: 1,
    borderColor: C.border,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 6,
  },
  typePillText: { fontSize: 10, fontWeight: '700' },
  botText: { color: C.text, fontSize: 14, lineHeight: 20 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingText: { color: C.muted, fontSize: 13 },

  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.tealPale,
    borderTopWidth: 1,
    borderTopColor: C.tealMid,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fileChipIcon: { fontSize: 16 },
  fileChipName: { fontSize: 12, fontWeight: '700', color: C.text },
  fileChipMeta: { fontSize: 10, color: C.muted, marginTop: 1 },
  fileChipClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileChipCloseText: { fontSize: 11, color: C.muted, fontWeight: '700' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.card,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.grayPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachIcon: { fontSize: 18 },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: C.grayPale,
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 14,
    color: C.text,
  },
  sendBtn: {
    backgroundColor: C.teal,
    borderRadius: 19,
    paddingHorizontal: 16,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
