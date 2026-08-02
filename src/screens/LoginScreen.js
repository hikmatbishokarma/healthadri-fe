import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LogoMark from '../../assets/logo.svg';
import { caregiverLink, firebaseVerify, sendOtp, verifyOtp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const USE_FIREBASE = process.env.EXPO_PUBLIC_USE_FIREBASE === 'true';

// Public website base URL — set via EXPO_PUBLIC_WEB_URL (.env / eas.json).
const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL;
const TERMS_URL = `${WEB_BASE}/terms`;
const PRIVACY_URL = `${WEB_BASE}/privacy`;

// Only import Firebase when the flag is on — avoids crashes in Expo Go / static-OTP mode
let firebaseAuth = null;
if (USE_FIREBASE) {
  firebaseAuth = require('@react-native-firebase/auth').default;
}

const ROLES = [
  {
    key: 'patient',
    label: 'Patient',
    desc: 'Track my cancer care journey',
    color: colors.primary,
    bg: colors.primaryTint,
    icon: 'fitness-outline',
  },
  {
    // Backend role value stays 'caregiver' (auth + invite-link contract);
    // only the user-facing label is "Caretaker".
    key: 'caregiver',
    label: 'Caretaker',
    desc: "Support my loved one's journey",
    color: colors.accentBlue,
    bg: colors.accentBlueTint,
    icon: 'people-outline',
  },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState('role');
  const [selectedRole, setSelectedRole] = useState(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [firebaseConfirmation, setFirebaseConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const otpRefs = useRef([]);

  // Inject global CSS once on web to kill the browser's native input focus ring.
  // outline:none alone is not enough — :focus-visible overrides it at higher specificity.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'ha-input-reset';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = [
      'input,textarea{outline:none!important;box-shadow:none!important;border:none!important;}',
      'input:focus,input:focus-visible,textarea:focus,textarea:focus-visible',
      '{outline:none!important;box-shadow:none!important;border:none!important;}',
    ].join('');
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    if (step !== 'otp') return;
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

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
      if (USE_FIREBASE) {
        const confirmation = await firebaseAuth().signInWithPhoneNumber('+91' + phone);
        setFirebaseConfirmation(confirmation);
      } else {
        await sendOtp(phone);
        Alert.alert('OTP Sent', 'Use 1234 for demo.');
      }
      setStep('otp');
    } catch (err) {
      Alert.alert('Error', err.message || err.response?.data?.message || 'Failed to send OTP');
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
      let res;
      if (USE_FIREBASE) {
        const credential = await firebaseConfirmation.confirm(otp);
        const idToken = await credential.user.getIdToken();
        res = await firebaseVerify(idToken, selectedRole);
      } else {
        res = await verifyOtp(phone, otp, selectedRole);
      }
      if (res.data.requiresInviteCode) {
        setTempToken(res.data.tempToken);
        setStep('invite');
      } else {
        await signIn(res.data.token, res.data.user);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCaregiverLink = async () => {
    if (inviteCode.trim().length < 5) {
      Alert.alert('Invite code required', 'Enter the invite code shared by the patient.');
      return;
    }
    setLoading(true);
    try {
      const res = await caregiverLink(tempToken, inviteCode.trim().toUpperCase());
      await signIn(res.data.token, res.data.user);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  // ── Role step ───────────────────────────────────────────────────────────────
  if (step === 'role') {
    return (
      <SafeAreaView style={s.light}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.primarySurface} />
        <ScrollView contentContainerStyle={s.roleScroll} showsVerticalScrollIndicator={false}>
          <View style={s.leafBL} pointerEvents="none">
            <Ionicons name="leaf-outline" size={48} color="#A9D6EE" style={s.leafText} />
          </View>
          <View style={s.leafBR} pointerEvents="none">
            <Ionicons name="leaf-outline" size={48} color="#A9D6EE" style={[s.leafText, { transform: [{ scaleX: -1 }] }]} />
          </View>

          <View style={s.logoArea}>
            <LogoMark width={80} height={80} style={s.logoMark} />
            <Text style={s.logoText}>
              Health<Text style={s.logoAccent}>adri</Text>
            </Text>
            <Text style={s.logoTagline}>Navigate Cancer Care</Text>
          </View>

          <Text style={s.welcomeTitle}>Welcome!</Text>
          <Text style={s.welcomeSub}>
            Choose how you want to continue{'\n'}to get started
          </Text>

          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={s.roleCard}
              onPress={() => handleSelectRole(r.key)}
              activeOpacity={0.75}
            >
              <View style={[s.roleIconWrap, { backgroundColor: r.bg }]}>
                <Ionicons name={r.icon} size={28} color={r.color} />
              </View>
              <View style={s.roleCardBody}>
                <Text style={s.roleIamA}>I am a</Text>
                <Text style={[s.roleCardTitle, { color: r.color }]}>{r.label}</Text>
                <Text style={s.roleCardDesc}>{r.desc}</Text>
              </View>
              <View style={[s.roleChevron, { backgroundColor: r.color }]}>
                <Ionicons name="chevron-forward" size={14} color={colors.white} />
              </View>
            </TouchableOpacity>
          ))}

          <View style={s.securityCard}>
            <View style={s.securityIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.securityTitle}>Your data is safe and secure</Text>
              <Text style={s.securityDesc}>We never share your information with anyone.</Text>
            </View>
          </View>

          <Text style={s.termsLight}>
            By continuing, you agree to our{' '}
            <Text style={s.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Use</Text>
            {' '}and{' '}
            <Text style={s.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Phone step ──────────────────────────────────────────────────────────────
  if (step === 'phone') {
    return (
      <SafeAreaView style={s.light}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.primarySurface} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => { setStep('role'); setPhone(''); }}>
            <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false}>
            {/* Illustration */}
            <View style={s.illustrationWrap}>
              <View style={s.illustrationBlob} />
              <Ionicons name="phone-portrait-outline" size={76} color={colors.primary} />
              <View style={s.shieldBadge}>
                <Ionicons name="shield-checkmark" size={34} color={colors.primary} />
              </View>
              <Text style={[s.plusDeco, { top: 12, left: 14 }]}>+</Text>
              <Text style={[s.plusDeco, { top: 4, right: 18 }]}>+</Text>
            </View>

            <Text style={s.stepTitle}>Enter your mobile number</Text>
            <Text style={s.stepSubtitle}>
              We'll send you a verification code{'\n'}to continue
            </Text>

            {/* Phone input row */}
            <View style={[s.phoneInputBox, phoneFocused && s.phoneInputBoxFocused]}>
              <TouchableOpacity style={s.countryCodeWrap} activeOpacity={0.7}>
                <Text style={s.flagEmoji}>🇮🇳</Text>
                <Text style={s.countryCodeText}>+91</Text>
                <Ionicons name="chevron-down" size={12} color="#7A9E96" />
              </TouchableOpacity>
              <View style={s.inputDivider} />
              <TextInput
                style={[
                  s.phoneField,
                  Platform.OS === 'web' && { outline: 'none', border: 'none', backgroundColor: 'transparent' },
                ]}
                placeholder="Mobile number"
                placeholderTextColor="#B0C4BF"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                autoFocus
                underlineColorAndroid="transparent"
                selectionColor={colors.primary}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
              {phone.length === 10 && (
                <View style={s.phoneCheckMark}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                </View>
              )}
            </View>

            {/* Button */}
            <TouchableOpacity style={s.primaryBtn} onPress={handleSendOtp} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <View style={{ width: 34 }} />
                  <Text style={s.primaryBtnText}>Send OTP</Text>
                  <View style={s.btnArrow}>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  </View>
                </>
              )}
            </TouchableOpacity>

            <View style={s.lockNotice}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
              <Text style={s.lockNoticeText}> We never share your number with anyone</Text>
            </View>

            <View style={s.stepPill}>
              <Text style={s.stepPillText}>Step 1 of 2</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── OTP step ────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    const mm = String(Math.floor(countdown / 60)).padStart(2, '0');
    const ss = String(countdown % 60).padStart(2, '0');

    const handleOtpDigit = (digit, index) => {
      const chars = otp.padEnd(4, '').split('');
      chars[index] = digit;
      const next = chars.join('').trimEnd();
      setOtp(next);
      if (digit && index < 3) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpBackspace = ({ nativeEvent }, index) => {
      if (nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
        const chars = otp.padEnd(4, '').split('');
        chars[index - 1] = '';
        setOtp(chars.join('').trimEnd());
        otpRefs.current[index - 1]?.focus();
      }
    };

    return (
      <SafeAreaView style={s.light}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.primarySurface} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => { setStep('phone'); setOtp(''); }}>
            <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false}>
            {/* Shield illustration */}
            <View style={s.illustrationWrap}>
              <View style={s.illustrationBlob} />
              <View style={s.shieldIconWrap}>
                <Ionicons name="shield" size={90} color={colors.primary} />
                <View style={s.lockOnShield}>
                  <Ionicons name="lock-closed" size={30} color={colors.white} />
                </View>
              </View>
              <View style={s.checkCircleBadge}>
                <Ionicons name="checkmark-circle" size={34} color={colors.successStrong} />
              </View>
              <Text style={[s.plusDeco, { top: 12, left: 14 }]}>+</Text>
              <Text style={[s.plusDeco, { top: 4, right: 18 }]}>+</Text>
            </View>

            <Text style={s.stepTitle}>Verify OTP</Text>
            <Text style={s.stepSubtitle}>
              Enter the 4-digit code sent to{'\n'}
              <Text style={s.phoneHighlight}>+91 {phone}</Text>
            </Text>

            {/* 4 individual OTP boxes */}
            <View style={s.otpRow}>
              {[0, 1, 2, 3].map((i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { otpRefs.current[i] = ref; }}
                  style={[
                    s.otpBox,
                    otp[i] ? s.otpBoxFilled : null,
                    i === otp.length ? s.otpBoxActive : null,
                    Platform.OS === 'web' && { outline: 'none', border: 'none' },
                  ]}
                  value={otp[i] || ''}
                  onChangeText={(v) => handleOtpDigit(v.replace(/[^0-9]/g, '').slice(-1), i)}
                  onKeyPress={(e) => handleOtpBackspace(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={i === 0}
                  underlineColorAndroid="transparent"
                  selectionColor={colors.primary}
                />
              ))}
            </View>

            {/* Countdown / resend */}
            <View style={s.resendRow}>
              {countdown > 0 ? (
                <Text style={s.resendText}>
                  Resend OTP in <Text style={s.countdown}>{mm}:{ss}</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={() => { sendOtp(phone); setCountdown(30); }}>
                  <Text style={s.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, otp.length < 4 && s.primaryBtnDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading || otp.length < 4}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <View style={{ width: 34 }} />
                  <Text style={s.primaryBtnText}>Verify & Continue</Text>
                  <View style={s.btnArrow}>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Secure login card */}
            <View style={s.secureCard}>
              <View style={s.secureIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={s.secureTitle}>Secure login</Text>
                <Text style={s.secureDesc}>Protected by encryption</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Invite step (new caregiver) ─────────────────────────────────────────────
  return (
    <SafeAreaView style={s.light}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.primarySurface} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { setStep('otp'); setInviteCode(''); setTempToken(''); }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={s.stepScroll} showsVerticalScrollIndicator={false}>
          <View style={s.illustrationWrap}>
            <View style={s.illustrationBlob} />
            <Ionicons name="link-outline" size={68} color={colors.primary} />
            <View style={s.shieldBadge}>
              <Ionicons name="heart-outline" size={28} color={colors.primary} />
            </View>
          </View>

          <Text style={s.stepTitle}>Link to a Patient</Text>
          <Text style={s.stepSubtitle}>
            Ask the patient to generate an invite{'\n'}code from their profile
          </Text>

          <View style={s.phoneInputBox}>
            <TextInput
              style={[
                s.phoneField,
                { flex: 1, paddingHorizontal: 16 },
                Platform.OS === 'web' && { outline: 'none', border: 'none', backgroundColor: 'transparent' },
              ]}
              placeholder="e.g. HX-4829"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={inviteCode}
              onChangeText={setInviteCode}
              maxLength={7}
              autoFocus
              underlineColorAndroid="transparent"
              selectionColor={colors.primary}
            />
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={handleCaregiverLink} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <View style={{ width: 34 }} />
                <Text style={s.primaryBtnText}>Link & Continue</Text>
                <View style={s.btnArrow}>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </View>
              </>
            )}
          </TouchableOpacity>

          <View style={s.lockNotice}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
            <Text style={s.lockNoticeText}> Your link is end-to-end encrypted</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  light: { flex: 1, backgroundColor: colors.primarySurface },

  // ── Role step ───────────────────────────────────────────────────────────────
  roleScroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  leafBL: { position: 'absolute', bottom: 30, left: -10, zIndex: 0 },
  leafBR: { position: 'absolute', bottom: 30, right: -10, zIndex: 0 },
  leafText: { fontSize: 90, opacity: 0.13 },

  logoArea: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  logoMark: { marginBottom: 14 },
  logoText: { fontSize: 30, fontWeight: '800', color: colors.textBody },
  logoAccent: { color: colors.accentWarm },
  logoTagline: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  welcomeTitle: { fontSize: 22, fontWeight: '700', color: colors.primaryDark, textAlign: 'center', marginBottom: 6 },
  welcomeSub: { fontSize: 13, color: '#7A9E96', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  roleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderRadius: 16, padding: 16, marginBottom: 12, gap: 14,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  roleIconWrap: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  roleCardBody: { flex: 1 },
  roleIamA: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  roleCardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  roleCardDesc: { fontSize: 12, color: '#7A8E9E', lineHeight: 17 },
  roleChevron: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  securityCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDF7F2',
    borderRadius: 12, padding: 14, gap: 12, marginTop: 4, marginBottom: 20,
  },
  securityIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  securityTitle: { fontSize: 13, fontWeight: '600', color: colors.primaryDark, marginBottom: 2 },
  securityDesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  termsLight: { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  termsLink: { color: colors.primary, fontWeight: '600' },

  // ── Shared step styles ──────────────────────────────────────────────────────
  backBtn: {
    margin: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
    ...Platform.select({
      ios: { shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  stepScroll: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Illustration
  illustrationWrap: {
    width: 160, height: 160,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  illustrationBlob: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: '#DFF0E9',
  },
  shieldBadge: {
    position: 'absolute', bottom: 8, right: 8,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  plusDeco: {
    position: 'absolute', fontSize: 20,
    color: colors.primary, opacity: 0.3, fontWeight: '300',
  },

  stepTitle: {
    fontSize: 22, fontWeight: '700', color: colors.primaryDark,
    textAlign: 'center', marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 13, color: '#7A9E96', textAlign: 'center',
    lineHeight: 20, marginBottom: 28,
  },
  phoneHighlight: { color: colors.primary, fontWeight: '600' },

  // Phone input — premium native feel
  phoneInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    width: '100%',
    height: 64,
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryDarkest,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
      web: { boxShadow: `0 4px 16px ${colors.primaryDarkShadow}` },
    }),
  },
  phoneInputBoxFocused: {
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
      web: { boxShadow: `0 0 0 3px ${colors.primaryShadowSoft}, 0 4px 20px ${colors.primaryShadowSoft}` },
    }),
  },
  countryCodeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    paddingHorizontal: 16,
    height: '100%',
    gap: 6,
    minWidth: 90,
  },
  flagEmoji: { fontSize: 20 },
  countryCodeText: { fontSize: 15, fontWeight: '700', color: colors.primaryDark, letterSpacing: 0.2 },
  inputDivider: { width: 1, height: '50%', backgroundColor: colors.primaryOverlay },
  phoneField: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '500',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  phoneCheckMark: {
    paddingRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Shield illustration (OTP step)
  shieldIconWrap: { alignItems: 'center', justifyContent: 'center' },
  lockOnShield: { position: 'absolute', top: 26, alignSelf: 'center' },
  checkCircleBadge: { position: 'absolute', bottom: 6, right: 6 },

  // OTP 4-box row
  otpRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  otpBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2EFE9',
    backgroundColor: colors.white,
    fontSize: 26,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'center',
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 1 },
      web: { boxShadow: `0 2px 6px ${colors.primaryShadowSoft}` },
    }),
  },
  otpBoxActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySurface },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: colors.primarySurface },

  // Countdown / resend
  resendRow: { marginBottom: 24 },
  resendText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  countdown: { color: colors.primary, fontWeight: '700' },
  resendLink: { fontSize: 13, color: colors.primary, fontWeight: '600', textAlign: 'center' },

  // Disabled button
  primaryBtnDisabled: { backgroundColor: '#A0C4BC', shadowOpacity: 0 },

  // Secure card (OTP step)
  secureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF7F2',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    width: '100%',
  },
  secureIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  secureTitle: { fontSize: 13, fontWeight: '600', color: colors.primaryDark, marginBottom: 2 },
  secureDesc: { fontSize: 11, color: colors.textSecondary },

  // Primary button
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    width: '100%',
    marginBottom: 18,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 16, flex: 1, textAlign: 'center' },
  btnArrow: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },

  // Lock notice
  lockNotice: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  lockNoticeText: { fontSize: 12, color: colors.textMuted },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },

  // Step pill
  stepPill: {
    borderWidth: 1, borderColor: '#CFE6F5',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  stepPillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
});
