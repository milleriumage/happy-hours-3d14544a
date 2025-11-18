import { useState, useEffect, useRef } from 'react';

interface UserPresence {
  username: string;
  displayName: string;
  online: boolean;
  avatarImage?: string;
  currentRoom?: {
    id: string;
    name: string;
    privacy: string;
    description?: string;
  };
  timestamp: string;
}

interface UserMonitorProps {
  targetUsername: string;
  sauce: string;
  onClose: () => void;
}

const UserMonitor = ({ targetUsername, sauce, onClose }: UserMonitorProps) => {
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const projectId = 'zroerzpqtyygmiamzkhy';
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/imvu-monitor-user?username=${encodeURIComponent(targetUsername)}&sauce=${encodeURIComponent(sauce)}`;
    
    console.log('Monitoring user:', targetUsername);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Presence update:', data);

        if (data.type === 'presence') {
          setPresence(data.data);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Erro ao conectar ao monitor');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [targetUsername, sauce]);

  return (
    <div className="chat-overlay">
      <div className="chat-modal">
        <div className="chat-header">
          <div className="chat-title">
            <span className="chat-icon">👁️</span>
            <div>
              <h3>Monitorando: {targetUsername}</h3>
              <p className="chat-status">
                {isConnected ? "Conectado" : "Desconectado"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="chat-close">✕</button>
        </div>

        <div className="chat-messages">
          {error && (
            <div className="chat-error">⚠️ {error}</div>
          )}
          
          {presence && (
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                {presence.avatarImage && (
                  <img 
                    src={presence.avatarImage} 
                    alt={presence.username}
                    style={{ width: '64px', height: '64px', borderRadius: '50%' }}
                  />
                )}
                <div>
                  <h3 style={{ margin: 0 }}>{presence.displayName || presence.username}</h3>
                  <p style={{ margin: '0.25rem 0', color: presence.online ? '#10b981' : '#ef4444' }}>
                    {presence.online ? '🟢 Online' : '🔴 Offline'}
                  </p>
                </div>
              </div>

              {presence.currentRoom && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '1rem',
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>📍 Sala Atual</h4>
                  <p style={{ margin: '0.25rem 0' }}>
                    <strong>Nome:</strong> {presence.currentRoom.name}
                  </p>
                  <p style={{ margin: '0.25rem 0' }}>
                    <strong>ID:</strong> {presence.currentRoom.id}
                  </p>
                  <p style={{ margin: '0.25rem 0' }}>
                    <strong>Privacidade:</strong> {presence.currentRoom.privacy}
                  </p>
                  {presence.currentRoom.description && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', opacity: 0.8 }}>
                      {presence.currentRoom.description}
                    </p>
                  )}
                </div>
              )}

              {!presence.currentRoom && presence.online && (
                <div style={{
                  background: 'rgba(156, 163, 175, 0.1)',
                  border: '1px solid rgba(156, 163, 175, 0.3)',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center',
                }}>
                  <p style={{ margin: 0 }}>Usuário online mas não está em nenhuma sala</p>
                </div>
              )}

              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '1rem', textAlign: 'center' }}>
                Última atualização: {new Date(presence.timestamp).toLocaleString()}
              </p>
            </div>
          )}

          {!presence && !error && isConnected && (
            <div className="chat-empty">
              <span className="chat-empty-icon">⏳</span>
              <p>Carregando dados do usuário...</p>
            </div>
          )}
        </div>

        <div className="chat-footer">
          Atualizando a cada 30 segundos
        </div>
      </div>
    </div>
  );
};

export default UserMonitor;
