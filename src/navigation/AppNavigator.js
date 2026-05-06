import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AiChatFab from '../components/AiChatFab';

import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PatientDashboardScreen from '../screens/PatientDashboardScreen';
import SymptomScreen from '../screens/SymptomScreen';
import NavigatorDashboardScreen from '../screens/NavigatorDashboardScreen';
import ChatScreen from '../screens/ChatScreen';
import HospitalDirectoryScreen from '../screens/HospitalDirectoryScreen';
import RemindersScreen from '../screens/RemindersScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import MedicalRecordsScreen from '../screens/MedicalRecordsScreen';
import DraftsListScreen from '../screens/DraftsListScreen';
import DraftReviewScreen from '../screens/DraftReviewScreen';
import AiExplainerScreen from '../screens/AiExplainerScreen';
import PlaybookActiveScreen from '../screens/PlaybookActiveScreen';
import CaregiverDashboardScreen from '../screens/CaregiverDashboardScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const [routeName, setRouteName] = useState(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A6B5A" />
      </View>
    );
  }

  const isPatientAuthed =
    !!user && user.profileCompleted && user.role === 'patient';
  const showFab = isPatientAuthed && routeName !== 'AiExplainer';

  const updateRouteName = () => {
    const r = navigationRef.getCurrentRoute();
    setRouteName(r?.name || null);
  };

  const openAiChat = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('AiExplainer');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        onReady={updateRouteName}
        onStateChange={updateRouteName}
      >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1A6B5A' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : user.role === 'caregiver' ? (
          <>
            <Stack.Screen
              name="CaregiverDashboard"
              component={CaregiverDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params?.name || 'Chat' })}
            />
          </>
        ) : !user.profileCompleted ? (
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerShown: false }}
          />
        ) : user.role === 'navigator' ? (
          <>
            <Stack.Screen
              name="NavigatorDashboard"
              component={NavigatorDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PlaybookActive"
              component={PlaybookActiveScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params?.name || 'Chat' })}
            />
            <Stack.Screen
              name="MedicalRecords"
              component={MedicalRecordsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DraftsList"
              component={DraftsListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DraftReview"
              component={DraftReviewScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="PatientDashboard"
              component={PatientDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Symptom"
              component={SymptomScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Hospitals"
              component={HospitalDirectoryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Reminders"
              component={RemindersScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WeeklyReport"
              component={WeeklyReportScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MedicalRecords"
              component={MedicalRecordsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params?.name || 'Chat' })}
            />
            <Stack.Screen
              name="AiExplainer"
              component={AiExplainerScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
      {showFab ? <AiChatFab onPress={openAiChat} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D4035',
  },
});
