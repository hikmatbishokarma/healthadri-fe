import { useCallback, useEffect, useRef, useState } from 'react';
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
  Share,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateInvite, searchHospitals, updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = {
  primary: '#1A6B5A',
  primaryDark: '#0D4035',
  primaryLight: '#E8F5F1',
  text: '#0F172A',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  errorText: '#EF4444',
};

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const CANCER_TYPES = [
  { id: 'breast', label: 'Breast Cancer' },
  { id: 'lung', label: 'Lung Cancer' },
  { id: 'head-neck', label: 'Head & Neck Cancer' },
  { id: 'blood', label: 'Blood Cancer' },
  { id: 'cervical', label: 'Cervical Cancer' },
  { id: 'prostate', label: 'Prostate Cancer' },
  { id: 'colorectal', label: 'Colorectal Cancer' },
  { id: 'thyroid', label: 'Thyroid Cancer' },
  { id: 'oral', label: 'Oral Cancer' },
  { id: 'stomach', label: 'Stomach Cancer' },
  { id: 'liver', label: 'Liver Cancer' },
  { id: 'other', label: 'Other' },
];

const CANCER_STAGES = [
  { value: 'Stage I', label: 'I' },
  { value: 'Stage II', label: 'II' },
  { value: 'Stage III', label: 'III' },
  { value: 'Stage IV', label: 'IV' },
  { value: 'Not Sure', label: '?' },
];

const TREATMENT_STATUS = [
  { value: 'newly-diagnosed', label: 'Newly Diagnosed' },
  { value: 'under-treatment', label: 'Under Treatment' },
  { value: 'completed', label: 'Completed Treatment' },
  { value: 'follow-up', label: 'Follow-up / Surveillance' },
];

const CAREGIVER_RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Other'];

const DP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DP_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const DP_YEARS = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - i));

export default function ProfileScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const isOnboarding = !user?.profileCompleted;
  const prevProfileCompleted = useRef(user?.profileCompleted);

  // Profile edit state
  const [editMode, setEditMode] = useState(false);
  const [editSection, setEditSection] = useState(null); // 'personal' | 'cancer' | 'hospital'
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState(user?.gender || '');
  const [cancerType, setCancerType] = useState(user?.cancerType || '');
  const [cancerStage, setCancerStage] = useState(user?.cancerStage || '');
  const [hospitalName, setHospitalName] = useState(user?.hospitalName || '');
  const [saving, setSaving] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age ? String(user.age) : '',
    gender: user?.gender || '',
    cancerType: user?.cancerType || '',
    cancerStage: user?.cancerStage || '',
    treatmentStatus: '',
    dateOfDiagnosis: '',
    caregiverName: '',
    caregiverRelationship: '',
    caregiverPhone: '',
    hospitalId: null,
    hospitalName: user?.hospitalName || '',
    hospitalCity: '',
  });

  // Step UI state
  const [cancerQuery, setCancerQuery] = useState('');
  const [caregiverChoice, setCaregiverChoice] = useState(null);
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [hospitalResults, setHospitalResults] = useState([]);
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [manualHospital, setManualHospital] = useState(false);
  const [consentMedical, setConsentMedical] = useState(false);

  const hospitalDebounce = useRef(null);

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    setName(user?.name || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setCancerType(user?.cancerType || '');
    setCancerStage(user?.cancerStage || '');
    setHospitalName(user?.hospitalName || '');
  }, [user]);

  useEffect(() => {
    const wasIncomplete = !prevProfileCompleted.current;
    const nowComplete = !!user?.profileCompleted;
    if (wasIncomplete && nowComplete) navigation.replace('PatientDashboard');
    prevProfileCompleted.current = user?.profileCompleted;
  }, [user?.profileCompleted]);

  // Suppress browser focus outline on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'ha-no-outline';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = '*:focus{outline:none!important;box-shadow:none!important;}';
    document.head.appendChild(el);
  }, []);

  const handleHospitalSearch = useCallback((text) => {
    setHospitalQuery(text);
    if (hospitalDebounce.current) clearTimeout(hospitalDebounce.current);
    if (!text.trim()) { setHospitalResults([]); return; }
    hospitalDebounce.current = setTimeout(async () => {
      setHospitalLoading(true);
      try {
        const res = await searchHospitals(text.trim());
        setHospitalResults(res.data.slice(0, 6));
      } catch { setHospitalResults([]); }
      finally { setHospitalLoading(false); }
    }, 350);
  }, []);

  const handleWizardSubmit = async () => {
    setSaving(true);
    // DatePickerField stores DD/MM/YYYY; backend requires ISO YYYY-MM-DD
    const toISODate = (ddmmyyyy) => {
      if (!ddmmyyyy) return undefined;
      const [d, m, y] = ddmmyyyy.split('/');
      if (!d || !m || !y) return undefined;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };
    try {
      await updateProfile({
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        cancerType: form.cancerType,
        cancerStage: form.cancerStage,
        treatmentStatus: form.treatmentStatus,
        dateOfDiagnosis: toISODate(form.dateOfDiagnosis),
        caregiverName: form.caregiverName,
        caregiverRelationship: form.caregiverRelationship,
        caregiverPhone: form.caregiverPhone || undefined,
        hospitalId: form.hospitalId || undefined,
        hospitalName: form.hospitalName,
      });
      await refresh();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message?.toString() || 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!name.trim() || !age || !gender) {
      Alert.alert('Required fields', 'Please fill in your name, age, and gender.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), age: Number(age), gender, cancerType, cancerStage, hospitalName });
      await refresh();
      setEditMode(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message?.toString() || 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await generateInvite();
      const code = res.data.code;
      setInviteCode(code);
      Share.share({ message: `I've added you as my caregiver on Healthadri. Download the app and enter this code when signing up: ${code}` });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not generate invite code');
    } finally { setGeneratingInvite(false); }
  };

  const openEdit = (section) => { setEditSection(section); setEditMode(true); };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setCancerType(user?.cancerType || '');
    setCancerStage(user?.cancerStage || '');
    setHospitalName(user?.hospitalName || '');
    setEditMode(false);
    setEditSection(null);
  };

  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  // ─── Onboarding Wizard ───────────────────────────────────────────────────────
  if (isOnboarding) {
    const stepValid = () => {
      if (currentStep === 1) return form.name.trim() && form.age && form.gender;
      if (currentStep === 2) return !!form.cancerType;
      if (currentStep === 3) return caregiverChoice !== null;
      return true;
    };

    const goNext = () => setCurrentStep((s) => Math.min(s + 1, 5));
    const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

    const filteredTypes = cancerQuery.trim()
      ? CANCER_TYPES.filter((t) => t.label.toLowerCase().includes(cancerQuery.toLowerCase()))
      : CANCER_TYPES;

    const treatmentLabel = TREATMENT_STATUS.find((o) => o.value === form.treatmentStatus)?.label;

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

          {/* ── Header ── */}
          <View style={s.header}>
            <TouchableOpacity
              onPress={goBack}
              style={[s.headerBack, currentStep === 1 && { opacity: 0 }]}
              disabled={currentStep === 1}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.headerTitle}>Registration</Text>
              <Text style={s.headerSub}>Step {currentStep} of 5</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* ── Progress dots ── */}
          <View style={s.progressRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <View key={n} style={[s.progressItem, n === 5 && { flex: 0 }]}>
                <View style={[
                  s.dot,
                  currentStep > n && s.dotDone,
                  currentStep === n && s.dotCurrent,
                ]}>
                  {currentStep > n
                    ? <Ionicons name="checkmark" size={10} color={C.white} />
                    : <Text style={[s.dotNum, currentStep === n && s.dotNumCurrent]}>{n}</Text>}
                </View>
                {n < 5 && <View style={[s.dotLine, currentStep > n && s.dotLineDone]} />}
              </View>
            ))}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ══ Step 1 — Basic Information ══ */}
            {currentStep === 1 && (
              <View>
                <Text style={s.stepTitle}>Tell us about yourself</Text>
                <Text style={s.stepSub}>We'll use this to personalize your care experience.</Text>

                <Text style={s.label}>Full Name <Text style={s.req}>*</Text></Text>
                <View style={s.inputRow}>
                  <Ionicons name="person-outline" size={18} color={C.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={s.inputInner}
                    value={form.name}
                    onChangeText={(v) => setField('name', v)}
                    placeholder="e.g. Ravi Kumar"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <Text style={s.label}>Age <Text style={s.req}>*</Text></Text>
                <View style={[s.inputRow, { width: 110 }]}>
                  <TextInput
                    style={[s.inputInner, { textAlign: 'center', width: 110 }]}
                    value={form.age}
                    onChangeText={(v) => setField('age', v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="45"
                    placeholderTextColor={C.textMuted}
                    maxLength={3}
                  />
                </View>

                <Text style={s.label}>Gender <Text style={s.req}>*</Text></Text>
                <View style={s.segRow}>
                  {GENDER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.seg, { flex: 1 }, form.gender === opt && s.segActive]}
                      onPress={() => setField('gender', opt)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.segText, form.gender === opt && s.segTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ══ Step 2 — Cancer Profile ══ */}
            {currentStep === 2 && (
              <View>
                <Text style={s.stepTitle}>Tell us about your cancer</Text>
                <Text style={s.stepSub}>This helps us provide better support.</Text>

                <Text style={s.label}>Cancer Type <Text style={s.req}>*</Text></Text>
                <View style={s.inputRow}>
                  <Ionicons name="search-outline" size={18} color={C.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={s.inputInner}
                    value={cancerQuery}
                    onChangeText={setCancerQuery}
                    placeholder="Search cancer type"
                    placeholderTextColor={C.textMuted}
                  />
                  {cancerQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCancerQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={C.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={s.listCard}>
                  {filteredTypes.map((type, idx) => {
                    const sel = form.cancerType === type.label;
                    const isLast = idx === filteredTypes.length - 1;
                    return (
                      <TouchableOpacity
                        key={type.id}
                        style={[s.listRow, !isLast && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                        onPress={() => { setField('cancerType', type.label); setCancerQuery(''); }}
                        activeOpacity={0.7}
                      >
                        <View style={[s.listIconBox, sel && s.listIconBoxActive]}>
                          <Ionicons name="medical-outline" size={15} color={sel ? C.white : C.primary} />
                        </View>
                        <Text style={[s.listRowText, sel && s.listRowTextActive]}>{type.label}</Text>
                        <View style={[s.radio, sel && s.radioActive]}>
                          {sel && <View style={s.radioDot} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {filteredTypes.length === 0 && (
                    <Text style={s.emptyText}>No results for "{cancerQuery}"</Text>
                  )}
                </View>

                <Text style={[s.label, { marginTop: 24 }]}>
                  Stage <Text style={s.opt}>(Optional)</Text>
                </Text>
                <View style={s.segRow}>
                  {CANCER_STAGES.map((st) => (
                    <TouchableOpacity
                      key={st.value}
                      style={[s.seg, { flex: 1 }, form.cancerStage === st.value && s.segActive]}
                      onPress={() => setField('cancerStage', form.cancerStage === st.value ? '' : st.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.segText, form.cancerStage === st.value && s.segTextActive]}>{st.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.label, { marginTop: 24 }]}>
                  Treatment Status <Text style={s.opt}>(Optional)</Text>
                </Text>
                <View style={s.listCard}>
                  {TREATMENT_STATUS.map((opt, idx) => {
                    const sel = form.treatmentStatus === opt.value;
                    const isLast = idx === TREATMENT_STATUS.length - 1;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.listRow, !isLast && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                        onPress={() => setField('treatmentStatus', sel ? '' : opt.value)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.radio, sel && s.radioActive]}>
                          {sel && <View style={s.radioDot} />}
                        </View>
                        <Text style={[s.listRowText, sel && s.listRowTextActive, { marginLeft: 12 }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[s.label, { marginTop: 24 }]}>
                  Date of Diagnosis <Text style={s.opt}>(Optional)</Text>
                </Text>
                <DatePickerField
                  value={form.dateOfDiagnosis}
                  onChange={(v) => setField('dateOfDiagnosis', v)}
                />
              </View>
            )}

            {/* ══ Step 3 — Caregiver ══ */}
            {currentStep === 3 && (
              <View>
                <Text style={s.stepTitle}>Do you have someone helping you during treatment?</Text>
                <Text style={s.stepSub}>You can add their details next.</Text>

                <TouchableOpacity
                  style={[s.choiceCard, caregiverChoice === 'yes' && s.choiceCardActive]}
                  onPress={() => setCaregiverChoice('yes')}
                  activeOpacity={0.8}
                >
                  <View style={[s.choiceIconBox, caregiverChoice === 'yes' && s.choiceIconBoxActive]}>
                    <Ionicons name="people-outline" size={22} color={caregiverChoice === 'yes' ? C.white : C.primary} />
                  </View>
                  <Text style={[s.choiceText, caregiverChoice === 'yes' && s.choiceTextActive]}>
                    Yes, I have someone helping me
                  </Text>
                  <View style={[s.radio, caregiverChoice === 'yes' && s.radioActive]}>
                    {caregiverChoice === 'yes' && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.choiceCard, { marginTop: 12 }, caregiverChoice === 'no' && s.choiceCardActive]}
                  onPress={() => {
                    setCaregiverChoice('no');
                    setField('caregiverName', '');
                    setField('caregiverRelationship', '');
                    setField('caregiverPhone', '');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[s.choiceIconBox, caregiverChoice === 'no' && s.choiceIconBoxActive]}>
                    <Ionicons name="person-outline" size={22} color={caregiverChoice === 'no' ? C.white : C.primary} />
                  </View>
                  <Text style={[s.choiceText, caregiverChoice === 'no' && s.choiceTextActive]}>
                    No, I don't have anyone helping me
                  </Text>
                  <View style={[s.radio, caregiverChoice === 'no' && s.radioActive]}>
                    {caregiverChoice === 'no' && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>

                {caregiverChoice === 'yes' && (
                  <View style={{ marginTop: 28 }}>
                    <Text style={s.sectionLabel}>Caregiver Details</Text>
                    <Text style={s.sectionSub}>This person will help in your care journey.</Text>

                    <Text style={s.label}>Caregiver Name</Text>
                    <View style={s.inputRow}>
                      <Ionicons name="person-outline" size={18} color={C.textMuted} style={s.inputIcon} />
                      <TextInput
                        style={s.inputInner}
                        value={form.caregiverName}
                        onChangeText={(v) => setField('caregiverName', v)}
                        placeholder="e.g. Priya Sharma"
                        placeholderTextColor={C.textMuted}
                        autoCapitalize="words"
                      />
                    </View>

                    <Text style={s.label}>Relationship</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                        {CAREGIVER_RELATIONSHIPS.map((r) => {
                          const sel = form.caregiverRelationship === r;
                          return (
                            <TouchableOpacity
                              key={r}
                              style={[s.pill, sel && s.pillActive]}
                              onPress={() => setField('caregiverRelationship', r)}
                              activeOpacity={0.75}
                            >
                              <Text style={[s.pillText, sel && s.pillTextActive]}>{r}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>

                    <Text style={s.label}>Phone Number</Text>
                    <View style={[s.inputRow, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                      <View style={s.phonePrefix}>
                        <Text style={s.phonePrefixText}>+91</Text>
                      </View>
                      <TextInput
                        style={[s.inputInner, { paddingHorizontal: 14, flex: 1 }]}
                        value={form.caregiverPhone}
                        onChangeText={(v) => setField('caregiverPhone', v.replace(/[^0-9]/g, ''))}
                        placeholder="98765 43210"
                        placeholderTextColor={C.textMuted}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ══ Step 4 — Hospital ══ */}
            {currentStep === 4 && (
              <View>
                <Text style={s.stepTitle}>Which hospital are you currently visiting?</Text>
                <Text style={s.stepSub}>Search or add your hospital manually.</Text>

                {!manualHospital ? (
                  <>
                    <View style={s.inputRow}>
                      <Ionicons name="search-outline" size={18} color={C.textMuted} style={s.inputIcon} />
                      <TextInput
                        style={s.inputInner}
                        value={hospitalQuery}
                        onChangeText={handleHospitalSearch}
                        placeholder="Search hospital"
                        placeholderTextColor={C.textMuted}
                      />
                      {hospitalLoading
                        ? <ActivityIndicator size="small" color={C.primary} />
                        : hospitalQuery.length > 0 && (
                          <TouchableOpacity onPress={() => { setHospitalQuery(''); setHospitalResults([]); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={18} color={C.textMuted} />
                          </TouchableOpacity>
                        )}
                    </View>

                    {form.hospitalName && !hospitalQuery && (
                      <View style={s.selectedRow}>
                        <Ionicons name="business-outline" size={18} color={C.primary} />
                        <Text style={s.selectedText} numberOfLines={1}>{form.hospitalName}</Text>
                        <TouchableOpacity onPress={() => { setField('hospitalName', ''); setField('hospitalId', null); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color={C.textMuted} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {hospitalResults.length > 0 && (
                      <View style={s.listCard}>
                        {hospitalResults.map((h, idx) => {
                          const isLast = idx === hospitalResults.length - 1;
                          return (
                            <TouchableOpacity
                              key={h._id}
                              style={[s.listRow, !isLast && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                              onPress={() => {
                                setField('hospitalId', h._id);
                                setField('hospitalName', h.name);
                                setHospitalQuery('');
                                setHospitalResults([]);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={s.listIconBox}>
                                <Ionicons name="business-outline" size={15} color={C.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.listRowText}>{h.name}</Text>
                                {h.city && <Text style={s.listRowSub}>{h.city}</Text>}
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    <View style={s.cantFind}>
                      <Text style={s.cantFindText}>Can't find your hospital?</Text>
                      <TouchableOpacity style={s.addManualBtn} onPress={() => setManualHospital(true)}>
                        <Ionicons name="add-circle-outline" size={16} color={C.primary} />
                        <Text style={s.addManualText}>Add Hospital Manually</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View>
                    <TouchableOpacity style={s.backLink} onPress={() => setManualHospital(false)}>
                      <Ionicons name="chevron-back" size={16} color={C.primary} />
                      <Text style={s.backLinkText}>Back to search</Text>
                    </TouchableOpacity>

                    <Text style={s.sectionLabel}>Add Hospital Manually</Text>
                    <Text style={s.sectionSub}>Please enter the hospital details.</Text>

                    <Text style={s.label}>Hospital Name</Text>
                    <TextInput
                      style={s.input}
                      value={form.hospitalName}
                      onChangeText={(v) => setField('hospitalName', v)}
                      placeholder="e.g. Sri Sai Oncology Center"
                      placeholderTextColor={C.textMuted}
                      autoCapitalize="words"
                    />

                    <Text style={s.label}>City</Text>
                    <TextInput
                      style={s.input}
                      value={form.hospitalCity}
                      onChangeText={(v) => setField('hospitalCity', v)}
                      placeholder="e.g. Warangal"
                      placeholderTextColor={C.textMuted}
                      autoCapitalize="words"
                    />
                  </View>
                )}
              </View>
            )}

            {/* ══ Step 5 — Review & Consent ══ */}
            {currentStep === 5 && (
              <View>
                <Text style={s.stepTitle}>Review your information</Text>
                <Text style={s.stepSub}>Please review and confirm your details.</Text>

                <ReviewCard label="Patient" icon="person-outline" onEdit={() => setCurrentStep(1)}>
                  <Text style={s.reviewLine}>{form.name || '—'}</Text>
                  {(form.age || form.gender) ? (
                    <Text style={s.reviewSub}>{[form.age && `${form.age} yrs`, form.gender].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </ReviewCard>

                <ReviewCard label="Cancer" icon="medical-outline" onEdit={() => setCurrentStep(2)}>
                  <Text style={s.reviewLine}>{form.cancerType || '—'}</Text>
                  {(form.cancerStage || treatmentLabel) ? (
                    <Text style={s.reviewSub}>{[form.cancerStage, treatmentLabel].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </ReviewCard>

                {caregiverChoice === 'yes' && (
                  <ReviewCard label="Caregiver" icon="people-outline" onEdit={() => setCurrentStep(3)}>
                    <Text style={s.reviewLine}>{form.caregiverName || '—'}</Text>
                    {form.caregiverRelationship ? (
                      <Text style={s.reviewSub}>
                        {form.caregiverRelationship}{form.caregiverPhone ? ` · +91 ${form.caregiverPhone}` : ''}
                      </Text>
                    ) : null}
                  </ReviewCard>
                )}

                {form.hospitalName ? (
                  <ReviewCard label="Hospital" icon="business-outline" onEdit={() => setCurrentStep(4)}>
                    <Text style={s.reviewLine}>{form.hospitalName}</Text>
                    {form.hospitalCity ? <Text style={s.reviewSub}>{form.hospitalCity}</Text> : null}
                  </ReviewCard>
                ) : null}

                <TouchableOpacity
                  style={s.consentRow}
                  onPress={() => setConsentMedical((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, consentMedical && s.checkboxDone]}>
                    {consentMedical && <Ionicons name="checkmark" size={13} color={C.white} />}
                  </View>
                  <Text style={s.consentText}>
                    I agree to share my medical information with my care navigator for better care coordination.
                  </Text>
                </TouchableOpacity>

                <View style={s.trustRow}>
                  {[
                    { icon: 'shield-checkmark-outline', text: 'Secure & Confidential' },
                    { icon: 'people-outline', text: 'Personalized Support' },
                    { icon: 'heart-outline', text: 'Better Care Coordination' },
                  ].map((b) => (
                    <View key={b.text} style={s.trustBadge}>
                      <Ionicons name={b.icon} size={20} color={C.primary} />
                      <Text style={s.trustText}>{b.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── Sticky Footer ── */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[
                s.ctaBtn,
                currentStep === 5
                  ? (!consentMedical || saving) && s.ctaBtnDisabled
                  : !stepValid() && s.ctaBtnDisabled,
              ]}
              onPress={currentStep === 5 ? handleWizardSubmit : goNext}
              disabled={currentStep === 5 ? (!consentMedical || saving) : !stepValid()}
              activeOpacity={0.88}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Text style={s.ctaBtnText}>
                    {currentStep === 5 ? 'Complete Registration' : 'Continue'}
                  </Text>
                  <Ionicons
                    name={currentStep === 5 ? 'checkmark-circle' : 'arrow-forward'}
                    size={20}
                    color={C.white}
                  />
                </>
              )}
            </TouchableOpacity>

            {currentStep === 4 && (
              <TouchableOpacity style={s.skipLink} onPress={goNext}>
                <Text style={s.skipLinkText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Profile View / Edit ─────────────────────────────────────────────────────
  if (editMode) {
    const sectionTitle =
      editSection === 'personal' ? 'Personal Information' :
      editSection === 'cancer'   ? 'Cancer Information' :
                                   'Hospital Information';

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={s.header}>
            <TouchableOpacity style={s.headerBack} onPress={handleCancelEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>{sectionTitle}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {editSection === 'personal' && (
              <>
                <Text style={s.label}>Full Name <Text style={s.req}>*</Text></Text>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholderTextColor={C.textMuted} outlineWidth={0} />

                <Text style={s.label}>Age <Text style={s.req}>*</Text></Text>
                <TextInput
                  style={[s.input, { width: 110 }]}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  placeholderTextColor={C.textMuted}
                  maxLength={3}
                  outlineWidth={0}
                />

                <Text style={s.label}>Gender <Text style={s.req}>*</Text></Text>
                <View style={s.segRow}>
                  {GENDER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.seg, { flex: 1 }, gender === opt && s.segActive]}
                      onPress={() => setGender(opt)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.segText, gender === opt && s.segTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {editSection === 'cancer' && (
              <>
                <Text style={s.label}>Cancer Type</Text>
                <TextInput
                  style={s.input}
                  value={cancerType}
                  onChangeText={setCancerType}
                  placeholder="e.g. Breast Cancer"
                  placeholderTextColor={C.textMuted}
                  outlineWidth={0}
                />

                <Text style={s.label}>Stage</Text>
                <View style={s.segRow}>
                  {CANCER_STAGES.map((st) => (
                    <TouchableOpacity
                      key={st.value}
                      style={[s.seg, { flex: 1 }, cancerStage === st.value && s.segActive]}
                      onPress={() => setCancerStage(cancerStage === st.value ? '' : st.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.segText, cancerStage === st.value && s.segTextActive]}>{st.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {editSection === 'hospital' && (
              <>
                <Text style={s.label}>Hospital Name</Text>
                <TextInput
                  style={s.input}
                  value={hospitalName}
                  onChangeText={setHospitalName}
                  placeholderTextColor={C.textMuted}
                  outlineWidth={0}
                />
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleCancelEdit}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.ctaBtn, { flex: 1 }, saving && s.ctaBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator color={C.white} /> : <Text style={s.ctaBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Settings menu view ────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Top bar */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.headerBack}
            onPress={() => navigation.navigate('PatientDashboard')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

          {/* User card */}
          <View style={s.userCard}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.profileName}>{name || '—'}</Text>
              <Text style={s.profileRole}>View and manage your profile</Text>
            </View>
          </View>

          {/* Primary menu */}
          <View style={s.menuCard}>
            <MenuItem
              icon="person-outline"
              iconBg="#EFF6FF"
              iconColor="#3B82F6"
              label="Personal Information"
              onPress={() => openEdit('personal')}
            />
            <MenuItem
              icon="medical-outline"
              iconBg="#FFF7ED"
              iconColor="#F97316"
              label="Cancer Information"
              onPress={() => openEdit('cancer')}
            />
            <MenuItem
              icon="business-outline"
              iconBg="#F0FDF4"
              iconColor="#16A34A"
              label="Hospital Information"
              onPress={() => openEdit('hospital')}
            />
            <MenuItem
              icon="people-outline"
              iconBg={C.primaryLight}
              iconColor={C.primary}
              label="Caregiver"
              subtitle="Manage caregiver access"
              onPress={() => navigation.navigate('Caregiver')}
              highlight
              last
            />
          </View>

          {/* Secondary menu */}
          <View style={[s.menuCard, { marginTop: 16 }]}>
            <MenuItem
              icon="notifications-outline"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              label="Notifications"
              onPress={() => {}}
            />
            <MenuItem
              icon="shield-outline"
              iconBg="#F5F3FF"
              iconColor="#7C3AED"
              label="Privacy & Security"
              onPress={() => {}}
            />
            <MenuItem
              icon="help-circle-outline"
              iconBg="#F0F9FF"
              iconColor="#0284C7"
              label="Help & Support"
              onPress={() => {}}
            />
            <MenuItem
              icon="information-circle-outline"
              iconBg="#F9FAFB"
              iconColor="#6B7280"
              label="About Us"
              onPress={() => {}}
              last
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ReviewCard({ label, icon, onEdit, children }) {
  return (
    <View style={s.reviewCard}>
      <View style={s.reviewCardHeader}>
        <View style={s.reviewIconBox}>
          <Ionicons name={icon} size={16} color={C.primary} />
        </View>
        <Text style={s.reviewCardLabel}>{label}</Text>
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="create-outline" size={18} color={C.textSub} />
        </TouchableOpacity>
      </View>
      <View style={s.reviewCardBody}>{children}</View>
    </View>
  );
}

function DatePickerField({ value, onChange }) {
  const [visible, setVisible] = useState(false);

  // Parse existing DD/MM/YYYY value
  const parsed = value ? value.split('/') : [];
  const initDay = parsed[0] || '';
  const initMonth = parsed[1] ? DP_MONTHS[parseInt(parsed[1], 10) - 1] || '' : '';
  const initYear = parsed[2] || '';

  const [selDay, setSelDay] = useState(initDay);
  const [selMonth, setSelMonth] = useState(initMonth);
  const [selYear, setSelYear] = useState(initYear);

  const handleOpen = () => {
    // Sync state from prop on open
    const p = value ? value.split('/') : [];
    setSelDay(p[0] || '');
    setSelMonth(p[1] ? DP_MONTHS[parseInt(p[1], 10) - 1] || '' : '');
    setSelYear(p[2] || '');
    setVisible(true);
  };

  const handleDone = () => {
    if (selDay && selMonth && selYear) {
      const m = String(DP_MONTHS.indexOf(selMonth) + 1).padStart(2, '0');
      onChange(`${selDay}/${m}/${selYear}`);
    }
    setVisible(false);
  };

  const displayText = value ? value.split('/').join(' / ') : '';

  return (
    <>
      <TouchableOpacity style={s.dateField} onPress={handleOpen} activeOpacity={0.75}>
        <Text style={[s.dateFieldText, !value && s.dateFieldPlaceholder]}>
          {displayText || 'DD / MM / YYYY'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={value ? C.textSub : C.textMuted} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.dpBackdrop} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={s.dpSheet} onStartShouldSetResponder={() => true}>
            <View style={s.dpHeader}>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.dpCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.dpTitle}>Date of Diagnosis</Text>
              <TouchableOpacity onPress={handleDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.dpDone}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={s.dpColumns}>
              <View style={s.dpColumnWrap}>
                <Text style={s.dpColumnLabel}>Day</Text>
                <PickerColumn items={DP_DAYS} selected={selDay} onSelect={setSelDay} open={visible} />
              </View>
              <View style={s.dpSep} />
              <View style={s.dpColumnWrap}>
                <Text style={s.dpColumnLabel}>Month</Text>
                <PickerColumn items={DP_MONTHS} selected={selMonth} onSelect={setSelMonth} open={visible} />
              </View>
              <View style={s.dpSep} />
              <View style={s.dpColumnWrap}>
                <Text style={s.dpColumnLabel}>Year</Text>
                <PickerColumn items={DP_YEARS} selected={selYear} onSelect={setSelYear} open={visible} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function PickerColumn({ items, selected, onSelect, open }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const idx = items.indexOf(selected);
    if (idx >= 0 && listRef.current) {
      setTimeout(() => {
        try { listRef.current?.scrollToOffset({ offset: idx * PICKER_ITEM_H, animated: false }); } catch {}
      }, 80);
    }
  }, [open]);  // scroll to selected when modal opens

  const onScrollEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    onSelect(items[clamped]);
  };

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(item) => item}
      showsVerticalScrollIndicator={false}
      snapToInterval={PICKER_ITEM_H}
      decelerationRate="fast"
      style={{ height: PICKER_ITEM_H * 4.5 }}
      onMomentumScrollEnd={onScrollEnd}
      renderItem={({ item }) => {
        const sel = item === selected;
        return (
          <TouchableOpacity
            style={[s.pickerItem, sel && s.pickerItemSel]}
            onPress={() => onSelect(item)}
            activeOpacity={0.6}
          >
            <Text style={[s.pickerItemText, sel && s.pickerItemTextSel]}>{item}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function InfoCard({ title, children }) {
  return (
    <View style={s.infoCard}>
      <Text style={s.infoCardTitle}>{title}</Text>
      <View style={s.infoCardBody}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, img, tint, label, value, last }) {
  return (
    <View style={[s.infoRow, last && { borderBottomWidth: 0 }]}>
      {img
        ? <Image source={img} style={[s.infoRowImg, tint && { tintColor: tint }]} />
        : <Ionicons name={icon} size={17} color={C.textSub} style={s.infoRowIconStyle} />}
      <Text style={s.infoRowLabel}>{label}</Text>
      <Text style={[s.infoRowValue, !value && s.infoRowEmpty]}>{value || '—'}</Text>
    </View>
  );
}

function MenuItem({ icon, iconBg, iconColor, label, subtitle, onPress, highlight, last }) {
  return (
    <TouchableOpacity
      style={[s.menuItem, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.menuIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuItemLabel, highlight && { color: C.primary, fontWeight: '600' }]}>{label}</Text>
        {subtitle ? <Text style={s.menuItemSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

const PICKER_ITEM_H = 48;

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Wizard header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: C.bg,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  headerSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },

  // Progress dots
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: C.bg,
  },
  progressItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotDone: { backgroundColor: C.primary, borderColor: C.primary },
  dotCurrent: { backgroundColor: C.primaryLight, borderColor: C.primary },
  dotNum: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  dotNumCurrent: { color: C.primary },
  dotLine: { flex: 1, height: 2, backgroundColor: C.border, marginHorizontal: 4 },
  dotLineDone: { backgroundColor: C.primary },

  // Scroll
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },

  // Step titles
  stepTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 6, lineHeight: 30 },
  stepSub: { fontSize: 14, color: C.textSub, marginBottom: 24, lineHeight: 20 },

  // Labels
  label: { fontSize: 13, fontWeight: '600', color: C.textSub, marginBottom: 8, marginTop: 16 },
  req: { color: C.errorText },
  opt: { fontWeight: '400', color: C.textMuted },

  // Input row (with icon container)
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputIcon: { marginRight: 10 },
  inputInner: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: 14,
    outlineWidth: 0,
  },

  // Standalone input (no icon)
  input: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: C.text,
    outlineWidth: 0,
  },

  // Segmented control
  segRow: {
    flexDirection: 'row',
    gap: 8,
  },
  seg: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
    minWidth: 60,
  },
  segActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  segText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  segTextActive: { color: C.primary, fontWeight: '700' },

  // Radio
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },

  // List card (cancer types, hospitals)
  listCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
    marginTop: 8,
  },
  listGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  listIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listIconBoxActive: { backgroundColor: C.primary },
  listRowText: { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  listRowTextActive: { color: C.primary, fontWeight: '700' },
  listRowSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  emptyText: { textAlign: 'center', color: C.textMuted, paddingVertical: 20, fontSize: 14 },

  // Caregiver choice cards
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
    gap: 14,
  },
  choiceCardActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  choiceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceIconBoxActive: { backgroundColor: C.primary },
  choiceText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500', lineHeight: 21 },
  choiceTextActive: { color: C.primary, fontWeight: '600' },

  // Section labels (within step)
  sectionLabel: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: C.textSub, marginBottom: 16 },

  // Pill selector (relationships)
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  pillActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  pillText: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  pillTextActive: { color: C.primary, fontWeight: '700' },

  // Phone prefix
  phonePrefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: C.bg,
    borderRightWidth: 1.5,
    borderRightColor: C.border,
    justifyContent: 'center',
  },
  phonePrefixText: { fontSize: 15, fontWeight: '600', color: C.textSub },

  // Hospital - selected state
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  selectedText: { flex: 1, fontSize: 14, color: C.primary, fontWeight: '600' },

  // Hospital "can't find"
  cantFind: { marginTop: 20, alignItems: 'center', gap: 8 },
  cantFindText: { fontSize: 14, color: C.textSub },
  addManualBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addManualText: { fontSize: 14, color: C.primary, fontWeight: '700' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  backLinkText: { fontSize: 14, color: C.primary, fontWeight: '600' },

  // Review step
  reviewCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  reviewIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCardLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },
  reviewCardBody: { paddingHorizontal: 14, paddingVertical: 12 },
  reviewLine: { fontSize: 15, fontWeight: '600', color: C.text },
  reviewSub: { fontSize: 13, color: C.textSub, marginTop: 3 },

  // Consent
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
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
  checkboxDone: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 20 },

  // Trust badges
  trustRow: { flexDirection: 'row', gap: 8 },
  trustBadge: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  trustText: { fontSize: 11, color: C.textSub, textAlign: 'center', fontWeight: '500', lineHeight: 15 },

  // Sticky footer
  footer: {
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
  },
  ctaBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: C.white, fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
  skipLink: { alignItems: 'center', paddingVertical: 4 },
  skipLinkText: { fontSize: 14, color: C.textSub, fontWeight: '500' },

  // ── Profile view mode ──
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: C.white, letterSpacing: 0.5 },
  profileName: { fontSize: 16, fontWeight: '700', color: C.text },
  profileRole: { fontSize: 12, color: C.textSub, marginTop: 2 },

  infoCard: {
    backgroundColor: C.white,
    marginHorizontal: 16, marginTop: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, overflow: 'hidden',
  },
  infoCardTitle: {
    fontSize: 11, fontWeight: '700', color: C.primary,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoCardBody: { paddingHorizontal: 16 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoRowIconStyle: { width: 24, textAlign: 'center', marginRight: 12 },
  infoRowImg: { width: 20, height: 20, resizeMode: 'contain', marginRight: 12 },
  infoRowLabel: { fontSize: 13, color: C.textSub, fontWeight: '500', width: 90 },
  infoRowValue: { fontSize: 14, color: C.text, fontWeight: '600', flex: 1 },
  infoRowEmpty: { color: C.textMuted, fontStyle: 'italic', fontWeight: '400' },

  recordsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 12,
  },
  recordsIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  recordsTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  recordsSub: { fontSize: 12, color: C.textSub, lineHeight: 16 },

  inviteCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 12,
  },
  inviteIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center',
  },
  inviteBtn: {
    backgroundColor: '#E8860A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 80, alignItems: 'center',
  },
  inviteBtnText: { color: C.white, fontWeight: '700', fontSize: 12 },

  // Edit mode card
  editCard: {
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  editSectionTitle: {
    fontSize: 11, fontWeight: '700', color: C.primary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: {
    backgroundColor: C.bg, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.border,
  },
  cancelBtnText: { color: C.textSub, fontWeight: '700', fontSize: 15 },

  // Date picker field (trigger button)
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateFieldText: { fontSize: 15, color: C.text, fontWeight: '500' },
  dateFieldPlaceholder: { color: C.textMuted, fontWeight: '400' },

  // Date picker modal
  dpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dpSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  dpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dpCancel: { fontSize: 15, color: C.textSub, fontWeight: '500' },
  dpTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  dpDone: { fontSize: 15, color: C.primary, fontWeight: '700' },
  dpColumns: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dpColumnWrap: { flex: 1, alignItems: 'center' },
  dpColumnLabel: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  dpSep: { width: 1, backgroundColor: C.border, marginTop: 26, marginHorizontal: 4 },

  // Picker column items
  pickerItem: {
    height: PICKER_ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  pickerItemSel: { backgroundColor: C.primaryLight },
  pickerItemText: { fontSize: 16, color: C.textSub, fontWeight: '400' },
  pickerItemTextSel: { color: C.primary, fontWeight: '700', fontSize: 17 },

  // ── Profile settings view ──
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20, gap: 14,
  },
  menuCard: {
    backgroundColor: C.white, marginHorizontal: 16,
    borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 14,
  },
  menuIconBox: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  menuItemLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  menuItemSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  // ── Edit mode ──
  editSectionTitle: {
    fontSize: 11, fontWeight: '700', color: C.primary,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 24, marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: {
    backgroundColor: C.bg, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.border,
  },
  cancelBtnText: { color: C.textSub, fontWeight: '700', fontSize: 15 },
});
