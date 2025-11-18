import React, { useState, FC } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from './Spinner';

export const Login: FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError('');
    try {
      await login(username, password);
    } catch (err: any) {
      setLocalError(err.message || 'Ocorreu um erro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>IMVU Room Explorer</h1>
        <div className="input-group">
          <label htmlFor="username">Usuário</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Entrar
        </button>
        <p className="error-message">{localError}</p>
      </form>
    </div>
  );
};
