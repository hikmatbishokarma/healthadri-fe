import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { getNavigatorDashboard, getNavigatorDrafts } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NavigatorDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [dashRes, draftsRes] = await Promise.all([
        getNavigatorDashboard(user._id),
        getNavigatorDrafts(user._id),
      ]);
      const list = Array.isArray(dashRes.data)
        ? dashRes.data
        : dashRes.data?.patients || [];
      setItems(list);
      setDraftCount(Array.isArray(draftsRes.data) ? draftsRes.data.length : 0);
    } catch (err) {
      setItems([]);
      setDraftCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1A6B5A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.greeting}>Navigator Dashboard</Text>
        <Text style={styles.name}>{user?.name}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item, idx) => item._id || item.patientId || String(idx)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          draftCount > 0 ? (
            <TouchableOpacity
              style={styles.draftsBanner}
              onPress={() => navigation.navigate('DraftsList')}
              activeOpacity={0.85}
            >
              <Text style={styles.draftsBannerIcon}>📝</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.draftsBannerTitle}>
                  {draftCount} draft{draftCount === 1 ? '' : 's'} to review
                </Text>
                <Text style={styles.draftsBannerSubtitle}>
                  Verify AI-extracted reminders before publishing to patients
                </Text>
              </View>
              <Text style={styles.draftsBannerChevron}>›</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No patient alerts right now.</Text>
          </View>
        }
        renderItem={({ item }) => <PatientRow item={item} navigation={navigation} />}
      />

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

function PatientRow({ item, navigation }) {
  const name = item.name || item.patientName || 'Patient';
  const cancerType = item.cancerType || '—';
  const stage = item.cancerStage || item.stage || '';
  const severity = item.severity || item.risk || 'LOW';
  const reason = item.reason || item.summary || '';
  const patientId = item._id || item.patientId;

  const color =
    severity === 'HIGH' ? '#EF4444' : severity === 'MED' ? '#F59E0B' : '#22C55E';

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('Chat', { withUserId: patientId, name })
        }
      >
        <View style={styles.rowTop}>
          <Text style={styles.patientName}>{name}</Text>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{severity}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {cancerType}
          {stage ? ` · ${stage}` : ''}
        </Text>
        {!!reason && <Text style={styles.reason}>{reason}</Text>}
      </TouchableOpacity>

      <View style={styles.rowActions}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('Chat', { withUserId: patientId, name })
          }
          style={styles.actionBtn}
        >
          <Text style={styles.actionBtnText}>💬 Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('MedicalRecords', {
              patientId,
              patientName: name,
              readOnly: true,
            })
          }
          style={styles.actionBtn}
        >
          <Text style={styles.actionBtnText}>📁 Documents</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBox: {
    padding: 16,
    backgroundColor: '#1E3A5F',
  },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  patientName: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 12, color: '#64748B' },
  reason: { fontSize: 12, color: '#1A1A2E', marginTop: 6, lineHeight: 17 },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: '#1A1A2E' },
  draftsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  draftsBannerIcon: { fontSize: 22 },
  draftsBannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  draftsBannerSubtitle: { fontSize: 11, color: '#78350F', marginTop: 2, lineHeight: 15 },
  draftsBannerChevron: { fontSize: 22, color: '#92400E', fontWeight: '300' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  signOut: { paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: '#64748B', fontSize: 12 },
});
