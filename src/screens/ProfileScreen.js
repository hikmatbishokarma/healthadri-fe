import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Share } from 'react-native';
import { generateInvite, searchDoctors, searchHospitals, updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ChipSelect from '../components/ChipSelect';
import SearchableDropdown from '../components/SearchableDropdown';

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
  'Breast', 'Lung', 'Head & Neck', 'Cervical', 'Blood/Leukemia',
  'Prostate', 'Colorectal', 'Thyroid', 'Oral', 'Stomach', 'Liver', 'Other',
];
const CANCER_STAGE_OPTIONS = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Not Sure'];
const TREATMENT_STATUS_OPTIONS = [
  { value: 'newly-diagnosed', label: 'Newly Diagnosed' },
  { value: 'awaiting-surgery', label: 'Awaiting Surgery' },
  { value: 'chemo-radiation', label: 'Chemo/Radiation' },
  { value: 'post-treatment', label: 'Post-Treatment' },
];
const CAREGIVER_RELATIONSHIP_OPTIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Other'];

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

  // Onboarding wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age ? String(user.age) : '',
    gender: user?.gender || '',
    abhaNumber: '',
    emergencyContactPhone: '',
    cancerType: user?.cancerType || '',
    primarySite: '',
    cancerStage: user?.cancerStage || '',
    treatmentStatus: '',
    dateOfDiagnosis: '',
    caregiverName: '',
    caregiverRelationship: '',
    caregiverPhone: '',
    hospitalId: null,
    hospitalName: user?.hospitalName || '',
    doctorId: null,
    doctorName: '',
  });
  const [consentMedical, setConsentMedical] = useState(false);
  const [consentCaregiver, setConsentCaregiver] = useState(false);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

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

  const handleWizardSubmit = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        abhaNumber: form.abhaNumber,
        emergencyContactPhone: form.emergencyContactPhone,
        cancerType: form.cancerType,
        primarySite: form.primarySite,
        cancerStage: form.cancerStage,
        treatmentStatus: form.treatmentStatus,
        dateOfDiagnosis: form.dateOfDiagnosis || undefined,
        caregiverName: form.caregiverName,
        caregiverRelationship: form.caregiverRelationship,
        caregiverPhone: form.caregiverPhone,
        hospitalId: form.hospitalId || undefined,
        hospitalName: form.hospitalName,
        doctorName: form.doctorName,
        doctorId: form.doctorId || undefined,
      });
      await refresh();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message?.toString() || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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

  // ─── Onboarding wizard ────────────────────────────────────────────────────────
  if (isOnboarding) {
    const stepTitles = [
      'Basic Identity',
      'Cancer Profile',
      'Caregiver',
      'Care Team',
      'Review & Consent',
    ];

    const stepValid = () => {
      if (currentStep === 1) return form.name.trim() && form.age && form.gender;
      if (currentStep === 2) return !!form.cancerType;
      return true;
    };

    const goNext = () => setCurrentStep((s) => Math.min(s + 1, 5));
    const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />

        {/* Header */}
        <View style={styles.wizardHeader}>
          {currentStep > 1 ? (
            <TouchableOpacity onPress={goBack} style={styles.wizardBack}>
              <Text style={styles.wizardBackText}>←</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.wizardStepLabel}>Step {currentStep} of 5</Text>
            <Text style={styles.wizardStepTitle}>{stepTitles[currentStep - 1]}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          {[1, 2, 3, 4, 5].map((n) => (
            <View
              key={n}
              style={[styles.progressSegment, currentStep >= n && styles.progressSegmentActive]}
            />
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1 — Basic Identity */}
          {currentStep === 1 && (
            <View style={styles.formCard}>
              <FormSection title="Basic Information">
                <FieldLabel label="Full Name" required />
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => setField('name', v)}
                  placeholder="e.g. Ravi Kumar"
                  placeholderTextColor={C.textMuted}
                  returnKeyType="next"
                />

                <FieldLabel label="Age" required />
                <TextInput
                  style={[styles.input, { width: 120 }]}
                  value={form.age}
                  onChangeText={(v) => setField('age', v)}
                  keyboardType="number-pad"
                  placeholder="e.g. 45"
                  placeholderTextColor={C.textMuted}
                  maxLength={3}
                />

                <FieldLabel label="Gender" required />
                <ChipSelect
                  value={form.gender}
                  options={GENDER_OPTIONS}
                  onChange={(v) => setField('gender', v)}
                />

                <FieldLabel label="ABHA ID (optional)" />
                <TextInput
                  style={styles.input}
                  value={form.abhaNumber}
                  onChangeText={(v) => setField('abhaNumber', v)}
                  placeholder="14-digit ABHA number"
                  placeholderTextColor={C.textMuted}
                  keyboardType="number-pad"
                  maxLength={14}
                />

                <FieldLabel label="Emergency Contact Number (optional)" />
                <TextInput
                  style={styles.input}
                  value={form.emergencyContactPhone}
                  onChangeText={(v) => setField('emergencyContactPhone', v)}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={C.textMuted}
                  keyboardType="phone-pad"
                />
              </FormSection>
            </View>
          )}

          {/* Step 2 — Cancer Profile */}
          {currentStep === 2 && (
            <View style={styles.formCard}>
              <FormSection title="Cancer Profile">
                <FieldLabel label="Cancer Type" required />
                <ChipSelect
                  value={form.cancerType}
                  options={CANCER_TYPE_OPTIONS}
                  onChange={(v) => setField('cancerType', v)}
                />

                <FieldLabel label="Primary Site (optional)" />
                <TextInput
                  style={styles.input}
                  value={form.primarySite}
                  onChangeText={(v) => setField('primarySite', v)}
                  placeholder="e.g. Right Breast"
                  placeholderTextColor={C.textMuted}
                />

                <FieldLabel label="Stage (optional)" />
                <ChipSelect
                  value={form.cancerStage}
                  options={CANCER_STAGE_OPTIONS}
                  onChange={(v) => setField('cancerStage', v)}
                />

                <FieldLabel label="Treatment Status (optional)" />
                <ChipSelect
                  value={form.treatmentStatus}
                  options={TREATMENT_STATUS_OPTIONS}
                  onChange={(v) => setField('treatmentStatus', v)}
                />

                <FieldLabel label="Date of Diagnosis (optional)" />
                <TextInput
                  style={styles.input}
                  value={form.dateOfDiagnosis}
                  onChangeText={(v) => setField('dateOfDiagnosis', v)}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </FormSection>
            </View>
          )}

          {/* Step 3 — Caregiver */}
          {currentStep === 3 && (
            <View style={styles.formCard}>
              <FormSection title="Caregiver Information">
                <Text style={styles.stepHint}>
                  Do you have a primary caregiver? You can skip this for now.
                </Text>

                <FieldLabel label="Caregiver Name" />
                <TextInput
                  style={styles.input}
                  value={form.caregiverName}
                  onChangeText={(v) => setField('caregiverName', v)}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor={C.textMuted}
                />

                <FieldLabel label="Relationship" />
                <ChipSelect
                  value={form.caregiverRelationship}
                  options={CAREGIVER_RELATIONSHIP_OPTIONS}
                  onChange={(v) => setField('caregiverRelationship', v)}
                />

                <FieldLabel label="Caregiver Phone" />
                <TextInput
                  style={styles.input}
                  value={form.caregiverPhone}
                  onChangeText={(v) => setField('caregiverPhone', v)}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={C.textMuted}
                  keyboardType="phone-pad"
                />

                <Text style={styles.infoNote}>
                  You can share app access with your caregiver after setup from your Profile.
                </Text>
              </FormSection>
            </View>
          )}

          {/* Step 4 — Care Team */}
          {currentStep === 4 && (
            <View style={[styles.formCard, { zIndex: 20 }]}>
              <FormSection title="Care Team">
                <Text style={styles.stepHint}>
                  Search for your hospital and doctor. You can skip this and update it later.
                </Text>

                <FieldLabel label="Primary Hospital" />
                <SearchableDropdown
                  placeholder="Search hospitals..."
                  onSearch={async (q) => {
                    const res = await searchHospitals(q);
                    return res.data;
                  }}
                  onSelect={(item) => {
                    setField('hospitalId', item._id);
                    setField('hospitalName', item.name);
                  }}
                />

                <View style={{ marginTop: 20 }}>
                  <FieldLabel label="Primary Oncologist" />
                  <SearchableDropdown
                    placeholder="Search doctors..."
                    onSearch={async (q) => {
                      const res = await searchDoctors(q);
                      return res.data;
                    }}
                    onSelect={(item) => {
                      setField('doctorId', item._id);
                      setField('doctorName', item.name);
                    }}
                  />
                </View>
              </FormSection>
            </View>
          )}

          {/* Step 5 — Consent */}
          {currentStep === 5 && (
            <View style={styles.formCard}>
              <FormSection title="Summary">
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Name</Text>
                  <Text style={styles.summaryValue}>{form.name || '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Cancer Type</Text>
                  <Text style={styles.summaryValue}>{form.cancerType || '—'}</Text>
                </View>
                {form.caregiverName ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Caregiver</Text>
                    <Text style={styles.summaryValue}>{form.caregiverName}</Text>
                  </View>
                ) : null}
                {form.hospitalName ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Hospital</Text>
                    <Text style={styles.summaryValue}>{form.hospitalName}</Text>
                  </View>
                ) : null}
              </FormSection>

              <Divider />

              <FormSection title="Consent">
                <TouchableOpacity
                  style={styles.consentRow}
                  onPress={() => setConsentMedical((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, consentMedical && styles.checkboxChecked]}>
                    {consentMedical && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentText}>
                    I consent to sharing my medical records with my assigned care navigator for
                    better care coordination. <Text style={{ color: C.errorText }}>*</Text>
                  </Text>
                </TouchableOpacity>

                {form.caregiverName ? (
                  <TouchableOpacity
                    style={[styles.consentRow, { marginTop: 12 }]}
                    onPress={() => setConsentCaregiver((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, consentCaregiver && styles.checkboxChecked]}>
                      {consentCaregiver && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.consentText}>
                      I authorize my caregiver ({form.caregiverName}) to view my health updates.
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </FormSection>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.stickyFooter}>
          {currentStep < 5 ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(currentStep === 3 || currentStep === 4) && (
                <TouchableOpacity style={styles.skipBtn} onPress={goNext}>
                  <Text style={styles.skipBtnText}>Skip for now →</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { flex: 1 },
                  !stepValid() && styles.saveBtnDisabled,
                ]}
                onPress={goNext}
                disabled={!stepValid()}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, (!consentMedical || saving) && styles.saveBtnDisabled]}
              onPress={handleWizardSubmit}
              disabled={!consentMedical || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Text style={styles.saveBtnText}>Complete Registration</Text>
                  <Text style={styles.saveBtnArrow}>→</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ─── Profile view / edit mode ────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF7F2" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile header — mint green, like status card */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#EDF7F2' }}>
        <View style={styles.profileHeader}>
          {/* Decorative shield — like the heart on the home status card */}
          <View style={styles.headerDeco} pointerEvents="none">
            <Image source={require('../../assets/icons/medical-shield.png')} style={styles.decoShield} />
          </View>
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
        </SafeAreaView>

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
              <InfoRow img={require('../../assets/icons/hospital.png')} tint="#1D4ED8" label="Hospital" value={hospitalName} last />
            </InfoCard>

            <TouchableOpacity
              style={styles.recordsCard}
              onPress={() => navigation.navigate('MedicalRecords')}
              activeOpacity={0.75}
            >
              <View style={styles.recordsIconBox}>
                <Image source={require('../../assets/icons/medical-records.png')} style={{ width: 24, height: 24, resizeMode: 'contain', tintColor: '#1A6B5A' }} />
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

function InfoRow({ icon, img, tint, label, value, last }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      {img
        ? <Image source={img} style={[styles.infoRowImg, tint && { tintColor: tint }]} />
        : <Text style={styles.infoRowIcon}>{icon}</Text>}
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={[styles.infoRowValue, !value && styles.infoRowEmpty]}>
        {value || '—'}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Wizard header ──
  wizardHeader: {
    backgroundColor: C.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  wizardBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardBackText: { color: C.white, fontSize: 20, fontWeight: '600' },
  wizardStepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  wizardStepTitle: { fontSize: 16, fontWeight: '700', color: C.white },

  // ── Progress bar ──
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: C.primaryDark,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressSegmentActive: {
    backgroundColor: '#4ADE80',
  },

  stepHint: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 19,
    marginBottom: 8,
  },

  infoNote: {
    fontSize: 12,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 12,
    lineHeight: 17,
  },

  // ── Summary (step 5) ──
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryLabel: { width: 100, fontSize: 13, color: C.textSub, fontWeight: '500' },
  summaryValue: { flex: 1, fontSize: 13, color: C.text, fontWeight: '600' },

  // ── Consent ──
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  checkmark: { color: C.white, fontSize: 13, fontWeight: '700' },
  consentText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 19 },

  // ── Skip button ──
  skipBtn: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: { color: C.textSub, fontWeight: '600', fontSize: 14 },

  // ── Profile header (view mode) — mint green, like status card ──
  profileHeader: {
    backgroundColor: '#EDF7F2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    overflow: 'hidden',
  },
  headerDeco: {
    position: 'absolute',
    right: 80,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decoShield: { width: 90, height: 90, resizeMode: 'contain', opacity: 0.18, tintColor: C.primary },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backBtnText: { color: C.text, fontSize: 18, fontWeight: '600', marginTop: -1 },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primary,
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
    color: C.text,
  },
  profileRole: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 1,
  },
  editPill: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  editPillText: { color: C.primary, fontSize: 13, fontWeight: '700' },

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
  infoRowImg: { width: 20, height: 20, resizeMode: 'contain', marginRight: 12 },
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
