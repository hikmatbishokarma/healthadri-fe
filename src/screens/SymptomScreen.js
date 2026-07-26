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
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSymptoms, submitSymptomEntry, getLatestSymptomEntry } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FaceScale from '../components/FaceScale';
import SymptomIconScene from '../components/SymptomIconScene';
import TopSymptoms from '../components/TopSymptoms';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const C = {
  primary: colors.primary,
  primaryDark: colors.primaryDark,
  primaryDarkest: colors.primaryDarkest,
  primaryTint: colors.primaryTint,
  bg: colors.background,
  card: colors.surface,
  text: colors.textBody,
  muted: colors.textSecondary,
  border: colors.border,
  disabled: '#CBD5E1',
};

// The Arc — one blade of the logo's four-blade mark, used on its own as a
// quiet background flourish. A partial ring (never closed), drawn with a
// dash/gap on the stroke so no path math is needed for the sweep.
function ArcFlourish({ size, color, opacity, style, strokeWidth = 7, sweep = 0.72 }) {
  const r = size / 2 - strokeWidth;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * sweep} ${circumference}`}
          fill="none"
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}

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
        const fetchedSymptoms = symptomsRes.data?.data ?? [];
        const list =
          fetchedSymptoms.length > 0
            ? fetchedSymptoms
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.primary} />
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
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <ArcFlourish size={220} color={colors.primaryVivid} opacity={0.55} style={styles.bgCircleTop} />
        <ArcFlourish size={240} color={colors.accentVivid} opacity={0.5} style={styles.bgCircleBottom} />

        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <View style={{ width: 36 }} />
            <Text style={styles.headerTitle}>Saved</Text>
            <View style={{ width: 36 }} />
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          <View style={styles.savedCard}>
            <View style={styles.savedIconRing}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            </View>
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

            <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
              <TopSymptoms
                responses={symptoms.map((sym) => ({
                  symptomId: sym._id,
                  name: sym.name,
                  value: valuesRef.current[sym._id] ?? 0,
                }))}
              />
            </View>

            {savedGuidance.length > 0 && (
              <View style={styles.guidanceBlock}>
                <Text style={styles.guidanceTitle}>What to expect next</Text>
                {savedGuidance.map((g, i) => (
                  <View key={i} style={styles.guidanceRow}>
                    <Ionicons name="checkmark" size={14} color={colors.success} style={styles.guidanceCheck} />
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

        <SafeAreaView edges={['bottom']}>
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.navBtn, styles.navNext]}
              activeOpacity={0.85}
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
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <View />
            <Text style={styles.stepLabel}>
              {step + 1} / {total}
            </Text>
          </View>
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
        </View>
      </SafeAreaView>

      {alreadyCheckedIn && (
        <View style={styles.resubmitBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.warningStrong} />
          <Text style={styles.resubmitText}>
            You already checked in today. Submit again only if your symptoms have changed.
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.eyebrow}>Today's check-in</Text>
        <SymptomIconScene name={current.name} />

        <Text style={styles.symptomName}>{current.name}</Text>
        <Text style={styles.prompt}>
          {PROMPTS[current.name] || 'Tap the face that matches how you feel.'}
        </Text>

        <FaceScale
          value={currentValue}
          onChange={(v) => handleFaceSelect(current._id, v)}
        />

        <View style={styles.feedbackRow}>
          {submitting ? (
            <>
              <ActivityIndicator size="small" color={C.primary} />
              <Text style={[styles.hint, styles.hintAnswered]}>Saving your check-in…</Text>
            </>
          ) : hasAnswered ? (
            <>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.hint, styles.hintAnswered]}>
                {isLast ? 'Recorded — saving your check-in' : 'Recorded — moving on in a moment'}
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>Tap a face to continue</Text>
          )}
        </View>
      </View>

      <SafeAreaView edges={['bottom']}>
        {saveError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Could not save: {saveError}</Text>
          </View>
        )}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={goBack}
            style={[styles.navBtn, step === 0 ? styles.navGhost : styles.navBack]}
            activeOpacity={0.8}
          >
            <Text style={[styles.navBackText, step === 0 && styles.navGhostText]}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },

  bgCircleTop: { position: 'absolute', top: -90, right: -70 },
  bgCircleBottom: { position: 'absolute', bottom: -100, left: -80 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    outlineStyle: 'none',
  },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  progressSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
  },
  stepLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
  },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 18, alignItems: 'stretch', justifyContent: 'center' },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  symptomName: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  prompt: {
    fontSize: 15,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
    paddingHorizontal: 8,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
    minHeight: 18,
  },
  hint: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
  },
  hintAnswered: {
    color: C.primary,
    fontWeight: '600',
  },

  navBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  navBtn: {
    flex: 1,
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    outlineStyle: 'none',
  },
  navBack: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  navBackText: { color: C.text, fontWeight: '700', fontSize: 14 },
  navGhost: { backgroundColor: 'transparent' },
  navGhostText: { color: C.muted },
  navNext: {
    backgroundColor: C.primary,
    flex: 1.5,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  navNextDisabled: {
    backgroundColor: C.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  navNextText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  resubmitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningTint,
    borderWidth: 1,
    borderColor: '#FDE9C4',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resubmitText: { color: '#92400E', fontSize: 12, fontWeight: '500', flex: 1, lineHeight: 17 },

  errorBanner: {
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: '#EDD2CE',
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600' },

  savedCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primaryDarkest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  savedIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  savedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  savedMessage: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  alertList: {
    alignSelf: 'stretch',
    backgroundColor: C.primaryTint,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    gap: 6,
  },
  alertRow: { flexDirection: 'row', gap: 8 },
  alertBullet: { color: C.primary, fontSize: 14, fontWeight: '700' },
  alertText: { color: C.text, fontSize: 13, flex: 1 },

  guidanceBlock: {
    alignSelf: 'stretch',
    marginTop: 16,
    backgroundColor: colors.successTint,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 16,
    gap: 8,
  },
  guidanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  guidanceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  guidanceCheck: { marginTop: 2 },
  guidanceText: { color: '#166534', fontSize: 13, flex: 1, lineHeight: 19 },
  savedHint: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    marginTop: 14,
  },
});
