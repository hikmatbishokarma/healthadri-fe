import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Illustration from '../components/Illustration';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Modal,
  Alert,
  Linking,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentFileUrl,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  tealPale: colors.primaryTint,
  blue: '#2563EB',
  bluePale: '#EFF6FF',
  amber: '#F59E0B',
  amberPale: '#FEF9C3',
  purple: '#7C3AED',
  purplePale: '#F5F3FF',
  red: '#EF4444',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#64748B',
  border: '#E2E8F0',
};

const CATEGORIES = [
  { id: 'prescription', label: 'Prescription', color: C.teal,   pale: C.tealPale,   icon: 'medkit-outline' },
  { id: 'lab',          label: 'Lab Report',   color: C.blue,   pale: C.bluePale,   icon: 'flask-outline' },
  { id: 'discharge',    label: 'Discharge',    color: C.purple, pale: C.purplePale, icon: 'business-outline' },
  { id: 'other',        label: 'Other',        color: C.muted,  pale: '#F1F5F9',    icon: 'document-outline' },
];

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function categoryStyle(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[3];
}

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MedicalRecordsScreen({ navigation, route }) {
  const { user } = useAuth();
  const patientId = route?.params?.patientId || user?._id;
  const readOnly = route?.params?.readOnly || false;
  const patientName = route?.params?.patientName;

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadModal, setUploadModal] = useState(null); // { fileAsset } when picked

  const fetchDocs = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await getDocuments(patientId);
      setDocs(res.data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocs();
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      if (asset.mimeType && !ALLOWED_TYPES.includes(asset.mimeType)) {
        Alert.alert('Unsupported file', 'Please upload a PDF, JPG, or PNG.');
        return;
      }
      setUploadModal({ asset });
    } catch (err) {
      Alert.alert('Could not pick file', err?.message || 'Try again.');
    }
  };

  const handleOpen = (doc) => {
    const url = getDocumentFileUrl(doc._id);
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open', 'Try again or download to your device.'),
    );
  };

  const handleDelete = (doc) => {
    Alert.alert(
      'Delete this file?',
      `${doc.fileName} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(doc._id);
              fetchDocs();
            } catch (err) {
              Alert.alert(
                'Could not delete',
                err.response?.data?.message?.toString() || 'Try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {readOnly ? 'Patient Documents' : 'My Medical Records'}
            </Text>
            {readOnly && patientName ? (
              <Text style={styles.headerSub}>{patientName}</Text>
            ) : null}
          </View>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {docs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Illustration name="reports_empty" size={160} style={styles.emptyIllustration} />
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptyText}>
                {readOnly
                  ? 'This patient has not uploaded any documents.'
                  : 'Upload prescriptions, lab reports, or discharge summaries here. Your care team can view them.'}
              </Text>
            </View>
          ) : (
            docs.map((d) => (
              <DocRow
                key={d._id}
                doc={d}
                readOnly={readOnly}
                onOpen={() => handleOpen(d)}
                onDelete={() => handleDelete(d)}
              />
            ))
          )}
        </ScrollView>
      )}

      {!readOnly && (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.card }}>
          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={pickFile} style={styles.uploadBtn}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.uploadBtnText}>Upload a document</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      <UploadModal
        visible={!!uploadModal}
        asset={uploadModal?.asset}
        patientId={patientId}
        uploaderId={user?._id}
        onClose={() => setUploadModal(null)}
        onUploaded={() => {
          setUploadModal(null);
          fetchDocs();
        }}
      />
    </View>
  );
}

function DocRow({ doc, readOnly, onOpen, onDelete }) {
  const cat = categoryStyle(doc.category);
  return (
    <View style={styles.docCard}>
      <TouchableOpacity onPress={onOpen} style={styles.docMain} activeOpacity={0.7}>
        <View style={[styles.docIcon, { backgroundColor: cat.pale }]}>
          <Ionicons name={cat.icon} size={22} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName} numberOfLines={1}>
            {doc.fileName}
          </Text>
          <View style={styles.docMetaRow}>
            <View style={[styles.catBadge, { backgroundColor: cat.pale }]}>
              <Text style={[styles.catBadgeText, { color: cat.color }]}>
                {cat.label}
              </Text>
            </View>
            <Text style={styles.docMeta}>
              {formatDate(doc.createdAt)} · {formatBytes(doc.fileSize)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      {!readOnly && (
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function UploadModal({ visible, asset, patientId, uploaderId, onClose, onUploaded }) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState('prescription');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setCategory('prescription');
  }, [visible]);

  const handleUpload = async () => {
    if (!asset) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('patientId', patientId);
      if (uploaderId) formData.append('uploadedByUserId', uploaderId);
      formData.append('category', category);

      if (Platform.OS === 'web') {
        // Web: backend (multer) needs a real Blob/File, not the RN pseudo-file
        let blob;
        if (asset.file) {
          blob = asset.file;
        } else {
          const response = await fetch(asset.uri);
          blob = await response.blob();
        }
        formData.append('file', blob, asset.name || 'upload');
      } else {
        // iOS / Android: RN's XHR knows how to read from { uri, name, type }
        formData.append('file', {
          uri: asset.uri,
          name: asset.name || 'upload',
          type: asset.mimeType || 'application/octet-stream',
        });
      }

      await uploadDocument(formData);
      onUploaded();
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err.response?.data?.message?.toString() || 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: 28 + insets.bottom }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Upload document</Text>

          {asset && (
            <View style={styles.fileBox}>
              <Text style={styles.fileBoxIcon}>📎</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileBoxName} numberOfLines={1}>
                  {asset.name || 'Selected file'}
                </Text>
                <Text style={styles.fileBoxMeta}>
                  {asset.mimeType} · {formatBytes(asset.size)}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.fieldLabel}>What kind of document is this?</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[
                    styles.catChip,
                    active
                      ? { backgroundColor: c.color, borderColor: c.color }
                      : { backgroundColor: c.pale, borderColor: 'transparent' },
                  ]}
                >
                  <Ionicons name={c.icon} size={16} color={active ? '#fff' : c.color} />
                  <Text
                    style={[
                      styles.catChipText,
                      { color: active ? '#fff' : c.color },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, styles.modalCancel]}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleUpload}
              disabled={submitting}
              style={[styles.modalBtn, styles.modalSubmit]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSubmitText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },

  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 24 },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 30,
  },
  emptyIllustration: { marginBottom: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18 },

  docCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    alignItems: 'center',
  },
  docMain: { flexDirection: 'row', flex: 1, padding: 12, gap: 10, alignItems: 'center' },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontSize: 13, fontWeight: '700', color: C.text },
  docMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  catBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  catBadgeText: { fontSize: 9, fontWeight: '700' },
  docMeta: { fontSize: 10, color: C.muted },

  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18 },

  bottomBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  uploadBtn: {
    backgroundColor: C.teal,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 28,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },

  fileBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  fileBoxIcon: { fontSize: 20 },
  fileBoxName: { fontSize: 13, fontWeight: '700', color: C.text },
  fileBoxMeta: { fontSize: 10, color: C.muted, marginTop: 2 },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  catChipText: { fontSize: 11, fontWeight: '700' },

  modalActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancel: { backgroundColor: C.border },
  modalCancelText: { color: C.text, fontWeight: '700', fontSize: 13 },
  modalSubmit: { backgroundColor: C.teal },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
