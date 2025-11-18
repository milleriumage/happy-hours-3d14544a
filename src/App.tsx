import React, { FC } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Rooms } from './components/Rooms';
import { Spinner } from './components/Spinner';

const AppContent: FC = () => {
  const { session, isLoading } = useAuth();
  if (isLoading) return <div className="spinner-container"><Spinner /></div>;
  return session ? <Rooms /> : <Login />;
};

export const App: FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
