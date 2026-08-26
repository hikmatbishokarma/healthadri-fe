import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Illustration from '../components/Illustration';
import TrackConsistentlyIllustration from '../components/TrackConsistentlyIllustration';
import ApptEmptyIllustration from '../components/ApptEmptyIllustration';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getWeeklyReport } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  bg: colors.background,
  card: colors.white,
  text: colors.textBody,
  muted: colors.textSecondary,
  border: colors.border,
  green: colors.successStrong,
  amber: colors.warning,
  red: colors.danger,
};

function getColor(value) {
  if (value === null || value === undefined) return null;
  if (value >= 8) return C.red;
  if (value >= 5) return C.amber;
  return C.green;
}

export default function WeeklyReportScreen({ navigation }) {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weeksBack, setWeeksBack] = useState(0);

  useEffect(() => {
    (async () => {
      if (!user?._id) { setLoading(false); return; }
      setLoading(true);
      try {
        const res = await getWeeklyReport(user._id, weeksBack);
        setReport(res.data);
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, weeksBack]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Weekly Report</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.weekNav}>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setWeeksBack(w => w + 1)}
          >
            <Ionicons name="chevron-back" size={16} color={colors.white} />
            <Text style={styles.weekNavText}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.weekNavLabel}>
            {weeksBack === 0 ? 'This week' : `${weeksBack} week${weeksBack > 1 ? 's' : ''} ago`}
          </Text>
          <TouchableOpacity
            style={[styles.weekNavBtn, weeksBack === 0 && styles.weekNavBtnDisabled]}
            onPress={() => setWeeksBack(w => Math.max(0, w - 1))}
            disabled={weeksBack === 0}
          >
            <Text style={styles.weekNavText}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color={weeksBack === 0 ? 'rgba(255,255,255,0.3)' : colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : !report || Object.keys(report.data || {}).length === 0 ? (
        <View style={styles.emptyCard}>
          <Illustration name="reports_empty" size={160} style={styles.emptyIllustration} />
          <Text style={styles.emptyTitle}>No check-ins this week</Text>
          <Text style={styles.emptyText}>
            No symptom check-ins this week yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
        >
          <View style={styles.tableCard}>
            <View style={styles.headerRow}>
              <View style={styles.nameCol} />
              {report.weekDays.map((day) => (
                <View key={day} style={styles.dayCol}>
                  <Text style={styles.dayLabel}>{day}</Text>
                </View>
              ))}
            </View>

            {Object.entries(report.data).map(([symptom, values]) => (
              <View key={symptom} style={styles.symptomRow}>
                <View style={styles.nameCol}>
                  <Text style={styles.symptomName}>{symptom}</Text>
                </View>
                {values.map((value, i) => {
                  const color = getColor(value);
                  return (
                    <View key={i} style={styles.dayCol}>
                      {color
                        ? <View style={[styles.dot, { backgroundColor: color }]} />
                        : <Text style={styles.noData}>–</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Legend</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: C.green }]} />
                <Text style={styles.legendText}>Low</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: C.amber }]} />
                <Text style={styles.legendText}>Medium</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: C.red }]} />
                <Text style={styles.legendText}>High</Text>
              </View>
              <View style={styles.legendItem}>
                <Text style={styles.noData}>–</Text>
                <Text style={styles.legendText}>No data</Text>
              </View>
            </View>
          </View>

          <View style={styles.trackCard}>
            <TrackConsistentlyIllustration size={46} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.trackTitle}>Track consistently</Text>
              <Text style={styles.trackSub}>Regular updates help your care team understand your health better.</Text>
            </View>
          </View>

          <View style={styles.tipCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.tipHead}>
                <View style={styles.tipIconBox}>
                  <Ionicons name="bulb-outline" size={14} color={C.teal} />
                </View>
                <Text style={styles.tipTitle}>Tip</Text>
              </View>
              <Text style={styles.tipSub}>Checking in every day helps your care team spot patterns and help sooner.</Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <ApptEmptyIllustration size={56} />
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

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
  backIcon: { color: colors.white, fontSize: 18, lineHeight: 20 },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700', flex: 1 },

  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  weekNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekNavBtnDisabled: { opacity: 0.3 },
  weekNavText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  weekNavLabel: { color: colors.white, fontSize: 13, fontWeight: '700' },

  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 32 },

  tableCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 6,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  nameCol: { width: 70 },
  dayCol: { flex: 1, alignItems: 'center' },

  dayLabel: { fontSize: 11, color: C.muted, fontWeight: '600' },
  symptomName: { fontSize: 13, fontWeight: '700', color: C.text },

  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  noData: {
    fontSize: 16,
    color: '#CBD5E1',
    fontWeight: '700',
    lineHeight: 16,
  },

  legendCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 12,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: C.text, fontWeight: '600' },

  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successTint,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  trackTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 3 },
  trackSub: { fontSize: 11.5, color: C.muted, lineHeight: 16 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  tipIconBox: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  tipTitle: { fontSize: 13.5, fontWeight: '700', color: C.text },
  tipSub: { fontSize: 11, color: C.muted, lineHeight: 16 },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 24,
    margin: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  emptyIllustration: { marginBottom: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center' },
});
