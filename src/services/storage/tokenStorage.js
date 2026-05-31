import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The auth JWT is sensitive (it authenticates the patient to their health data),
// so on device it lives in the OS-encrypted store (Keychain on iOS, Keystore on
// Android) rather than AsyncStorage's plaintext file.
//
// SecureStore has no web implementation, so web falls back to AsyncStorage —
// acceptable because the web build is dev/preview only, not the shipped product.

const TOKEN_KEY = 'auth_token';
const LEGACY_KEY = 'token'; // where the token used to live in AsyncStorage

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function getToken() {
  if (!isNative) {
    return AsyncStorage.getItem(TOKEN_KEY);
  }

  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) return token;

  // One-time migration: a user already logged in before this change still has
  // their token in AsyncStorage. Move it into SecureStore so they stay signed in.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return legacy;
  }
  return null;
}

export async function setToken(token) {
  if (isNative) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

export async function clearToken() {
  if (isNative) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
  // Always clear the legacy slot too, in case migration never ran.
  await AsyncStorage.removeItem(LEGACY_KEY);
}
