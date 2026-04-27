import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

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

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A6B5A" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
        ) : !user.profileCompleted ? (
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: 'Complete Your Profile' }}
          />
        ) : user.role === 'navigator' ? (
          <>
            <Stack.Screen
              name="NavigatorDashboard"
              component={NavigatorDashboardScreen}
              options={{ title: 'Navigator Dashboard' }}
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
              options={{ title: 'My Profile' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params?.name || 'Chat' })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
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
