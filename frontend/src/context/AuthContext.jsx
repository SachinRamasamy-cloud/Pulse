import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(() => { try { return JSON.parse(localStorage.getItem('pb_user')); } catch { return null; } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pb_token');
    if (!token) { setLoading(false); return; }
    authAPI.getMe()
      .then(({ data }) => { setUser(data.user); localStorage.setItem('pb_user', JSON.stringify(data.user)); })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('pb_token', data.token);
    localStorage.setItem('pb_user',  JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await authAPI.register({ name, email, password });
    localStorage.setItem('pb_token', data.token);
    localStorage.setItem('pb_user',  JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pb_token');
    localStorage.removeItem('pb_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await authAPI.getMe();
    setUser(data.user);
    localStorage.setItem('pb_user', JSON.stringify(data.user));
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
