import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendOtp, verifyOtp } from '../services/api';
import { useAuth } from '../context/AuthContext';

// step: 'role' → 'phone' → 'otp'
// caregivers also fill in invite code on the otp step

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState('role');
  const [selectedRole, setSelectedRole] = useState(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setStep('phone');
  };

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid phone', 'Enter a 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(phone);
      setStep('otp');
      Alert.alert('OTP Sent', 'Use 1234 for demo.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      Alert.alert('Invalid OTP', 'Enter the 4-digit OTP.');
      return;
    }
    if (selectedRole === 'caregiver' && inviteCode.trim().length < 5) {
      Alert.alert('Invite code required', 'Enter the invite code shared by the patient.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(
        phone,
        otp,
        selectedRole,
        selectedRole === 'caregiver' ? inviteCode.trim().toUpperCase() : undefined,
      );
      await signIn(res.data.token, res.data.user);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Invalid OTP or invite code');
    } finally {
      setLoading(false);
    }
  };

  const renderRole = () => (
    <View style={styles.card}>
      <Text style={styles.roleTitle}>I am joining as</Text>
      <TouchableOpacity style={styles.roleButton} onPress={() => handleSelectRole('patient')}>
        <Text style={styles.roleEmoji}>🧑‍⚕️</Text>
        <View>
          <Text style={styles.roleLabel}>Patient</Text>
          <Text style={styles.roleDesc}>Track my cancer care journey</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.roleButton} onPress={() => handleSelectRole('caregiver')}>
        <Text style={styles.roleEmoji}>🤲</Text>
        <View>
          <Text style={styles.roleLabel}>Caregiver</Text>
          <Text style={styles.roleDesc}>Support a family member or friend</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderPhone = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Mobile Number</Text>
      <TextInput
        style={styles.input}
        placeholder="+91 XXXXX XXXXX"
        placeholderTextColor="#94A3B8"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        maxLength={15}
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setStep('role'); setPhone(''); }}>
        <Text style={styles.link}>← Change role</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtp = () => (
    <View style={styles.card}>
      <Text style={styles.label}>Enter OTP</Text>
      <TextInput
        style={styles.input}
        placeholder="1234"
        placeholderTextColor="#94A3B8"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
        maxLength={6}
        autoFocus
      />
      {selectedRole === 'caregiver' && (
        <>
          <Text style={styles.label}>Invite Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. HX-4829"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
            maxLength={7}
          />
          <Text style={styles.hint}>Ask the patient to generate this from their profile</Text>
        </>
      )}
      <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setInviteCode(''); }}>
        <Text style={styles.link}>← Change number</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Text style={styles.emoji}>🏥</Text>
        <Text style={styles.logo}>
          Health<Text style={styles.logoAccent}>adri</Text>
        </Text>
        <Text style={styles.sub}>Navigate Cancer Care</Text>

        {step === 'role' && renderRole()}
        {step === 'phone' && renderPhone()}
        {step === 'otp' && renderOtp()}

        <Text style={styles.terms}>
          By continuing you agree to our Terms of Use and Privacy Policy
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D4035' },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 60, marginBottom: 12 },
  logo: { fontSize: 28, fontWeight: '700', color: '#fff' },
  logoAccent: { color: '#F5A623' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, marginBottom: 32 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
  },
  roleTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 14,
    textAlign: 'center',
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  roleEmoji: { fontSize: 28 },
  roleLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  roleDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: -8,
    marginBottom: 14,
  },
  button: {
    backgroundColor: '#E8860A',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  link: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
  terms: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 24,
    maxWidth: 280,
  },
});
