# Healthadri Frontend

React Native (Expo) mobile app for Healthadri cancer-care navigation.

## Setup

```bash
cd healthadri-fe
npm install
npm start
```

Then press `i` for iOS, `a` for Android, or `w` for web.

## API base URL

Set in [src/services/api.js](src/services/api.js):

- iOS simulator / web: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`
- Physical device: replace with your machine LAN IP (e.g. `http://192.168.1.10:3000`)

## Backend

Run the NestJS backend in `../healthadri-be`:

```bash
cd ../healthadri-be
npm run start:dev
```

Seed data once:

```bash
npx ts-node src/seed.ts
```

## Demo login

- Any 10-digit phone number
- Static OTP: `1234`

## Flow

1. Login (phone + OTP)
2. `/users/me` fetched on app load
3. If `profileCompleted === false` → Profile screen
4. If role is `navigator` → Navigator Dashboard
5. If role is `patient` → Patient Dashboard → Symptom Check-in, Chat

## Structure

```
src/
  navigation/    AppNavigator.js       — stack navigator + role routing
  services/      api.js                — axios + endpoints
  context/       AuthContext.js        — token + user in AsyncStorage
  screens/
    LoginScreen.js
    ProfileScreen.js
    PatientDashboardScreen.js
    SymptomScreen.js
    NavigatorDashboardScreen.js
    ChatScreen.js
```
