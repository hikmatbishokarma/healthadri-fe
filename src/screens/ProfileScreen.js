import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Share } from 'react-native';
import { generateInvite, updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ChipSelect from '../components/ChipSelect';

const C = {
  primary: '#1A6B5A',
  primaryDark: '#0D4035',
  primaryLight: '#E8F5F1',
  primaryMid: '#145548',
  text: '#0F172A',
  textSub: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  errorBg: '#FEF2F2',
  errorText: '#DC2626',
};

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const CANCER_TYPE_OPTIONS = [
  'Oral', 'Breast', 'Lung', 'Cervical', 'Colorectal',
  'Prostate', 'Stomach', 'Liver', 'Leukemia', 'Lymphoma', 'Other',
];
const CANCER_STAGE_OPTIONS = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unknown'];

export default function ProfileScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const isOnboarding = !user?.profileCompleted;
  const prevProfileCompleted = useRef(user?.profileCompleted);

  const [editMode, setEditMode] = useState(isOnboarding);
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState(user?.gender || '');
  const [cancerType, setCancerType] = useState(user?.cancerType || '');
  const [cancerStage, setCancerStage] = useState(user?.cancerStage || '');
  const [hospitalName, setHospitalName] = useState(user?.hospitalName || '');
  const [saving, setSaving] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);

  // Re-sync when user data updates from server
  useEffect(() => {
    setName(user?.name || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setCancerType(user?.cancerType || '');
    setCancerStage(user?.cancerStage || '');
    setHospitalName(user?.hospitalName || '');
  }, [user]);

  // Navigation fix: when profileCompleted flips true (onboarding complete),
  // explicitly navigate so we don't rely solely on AppNavigator's conditional screens.
  useEffect(() => {
    const wasIncomplete = !prevProfileCompleted.current;
    const nowComplete = !!user?.profileCompleted;
    if (wasIncomplete && nowComplete) {
      navigation.replace('PatientDashboard');
    }
    prevProfileCompleted.current = user?.profileCompleted;
  }, [user?.profileCompleted]);

  const handleSave = async () => {
    if (!name.trim() || !age || !gender) {
      Alert.alert('Required fields', 'Please fill in your name, age, and gender.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        age: Number(age),
        gender,
        cancerType,
        cancerStage,
        hospitalName,
      });
      await refresh();
      if (!isOnboarding) setEditMode(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message?.toString() || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await generateInvite();
      const code = res.data.code;
      setInviteCode(code);
      Share.share({
        message: `I've added you as my caregiver on Healthadri. Download the app and enter this code when signing up: ${code}`,
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not generate invite code');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setCancerType(user?.cancerType || '');
    setCancerStage(user?.cancerStage || '');
    setHospitalName(user?.hospitalName || '');
    setEditMode(false);
  };

  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  // ─── Onboarding view ────────────────────────────────────────────────────────
  if (isOnboarding) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroIconText}>👤</Text>
            </View>
            <Text style={styles.heroTitle}>Tell us about you</Text>
            <Text style={styles.heroSub}>
              This helps your care team support you better and respond faster.
            </Text>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            <FormSection title="Basic Information">
              <FieldLabel label="Full Name" required />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ravi Kumar"
                placeholderTextColor={C.textMuted}
                returnKeyType="next"
              />

              <FieldLabel label="Age" required />
              <TextInput
                style={[styles.input, { width: 120 }]}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="e.g. 45"
                placeholderTextColor={C.textMuted}
                maxLength={3}
              />

              <FieldLabel label="Gender" required />
              <ChipSelect value={gender} options={GENDER_OPTIONS} onChange={setGender} />
            </FormSection>

            <Divider />

            <FormSection title="Cancer Details">
              <FieldLabel label="Cancer Type" />
              <ChipSelect
                value={cancerType}
                options={CANCER_TYPE_OPTIONS}
                onChange={setCancerType}
              />

              <FieldLabel label="Stage" />
              <ChipSelect
                value={cancerStage}
                options={CANCER_STAGE_OPTIONS}
                onChange={setCancerStage}
              />
            </FormSection>

            <Divider />

            <FormSection title="Treatment Centre">
              <FieldLabel label="Hospital Name" />
              <TextInput
                style={styles.input}
                value={hospitalName}
                onChangeText={setHospitalName}
                placeholder="e.g. City Cancer Center"
                placeholderTextColor={C.textMuted}
              />
            </FormSection>
          </View>
        </ScrollView>

        {/* Sticky save button */}
        <View style={styles.stickyFooter}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <>
                <Text style={styles.saveBtnText}>Save & Continue</Text>
                <Text style={styles.saveBtnArrow}>→</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Profile view / edit mode ────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Compact profile header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('PatientDashboard')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{name || '—'}</Text>
            <Text style={styles.profileRole}>Patient</Text>
          </View>
          {!editMode && (
            <TouchableOpacity style={styles.editPill} onPress={() => setEditMode(true)}>
              <Text style={styles.editPillText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {!editMode ? (
          // ── View mode ──
          <>
            <InfoCard title="Basic Information">
              <InfoRow icon="👤" label="Name" value={name} />
              <InfoRow icon="🎂" label="Age" value={age ? `${age} yrs` : null} />
              <InfoRow icon="⚥" label="Gender" value={gender} last />
            </InfoCard>

            <InfoCard title="Cancer Details">
              <InfoRow icon="🎗" label="Type" value={cancerType} />
              <InfoRow icon="📊" label="Stage" value={cancerStage} last />
            </InfoCard>

            <InfoCard title="Treatment Centre">
              <InfoRow icon="🏥" label="Hospital" value={hospitalName} last />
            </InfoCard>

            <TouchableOpacity
              style={styles.recordsCard}
              onPress={() => navigation.navigate('MedicalRecords')}
              activeOpacity={0.75}
            >
              <View style={styles.recordsIconBox}>
                <Text style={{ fontSize: 20 }}>📁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordsTitle}>My Medical Records</Text>
                <Text style={styles.recordsSub}>
                  Prescriptions, lab reports, discharge summaries
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.inviteCard}>
              <View style={styles.inviteIconBox}>
                <Text style={{ fontSize: 20 }}>🤲</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordsTitle}>Invite a Caregiver</Text>
                <Text style={styles.recordsSub}>
                  {inviteCode
                    ? `Code: ${inviteCode}  ·  Valid 7 days`
                    : 'Let a family member or friend support you'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={handleGenerateInvite}
                disabled={generatingInvite}
              >
                {generatingInvite
                  ? <ActivityIndicator color={C.white} size="small" />
                  : <Text style={styles.inviteBtnText}>{inviteCode ? 'Share again' : 'Generate'}</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          // ── Edit mode ──
          <View style={styles.formCard}>
            <FormSection title="Basic Information">
              <FieldLabel label="Full Name" required />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholderTextColor={C.textMuted}
              />
              <FieldLabel label="Age" required />
              <TextInput
                style={[styles.input, { width: 120 }]}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholderTextColor={C.textMuted}
                maxLength={3}
              />
              <FieldLabel label="Gender" required />
              <ChipSelect value={gender} options={GENDER_OPTIONS} onChange={setGender} />
            </FormSection>

            <Divider />

            <FormSection title="Cancer Details">
              <FieldLabel label="Cancer Type" />
              <ChipSelect
                value={cancerType}
                options={CANCER_TYPE_OPTIONS}
                onChange={setCancerType}
              />
              <FieldLabel label="Stage" />
              <ChipSelect
                value={cancerStage}
                options={CANCER_STAGE_OPTIONS}
                onChange={setCancerStage}
              />
            </FormSection>

            <Divider />

            <FormSection title="Treatment Centre">
              <FieldLabel label="Hospital Name" />
              <TextInput
                style={styles.input}
                value={hospitalName}
                onChangeText={setHospitalName}
                placeholderTextColor={C.textMuted}
              />
            </FormSection>

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1 }, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FormSection({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FieldLabel({ label, required }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={{ color: C.errorText }}> *</Text>}
    </Text>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function InfoCard({ title, children }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>{title}</Text>
      <View style={styles.infoCardBody}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoRowIcon}>{icon}</Text>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={[styles.infoRowValue, !value && styles.infoRowEmpty]}>
        {value || '—'}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Hero (onboarding) ──
  hero: {
    backgroundColor: C.primaryDark,
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIconText: { fontSize: 28 },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  // ── Profile header (view mode) — compact horizontal ──
  profileHeader: {
    backgroundColor: C.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backBtnText: { color: C.white, fontSize: 18, fontWeight: '600', marginTop: -1 },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
  profileMeta: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
  },
  profileRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  editPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  editPillText: { color: C.white, fontSize: 13, fontWeight: '600' },

  // ── Form card ──
  formCard: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  section: { padding: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSub,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 20,
  },

  // ── Info cards (view mode) ──
  infoCard: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoCardBody: { paddingHorizontal: 16 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoRowIcon: { fontSize: 16, marginRight: 12, width: 24, textAlign: 'center' },
  infoRowLabel: { fontSize: 13, color: C.textSub, fontWeight: '500', width: 90 },
  infoRowValue: { fontSize: 14, color: C.text, fontWeight: '600', flex: 1 },
  infoRowEmpty: { color: C.textMuted, fontStyle: 'italic', fontWeight: '400' },

  // ── Records shortcut ──
  recordsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  recordsIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordsTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  recordsSub: { fontSize: 12, color: C.textSub, lineHeight: 16 },
  chevron: { color: C.textMuted, fontSize: 24 },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  inviteIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtn: {
    backgroundColor: '#E8860A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  inviteBtnText: { color: C.white, fontWeight: '700', fontSize: 12 },

  // ── Buttons ──
  stickyFooter: {
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  saveBtnArrow: { color: C.white, fontSize: 18, fontWeight: '700' },

  editActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    paddingTop: 24,
  },
  cancelBtn: {
    backgroundColor: C.bg,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  cancelBtnText: { color: C.textSub, fontWeight: '700', fontSize: 15 },
});
