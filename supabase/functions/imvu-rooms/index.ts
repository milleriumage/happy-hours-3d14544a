/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session, searchTerm, roomId } = await req.json();

    if (!session || !session.cookies) {
      throw new Error('Não autorizado');
    }

    const { sauce, cookies } = session;
    const headers = {
      'Cookie': cookies,
      'x-imvu-sauce': sauce,
    };

    // Se foi fornecido um ID de sala específico
    if (roomId) {
      console.log('Buscando sala por ID:', roomId);
      try {
        const roomDetailResponse = await fetch(`https://api.imvu.com/room/room-${roomId}`, { headers });
        const roomDetail = await roomDetailResponse.json();
        
        console.log('Resposta da sala:', JSON.stringify(roomDetail).substring(0, 500));
        
        if (roomDetail.denormalized) {
          // Encontrar a chave da sala no denormalized
          const roomKey = Object.keys(roomDetail.denormalized).find(key => key.includes(`room-${roomId}`));
          const roomData = roomKey ? roomDetail.denormalized[roomKey] : Object.values(roomDetail.denormalized).find((item: any) => item.data?.id && item.data.id.toString().includes(roomId));
          
          if (!roomData) {
            console.error('Dados da sala não encontrados no denormalized');
            return new Response(
              JSON.stringify({ message: 'Sala não encontrada', rooms: [] }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const room = {
            id: roomData.data.id || roomId,
            name: roomData.data.name || '',
            capacity: roomData.data.capacity || 0,
            description: roomData.data.description || '',
            currentUsers: roomData.data.current_occupancy || 0,
            privacy: roomData.data.privacy || '',
            rating: roomData.data.rating || '',
            users: [],
            host: null
          };

          console.log('Sala processada:', room.name, 'ID:', room.id);

          // Buscar informações do host
          if (roomData.relations?.creator) {
            const hostId = roomData.relations.creator;
            const hostData = roomDetail.denormalized[hostId];
            if (hostData) {
              room.host = {
                id: hostData.data.id,
                username: hostData.data.legacy_cid || hostData.data.username || 'Host',
                avatarImage: hostData.data.avatar_image || hostData.data.image,
              };
            }
          }

          // Buscar usuários na sala
          if (roomData.relations?.occupants) {
            for (const userId of roomData.relations.occupants) {
              const userData = roomDetail.denormalized[userId];
              if (userData) {
                room.users.push({
                  id: userData.data.id,
                  username: userData.data.legacy_cid || userData.data.username || 'Usuário',
                  avatarImage: userData.data.avatar_image || userData.data.image,
                });
              }
            }
          }

          return new Response(
            JSON.stringify({ rooms: [room] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('Erro ao buscar sala por ID:', e);
      }
    }

    // Busca geral de salas
    let apiUrl = 'https://api.imvu.com/room?limit=50&nsfw=false';
    if (searchTerm && searchTerm.trim()) {
      apiUrl += `&query=${encodeURIComponent(searchTerm.trim())}`;
    }

    console.log('Buscando salas:', apiUrl);

    const roomsResponse = await fetch(apiUrl, { headers });
    const roomsData = await roomsResponse.json();

    console.log('Resposta da API:', JSON.stringify(roomsData).substring(0, 500));

    if (roomsData.status === 'failure') {
      console.error('Falha na busca:', roomsData.message);
      throw new Error(roomsData.message || 'Falha ao buscar salas');
    }

    // Processar as salas
    const rooms = [];
    const roomLinks = roomsData.links || [];
    
    console.log('Total de salas encontradas:', roomLinks.length);

    for (const roomId of roomLinks) {
      const roomResource = roomsData.denormalized[roomId];
      if (roomResource) {
        const room = {
          id: roomResource.data.id,
          name: roomResource.data.name,
          capacity: roomResource.data.capacity || 0,
          description: roomResource.data.description || '',
          privacy: roomResource.data.privacy || '',
          rating: roomResource.data.rating || '',
          currentUsers: 0,
          users: [],
          host: null
        };

        // Buscar detalhes da sala incluindo usuários
        try {
          const roomDetailResponse = await fetch(`https://api.imvu.com/room/room-${roomResource.data.id}`, { headers });
          const roomDetail = await roomDetailResponse.json();
          
          if (roomDetail.denormalized) {
            // Encontrar a chave da sala no denormalized
            const roomKey = Object.keys(roomDetail.denormalized).find(key => key.includes(`room-${roomResource.data.id}`));
            const roomData = roomKey ? roomDetail.denormalized[roomKey] : Object.values(roomDetail.denormalized).find((item: any) => item.data?.id && item.data.id.toString().includes(roomResource.data.id));
            
            if (roomData) {
              room.currentUsers = roomData?.data?.current_occupancy || 0;

              // Buscar informações do host
              if (roomData.relations?.creator) {
                const hostId = roomData.relations.creator;
                const hostData = roomDetail.denormalized[hostId];
                if (hostData) {
                  room.host = {
                    id: hostData.data.id,
                    username: hostData.data.legacy_cid || hostData.data.username || 'Host',
                    avatarImage: hostData.data.avatar_image || hostData.data.image,
                  };
                }
              }

              // Buscar usuários na sala
              if (roomData.relations?.occupants) {
                for (const userId of roomData.relations.occupants) {
                  const userData = roomDetail.denormalized[userId];
                  if (userData) {
                    room.users.push({
                      id: userData.data.id,
                      username: userData.data.legacy_cid || userData.data.username || 'Usuário',
                      avatarImage: userData.data.avatar_image || userData.data.image,
                    });
                  }
                }
                console.log(`Sala ${room.name}: ${room.users.length} usuários encontrados`);
              }
            }
          }
        } catch (e) {
          console.log('Erro ao buscar detalhes da sala:', roomResource.data.id, e);
        }

        rooms.push(room);
      }
    }

    return new Response(
      JSON.stringify({ rooms }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ message: 'Falha ao buscar salas', error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
