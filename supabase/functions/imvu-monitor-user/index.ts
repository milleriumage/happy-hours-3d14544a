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

          // Get current activity
          const activityResponse = await fetch(
            `https://api.imvu.com/user/user-${userId}/activity?limit=5`,
            {
              headers: {
                'Authorization': `Bearer ${sauce}`,
                'Content-Type': 'application/json',
              },
            }
          );

          let currentRoom = null;
          if (activityResponse.ok) {
            const activityData = await activityResponse.json();
            const roomVisits = Object.values(activityData.denormalized).filter((item: any) => 
              item.data?.action === 'visit_room'
            );

            if (roomVisits.length > 0) {
              const latestVisit = roomVisits[0] as any;
              const roomId = latestVisit.data?.room_id;
              
              if (roomId) {
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
                  }
                }
              }
            }
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
