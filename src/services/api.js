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

export const verifyOtp = (phone, otp) =>
  api.post('/auth/verify-otp', { phone, otp });

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

export const getMessages = (userId, withUserId) =>
  api.get(`/messages/${userId}`, { params: { with: withUserId } });

export const sendMessage = (senderId, receiverId, text) =>
  api.post('/messages', { senderId, receiverId, text });

export const getHospitals = () => api.get('/hospitals');

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

export default api;
