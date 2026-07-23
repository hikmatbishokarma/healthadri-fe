import { View, Text, StyleSheet } from 'react-native';

// Reuses the exact same severity thresholds as WeeklyReportScreen.js's
// getColor() (≥8 high, ≥5 medium, else low) so this stays consistent with
// the Weekly Report's legend rather than inventing a second severity scale
// for the same underlying data.
const C = {
  text: '#1A1A2E',
  muted: '#64748B',
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
};

function tierFor(value) {
  if (value >= 8) return { label: 'High', color: C.red, filled: 3 };
  if (value >= 5) return { label: 'Moderate', color: C.amber, filled: 2 };
  return { label: 'Mild', color: C.green, filled: 1 };
}

function Dots({ filled, color }) {
  return (
    <View style={s.dotsRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            s.dot,
            i < filled ? { backgroundColor: color } : { backgroundColor: '#E5E7EB' },
          ]}
        />
      ))}
    </View>
  );
}

// responses: [{ name, value }] — pass the latest symptom entry's responses.
export default function TopSymptoms({ responses, max = 4 }) {
  const top = (responses || [])
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, max);

  if (top.length === 0) return null;

  return (
    <View style={s.card}>
      <Text style={s.title}>Top Symptoms</Text>
      {top.map((r) => {
        const tier = tierFor(r.value);
        return (
          <View key={r.symptomId || r.name} style={s.row}>
            <Text style={s.name} numberOfLines={1}>{r.name}</Text>
            <View style={s.rightCol}>
              <Text style={[s.tierLabel, { color: tier.color }]}>{tier.label}</Text>
              <Dots filled={tier.filled} color={tier.color} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 18,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  name: { fontSize: 13, fontWeight: '600', color: C.text, flex: 1, marginRight: 8 },
  rightCol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierLabel: { fontSize: 11, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
