import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMe } from '../services/api';
import { getToken, setToken, clearToken } from '../services/storage/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const res = await getMe();
      setUser(res.data);
    } catch (err) {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signIn = async (token, userData) => {
    await setToken(token);
    setUser(userData);
    // Refresh from /users/me to get full profile fields
    try {
      const res = await getMe();
      setUser(res.data);
    } catch (_) {}
  };

  const signOut = async () => {
    await clearToken();
    setUser(null);
  };

  const refresh = async () => {
    try {
      const res = await getMe();
      setUser(res.data);
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
