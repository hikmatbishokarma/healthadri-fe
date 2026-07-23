import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getHospitalById } from '../services/api';
import { colors } from '../theme/colors';

const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  tealPale: colors.primaryTint,
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
};

function openTel(phone) {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Could not place call', 'Please try again.'));
}

function openWhatsApp(phone) {
  if (!phone) return;
  const digits = phone.replace(/[^0-9]/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  Linking.openURL(`https://wa.me/${withCountryCode}`).catch(() =>
    Alert.alert('Could not open WhatsApp', 'Please try again.'),
  );
}

export default function HospitalDetailScreen({ navigation, route }) {
  const hospitalId = route?.params?.hospitalId;
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!hospitalId) { setLoading(false); return; }
      try {
        const res = await getHospitalById(hospitalId);
        setHospital(res.data);
      } catch {
        setHospital(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [hospitalId]);

  const addressParts = [hospital?.address, hospital?.landmark, hospital?.city].filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Hospital Details</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : !hospital ? (
        <View style={s.center}>
          <Text style={{ color: C.muted }}>Could not load hospital details.</Text>
        </View>
      ) : (
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <Text style={s.name}>{hospital.name}</Text>
            {addressParts.length > 0 && (
              <View style={s.row}>
                <Ionicons name="location-outline" size={16} color={C.muted} />
                <Text style={s.rowText}>{addressParts.join(', ')}</Text>
              </View>
            )}
            {hospital.facilityType ? (
              <View style={s.row}>
                <Ionicons name="medical-outline" size={16} color={C.muted} />
                <Text style={s.rowText}>{hospital.facilityType}</Text>
              </View>
            ) : null}
          </View>

          {(hospital.opdContact || hospital.whatsappContact) && (
            <View style={s.card}>
              <Text style={s.sectionLabel}>CONTACT</Text>
              {hospital.opdContact && (
                <TouchableOpacity style={s.contactBtn} onPress={() => openTel(hospital.opdContact)} activeOpacity={0.8}>
                  <Ionicons name="call-outline" size={18} color={C.teal} />
                  <Text style={s.contactText}>OPD: {hospital.opdContact}</Text>
                </TouchableOpacity>
              )}
              {hospital.whatsappContact && (
                <TouchableOpacity
                  style={s.contactBtn}
                  onPress={() => openWhatsApp(hospital.whatsappContact)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={18} color={C.teal} />
                  <Text style={s.contactText}>WhatsApp: {hospital.whatsappContact}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
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
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 40 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  name: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 },
  rowText: { fontSize: 13, color: C.muted, flex: 1, lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    letterSpacing: 0.8, marginBottom: 10,
  },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  contactText: { fontSize: 14, color: C.text, fontWeight: '600' },
});
