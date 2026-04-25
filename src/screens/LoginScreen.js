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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid phone', 'Enter a 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
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
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp);
      await signIn(res.data.token, res.data.user);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

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

        <View style={styles.card}>
          <Text style={styles.label}>Mobile Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+91 XXXXX XXXXX"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            editable={!otpSent}
            maxLength={15}
          />

          {otpSent && (
            <>
              <Text style={styles.label}>Enter OTP</Text>
              <TextInput
                style={styles.input}
                placeholder="1234"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={otpSent ? handleVerifyOtp : handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {otpSent ? 'Verify OTP' : 'Send OTP'}
              </Text>
            )}
          </TouchableOpacity>

          {otpSent && (
            <TouchableOpacity
              onPress={() => {
                setOtpSent(false);
                setOtp('');
              }}
            >
              <Text style={styles.link}>Change number</Text>
            </TouchableOpacity>
          )}
        </View>

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
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
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
