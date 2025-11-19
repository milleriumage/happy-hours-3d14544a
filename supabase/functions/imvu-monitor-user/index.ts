/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const targetUsername = url.searchParams.get("username");
    const sauce = url.searchParams.get("sauce");

    if (!targetUsername || !sauce) {
      return new Response("Username and sauce required", { status: 400 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    let intervalId: number;

    socket.onopen = async () => {
      console.log(`Monitoring user: ${targetUsername}`);
      
      const checkPresence = async () => {
        try {
          const userResponse = await fetch(
            `https://api.imvu.com/user?username=${encodeURIComponent(targetUsername)}`,
            {
              headers: {
                'Authorization': `Bearer ${sauce}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!userResponse.ok) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Failed to fetch user data',
            }));
            return;
          }

          const userData = await userResponse.json();
          const userId = Object.keys(userData.denormalized).find(key => key.includes('/user/user-'))?.split('user-')[1];
          
          if (!userId) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'User not found',
            }));
            return;
          }

          const userInfo = Object.values(userData.denormalized)[0] as any;

          // Get current room from relations.current_room
          let currentRoom = null;
          
          // Extract room ID from the current_room URL in relations
          const currentRoomUrl = userInfo.relations?.current_room;
          console.log('Current room URL:', currentRoomUrl);
          
          if (currentRoomUrl) {
            // Extract room ID from URL like "https://api.imvu.com/room/room-105959787-406"
            const roomIdMatch = currentRoomUrl.match(/room-(.+)$/);
            if (roomIdMatch) {
              const roomId = roomIdMatch[1];
              console.log('Extracted room ID:', roomId);
              
              try {
                const roomResponse = await fetch(
                  `https://api.imvu.com/room/room-${roomId}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${sauce}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );

                if (roomResponse.ok) {
                  const roomData = await roomResponse.json();
                  console.log('Room data:', JSON.stringify(roomData, null, 2));
                  
                  const roomInfo = Object.values(roomData.denormalized).find((item: any) => 
                    item.data?.name
                  ) as any;

                  if (roomInfo) {
                    currentRoom = {
                      id: roomId,
                      name: roomInfo.data.name,
                      privacy: roomInfo.data.privacy,
                      description: roomInfo.data.description,
                    };
                    console.log('Current room set:', currentRoom);
                  }
                } else {
                  console.log('Room response not ok:', roomResponse.status);
                }
              } catch (error) {
                console.error('Error fetching room:', error);
              }
            }
          } else {
            console.log('No current_room found in relations');
          }

          socket.send(JSON.stringify({
            type: 'presence',
            data: {
              username: userInfo.data?.username,
              displayName: userInfo.data?.display_name,
              online: userInfo.data?.online,
              avatarImage: userInfo.data?.avatar_image,
              currentRoom,
              timestamp: new Date().toISOString(),
            },
          }));
          
          console.log('Sent presence update:', { 
            username: userInfo.data?.username, 
            online: userInfo.data?.online,
            currentRoom 
          });

        } catch (error) {
          console.error('Error checking presence:', error);
          socket.send(JSON.stringify({
            type: 'error',
            message: error.message,
          }));
        }
      };

      // Check immediately
      await checkPresence();
      
      // Then check every 30 seconds
      intervalId = setInterval(checkPresence, 30000);
    };

    socket.onclose = () => {
      console.log('Client disconnected');
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return response;

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
