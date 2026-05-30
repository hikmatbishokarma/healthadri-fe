import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Share, ActivityIndicator, ScrollView, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { generateInvite } from '../services/api';
import Illustration from '../components/Illustration';

const C = {
  primary: '#1A6B5A',
  primaryLight: '#E8F5F1',
  primaryDark: '#0D4035',
  text: '#0F172A',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  error: '#EF4444',
};

export default function ConnectCaregiverScreen({ navigation }) {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadCode(); }, []);

  const loadCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateInvite();
      setCode(res.data.code);
    } catch {
      setError('Could not generate an invite code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const buildMessage = () =>
    `Join me on Healthadri as my caregiver.\n\nUse this invite code: ${code}\n\nDownload the app and enter the code when signing up.`;

  const handleWhatsApp = async () => {
    const msg = encodeURIComponent(buildMessage());
    try {
      await Linking.openURL(`https://wa.me/?text=${msg}`);
    } catch {
      Share.share({ message: buildMessage() });
    }
  };

  const handleSMS = async () => {
    const msg = encodeURIComponent(buildMessage());
    try {
      await Linking.openURL(`sms:?body=${msg}`);
    } catch {
      Share.share({ message: buildMessage() });
    }
  };

  const handleCopyCode = () => {
    Share.share({ message: code });
  };

  const handleShareLink = () => {
    Share.share({ message: buildMessage() });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.headerBack}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Connect Caregiver</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Illustration */}
          <Illustration name="caregiver_connected" size={180} style={s.illustrationWrap} />

          <Text style={s.inviteTitle}>Invite your caregiver</Text>
          <Text style={s.inviteSub}>Share the invite code or link with your caregiver.</Text>

          {/* Code / loading / error */}
          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={s.loadingText}>Generating invite code…</Text>
            </View>
          ) : error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={24} color={C.error} />
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={loadCode}>
                <Text style={s.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Invite code */}
              <View style={s.codeCard}>
                <Text style={s.codeLabel}>Invite Code</Text>
                <Text style={s.codeValue}>{code}</Text>
                <Text style={s.codeExpiry}>Code will expire in 7 days</Text>
              </View>

              {/* Share options */}
              <View style={s.shareCard}>
                <ShareRow
                  icon="logo-whatsapp"
                  iconBg="#25D36620"
                  iconColor="#25D366"
                  label="Share on WhatsApp"
                  onPress={handleWhatsApp}
                />
                <View style={s.sep} />
                <ShareRow
                  icon="chatbubble-ellipses-outline"
                  iconBg="#3B82F620"
                  iconColor="#3B82F6"
                  label="Share via SMS"
                  onPress={handleSMS}
                />
                <View style={s.sep} />
                <ShareRow
                  icon="copy-outline"
                  iconBg="#8B5CF620"
                  iconColor="#8B5CF6"
                  label="Copy Invite Code"
                  onPress={handleCopyCode}
                />
                <View style={s.sep} />
                <ShareRow
                  icon="qr-code-outline"
                  iconBg="#F59E0B20"
                  iconColor="#F59E0B"
                  label="Share Link"
                  onPress={handleShareLink}
                  last
                />
              </View>

              {/* Info */}
              <View style={s.infoBox}>
                <Text style={s.infoText}>
                  Once your caregiver accepts the invite, they will be able to access your care information.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ShareRow({ icon, iconBg, iconColor, label, onPress, last }) {
  return (
    <TouchableOpacity style={s.shareRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.shareIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={s.shareLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Illustration
  illustrationWrap: { marginTop: 16, marginBottom: 24 },

  inviteTitle: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 6 },
  inviteSub: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  // Loading
  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: C.textSub },

  // Error
  errorBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  errorText: { fontSize: 14, color: C.textSub, textAlign: 'center' },
  retryBtn: {
    backgroundColor: C.primaryLight, borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryText: { color: C.primary, fontWeight: '700', fontSize: 14 },

  // Code card
  codeCard: {
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
    padding: 20, alignItems: 'center', marginBottom: 16,
  },
  codeLabel: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  codeValue: {
    fontSize: 36, fontWeight: '800', color: C.primary,
    letterSpacing: 8, fontFamily: 'monospace',
  },
  codeExpiry: { fontSize: 12, color: C.textMuted, marginTop: 8 },

  // Share card
  shareCard: {
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
    overflow: 'hidden', marginBottom: 16,
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  shareIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  shareLabel: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
  sep: { height: 1, backgroundColor: C.border, marginLeft: 70 },

  // Info
  infoBox: {
    backgroundColor: C.primaryLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#C6E8DC',
  },
  infoText: { fontSize: 13, color: C.primary, lineHeight: 20, textAlign: 'center' },
});
