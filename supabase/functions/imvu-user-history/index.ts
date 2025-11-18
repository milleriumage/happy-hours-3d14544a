/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const buildHeaders = (session: any) => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${session.sauce}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (session?.cookies) headers['Cookie'] = session.cookies;
  if (session?.cid) headers['X-IMVU-CID'] = String(session.cid);
  return headers;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session, username } = await req.json();

    if (!session?.sauce || !session?.cid) {
      return new Response(
        JSON.stringify({ error: 'Sessão inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!username) {
      return new Response(
        JSON.stringify({ error: 'Username é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[USER-HISTORY] Buscando usuário: ${username}`);

    // Buscar informações do usuário
    const userSearchResponse = await fetch(
      `https://api.imvu.com/user?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: buildHeaders(session),
      }
    );

    if (!userSearchResponse.ok) {
      console.error('Erro ao buscar usuário:', userSearchResponse.status);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userData = await userSearchResponse.json();
    console.log('Resposta do usuário:', JSON.stringify(userData).substring(0, 200));

    // Extrair ID do usuário
    let userId = null;
    const userUrl = Object.keys(userData.denormalized || {}).find(key => key.includes('/user/user-'));
    if (userUrl) {
      const match = userUrl.match(/user-(\d+)/);
      if (match) {
        userId = match[1];
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[USER-HISTORY] ID do usuário encontrado: ${userId}`);
    
    // Informações do usuário
    const userInfo = userData.denormalized?.[userUrl];
    let roomHistory: any[] = [];
    let currentRoom = null;
    
    // Buscar current_room do usuário
    console.log('[USER-HISTORY] Verificando current_room do usuário...');
    try {
      const currentRoomUrl = userInfo?.relations?.current_room;
      if (currentRoomUrl && typeof currentRoomUrl === 'string') {
        console.log(`[USER-HISTORY] Current room URL: ${currentRoomUrl}`);
        const roomMatch = currentRoomUrl.match(/room-(.+)/);
        if (roomMatch) {
          const roomId = roomMatch[1];
          const roomResponse = await fetch(
            `https://api.imvu.com/room/room-${roomId}`,
            {
              method: 'GET',
              headers: buildHeaders(session),
            }
          );
          
          if (roomResponse.ok) {
            const roomData = await roomResponse.json();
            const roomInfo = roomData.denormalized?.[`https://api.imvu.com/room/room-${roomId}`];
            
            if (roomInfo?.data) {
              console.log('[USER-HISTORY] Found current room:', roomInfo.data.name);
              currentRoom = {
                id: roomId,
                name: roomInfo.data.name || 'Sala sem nome',
                description: roomInfo.data.description || '',
                privacy: roomInfo.data.privacy || 'public',
              };
              
              // Adicionar também ao histórico
              roomHistory.push({
                id: roomId,
                name: roomInfo.data.name || 'Sala atual',
                description: roomInfo.data.description || '',
                visitedAt: new Date().toISOString(),
                privacy: roomInfo.data.privacy || 'public',
                rating: roomInfo.data.rating || '',
              });
            }
          } else {
            console.log(`[USER-HISTORY] Erro ao buscar current_room: ${roomResponse.status}`);
          }
        }
      } else {
        console.log('[USER-HISTORY] Usuário não está em nenhuma sala no momento');
      }
    } catch (error) {
      console.error('[USER-HISTORY] Erro ao buscar current_room:', error);
    }

    // Buscar histórico de atividades do usuário (apenas se não tiver sala atual)
    if (roomHistory.length === 0) {
      console.log(`[USER-HISTORY] Tentando buscar activity para user-${userId}`);
      const activityResponse = await fetch(
        `https://api.imvu.com/user/user-${userId}/activity?limit=50`,
        {
          method: 'GET',
          headers: buildHeaders(session),
        }
      );

      console.log(`[USER-HISTORY] Activity response status: ${activityResponse.status}`);
      
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        console.log('[USER-HISTORY] Activity data keys:', Object.keys(activityData));
        console.log('[USER-HISTORY] Activity sample:', JSON.stringify(activityData).substring(0, 500));

        // Processar atividades para encontrar visitas a salas
        const activities = activityData.denormalized || {};
        const roomVisits: any[] = [];

        console.log(`[USER-HISTORY] Total activities entries: ${Object.keys(activities).length}`);

        for (const [key, value] of Object.entries(activities)) {
          const activity = value as any;
          
          // Log para debug
          if (activity.relations?.room || activity.data?.room) {
            console.log('[USER-HISTORY] Found room activity:', JSON.stringify(activity).substring(0, 200));
          }
          
          // Verificar múltiplas formas de relacionamento com sala
          let roomUrl = activity.relations?.room || activity.data?.room || activity.data?.current_room;
          
          if (roomUrl && typeof roomUrl === 'string') {
            const roomMatch = roomUrl.match(/room-(.+)/);
            if (roomMatch) {
              console.log(`[USER-HISTORY] Found room: ${roomMatch[1]}`);
              roomVisits.push({
                roomId: roomMatch[1],
                timestamp: activity.data?.created || activity.data?.updated || Date.now(),
              });
            }
          }
        }
        
        console.log(`[USER-HISTORY] Total room visits found: ${roomVisits.length}`);

        // Ordenar por data mais recente e pegar as 5 últimas
        roomVisits.sort((a, b) => b.timestamp - a.timestamp);
        const recentRooms = roomVisits.slice(0, 5);

        // Buscar detalhes de cada sala
        for (const visit of recentRooms) {
          try {
            const roomResponse = await fetch(
              `https://api.imvu.com/room/room-${visit.roomId}`,
              {
                method: 'GET',
                headers: buildHeaders(session),
              }
            );

            if (roomResponse.ok) {
              const roomData = await roomResponse.json();
              const roomInfo = roomData.denormalized?.[`https://api.imvu.com/room/room-${visit.roomId}`];
              
              if (roomInfo?.data) {
                roomHistory.push({
                  id: visit.roomId,
                  name: roomInfo.data.name || 'Sala sem nome',
                  description: roomInfo.data.description || '',
                  visitedAt: new Date(visit.timestamp).toISOString(),
                  privacy: roomInfo.data.privacy || 'public',
                  rating: roomInfo.data.rating || '',
                });
              }
            }
          } catch (error) {
            console.error(`Erro ao buscar detalhes da sala ${visit.roomId}:`, error);
          }
        }
      }
    }

    // Se não encontrou histórico via activities, tentar buscar salas recentes do usuário
    if (roomHistory.length === 0) {
      console.log('[USER-HISTORY] Tentando endpoint recent_rooms...');
      
      const recentRoomsResponse = await fetch(
        `https://api.imvu.com/user/user-${userId}/recent_rooms?limit=5`,
        {
          method: 'GET',
          headers: buildHeaders(session),
        }
      );

      console.log(`[USER-HISTORY] Recent rooms status: ${recentRoomsResponse.status}`);

      if (recentRoomsResponse.ok) {
        const recentRoomsData = await recentRoomsResponse.json();
        console.log('[USER-HISTORY] Recent rooms data:', JSON.stringify(recentRoomsData).substring(0, 500));
        
        const rooms = recentRoomsData.denormalized || {};

        for (const [key, value] of Object.entries(rooms)) {
          if (key.includes('/room/room-')) {
            const room = value as any;
            const roomMatch = key.match(/room-(.+)/);
            
            if (roomMatch && room.data) {
              roomHistory.push({
                id: roomMatch[1],
                name: room.data.name || 'Sala sem nome',
                description: room.data.description || '',
                visitedAt: new Date(room.data.created || room.data.updated || Date.now()).toISOString(),
                privacy: room.data.privacy || 'public',
                rating: room.data.rating || '',
              });
            }
          }
        }
      } else {
        console.error('[USER-HISTORY] Erro ao buscar recent_rooms:', recentRoomsResponse.status);
        const errorText = await recentRoomsResponse.text();
        console.error('[USER-HISTORY] Error details:', errorText.substring(0, 500));
      }
    }
    
    console.log(`[USER-HISTORY] Final room history count: ${roomHistory.length}`);

    // Montar objeto do usuário
    const user = {
      id: userId,
      username: userInfo?.data?.username || username,
      displayName: userInfo?.data?.display_name || username,
      avatarImage: userInfo?.data?.avatar_image || userInfo?.data?.image,
      registered: userInfo?.data?.registered ? new Date(userInfo.data.registered * 1000).toISOString() : undefined,
      online: userInfo?.data?.online,
      currentRoom: currentRoom,
    };

    return new Response(
      JSON.stringify({
        user,
        roomHistory: roomHistory.slice(0, 5),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
