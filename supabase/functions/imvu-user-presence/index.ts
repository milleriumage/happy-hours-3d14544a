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

  try {
    const { username, sauce } = await req.json();

    if (!username || !sauce) {
      return new Response(
        JSON.stringify({ error: 'Username and sauce required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user info with current room
    const userResponse = await fetch(
      `https://api.imvu.com/user?username=${encodeURIComponent(username)}`,
      {
        headers: {
          'Authorization': `Bearer ${sauce}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const userId = Object.keys(userData.denormalized).find(key => key.includes('/user/user-'))?.split('user-')[1];

    if (!userId) {
      throw new Error('User ID not found');
    }

    const userInfo = Object.values(userData.denormalized)[0] as any;

    // Get current room from activity
    let currentRoom = null;
    try {
      const activityResponse = await fetch(
        `https://api.imvu.com/user/user-${userId}/activity?limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${sauce}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        const activities = Object.values(activityData.denormalized).filter((item: any) => 
          item.data?.action === 'visit_room'
        );

        if (activities.length > 0) {
          const latestActivity = activities[0] as any;
          const roomId = latestActivity.data?.room_id;
          
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
                };
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching current room:', err);
    }

    // Get friends list
    let friends = [];
    try {
      const friendsResponse = await fetch(
        `https://api.imvu.com/user/user-${userId}/friends?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${sauce}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        friends = Object.values(friendsData.denormalized)
          .filter((item: any) => item.data?.username)
          .map((item: any) => ({
            username: item.data.username,
            displayName: item.data.display_name,
            online: item.data.online,
            avatarImage: item.data.avatar_image,
          }));
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
    }

    return new Response(
      JSON.stringify({
        user: {
          id: userId,
          username: userInfo.data?.username,
          displayName: userInfo.data?.display_name,
          online: userInfo.data?.online,
          avatarImage: userInfo.data?.avatar_image,
          registered: userInfo.data?.registered,
          country: userInfo.data?.country,
        },
        currentRoom,
        friends,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
