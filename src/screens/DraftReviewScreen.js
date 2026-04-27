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
  teal: '#1A6B5A',
  tealDark: '#0D4035',
  tealPale: '#E8F5F1',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
  green: '#15803D',
  greenPale: '#DCFCE7',
  red: '#B91C1C',
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
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientLabel} numberOfLines={1}>
              {patientName || 'Patient'}
            </Text>
            <Text style={styles.docLabel} numberOfLines={1}>
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

        {drafts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No drafts left. All reviewed.
            </Text>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          drafts.map((d) => (
            <DraftCard
              key={d._id}
              draft={d}
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

function DraftCard({ draft, busy, onChange, onPublish, onReject }) {
  const isVisit = draft.type === 'visit';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
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
        <Text style={styles.tapToToggle}>tap to switch</Text>
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
          style={[styles.actionBtn, { backgroundColor: C.redPale }]}
          onPress={onReject}
          disabled={busy}
        >
          <Text style={[styles.actionText, { color: C.red }]}>✗ Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: C.greenPale }]}
          onPress={onPublish}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={C.green} size="small" />
          ) : (
            <Text style={[styles.actionText, { color: C.green }]}>
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
  patientLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  docLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 32 },

  openDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.tealPale,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#B2D8CF',
  },
  openDocIcon: { fontSize: 18 },
  openDocText: { flex: 1, color: C.teal, fontSize: 14, fontWeight: '700' },
  openDocChevron: { color: C.teal, fontSize: 16, fontWeight: '700' },

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
    gap: 8,
    marginBottom: 10,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  typePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  tapToToggle: { fontSize: 10, color: C.muted, fontStyle: 'italic' },

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
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700' },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 14 },
  doneBtn: {
    backgroundColor: C.teal,
    paddingHorizontal: 24,
    paddingVertical: 10,
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
    backgroundColor: C.teal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  publishAllText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
