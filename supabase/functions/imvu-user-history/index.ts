/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session, username } = await req.json();

    if (!session?.sauce || !session?.cid) {
      return new Response(
        JSON.stringify({ error: 'Session inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!username) {
      return new Response(
        JSON.stringify({ error: 'Username é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Buscando usuário: ${username}`);

    // Buscar informações do usuário
    const userSearchResponse = await fetch(
      `https://api.imvu.com/user?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.sauce}`,
          'Content-Type': 'application/json',
        },
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

    console.log(`ID do usuário encontrado: ${userId}`);

    // Buscar histórico de atividades do usuário
    const activityResponse = await fetch(
      `https://api.imvu.com/user/user-${userId}/activity?limit=50`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.sauce}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let roomHistory: any[] = [];

    if (activityResponse.ok) {
      const activityData = await activityResponse.json();
      console.log('Atividades encontradas');

      // Processar atividades para encontrar visitas a salas
      const activities = activityData.denormalized || {};
      const roomVisits: any[] = [];

      for (const [key, value] of Object.entries(activities)) {
        const activity = value as any;
        
        // Verificar se é uma atividade relacionada a sala
        if (activity.data?.type === 'room_visit' || activity.relations?.room) {
          const roomUrl = activity.relations?.room;
          if (roomUrl && typeof roomUrl === 'string') {
            const roomMatch = roomUrl.match(/room-(.+)/);
            if (roomMatch) {
              roomVisits.push({
                roomId: roomMatch[1],
                timestamp: activity.data?.created || activity.data?.updated || Date.now(),
              });
            }
          }
        }
      }

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
              headers: {
                'Authorization': `Bearer ${session.sauce}`,
                'Content-Type': 'application/json',
              },
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

    // Se não encontrou histórico via activities, tentar buscar salas recentes do usuário
    if (roomHistory.length === 0) {
      console.log('Tentando buscar salas recentes do usuário...');
      
      const recentRoomsResponse = await fetch(
        `https://api.imvu.com/user/user-${userId}/recent_rooms?limit=5`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.sauce}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (recentRoomsResponse.ok) {
        const recentRoomsData = await recentRoomsResponse.json();
        console.log('Resposta de recent_rooms:', JSON.stringify(recentRoomsData).substring(0, 500));
        
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
        console.error('Erro ao buscar recent_rooms:', recentRoomsResponse.status);
      }
    }

    // Informações do usuário
    const userInfo = userData.denormalized?.[userUrl];
    const user = {
      id: userId,
      username: userInfo?.data?.username || username,
      displayName: userInfo?.data?.display_name || username,
      avatarImage: userInfo?.data?.avatar_image || userInfo?.data?.image,
      registered: userInfo?.data?.registered,
      online: userInfo?.data?.online,
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
