import { useState, useEffect, useRef } from 'react';
import { Session } from '../types';
import { useToast } from './ui/toast';

interface MonitoredUser {
  username: string;
  lastSeen?: {
    online: boolean;
    roomId?: string;
    roomName?: string;
    roomPrivacy?: string;
    timestamp: string;
  };
}

interface MonitoredUsersProps {
  session: Session;
}

export const MonitoredUsers = ({ session }: MonitoredUsersProps) => {
  const { toast } = useToast();
  const [monitoredUsers, setMonitoredUsers] = useState<MonitoredUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const websockets = useRef<Map<string, WebSocket>>(new Map());
  const lastStatus = useRef<Map<string, { online: boolean; roomId?: string }>>(new Map());

  useEffect(() => {
    const stored = localStorage.getItem('monitored-users');
    if (stored) {
      const users = JSON.parse(stored);
      setMonitoredUsers(users);
      users.forEach((user: MonitoredUser) => connectToUser(user.username));
    }

    return () => {
      websockets.current.forEach(ws => ws.close());
    };
  }, []);

  const connectToUser = (username: string) => {
    const sessionData = JSON.parse(session.token);
    const projectId = 'zroerzpqtyygmiamzkhy';
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/imvu-monitor-user?username=${encodeURIComponent(username)}&sauce=${encodeURIComponent(sessionData.sauce)}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'presence') {
          const { online, currentRoom } = data.data;
          const lastState = lastStatus.current.get(username);
          
          // Notify if status changed
          if (lastState && lastState.online !== online) {
            if (online) {
              toast({
                title: `🟢 ${username} está online!`,
                description: currentRoom ? `Em: ${currentRoom.name}` : 'Online agora',
              });
            } else {
              toast({
                title: `🔴 ${username} ficou offline`,
                variant: 'destructive',
              });
            }
          }
          
          // Notify if room changed
          if (online && currentRoom && lastState?.roomId !== currentRoom.id) {
            toast({
              title: `📍 ${username} entrou em uma sala`,
              description: `${currentRoom.name} (${currentRoom.privacy})`,
            });
          }
          
          lastStatus.current.set(username, { online, roomId: currentRoom?.id });
          
          setMonitoredUsers(prev => 
            prev.map(user => 
              user.username === username 
                ? {
                    ...user,
                    lastSeen: {
                      online,
                      roomId: currentRoom?.id,
                      roomName: currentRoom?.name,
                      roomPrivacy: currentRoom?.privacy,
                      timestamp: new Date().toISOString(),
                    }
                  }
                : user
            )
          );
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = () => {
      toast({
        title: 'Erro ao monitorar',
        description: `Não foi possível monitorar ${username}`,
        variant: 'destructive',
      });
    };

    websockets.current.set(username, ws);
  };

  const addUser = () => {
    const username = newUsername.trim();
    if (!username) return;
    
    if (monitoredUsers.some(u => u.username === username)) {
      toast({
        title: 'Usuário já está sendo monitorado',
        variant: 'destructive',
      });
      return;
    }

    const newUser: MonitoredUser = { username };
    const updated = [...monitoredUsers, newUser];
    setMonitoredUsers(updated);
    localStorage.setItem('monitored-users', JSON.stringify(updated));
    connectToUser(username);
    setNewUsername('');
    
    toast({
      title: `Monitorando ${username}`,
      description: 'Você receberá notificações de atividade',
    });
  };

  const removeUser = (username: string) => {
    const ws = websockets.current.get(username);
    if (ws) {
      ws.close();
      websockets.current.delete(username);
    }
    
    lastStatus.current.delete(username);
    const updated = monitoredUsers.filter(u => u.username !== username);
    setMonitoredUsers(updated);
    localStorage.setItem('monitored-users', JSON.stringify(updated));
    
    toast({
      title: `Parou de monitorar ${username}`,
    });
  };

  return (
    <div style={{
      background: 'rgba(168, 85, 247, 0.1)',
      border: '1px solid rgba(168, 85, 247, 0.3)',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '2rem',
    }}>
      <h2 style={{ marginTop: 0 }}>🔔 Usuários Monitorados</h2>
      <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '1rem' }}>
        Receba notificações quando ficarem online ou mudarem de sala
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Nome do usuário"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addUser()}
          className="search-input"
          style={{ flex: 1 }}
        />
        <button onClick={addUser} className="btn">
          Adicionar
        </button>
      </div>

      {monitoredUsers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          opacity: 0.6,
        }}>
          Nenhum usuário sendo monitorado
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '0.75rem',
        }}>
          {monitoredUsers.map((user) => (
            <div
              key={user.username}
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '1rem',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                  {user.username}
                </div>
                {user.lastSeen && (
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    {user.lastSeen.online ? (
                      <>
                        <span style={{ color: '#10b981' }}>🟢 Online</span>
                        {user.lastSeen.roomName && (
                          <div style={{ marginTop: '0.25rem' }}>
                            📍 {user.lastSeen.roomName}
                            {user.lastSeen.roomPrivacy && (
                              <span style={{ 
                                marginLeft: '0.5rem',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '3px',
                                background: user.lastSeen.roomPrivacy === 'public' 
                                  ? 'rgba(34, 197, 94, 0.2)' 
                                  : 'rgba(251, 146, 60, 0.2)',
                                color: user.lastSeen.roomPrivacy === 'public' 
                                  ? '#22c55e' 
                                  : '#fb923c',
                                fontSize: '0.65rem',
                              }}>
                                {user.lastSeen.roomPrivacy === 'public' ? '🌐 Pública' : '🔒 Privada'}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: '#ef4444' }}>🔴 Offline</span>
                    )}
                    <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                      {new Date(user.lastSeen.timestamp).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeUser(user.username)}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '4px',
                  padding: '0.5rem 1rem',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
