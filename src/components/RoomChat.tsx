import { useEffect, useRef, useState } from 'react';

interface Message {
  user_id: string;
  username?: string;
  text: string;
  timestamp: number;
}

interface RoomChatProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
}

const RoomChat = ({ roomId, roomName, onClose }: RoomChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const projectId = 'zroerzpqtyygmiamzkhy';
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/imvu-room-chat?roomId=${roomId}`;
    
    console.log('Connecting to room chat:', roomId);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnecting(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Message received:', data);

        if (data.type === 'connected') {
          setIsConnected(true);
        } else if (data.type === 'message') {
          const msgData = data.data;
          setMessages(prev => [...prev, {
            user_id: msgData.user_id,
            username: msgData.username || `User ${msgData.user_id}`,
            text: msgData.text || JSON.stringify(msgData),
            timestamp: Date.now()
          }]);
        } else if (data.type === 'state') {
          console.log('State update:', data.data);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnecting(false);
      setError('Não foi possível conectar ao chat da sala');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
      setIsConnecting(false);
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-overlay">
      <div className="chat-modal">
        <div className="chat-header">
          <div className="chat-title">
            <span className="chat-icon">💬</span>
            <div>
              <h3>{roomName}</h3>
              <p className="chat-status">
                {isConnecting && "Conectando..."}
                {isConnected && "Monitorando chat"}
                {!isConnecting && !isConnected && "Desconectado"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="chat-close">✕</button>
        </div>

        <div className="chat-messages">
          {error && (
            <div className="chat-error">⚠️ {error}</div>
          )}
          {messages.length === 0 && !error ? (
            <div className="chat-empty">
              <span className="chat-empty-icon">💬</span>
              <p>Aguardando mensagens...</p>
              <p className="chat-empty-subtitle">As mensagens aparecerão aqui em tempo real</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="chat-message">
                <div className="chat-message-header">
                  <span className="chat-message-user">{msg.username}</span>
                  <span className="chat-message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="chat-message-text">{msg.text}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-footer">
          Bot monitorando mensagens em tempo real via IMQ
        </div>
      </div>
    </div>
  );
};

export default RoomChat;
