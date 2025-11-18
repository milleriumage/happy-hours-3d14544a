import { Session, Room } from '../types';

const SUPABASE_URL = 'https://zroerzpqtyygmiamzkhy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyb2VyenBxdHl5Z21pYW16a2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMDcxOTQsImV4cCI6MjA3ODg4MzE5NH0.o3_mgXyt5NLMEqFdhzmce5HRZIIei7wBNbNrHErS8OM';

export async function apiLogin(username: string, password: string): Promise<Session> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/imvu-login`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Falha no login');
  }
  
  return { 
    user: data.user, 
    token: JSON.stringify(data.session) 
  };
}

export async function apiFetchRooms(token: string, searchTerm?: string, roomId?: string): Promise<Room[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/imvu-rooms`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      session: JSON.parse(token),
      searchTerm,
      roomId
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar salas');
  }

  return data.rooms;
}
