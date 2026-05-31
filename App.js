import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import { registerPushToken } from './src/services/api';
import { logger } from './src/services/logger';

const EAS_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getExpoPushToken() {
  logger.debug('PushToken', 'isDevice:', Device.isDevice);
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  logger.debug('PushToken', 'permission status:', existing);
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    logger.debug('PushToken', 'requested permission:', finalStatus);
  }
  if (finalStatus !== 'granted') {
    logger.warn('PushToken', 'permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medications', {
      name: 'Medications',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
  }

  logger.debug('PushToken', 'projectId:', EAS_PROJECT_ID);
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
    );
    logger.debug('PushToken', 'got token:', tokenData.data);
    return tokenData.data;
  } catch (e) {
    logger.error('PushToken', 'getExpoPushTokenAsync failed:', e?.message);
    return null;
  }
}

function PushTokenRegistrar() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?._id) return;
    getExpoPushToken().then((token) => {
      logger.debug('PushToken', token ?? 'no token received');
      if (token) {
        registerPushToken(user._id, token).catch((e) =>
          logger.warn('PushToken', 'registration failed', e?.message),
        );
      }
    });
  }, [user?._id]);

  return null;
}

export default function App() {
  const responseListener = useRef();

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'MEDICATION_DUE' && data?.scheduledAt && navigationRef.isReady()) {
        navigationRef.navigate('MedicationAlarm', {
          scheduledAt: data.scheduledAt,
          patientId: data.patientId,
        });
      }
    });
    return () => responseListener.current?.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <PushTokenRegistrar />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
