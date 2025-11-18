import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Spinner } from './Spinner';
import { Session } from '../types';

interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  avatarImage?: string;
  registered?: string;
  online?: boolean;
}

interface RoomVisit {
  id: string;
  name: string;
  description: string;
  visitedAt: string;
  privacy: string;
  rating: string | number;
}

interface UserHistoryProps {
  session: Session;
}

export const UserHistory = ({ session }: UserHistoryProps) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [roomHistory, setRoomHistory] = useState<RoomVisit[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Digite um nome de usuário');
      return;
    }

    setLoading(true);
    setError(null);
    setUserInfo(null);
    setRoomHistory([]);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('imvu-user-history', {
        body: { session: JSON.parse(session.token), username: username.trim() },
      });

      if (functionError) throw functionError;

      if (data.error) {
        setError(data.error);
      } else {
        setUserInfo(data.user);
        setRoomHistory(data.roomHistory || []);
        
        if (data.roomHistory?.length === 0) {
          setError('⚠️ Histórico não disponível: A API IMVU restringe o acesso ao histórico de atividades de outros usuários por privacidade. Você pode apenas ver seu próprio histórico.');
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar histórico:', err);
      setError('Erro ao buscar histórico do usuário');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div style={{
      background: 'rgba(30, 30, 40, 0.8)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '32px',
      backdropFilter: 'blur(10px)'
    }}>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        marginBottom: '20px'
      }}>🔍 Histórico de Usuário</h2>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-group">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Digite o nome do usuário IMVU..."
            className="search-input"
            disabled={loading}
          />
          <button type="submit" className="search-button" disabled={loading}>
            {loading ? <Spinner /> : '🔎 Buscar'}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {userInfo && (
        <div className="user-info-card">
          <div className="user-header">
            {userInfo.avatarImage && (
              <img 
                src={userInfo.avatarImage} 
                alt={userInfo.username}
                className="user-avatar-large"
              />
            )}
            <div className="user-details">
              <h3 className="user-display-name">{userInfo.displayName}</h3>
              <p className="user-username">@{userInfo.username}</p>
              <div className="user-status">
                <span className={`status-badge ${userInfo.online ? 'online' : 'offline'}`}>
                  {userInfo.online ? '🟢 Online' : '⚫ Offline'}
                </span>
                {userInfo.registered && (
                  <span className="user-joined">
                    Registrado: {formatDate(userInfo.registered)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="room-history">
            <h4 className="history-title">
              📜 Últimas 5 Salas Visitadas
            </h4>
            
            {roomHistory.length === 0 ? (
              <div className="no-history" style={{
                background: 'rgba(255, 193, 7, 0.1)',
                border: '1px solid rgba(255, 193, 7, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '12px'
              }}>
                <p style={{ margin: 0, color: '#ffc107' }}>
                  ⚠️ A API IMVU restringe o acesso ao histórico de salas de outros usuários por questões de privacidade.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '0.9em', opacity: 0.8 }}>
                  Apenas o próprio usuário pode ver seu histórico completo ao fazer login.
                </p>
              </div>
            ) : (
              <div className="history-list">
                {roomHistory.map((room, index) => (
                  <div key={room.id} className="history-item">
                    <div className="history-number">{index + 1}</div>
                    <div className="history-content">
                      <div className="history-room-info">
                        <h5 className="history-room-name">{room.name}</h5>
                        {room.description && (
                          <p className="history-room-description">{room.description}</p>
                        )}
                      </div>
                      <div className="history-metadata">
                        <span className="history-date">
                          📅 {formatDate(room.visitedAt)}
                        </span>
                        <span className="history-privacy">
                          {room.privacy === 'public' ? '🌐 Público' : '🔒 Privado'}
                        </span>
                        {room.rating && (
                          <span className="history-rating">
                            ⭐ {room.rating}
                          </span>
                        )}
                      </div>
                      <div className="history-room-id">
                        ID: {room.id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
