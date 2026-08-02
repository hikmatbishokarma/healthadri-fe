import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
  Modal,
  Alert,
  Linking,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentFileUrl,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';
import { colors } from '../theme/colors';

const C = {
  teal: colors.primary,
  tealDark: colors.primaryDarkest,
  tealPale: colors.primaryTint,
  blue: colors.accentBlue,
  bluePale: colors.accentBlueTint,
  amber: colors.warning,
  amberPale: '#FEF9C3',
  purple: colors.accentViolet,
  purplePale: '#F5F3FF',
  red: colors.danger,
  bg: colors.background,
  card: colors.white,
  text: colors.textBody,
  muted: colors.textSecondary,
  border: colors.border,
};

const CATEGORIES = [
  { id: 'prescription', label: 'Prescription', color: C.teal,   pale: C.tealPale,   icon: 'medkit-outline' },
  { id: 'lab',          label: 'Lab Report',   color: C.blue,   pale: C.bluePale,   icon: 'flask-outline' },
  { id: 'discharge',    label: 'Discharge',    color: C.purple, pale: C.purplePale, icon: 'business-outline' },
  { id: 'other',        label: 'Other',        color: C.muted,  pale: colors.surfaceSubtle,    icon: 'document-outline' },
];

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function categoryStyle(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[3];
}

function fileTypeBadge(mimeType) {
  if (mimeType === 'application/pdf') {
    return { label: 'PDF', color: C.red, pale: '#FEE2E2' };
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    return { icon: 'image', color: C.blue, pale: C.bluePale };
  }
  return { icon: 'document-outline', color: C.muted, pale: colors.surfaceSubtle };
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
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('prescription');

  const counts = useMemo(() => {
    const c = { prescription: 0, lab: 0, discharge: 0, other: 0 };
    docs.forEach((d) => {
      const key = c[d.category] !== undefined ? d.category : 'other';
      c[key] += 1;
    });
    return c;
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (activeCategory && d.category !== activeCategory) return false;
      if (q && !d.fileName?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, activeCategory, search]);

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

  // presetCategory: only passed by the explicit "+ Upload to <Category>" buttons
  // shown once a category is filtered — never inferred from tapping a tile.
  const pickFile = async (presetCategory = null) => {
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
      setUploadModal({ asset, presetCategory });
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

  // Fetches the file to a local temp path, then hands it to the OS share
  // sheet — on both iOS and Android that sheet includes "Save to Files" /
  // "Save Image", so this one action covers both "download" and "share".
  const handleShare = async (doc) => {
    try {
      const localUri = `${FileSystem.cacheDirectory}${doc.fileName}`;
      const { uri } = await FileSystem.downloadAsync(getDocumentFileUrl(doc._id), localUri);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Not available', 'Sharing is not supported on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: doc.mimeType, dialogTitle: doc.fileName });
    } catch {
      Alert.alert('Could not download', 'Please try again.');
    }
  };

  const handleMore = (doc) => {
    Alert.alert(
      doc.fileName,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => handleShare(doc) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(doc) },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDark} />

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.teal }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
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
          {!readOnly && (
            <View style={styles.uploadBanner}>
              <View style={styles.uploadBannerIcon}>
                <Ionicons name="folder-open" size={28} color={C.teal} />
              </View>
              <View style={styles.uploadBannerText}>
                <Text style={styles.uploadBannerTitle}>Your health records, always safe and organized</Text>
                <Text style={styles.uploadBannerSub}>
                  Upload reports, prescriptions, scans and other documents. Only you and your care team can access them.
                </Text>
              </View>
            </View>
          )}

          {docs.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>DOCUMENT CATEGORIES</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((c) => {
                  const active = activeCategory === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.categoryTile,
                        { backgroundColor: c.pale },
                        active && { borderColor: c.color, borderWidth: 2 },
                      ]}
                      onPress={() => setActiveCategory(active ? null : c.id)}
                      activeOpacity={0.75}
                    >
                      {active && (
                        <View style={[styles.categoryTileCheck, { backgroundColor: c.color }]}>
                          <Ionicons name="checkmark" size={9} color={colors.white} />
                        </View>
                      )}
                      <Ionicons name={c.icon} size={17} color={c.color} />
                      <Text style={styles.categoryTileLabel} numberOfLines={2}>{c.label}</Text>
                      <Text style={[styles.categoryTileCount, { color: c.color }]}>{counts[c.id]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={C.muted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={activeCategory ? `Search in ${categoryStyle(activeCategory).label}` : 'Search documents'}
                  placeholderTextColor={C.muted}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={C.muted} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>
                  {activeCategory || search ? 'MATCHING DOCUMENTS' : 'RECENT DOCUMENTS'}
                </Text>
                {!readOnly && filteredDocs.length > 0 && (
                  <TouchableOpacity
                    onPress={() => pickFile(activeCategory)}
                    style={styles.inlineUploadBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="add" size={14} color={C.teal} />
                    <Text style={styles.inlineUploadText}>Upload</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {docs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Illustration name="reports_empty" size={160} style={styles.emptyIllustration} />
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptyText}>
                {readOnly
                  ? 'This patient has not uploaded any documents.'
                  : 'Upload prescriptions, lab reports, or discharge summaries here. Your care team can view them.'}
              </Text>
              {!readOnly && (
                <TouchableOpacity style={styles.addBtn} onPress={() => pickFile()} activeOpacity={0.85}>
                  <Text style={styles.addBtnText}>+ Upload a document</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : filteredDocs.length === 0 && activeCategory && !search ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptyText}>
                You haven't added any {categoryStyle(activeCategory).label} documents yet.
              </Text>
              {!readOnly && (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => pickFile(activeCategory)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addBtnText}>+ Upload to {categoryStyle(activeCategory).label}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : filteredDocs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No matching documents</Text>
              <Text style={styles.emptyText}>Try a different search or category.</Text>
            </View>
          ) : (
            filteredDocs.map((d) => (
              <DocRow
                key={d._id}
                doc={d}
                readOnly={readOnly}
                onOpen={() => handleOpen(d)}
                onDownload={() => handleShare(d)}
                onMore={() => handleMore(d)}
              />
            ))
          )}
        </ScrollView>
      )}

      {!readOnly && <BottomNav active="Documents" navigation={navigation} />}

      <UploadModal
        visible={!!uploadModal}
        asset={uploadModal?.asset}
        defaultCategory={uploadModal?.presetCategory}
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

function DocRow({ doc, readOnly, onOpen, onDownload, onMore }) {
  const cat = categoryStyle(doc.category);
  const fileType = fileTypeBadge(doc.mimeType);
  return (
    <View style={styles.docCard}>
      <TouchableOpacity onPress={onOpen} style={styles.docMain} activeOpacity={0.7}>
        <View style={[styles.docIcon, { backgroundColor: fileType.pale }]}>
          {fileType.label
            ? <Text style={[styles.docIconLabel, { color: fileType.color }]}>{fileType.label}</Text>
            : <Ionicons name={fileType.icon} size={22} color={fileType.color} />}
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
        <View style={styles.docActions}>
          <TouchableOpacity onPress={onDownload} style={styles.docActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="download-outline" size={20} color={C.teal} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onMore} style={styles.docActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={C.muted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function UploadModal({ visible, asset, patientId, uploaderId, defaultCategory, onClose, onUploaded }) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setCategory(defaultCategory || null);
  }, [visible, defaultCategory]);

  const handleUpload = async () => {
    if (!asset || !category) return;
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

          <Text style={styles.fieldLabel}>
            {defaultCategory ? 'Category' : 'What kind of document is this?'}
          </Text>
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
                  <Ionicons name={c.icon} size={16} color={active ? colors.white : c.color} />
                  <Text
                    style={[
                      styles.catChipText,
                      { color: active ? colors.white : c.color },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!category && (
            <Text style={styles.fieldHint}>Choose a category to continue.</Text>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, styles.modalCancel]}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleUpload}
              disabled={submitting || !category}
              style={[styles.modalBtn, styles.modalSubmit, !category && styles.modalSubmitDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
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
  backIcon: { color: colors.white, fontSize: 18, lineHeight: 20 },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },

  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 24 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text, padding: 0 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inlineUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inlineUploadText: { fontSize: 11, fontWeight: '700', color: C.teal },

  addBtn: {
    backgroundColor: C.teal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  addBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  uploadBannerIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: C.tealPale,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadBannerText: { flex: 1 },
  uploadBannerTitle: { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18 },
  uploadBannerSub: { fontSize: 11, color: C.muted, lineHeight: 15, marginTop: 4 },

  categoryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  categoryTile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  categoryTileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileLabel: { fontSize: 9, fontWeight: '600', color: C.text, textAlign: 'center', lineHeight: 12 },
  categoryTileCount: { fontSize: 15, fontWeight: '800' },

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
  docIconLabel: { fontSize: 10, fontWeight: '800' },
  docName: { fontSize: 13, fontWeight: '700', color: C.text },
  docMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  catBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  catBadgeText: { fontSize: 9, fontWeight: '700' },
  docMeta: { fontSize: 10, color: C.muted },

  docActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 10, gap: 4 },
  docActionBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  fieldHint: { fontSize: 11, color: C.muted, marginTop: 8 },

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
  modalSubmitDisabled: { backgroundColor: C.border },
  modalSubmitText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
