import { FC, useState } from 'react';
import { Room } from '../types';
import RoomChat from './RoomChat';

export const RoomCard: FC<{ room: Room }> = ({ room }) => {
  const [showChat, setShowChat] = useState(false);

  return (
    <>
      {showChat && (
        <RoomChat
          roomId={room.id}
          roomName={room.name}
          onClose={() => setShowChat(false)}
        />
      )}
      <div className="room-card">
    <div className="room-card-header">
      <h3 className="room-title">{room.name}</h3>
      {room.host && (
        <div className="room-host">
          {room.host.avatarImage && (
            <img src={room.host.avatarImage} alt={room.host.username} className="host-avatar" />
          )}
          <span className="host-label">Hosted by <strong>{room.host.username}</strong></span>
        </div>
      )}
    </div>
    
    <div className="room-card-content">
      {room.description && (
        <div className="room-description-section">
          <p className="room-description">{room.description}</p>
        </div>
      )}

      <div className="room-metadata">
        <div className="room-meta-item">
          <span className="meta-label">ID:</span>
          <span className="meta-value">{room.id}</span>
        </div>
        <div className="room-meta-item">
          <span className="meta-label">Capacidade:</span>
          <span className="meta-value">{room.capacity}</span>
        </div>
        {room.currentUsers !== undefined && (
          <div className="room-meta-item">
            <span className="meta-label">Usuários online:</span>
            <span className="meta-value">{room.currentUsers}</span>
          </div>
        )}
        {room.privacy && (
          <div className="room-meta-item">
            <span className="meta-label">Privacidade:</span>
            <span className="meta-value">{room.privacy}</span>
          </div>
        )}
        {room.rating && (
          <div className="room-meta-item">
            <span className="meta-label">Rating:</span>
            <span className="meta-value">{room.rating}</span>
          </div>
        )}
      </div>
      
      {room.users && room.users.length > 0 && (
        <div className="room-participants">
          <h4 className="participants-title">
            👥 APRESENTADORES ({room.users.length}/{room.capacity})
          </h4>
          <div className="participants-grid">
            {room.users.map((user, index) => (
              <div key={`${user.id}-${index}`} className="participant-item" title={user.username}>
                {user.avatarImage ? (
                  <img src={user.avatarImage} alt={user.username} className="participant-avatar" />
                ) : (
                  <div className="participant-avatar-placeholder">{user.username[0]}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setShowChat(true)}
        className="chat-button"
      >
        💬 Ver Chat da Sala
      </button>
    </div>
  </div>
    </>
  );
};
