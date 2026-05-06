import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getNavigatorDrafts } from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = {
  navy: '#1E3A5F',
  navyDark: '#0F2238',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
  accent: '#6D5BD0',
  accentPale: '#EEEAFD',
  amber: '#B45309',
  amberPale: '#FEF3C7',
};

const CATEGORY_META = {
  lab: { emoji: '🧪', label: 'LAB' },
  prescription: { emoji: '💊', label: 'PRESCRIPTION' },
  discharge: { emoji: '🏥', label: 'DISCHARGE' },
  other: { emoji: '📄', label: 'DOCUMENT' },
};

function groupByDocument(tasks) {
  const groups = new Map();
  for (const t of tasks) {
    const docId = t.sourceDocumentId?._id;
    if (!docId) continue;
    if (!groups.has(docId)) {
      groups.set(docId, {
        documentId: docId,
        document: t.sourceDocumentId,
        patient: t.patientId,
        tasks: [],
      });
    }
    groups.get(docId).tasks.push(t);
  }
  return Array.from(groups.values());
}

export default function DraftsListScreen({ navigation }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await getNavigatorDrafts(user._id);
      setGroups(groupByDocument(res.data || []));
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetch();
  };

  const totalDrafts = groups.reduce((sum, g) => sum + g.tasks.length, 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.navyDark} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.navy }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>AI Extracted Reminders</Text>
            <Text style={styles.title}>Drafts to Review</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.documentId}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            groups.length > 0 ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryEmoji}>🤖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryTitle}>Sarvam AI extracted</Text>
                  <Text style={styles.summaryBody}>
                    {totalDrafts} reminder{totalDrafts === 1 ? '' : 's'} from{' '}
                    {groups.length} document{groups.length === 1 ? '' : 's'}. Review
                    and publish to send to patients.
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptyText}>No drafts waiting for review.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cat = CATEGORY_META[item.document?.category] || CATEGORY_META.other;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  navigation.navigate('DraftReview', {
                    sourceDocumentId: item.documentId,
                    patientName: item.patient?.name || 'Patient',
                    documentName: item.document?.fileName || 'Document',
                  })
                }
                activeOpacity={0.85}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.cardEmoji}>{cat.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.patientName} numberOfLines={1}>
                      {item.patient?.name || 'Patient'}
                    </Text>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>
                        {item.tasks.length} draft{item.tasks.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.docName} numberOfLines={1}>
                    {item.document?.fileName || 'Document'}
                  </Text>
                  <Text style={styles.category}>{cat.label}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: C.navy,
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },

  summaryCard: {
    backgroundColor: C.accent,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  summaryEmoji: { fontSize: 22 },
  summaryTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  summaryBody: { color: 'rgba(255,255,255,0.92)', fontSize: 12, lineHeight: 17 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accentPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 22 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  patientName: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  pill: {
    backgroundColor: C.amberPale,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: 6,
  },
  pillText: { fontSize: 10, fontWeight: '800', color: C.amber, letterSpacing: 0.4 },
  docName: { fontSize: 12, color: C.muted, marginTop: 2 },
  category: {
    fontSize: 9,
    fontWeight: '800',
    color: C.accent,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  chevron: { fontSize: 24, color: C.muted, fontWeight: '300' },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'center' },
});
