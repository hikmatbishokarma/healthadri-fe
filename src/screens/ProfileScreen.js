import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ChipSelect from '../components/ChipSelect';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const CANCER_TYPE_OPTIONS = [
  'Oral',
  'Breast',
  'Lung',
  'Cervical',
  'Colorectal',
  'Prostate',
  'Stomach',
  'Liver',
  'Leukemia',
  'Lymphoma',
  'Other',
];

const CANCER_STAGE_OPTIONS = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unknown'];

export default function ProfileScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const isOnboarding = !user?.profileCompleted;

  // View mode default for an already-onboarded patient; force edit mode during onboarding.
  const [editMode, setEditMode] = useState(isOnboarding);

  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState(user?.gender || '');
  const [cancerType, setCancerType] = useState(user?.cancerType || '');
  const [cancerStage, setCancerStage] = useState(user?.cancerStage || '');
  const [hospitalName, setHospitalName] = useState(user?.hospitalName || '');
  const [saving, setSaving] = useState(false);

  // Re-sync local state when user data refreshes from server
  useEffect(() => {
    setName(user?.name || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setCancerType(user?.cancerType || '');
    setCancerStage(user?.cancerStage || '');
    setHospitalName(user?.hospitalName || '');
  }, [user]);

  const handleSave = async () => {
    if (!name || !age || !gender) {
      Alert.alert('Missing fields', 'Name, age and gender are required.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name,
        age: Number(age),
        gender,
        cancerType,
        cancerStage,
        hospitalName,
      });
      await refresh();
      if (!isOnboarding) setEditMode(false);
    } catch (err) {
      Alert.alert(
        'Error',
        err.response?.data?.message?.toString() || 'Failed to save',
      );
    } finally {
      setSaving(false);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>
            {isOnboarding ? 'Tell us about you' : 'My Profile'}
          </Text>
          <Text style={styles.subheading}>
            {isOnboarding
              ? 'This helps your care team support you better.'
              : 'Your personal and medical details.'}
          </Text>
        </View>
        {!isOnboarding && !editMode && (
          <TouchableOpacity
            onPress={() => setEditMode(true)}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isOnboarding && (
        <TouchableOpacity
          style={styles.recordsLink}
          onPress={() => navigation.navigate('MedicalRecords')}
          activeOpacity={0.7}
        >
          <Text style={styles.recordsIcon}>📁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.recordsTitle}>My Medical Records</Text>
            <Text style={styles.recordsSub}>
              Prescriptions, lab reports, discharge summaries
            </Text>
          </View>
          <Text style={styles.recordsChevron}>›</Text>
        </TouchableOpacity>
      )}

      {editMode ? (
        <>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field
            label="Age"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />

          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <ChipSelect
              value={gender}
              options={GENDER_OPTIONS}
              onChange={setGender}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Cancer Type</Text>
            <ChipSelect
              value={cancerType}
              options={CANCER_TYPE_OPTIONS}
              onChange={setCancerType}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Cancer Stage</Text>
            <ChipSelect
              value={cancerStage}
              options={CANCER_STAGE_OPTIONS}
              onChange={setCancerStage}
            />
          </View>

          <Field
            label="Hospital Name"
            value={hospitalName}
            onChangeText={setHospitalName}
          />

          <View style={styles.actionRow}>
            {!isOnboarding && (
              <TouchableOpacity
                style={[styles.button, styles.cancelBtn]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.saveBtn]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isOnboarding ? 'Save Profile' : 'Save Changes'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.viewCard}>
          <ReadRow label="Name" value={name} />
          <ReadRow label="Age" value={age} />
          <ReadRow label="Gender" value={gender} />
          <ReadRow label="Cancer Type" value={cancerType} />
          <ReadRow label="Cancer Stage" value={cancerStage} />
          <ReadRow label="Hospital" value={hospitalName} last />
        </View>
      )}
    </ScrollView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#94A3B8" {...props} />
    </View>
  );
}

function ReadRow({ label, value, last }) {
  return (
    <View
      style={[
        styles.readRow,
        last && { borderBottomWidth: 0 },
      ]}
    >
      <Text style={styles.readLabel}>{label}</Text>
      <Text style={[styles.readValue, !value && styles.readEmpty]}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  content: { padding: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  subheading: { fontSize: 13, color: '#64748B', marginTop: 4 },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1A6B5A',
    borderRadius: 8,
  },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  recordsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  recordsIcon: { fontSize: 24 },
  recordsTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  recordsSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  recordsChevron: { color: '#64748B', fontSize: 22, fontWeight: '300' },

  field: { marginBottom: 14 },
  label: { fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1A1A2E',
  },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtn: { backgroundColor: '#1A6B5A' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { backgroundColor: '#E2E8F0' },
  cancelBtnText: { color: '#1A1A2E', fontWeight: '700', fontSize: 14 },

  viewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  readLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', width: 110 },
  readValue: { fontSize: 14, color: '#1A1A2E', flex: 1, fontWeight: '500' },
  readEmpty: { color: '#94A3B8', fontStyle: 'italic' },
});
