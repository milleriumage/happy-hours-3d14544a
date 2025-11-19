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
          let roomUsers = [];
          
          // Log complete relations structure for debugging
          console.log('User relations:', JSON.stringify(userInfo.relations, null, 2));
          console.log('User data:', JSON.stringify(userInfo.data, null, 2));
          
          // Try to get presence data which may contain room info for private rooms
          let presenceRoomUrl = null;
          if (userInfo.relations?.presence) {
            try {
              console.log('Fetching presence data from:', userInfo.relations.presence);
              const presenceResponse = await fetch(userInfo.relations.presence, {
                headers: {
                  'Authorization': `Bearer ${sauce}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (presenceResponse.ok) {
                const presenceData = await presenceResponse.json();
                console.log('Presence data:', JSON.stringify(presenceData, null, 2));
                
                // Try to extract room from presence data
                const presenceInfo = Object.values(presenceData.denormalized)[0] as any;
                if (presenceInfo?.relations?.room) {
                  presenceRoomUrl = presenceInfo.relations.room;
                  console.log('Found room in presence:', presenceRoomUrl);
                }
              }
            } catch (error) {
              console.error('Error fetching presence:', error);
            }
          }
          
          // Try multiple ways to find the current room
          const currentRoomUrl = userInfo.relations?.current_room || presenceRoomUrl;
          console.log('Current room URL (from relations or presence):', currentRoomUrl);
          
          if (currentRoomUrl) {
            // Extract room ID from URL like "https://api.imvu.com/room/room-105959787-406"
            const roomIdMatch = currentRoomUrl.match(/room-(.+)$/);
            if (roomIdMatch) {
              const roomId = roomIdMatch[1];
              console.log('Found room ID from relations:', roomId);
              
              try {
                // Fetch room details
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
                  console.log('Full room data:', JSON.stringify(roomData, null, 2));
                  
                  const roomInfo = Object.values(roomData.denormalized).find((item: any) => 
                    item.data?.name
                  ) as any;

                  if (roomInfo) {
                    currentRoom = {
                      id: roomId,
                      name: roomInfo.data.name,
                      privacy: roomInfo.data.privacy,
                      description: roomInfo.data.description,
                      type: roomInfo.data.type,
                      occupancy: roomInfo.data.occupancy,
                      capacity: roomInfo.data.capacity,
                    };
                    console.log('Room found (privacy: ' + roomInfo.data.privacy + '):', currentRoom);

                    // Try to fetch users from scene endpoint (more reliable for getting occupants)
                    try {
                      const sceneUrl = roomInfo.relations?.scene;
                      if (sceneUrl) {
                        console.log('Fetching scene data from:', sceneUrl);
                        const sceneResponse = await fetch(sceneUrl, {
                          headers: {
                            'Authorization': `Bearer ${sauce}`,
                            'Content-Type': 'application/json',
                          },
                        });

                        if (sceneResponse.ok) {
                          const sceneData = await sceneResponse.json();
                          console.log('Scene data received:', JSON.stringify(sceneData, null, 2));
                          
                          // Extract users from scene data
                          if (sceneData.denormalized) {
                            Object.values(sceneData.denormalized).forEach((item: any) => {
                              // Look for avatars array which contains users in the room
                              if (item.data?.avatars && Array.isArray(item.data.avatars)) {
                                // Extract usernames from avatar data
                                const usernames = item.data.avatars
                                  .map((avatar: any) => avatar.username || avatar.name)
                                  .filter((name: string) => name);
                                roomUsers = usernames;
                                console.log('Found users from avatars:', roomUsers);
                              }
                              
                              // Also check for occupants in different formats
                              if (item.data?.occupants && Array.isArray(item.data.occupants)) {
                                roomUsers = item.data.occupants;
                                console.log('Found users from occupants:', roomUsers);
                              }
                            });
                          }
                        } else {
                          console.log('Scene fetch returned status:', sceneResponse.status);
                        }
                      }
                    } catch (sceneError) {
                      console.error('Error fetching scene data:', sceneError);
                    }
                    
                    console.log('Final roomUsers array:', roomUsers);
                  }
                } else {
                  const errorText = await roomResponse.text();
                  console.log('Room fetch failed with status:', roomResponse.status, 'Error:', errorText);
                }
              } catch (error) {
                console.error('Error fetching room:', error);
              }
            }
          } else {
            console.log('No current_room in relations');
          }

          socket.send(JSON.stringify({
            type: 'presence',
            data: {
              username: userInfo.data?.username,
              displayName: userInfo.data?.display_name,
              online: userInfo.data?.online || false,
              avatarImage: userInfo.data?.avatar_image,
              currentRoom,
              roomUsers,
              timestamp: new Date().toISOString(),
            },
          }));
          
          console.log('Sent presence update:', { 
            username: userInfo.data?.username, 
            online: userInfo.data?.online,
            currentRoom: currentRoom ? currentRoom.name : null,
            roomUsersCount: roomUsers.length
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
