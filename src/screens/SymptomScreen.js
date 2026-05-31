import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSymptoms, submitSymptomEntry, getLatestSymptomEntry } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FaceScale from '../components/FaceScale';

const C = {
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  tealPale: '#E8F5F1',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
  disabled: '#CBD5E1',
};

const PROMPTS = {
  Pain: 'How much pain do you have today?',
  Fatigue: 'How tired do you feel today?',
  Nausea: 'Do you feel sick to your stomach?',
  Fever: 'Do you have a fever?',
  Appetite: 'How is your appetite today?',
};

export default function SymptomScreen({ navigation }) {
  const { user } = useAuth();
  const [symptoms, setSymptoms] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [savedAlerts, setSavedAlerts] = useState(null);
  const [savedGuidance, setSavedGuidance] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  // Always-current values for reading inside timer callbacks
  const valuesRef = useRef({});
  const autoTimer = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const [symptomsRes, entryRes] = await Promise.all([
          getSymptoms(),
          user?._id ? getLatestSymptomEntry(user._id).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);
        const list =
          symptomsRes.data && symptomsRes.data.length
            ? symptomsRes.data
            : [
                { _id: 'pain',    name: 'Pain',    min: 0, max: 10 },
                { _id: 'fatigue', name: 'Fatigue', min: 0, max: 10 },
                { _id: 'nausea',  name: 'Nausea',  min: 0, max: 10 },
                { _id: 'fever',   name: 'Fever',   min: 0, max: 10 },
              ];
        setSymptoms(list);

        const entry = entryRes.data;
        if (entry?.createdAt) {
          const entryDate = new Date(entry.createdAt);
          setAlreadyCheckedIn(entryDate.toDateString() === new Date().toDateString());
        }
      } catch {
        Alert.alert('Could not load', 'Please check your internet and try again.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, []);

  // Animate the progress bar whenever step or symptom count changes
  useEffect(() => {
    if (symptoms.length === 0) return;
    Animated.timing(progressAnim, {
      toValue: (step + 1) / symptoms.length,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [step, symptoms.length]);

  const setValue = (id, v) => {
    const next = { ...valuesRef.current, [id]: v };
    valuesRef.current = next;
    setValues(next);
  };

  const handleSave = async () => {
    if (!user?._id || submitting || savedAlerts !== null) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const responses = symptoms.map((s) => ({
        symptomId: s._id,
        value: valuesRef.current[s._id] ?? 0,
      }));
      const res = await submitSymptomEntry(user._id, responses);
      setSavedAlerts(res.data?.alerts || []);
      setSavedGuidance(res.data?.guidance || []);
    } catch (err) {
      setSaveError(
        err.response?.data?.message?.toString() || 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-advance 450ms after selecting a face; cancel if user taps again or goes back
  const handleFaceSelect = (id, v) => {
    setValue(id, v);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      if (step < symptoms.length - 1) {
        setStep((s) => s + 1);
      } else {
        handleSave();
      }
    }, 450);
  };

  const goBack = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  const goNext = () => {
    const current = symptoms[step];
    if (valuesRef.current[current?._id] === undefined) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (step === symptoms.length - 1) {
      handleSave();
    } else {
      setStep((s) => s + 1);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  if (symptoms.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: C.muted }}>No symptoms to check in.</Text>
      </View>
    );
  }

  // ── Result screen ──────────────────────────────────────────────────────────
  if (savedAlerts !== null) {
    const triggered = savedAlerts;
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
          <View style={styles.header}>
            <View style={{ width: 32 }} />
            <Text style={styles.headerTitle}>Saved</Text>
            <View style={{ width: 32 }} />
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          <View style={styles.savedCard}>
            <Ionicons name="checkmark-circle" size={48} color="#16A34A" style={styles.savedIcon} />
            <Text style={styles.savedTitle}>
              {triggered.length > 0 ? "We'll check in with you" : 'Thank you!'}
            </Text>
            <Text style={styles.savedMessage}>
              {triggered.length > 0
                ? 'Your care team has been told about:'
                : 'Your check-in is saved. See you tomorrow.'}
            </Text>

            {triggered.length > 0 && (
              <View style={styles.alertList}>
                {triggered.map((a, i) => (
                  <View key={i} style={styles.alertRow}>
                    <Text style={styles.alertBullet}>•</Text>
                    <Text style={styles.alertText}>{a.reason}</Text>
                  </View>
                ))}
              </View>
            )}

            {savedGuidance.length > 0 && (
              <View style={styles.guidanceBlock}>
                <Text style={styles.guidanceTitle}>What to expect next</Text>
                {savedGuidance.map((g, i) => (
                  <View key={i} style={styles.guidanceRow}>
                    <Ionicons name="checkmark" size={14} color="#16A34A" style={styles.guidanceCheck} />
                    <Text style={styles.guidanceText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {triggered.length > 0 && (
              <Text style={styles.savedHint}>
                Someone will reach out to you soon.
              </Text>
            )}
          </View>
        </View>

        <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.card }}>
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.navBtn, styles.navNext]}
            >
              <Text style={styles.navNextText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Check-in screen ────────────────────────────────────────────────────────
  const total = symptoms.length;
  const current = symptoms[step];
  const currentValue = values[current._id];
  const hasAnswered = currentValue !== undefined;
  const isLast = step === total - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>How are you today?</Text>
          <View style={styles.langBadge}>
            <Text style={styles.langText}>EN</Text>
          </View>
        </View>

        {/* Animated progress bar — works for any number of symptoms */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </SafeAreaView>

      {alreadyCheckedIn && (
        <View style={styles.resubmitBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#92400E" />
          <Text style={styles.resubmitText}>
            You already checked in today. Submit again only if your symptoms have changed.
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.stepLabel}>
          {step + 1} / {total}
        </Text>

        <View style={styles.questionCard}>
          <Text style={styles.symptomName}>{current.name}</Text>
          <Text style={styles.prompt}>
            {PROMPTS[current.name] || 'Tap the face that matches how you feel.'}
          </Text>

          <FaceScale
            value={currentValue}
            onChange={(v) => handleFaceSelect(current._id, v)}
          />

          <Text style={[styles.hint, hasAnswered && styles.hintAnswered]}>
            {hasAnswered ? 'Moving on in a moment…' : 'Tap a face to continue'}
          </Text>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.bg }}>
        {saveError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Could not save: {saveError}</Text>
          </View>
        )}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={goBack} style={[styles.navBtn, styles.navBack]}>
            <Text style={styles.navBackText}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNext}
            disabled={!hasAnswered || submitting}
            style={[
              styles.navBtn,
              styles.navNext,
              (!hasAnswered || submitting) && styles.navNextDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.navNextText}>
                {isLast ? 'Save' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },

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
  backIcon: { color: '#fff', fontSize: 18, lineHeight: 20 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  langBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  langText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  body: { flex: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },

  stepLabel: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },

  questionCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  symptomName: {
    fontSize: 28,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  prompt: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  hint: {
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  hintAnswered: {
    color: C.teal,
    opacity: 0.8,
  },

  navBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  navBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBack: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  navBackText: { color: C.text, fontWeight: '700', fontSize: 14 },
  navNext: { backgroundColor: C.teal, flex: 1.5 },
  navNextDisabled: { backgroundColor: C.disabled },
  navNextText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  resubmitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resubmitText: { color: '#92400E', fontSize: 12, fontWeight: '500', flex: 1, lineHeight: 17 },

  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },

  savedCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    marginTop: 12,
  },
  savedIcon: { fontSize: 56, marginBottom: 10 },
  savedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  savedMessage: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  alertList: {
    alignSelf: 'stretch',
    backgroundColor: C.tealPale,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 6,
  },
  alertRow: { flexDirection: 'row', gap: 8 },
  alertBullet: { color: C.teal, fontSize: 14, fontWeight: '700' },
  alertText: { color: C.text, fontSize: 13, flex: 1 },

  guidanceBlock: {
    alignSelf: 'stretch',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  guidanceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  guidanceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  guidanceCheck: { color: C.teal, fontSize: 16, fontWeight: '700', lineHeight: 20 },
  guidanceText: { color: C.text, fontSize: 13, flex: 1, lineHeight: 19 },
  savedHint: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    marginTop: 14,
    fontStyle: 'italic',
  },
});
