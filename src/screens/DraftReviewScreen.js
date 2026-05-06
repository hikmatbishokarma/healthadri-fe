import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getDraftsForDocument,
  updateTask,
  publishTask,
  deleteTask,
  getDocumentFileUrl,
} from '../services/api';

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
  green: '#15803D',
  greenPale: '#DCFCE7',
  red: '#DC2626',
  redPale: '#FEE2E2',
  blue: '#1D4ED8',
  bluePale: '#DBEAFE',
  amber: '#B45309',
  amberPale: '#FEF3C7',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toLocalDateString(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function DraftReviewScreen({ navigation, route }) {
  const { sourceDocumentId, patientName, documentName } = route.params || {};
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());

  const fetchDrafts = useCallback(async () => {
    if (!sourceDocumentId) return;
    try {
      const res = await getDraftsForDocument(sourceDocumentId);
      const items = (res.data || []).map((t) => ({
        _id: t._id,
        type: t.type,
        title: t.title,
        date: toLocalDateString(t.date),
        original: { type: t.type, title: t.title, date: toLocalDateString(t.date) },
      }));
      setDrafts(items);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [sourceDocumentId]);

  useFocusEffect(
    useCallback(() => {
      fetchDrafts();
    }, [fetchDrafts]),
  );

  const setBusy = (id, on) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const updateField = (id, key, value) => {
    setDrafts((prev) =>
      prev.map((d) => (d._id === id ? { ...d, [key]: value } : d)),
    );
  };

  const isDirty = (d) =>
    d.type !== d.original.type ||
    d.title !== d.original.title ||
    d.date !== d.original.date;

  const validate = (d) => {
    if (!d.title?.trim()) return 'Title is required';
    if (!DATE_RE.test(d.date)) return 'Date must be YYYY-MM-DD';
    if (isNaN(new Date(d.date).getTime())) return 'Invalid date';
    return null;
  };

  const persistEdits = async (d) => {
    if (!isDirty(d)) return;
    await updateTask(d._id, { type: d.type, title: d.title.trim(), date: d.date });
  };

  const handlePublish = async (d) => {
    const err = validate(d);
    if (err) {
      Alert.alert('Cannot publish', err);
      return;
    }
    setBusy(d._id, true);
    try {
      await persistEdits(d);
      await publishTask(d._id);
      setDrafts((prev) => prev.filter((x) => x._id !== d._id));
    } catch (e) {
      Alert.alert('Publish failed', e?.response?.data?.message || 'Try again');
    } finally {
      setBusy(d._id, false);
    }
  };

  const handleReject = (d) => {
    Alert.alert(
      'Reject draft?',
      'This will permanently delete this draft.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setBusy(d._id, true);
            try {
              await deleteTask(d._id);
              setDrafts((prev) => prev.filter((x) => x._id !== d._id));
            } catch (e) {
              Alert.alert('Delete failed', e?.response?.data?.message || 'Try again');
            } finally {
              setBusy(d._id, false);
            }
          },
        },
      ],
    );
  };

  const handlePublishAll = async () => {
    const invalid = drafts.find((d) => validate(d));
    if (invalid) {
      Alert.alert('Fix issues first', `${invalid.title || 'A draft'}: ${validate(invalid)}`);
      return;
    }
    for (const d of drafts) {
      try {
        await persistEdits(d);
        await publishTask(d._id);
      } catch {
        // continue with the rest; user can retry the failed ones
      }
    }
    fetchDrafts();
  };

  const openDocument = () => {
    if (!sourceDocumentId) return;
    const url = getDocumentFileUrl(sourceDocumentId);
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open document', 'No app available to view this file'),
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.navyDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.navy }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {patientName || 'Patient'}
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {documentName || 'Document'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.openDocBtn} onPress={openDocument}>
          <Text style={styles.openDocIcon}>📄</Text>
          <Text style={styles.openDocText}>View original document</Text>
          <Text style={styles.openDocChevron}>↗</Text>
        </TouchableOpacity>

        <View style={styles.aiHint}>
          <Text style={styles.aiHintEmoji}>🤖</Text>
          <Text style={styles.aiHintText}>
            Sarvam AI extracted these reminders. Review the title, type, and date,
            then publish to send to the patient.
          </Text>
        </View>

        {drafts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>All reviewed</Text>
            <Text style={styles.emptyText}>No drafts left for this document.</Text>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          drafts.map((d, idx) => (
            <DraftCard
              key={d._id}
              draft={d}
              index={idx + 1}
              total={drafts.length}
              busy={busyIds.has(d._id)}
              onChange={(k, v) => updateField(d._id, k, v)}
              onPublish={() => handlePublish(d)}
              onReject={() => handleReject(d)}
            />
          ))
        )}
      </ScrollView>

      {drafts.length > 1 && (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.card }}>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.publishAllBtn}
              onPress={handlePublishAll}
            >
              <Text style={styles.publishAllText}>
                ✓ Publish all ({drafts.length})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

function DraftCard({ draft, index, total, busy, onChange, onPublish, onReject }) {
  const isVisit = draft.type === 'visit';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardCounter}>
          DRAFT {index} OF {total}
        </Text>
        <TouchableOpacity
          style={[
            styles.typePill,
            { backgroundColor: isVisit ? C.bluePale : C.amberPale },
          ]}
          onPress={() => onChange('type', isVisit ? 'test' : 'visit')}
        >
          <Text
            style={[styles.typePillText, { color: isVisit ? C.blue : C.amber }]}
          >
            {isVisit ? '👤 VISIT' : '🧪 TEST'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Title</Text>
      <TextInput
        style={styles.input}
        value={draft.title}
        onChangeText={(v) => onChange('title', v)}
        placeholder="e.g. CBC test before chemo session 3"
        placeholderTextColor={C.muted}
        multiline
      />

      <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={draft.date}
        onChangeText={(v) => onChange('date', v)}
        placeholder="2026-05-04"
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={onReject}
          disabled={busy}
        >
          <Text style={[styles.actionText, { color: C.red }]}>✗ Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.publishBtn]}
          onPress={onPublish}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.actionText, { color: '#fff' }]}>
              ✓ Publish
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

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
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },

  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32 },

  openDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.accentPale,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D5CCF8',
  },
  openDocIcon: { fontSize: 18 },
  openDocText: { flex: 1, color: C.accent, fontSize: 14, fontWeight: '700' },
  openDocChevron: { color: C.accent, fontSize: 16, fontWeight: '700' },

  aiHint: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: '#F8F7FE',
    borderRadius: 10,
    marginBottom: 14,
  },
  aiHintEmoji: { fontSize: 16 },
  aiHintText: { flex: 1, fontSize: 12, color: C.muted, lineHeight: 17 },

  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardCounter: {
    fontSize: 10,
    fontWeight: '800',
    color: C.muted,
    letterSpacing: 0.8,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  typePillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: C.text,
    backgroundColor: '#FAFBFC',
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectBtn: { backgroundColor: C.redPale },
  publishBtn: { backgroundColor: C.green },
  actionText: { fontSize: 13, fontWeight: '800' },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 32, marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 14 },
  doneBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 8,
  },
  doneBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  footer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  publishAllBtn: {
    backgroundColor: C.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  publishAllText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
