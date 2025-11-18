import React, { createContext, useContext, useState, useEffect, FC, PropsWithChildren } from 'react';
import { AuthContextType, Session } from '../types';
import { apiLogin } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<PropsWithChildren<{}>> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedSession = localStorage.getItem('imvu-session');
      if (storedSession) {
        setSession(JSON.parse(storedSession));
      }
    } catch (e) {
      console.error("Failed to parse session from localStorage", e);
      localStorage.removeItem('imvu-session');
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await apiLogin(username, password);
      setSession(newSession);
      localStorage.setItem('imvu-session', JSON.stringify(newSession));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem('imvu-session');
  };

  return (
    <AuthContext.Provider value={{ session, login, logout, isLoading, error }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
