import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import Constants from 'expo-constants';

// Resolve the dev machine's host so a physical device on the same Wi-Fi
// can reach the backend. Expo exposes the LAN IP of the dev server here.
const lanHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? '';

const BASE_URL = lanHost
  ? `http://${lanHost}:3000`
  : Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const sendOtp = (phone) => api.post('/auth/send-otp', { phone });

export const verifyOtp = (phone, otp, role) =>
  api.post('/auth/verify-otp', { phone, otp, ...(role && { role }) });

export const caregiverLink = (tempToken, inviteCode) =>
  api.post('/auth/caregiver/link', { tempToken, inviteCode });

export const firebaseVerify = (idToken, role) =>
  api.post('/auth/firebase-verify', { idToken, ...(role && { role }) });

export const generateInvite = () => api.post('/patients/invite');

export const getCaregiverPatient = () => api.get('/caregiver/patient');

export const getMe = () => api.get('/users/me');

export const updateProfile = (payload) => api.post('/users/profile', payload);

export const getSymptoms = () => api.get('/symptoms');

export const submitSymptomEntry = (patientId, responses) =>
  api.post('/symptom-entry', { patientId, responses });

export const getSymptomHistory = (patientId, days = 7) =>
  api.get('/symptom-entry/history', { params: { patientId, days } });

export const getWeeklyReport = (patientId) =>
  api.get('/reports/weekly', { params: { patientId } });

export const getLatestTriage = (patientId) =>
  api.get('/triage/latest', { params: { patientId } });

export const getNavigatorDashboard = (navigatorId) =>
  api.get(`/navigator/dashboard/${navigatorId}`);

export const getNavigatorPatients = (navigatorId) =>
  api.get(`/navigator/patients/${navigatorId}`);

export const getNavigatorPlaybookRun = (patientId) =>
  api.get(`/navigator/playbook-run/${patientId}`);

export const getThread = (patientId, since = null, callerRole = 'patient') =>
  api.get(`/messages/thread/${patientId}`, { params: { ...(since ? { since } : {}), callerRole } });

export const sendChatMessage = (patientId, senderId, senderType, body, scope = 'both') =>
  api.post('/messages/send', { patientId, senderId, senderType, body, ...(senderType === 'navigator' ? { scope } : {}) });

export const getInbox = (navigatorId) =>
  api.get(`/messages/inbox/${navigatorId}`);

export const markRead = (conversationId) =>
  api.post(`/messages/read/${conversationId}`);

export const navigatorHeartbeat = (navigatorId) =>
  api.post('/messages/heartbeat', { navigatorId });

export const getHospitals = () => api.get('/hospitals');

export const searchHospitals = (query) =>
  api.get(`/hospitals?search=${encodeURIComponent(query)}`);

export const searchDoctors = (query) =>
  api.get(`/doctors?search=${encodeURIComponent(query)}`);

export const getAppointments = (patientId) =>
  api.get('/appointments', { params: { patientId } });

export const createAppointment = (payload) => api.post('/appointments', payload);

export const updateAppointment = (id, payload) =>
  api.patch(`/appointments/${id}`, payload);

export const deleteAppointment = (id) => api.delete(`/appointments/${id}`);

export const getDocuments = (patientId) =>
  api.get('/documents', { params: { patientId } });

export const uploadDocument = (formData) =>
  api.post('/documents/upload', formData, {
    // Web: leave Content-Type unset so the browser adds the boundary itself.
    // Native RN: must set it explicitly — RN handles the boundary internally.
    headers:
      Platform.OS === 'web'
        ? {}
        : { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });

export const deleteDocument = (id) => api.delete(`/documents/${id}`);

export const getDocumentFileUrl = (id) => `${BASE_URL}/documents/${id}/file`;

export const getNavigatorDrafts = (navigatorId) =>
  api.get('/tasks', { params: { navigatorId, status: 'draft' } });

export const getDraftsForDocument = (sourceDocumentId) =>
  api.get('/tasks', { params: { sourceDocumentId, status: 'draft' } });

export const getPatientReminders = (patientId) =>
  api.get('/tasks', { params: { patientId, status: 'active' } });

export const updateTask = (id, payload) => api.patch(`/tasks/${id}`, payload);

export const publishTask = (id) => api.post(`/tasks/${id}/publish`);

export const deleteTask = (id) => api.delete(`/tasks/${id}`);

export const explainAi = (formData) =>
  api.post('/ai/explain', formData, {
    headers:
      Platform.OS === 'web'
        ? {}
        : { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });

export default api;
