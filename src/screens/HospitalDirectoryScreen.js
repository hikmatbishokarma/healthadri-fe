import React, { useEffect, useMemo, useState } from 'react';
import Illustration from '../components/Illustration';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getHospitals } from '../services/api';

const C = {
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  tealPale: '#E8F5F1',
  bluePale: '#EFF6FF',
  blue: '#2563EB',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'government', label: 'Government' },
  { id: 'aarogyasri', label: 'Aarogyasri' },
  { id: 'palliative', label: 'Palliative' },
];

export default function HospitalDirectoryScreen({ navigation }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await getHospitals();
        setHospitals(res.data || []);
      } catch {
        setHospitals([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hospitals.filter((h) => {
      if (filter === 'government' && h.type !== 'government') return false;
      if (filter === 'aarogyasri' && !h.acceptsAarogyasri) return false;
      if (filter === 'palliative' && !h.offersPalliative) return false;
      if (!q) return true;
      const hay = [h.name, h.city, h.address, ...(h.tags || [])]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [hospitals, filter, search]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Find a Hospital</Text>
            <View style={styles.langBadge}>
              <Text style={styles.langText}>EN</Text>
            </View>
          </View>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search hospitals by city or cancer type..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.searchInput}
            />
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[
                  styles.filterChip,
                  active
                    ? { backgroundColor: C.teal, borderColor: C.teal }
                    : { backgroundColor: C.card, borderColor: C.border },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active ? { color: '#fff' } : { color: C.muted },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
        >
          <Text style={styles.sectionLabel}>
            {filtered.length} {filtered.length === 1 ? 'hospital' : 'hospitals'}
            {filter !== 'all' ? ' · filtered' : ''}
          </Text>

          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Illustration name="hospital_empty" size={160} style={styles.emptyIllustration} />
              <Text style={styles.emptyTitle}>No hospitals found</Text>
              <Text style={styles.emptyText}>
                No hospitals match your search.
              </Text>
            </View>
          ) : (
            filtered.map((h) => <HospitalCard key={h._id} hospital={h} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

function HospitalCard({ hospital }) {
  return (
    <View style={styles.hospCard}>
      <View style={styles.hospLogo}>
        <Text style={{ fontSize: 22 }}>🏥</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.hospName}>{hospital.name}</Text>
        <Text style={styles.hospLoc}>
          📍 {hospital.city}
          {hospital.type === 'government' ? ' · Government' : ''}
          {hospital.address ? ` · ${hospital.address}` : ''}
        </Text>
        <View style={styles.tagRow}>
          {(hospital.tags || []).slice(0, 4).map((t) => (
            <View key={t} style={[styles.tag, { backgroundColor: C.tealPale }]}>
              <Text style={[styles.tagText, { color: C.teal }]}>{t}</Text>
            </View>
          ))}
          {hospital.acceptsAarogyasri && (
            <View style={[styles.tag, { backgroundColor: C.bluePale }]}>
              <Text style={[styles.tagText, { color: C.blue }]}>Aarogyasri ✓</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { backgroundColor: C.teal, paddingHorizontal: 12, paddingVertical: 12 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
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

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 12, color: '#fff', padding: 0 },

  filterRow: {
    backgroundColor: C.bg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterContent: { paddingHorizontal: 12, gap: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
  },
  filterChipText: { fontSize: 11, fontWeight: '600' },

  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 32 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  emptyIllustration: { marginBottom: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyText: { color: C.muted, fontSize: 12 },

  hospCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  hospLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: C.tealPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hospName: { fontSize: 13, fontWeight: '700', color: C.text },
  hospLoc: { fontSize: 10, color: C.muted, marginTop: 3 },
  tagRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 6 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 9, fontWeight: '700' },
});
