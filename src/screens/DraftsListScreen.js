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
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
  pillBg: '#E8F5F1',
  pillText: '#1A6B5A',
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Drafts to Review</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.documentId}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No drafts waiting for review.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('DraftReview', {
                  sourceDocumentId: item.documentId,
                  patientName: item.patient?.name || 'Patient',
                  documentName: item.document?.fileName || 'Document',
                })
              }
              activeOpacity={0.8}
            >
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
                📄 {item.document?.fileName || 'Document'}
              </Text>
              <Text style={styles.category}>
                {(item.document?.category || 'document').toUpperCase()}
              </Text>
              <Text style={styles.cta}>Tap to review →</Text>
            </TouchableOpacity>
          )}
        />
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
  backIcon: { color: '#fff', fontSize: 18, lineHeight: 20 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },

  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  patientName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  pill: {
    backgroundColor: C.pillBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: C.pillText },
  docName: { fontSize: 13, color: C.text, marginTop: 2 },
  category: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  cta: { fontSize: 12, color: C.teal, marginTop: 10, fontWeight: '600' },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 24,
    margin: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center' },
});
