import React, { useState, useEffect, FC } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetchRooms } from '../services/api';
import { Room } from '../types';
import { Spinner } from './Spinner';
import { RoomCard } from './RoomCard';
import { UserHistory } from './UserHistory';
import { UserPresence } from './UserPresence';

export const Rooms: FC = () => {
  const { session, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'id'>('name');
  const [isSearching, setIsSearching] = useState(false);

  const fetchRooms = async (search?: string, type: 'name' | 'id' = 'name') => {
    if (!session?.token) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const fetchedRooms = type === 'id' && search
        ? await apiFetchRooms(session.token, undefined, search)
        : await apiFetchRooms(session.token, search);
      setRooms(fetchedRooms);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [session]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRooms(searchTerm, searchType);
  };

  if (!session) return null;

  return (
    <div className="container">
      <header className="header">
        <h1>Salas Públicas</h1>
        <div>
          <span className="user-info">Logado como: {session.user.username}</span>
          <button onClick={logout} className="logout-btn" style={{marginLeft: '1rem'}}>Sair</button>
        </div>
      </header>

      <UserHistory session={session} />
      <UserPresence session={session} />

      <div className="search-section">
        <div className="search-type-selector">
          <label>
            <input
              type="radio"
              value="name"
              checked={searchType === 'name'}
              onChange={(e) => setSearchType(e.target.value as 'name' | 'id')}
            />
            <span>Buscar por nome</span>
          </label>
          <label>
            <input
              type="radio"
              value="id"
              checked={searchType === 'id'}
              onChange={(e) => setSearchType(e.target.value as 'name' | 'id')}
            />
            <span>Buscar por ID</span>
          </label>
        </div>
        
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder={searchType === 'id' ? 'Digite o ID da sala...' : 'Digite o nome da sala...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-btn" disabled={isSearching}>
            {isSearching ? <Spinner /> : 'Buscar'}
          </button>
        </form>
        {searchTerm && (
          <button 
            onClick={() => {
              setSearchTerm('');
              fetchRooms();
            }} 
            className="clear-search-btn"
          >
            Limpar busca
          </button>
        )}
      </div>

      <div className="stats-panel">
        <div className="stat-item">
          <span className="stat-label">Total de salas:</span>
          <span className="stat-value">{rooms.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total de usuários online:</span>
          <span className="stat-value">
            {rooms.reduce((sum, room) => sum + (room.currentUsers || 0), 0)}
          </span>
        </div>
      </div>
      
      {isLoading && <div className="spinner-container"><Spinner /></div>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && (
        <div className="rooms-grid">
          {rooms.map(room => <RoomCard key={room.id} room={room} />)}
        </div>
      )}
    </div>
  );
};
