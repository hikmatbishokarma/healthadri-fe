# healthadri-fe — React Native Mobile App

## Stack
Expo SDK, React Native, **JavaScript** (not TypeScript), React Navigation (native-stack), Axios, `@react-native-async-storage/async-storage`, `expo-document-picker`

> All files are `.js`. Do not convert to TypeScript without aligning the whole project.

---

## ⚠️ React Native Component Rules — Non-Negotiable

Never use HTML tags. Always use React Native equivalents:

| HTML | React Native |
|------|-------------|
| `div` | `View` |
| `p`, `span`, `h1`–`h6` | `Text` |
| `input` | `TextInput` |
| `button` | `TouchableOpacity` or `Pressable` |
| overflow scroll | `ScrollView` |
| `img` | `Image` |
| CSS classes / inline CSS | `StyleSheet.create()` |
| `ul` + `li` / `Array.map` in scroll | `FlatList` |

Use `FlatList` for all scrollable lists — never `ScrollView` + `.map()`.

---

## Project Structure

```
src/
  screens/          ← one file per screen
  components/       ← reusable UI pieces (AiChatFab, ChipSelect, FaceScale)
  navigation/
    AppNavigator.js ← single file; role-based stack routing
  context/
    AuthContext.js  ← user state, signIn, signOut, refresh
  services/
    api.js          ← axios instance + every API call as a named export
```

---

## Brand & Style

- **Primary teal**: `#1A6B5A` (headers, active states, primary buttons)
- **Dark background**: `#0D4035` (loading screen, dark areas)
- Consistent spacing units: `8`, `16`, `24`, `32`
- Mobile-first, thumb-friendly touch targets (minimum 44px height)
- Do not introduce new brand colors without design sign-off.

---

## Auth Flow

1. App boots → `AuthContext` reads token from `AsyncStorage` (`key: 'token'`) and calls `GET /users/me`.
2. If no token or 401 → `user = null` → routed to `Login`.
3. After OTP verify → `signIn(token, userData)` stores token and refreshes profile.
4. `AppNavigator` branches by role + `profileCompleted`:
   - `!user` → Login
   - `user` + `!profileCompleted` → Profile (complete profile first)
   - `user.role === 'navigator'` → NavigatorDashboard stack
   - `user.role === 'patient'` → PatientDashboard stack

---

## API Layer (`src/services/api.js`)

Single Axios instance. Key behaviours:
- **Dev LAN resolution**: reads `Constants.expoConfig.hostUri` to get the dev machine's LAN IP so physical devices on the same Wi-Fi can reach the backend without hardcoding IPs.
- Falls back to `10.0.2.2:3000` (Android emulator) or `localhost:3000` (iOS simulator).
- Attaches `Authorization: Bearer <token>` on every request.

When adding a new API call, export a named function from `api.js` — never call `axios` directly from a screen.

---

## Screens Reference

| Screen | Role | Notes |
|--------|------|-------|
| `LoginScreen` | Both | OTP phone login |
| `ProfileScreen` | Both | First-time profile completion |
| `PatientDashboardScreen` | Patient | Home, symptom summary |
| `SymptomScreen` | Patient | Daily check-in |
| `NavigatorDashboardScreen` | Navigator | Priority patient queue |
| `PlaybookActiveScreen` | Navigator | Run a playbook for a patient |
| `ChatScreen` | Both | Patient ↔ navigator messaging |
| `HospitalDirectoryScreen` | Patient | Browse hospitals |
| `RemindersScreen` | Patient | — |
| `WeeklyReportScreen` | Patient | — |
| `MedicalRecordsScreen` | Both | Documents |
| `DraftsListScreen` | Navigator | AI-generated draft summaries |
| `DraftReviewScreen` | Navigator | Review and approve a draft |
| `AiExplainerScreen` | Patient | Medical AI chat (FAB entry point) |

The floating `AiChatFab` is shown to authenticated patients on every screen except `AiExplainer`.

---

## Adding a New Screen

1. Create `src/screens/<Name>Screen.js`.
2. Import and add a `Stack.Screen` entry in `AppNavigator.js` inside the correct role branch.
3. Export all API calls needed from `src/services/api.js`.
