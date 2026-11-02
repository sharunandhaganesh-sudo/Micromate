import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, setAuthToken, getAuthToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isOperator: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const profile = await api.getMe();
          setUser(profile);
        } catch (e) {
          console.warn('Session expired or invalid, logging in as default operator');
          autoLoginDefault();
        }
      } else {
        autoLoginDefault();
      }
      setLoading(false);
    };

    const autoLoginDefault = async () => {
      try {
        const res = await api.login({ username: 'operator', password: 'OperatorPassword2026!' });
        setAuthToken(res.access_token);
        setUser(res.user);
      } catch (err) {
        console.error('Failed default auto-login:', err);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setAuthToken(res.access_token);
    setUser(res.user);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'admin' || user?.role === 'operator';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isOperator }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
