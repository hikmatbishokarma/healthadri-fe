import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/api';

const C = {
  primary: '#1A6B5A',
  primaryLight: '#E8F5F1',
  text: '#0F172A',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  error: '#EF4444',
};

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Other'];

export default function AddCaregiverScreen({ navigation, route }) {
  const { user, refresh } = useAuth();
  const isEdit = !!route.params?.editMode;

  const [cgName, setCgName] = useState(user?.caregiverName || '');
  const [relationship, setRelationship] = useState(user?.caregiverRelationship || '');
  const [phone, setPhone] = useState(user?.caregiverPhone || '');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValid = cgName.trim().length >= 2 && relationship && phone.trim().length >= 10;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        caregiverName: cgName.trim(),
        caregiverRelationship: relationship,
        caregiverPhone: phone.trim(),
      });
      await refresh();
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message?.toString() || 'Could not save caregiver. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.headerBack}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEdit ? 'Caregiver Details' : 'Add Caregiver'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.label}>Caregiver Name <Text style={s.req}>*</Text></Text>
          <View style={s.inputRow}>
            <Ionicons name="person-outline" size={18} color={C.textMuted} style={s.inputIcon} />
            <TextInput
              style={s.inputInner}
              value={cgName}
              onChangeText={setCgName}
              placeholder="Enter caregiver name"
              placeholderTextColor={C.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
              outlineWidth={0}
            />
          </View>

          <Text style={s.label}>Relationship <Text style={s.req}>*</Text></Text>
          <TouchableOpacity
            style={s.selectRow}
            onPress={() => setShowPicker((v) => !v)}
            activeOpacity={0.75}
          >
            <Text style={[s.selectText, !relationship && s.selectPlaceholder]}>
              {relationship || 'Select relationship'}
            </Text>
            <Ionicons
              name={showPicker ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={C.textMuted}
            />
          </TouchableOpacity>

          {showPicker && (
            <View style={s.dropdown}>
              {RELATIONSHIPS.map((r, idx) => {
                const isLast = idx === RELATIONSHIPS.length - 1;
                const sel = relationship === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[s.dropdownItem, !isLast && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                    onPress={() => { setRelationship(r); setShowPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.dropdownText, sel && s.dropdownTextSel]}>{r}</Text>
                    {sel && <Ionicons name="checkmark" size={16} color={C.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={s.label}>Phone Number <Text style={s.req}>*</Text></Text>
          <View style={[s.inputRow, { paddingHorizontal: 0, overflow: 'hidden' }]}>
            <View style={s.phonePrefix}>
              <Text style={s.phonePrefixText}>+91</Text>
            </View>
            <TextInput
              style={[s.inputInner, { paddingHorizontal: 14, flex: 1 }]}
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
              placeholder="Enter phone number"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              outlineWidth={0}
            />
          </View>

          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={C.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
            <Text style={s.infoText}>
              We will use this information to generate an invite for your caregiver.
            </Text>
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.saveBtn, (!isValid || saving) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid || saving}
            activeOpacity={0.88}
          >
            {saving
              ? <ActivityIndicator color={C.white} />
              : <Text style={s.saveBtnText}>{isEdit ? 'Save Changes' : 'Save Caregiver'}</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
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

  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },

  label: { fontSize: 13, fontWeight: '600', color: C.textSub, marginBottom: 8, marginTop: 20 },
  req: { color: C.error },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, minHeight: 52,
  },
  inputIcon: { marginRight: 10 },
  inputInner: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 14 },

  selectRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 16,
  },
  selectText: { fontSize: 15, color: C.text, fontWeight: '500' },
  selectPlaceholder: { color: C.textMuted, fontWeight: '400' },

  dropdown: {
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, overflow: 'hidden', marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dropdownText: { fontSize: 15, color: C.text },
  dropdownTextSel: { color: C.primary, fontWeight: '700' },

  phonePrefix: {
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1.5, borderRightColor: C.border, justifyContent: 'center',
  },
  phonePrefixText: { fontSize: 15, fontWeight: '600', color: C.textSub },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, marginTop: 20,
    borderWidth: 1, borderColor: C.border,
  },
  infoText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 19 },

  footer: {
    backgroundColor: C.white, paddingHorizontal: 20,
    paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 14, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: 16 },
});
