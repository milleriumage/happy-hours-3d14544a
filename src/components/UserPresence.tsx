import { useState, FC, FormEvent } from 'react';
import { Session } from '../types';
import { Spinner } from './Spinner';
import UserMonitor from './UserMonitor';

interface Friend {
  username: string;
  displayName?: string;
  online: boolean;
  avatarImage?: string;
}

interface UserPresenceProps {
  session: Session;
}

export const UserPresence = ({ session }: UserPresenceProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monitoringUser, setMonitoringUser] = useState<string | null>(null);
  const [customUsername, setCustomUsername] = useState('');

  const fetchPresence = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://zroerzpqtyygmiamzkhy.supabase.co/functions/v1/imvu-user-presence`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: session.user.username,
            sauce: session.token,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar presença');
      }

      const data = await response.json();
      setFriends(data.friends || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMonitorCustomUser = (e: FormEvent) => {
    e.preventDefault();
    if (customUsername.trim()) {
      setMonitoringUser(customUsername.trim());
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ 
        background: 'rgba(59, 130, 246, 0.1)', 
        borderRadius: '8px', 
        padding: '1.5rem',
        border: '1px solid rgba(59, 130, 246, 0.3)',
      }}>
        <h2 style={{ marginTop: 0 }}>👥 Presença e Monitoramento</h2>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={fetchPresence} className="btn" disabled={isLoading}>
            {isLoading && <Spinner />}
            Ver Amigos Online
          </button>
        </div>

        <form onSubmit={handleMonitorCustomUser} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Nome de usuário para monitorar"
            value={customUsername}
            onChange={(e) => setCustomUsername(e.target.value)}
            className="search-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn">
            Monitorar Usuário
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}

        {friends.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Amigos ({friends.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {friends.map((friend) => (
                <div
                  key={friend.username}
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => setMonitoringUser(friend.username)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'}
                >
                  {friend.avatarImage && (
                    <img 
                      src={friend.avatarImage} 
                      alt={friend.username}
                      style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500' }}>{friend.displayName || friend.username}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7, color: friend.online ? '#10b981' : '#ef4444' }}>
                      {friend.online ? '🟢 Online' : '🔴 Offline'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {monitoringUser && (
        <UserMonitor
          targetUsername={monitoringUser}
          sauce={session.token}
          onClose={() => setMonitoringUser(null)}
        />
      )}
    </div>
  );
};
