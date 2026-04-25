import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSymptoms, submitSymptomEntry } from '../services/api';
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

  useEffect(() => {
    (async () => {
      try {
        const res = await getSymptoms();
        const list =
          res.data && res.data.length
            ? res.data
            : [
                { _id: 'pain', name: 'Pain', min: 0, max: 10 },
                { _id: 'fatigue', name: 'Fatigue', min: 0, max: 10 },
                { _id: 'nausea', name: 'Nausea', min: 0, max: 10 },
                { _id: 'fever', name: 'Fever', min: 0, max: 10 },
              ];
        setSymptoms(list);
      } catch {
        Alert.alert('Could not load', 'Please check your internet and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setValue = (id, v) => setValues((prev) => ({ ...prev, [id]: v }));

  const handleSave = async () => {
    if (!user?._id || submitting || savedAlerts !== null) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const responses = symptoms.map((s) => ({
        symptomId: s._id,
        value: values[s._id] ?? 0,
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
            <Text style={styles.savedIcon}>✅</Text>
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
                {savedGuidance.map((step, i) => (
                  <View key={i} style={styles.guidanceRow}>
                    <Text style={styles.guidanceCheck}>✓</Text>
                    <Text style={styles.guidanceText}>{step}</Text>
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

  const total = symptoms.length;
  const current = symptoms[step];
  const currentValue = values[current._id];
  const hasAnswered = currentValue !== undefined;
  const isLast = step === total - 1;

  const goBack = () => {
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  const goNext = () => {
    if (!hasAnswered) return;
    if (isLast) {
      handleSave();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>How are you today?</Text>
          <View style={styles.langBadge}>
            <Text style={styles.langText}>EN</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <View style={styles.progressBlock}>
          <View style={styles.dotsRow}>
            {symptoms.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step && styles.dotActive,
                  i < step && styles.dotDone,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            Step {step + 1} of {total}
          </Text>
        </View>

        <View style={styles.questionCard}>
          <Text style={styles.symptomName}>{current.name}</Text>
          <Text style={styles.prompt}>
            {PROMPTS[current.name] || 'Tap the face that matches how you feel.'}
          </Text>

          <View style={styles.scaleWrap}>
            <FaceScale
              size="big"
              value={currentValue}
              onChange={(v) => setValue(current._id, v)}
            />
          </View>

          {!hasAnswered && (
            <Text style={styles.tapHint}>Tap a face to continue</Text>
          )}
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.card }}>
        {saveError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Could not save: {saveError}</Text>
          </View>
        )}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={goBack} style={[styles.navBtn, styles.navBack]}>
            <Text style={styles.navBackText}>
              {step === 0 ? 'Cancel' : '← Back'}
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
                {isLast ? '✓ Save' : 'Next →'}
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

  body: { flex: 1, padding: 14 },

  progressBlock: { alignItems: 'center', marginTop: 4, marginBottom: 18 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  dotActive: { width: 24, backgroundColor: C.teal },
  dotDone: { backgroundColor: C.teal, opacity: 0.5 },
  stepLabel: { fontSize: 11, color: C.muted, marginTop: 8, fontWeight: '600' },

  questionCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  symptomName: {
    fontSize: 26,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  prompt: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
    lineHeight: 20,
  },
  scaleWrap: { marginTop: 4 },
  tapHint: {
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },

  navBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  navBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBack: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  navBackText: { color: C.text, fontWeight: '700', fontSize: 14 },
  navNext: { backgroundColor: C.teal, flex: 1.5 },
  navNextDisabled: { backgroundColor: C.disabled },
  navNextText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },

  savedCard: {
    backgroundColor: C.card,
    borderRadius: 16,
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
