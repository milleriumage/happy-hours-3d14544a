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

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const roomId = url.searchParams.get("roomId");
    const username = Deno.env.get('IMVU_BOT_USERNAME');
    const password = Deno.env.get('IMVU_BOT_PASSWORD');

    if (!roomId) {
      return new Response("Room ID required", { status: 400 });
    }

    if (!username || !password) {
      return new Response("Bot credentials not configured", { status: 500 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = async () => {
      console.log(`WebSocket opened for room ${roomId}`);
      
      try {
        // Call the imvu-login function to get authenticated session
        console.log('Calling imvu-login function...');
        const loginResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/imvu-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            username,
            password,
          }),
        });

        if (!loginResponse.ok) {
          const errorText = await loginResponse.text();
          console.error('Login failed:', loginResponse.status, errorText);
          throw new Error(`Login failed: ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        console.log('Login successful, user:', loginData.user?.username);
        
        const sauce = loginData.session.sauce;
        const userId = loginData.session.cid;
        
        console.log(`Authenticated as user ${userId}`);

        // Connect to IMQ WebSocket
        console.log('Connecting to IMQ...');
        const imqSocket = new WebSocket('wss://imq.imvu.com:444/streaming/imvu_pre');
        let isAuthenticated = false;

        imqSocket.onopen = () => {
          console.log('IMQ WebSocket connected, authenticating...');
          // Send authentication message in the format IMQ expects
          const authMessage = JSON.stringify({
            type: 'msg_c2g_connect',
            data: {
              user_id: userId.toString(),
              cookie: sauce,
              metadata: {},
            },
          });
          console.log('Sending auth message:', authMessage.substring(0, 100));
          imqSocket.send(authMessage);
        };

        imqSocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string);
            console.log('IMQ message type:', message.type);

            if (!isAuthenticated && message.type === 'msg_g2c_result') {
              if (!message.data?.error) {
                console.log('IMQ authenticated successfully');
                isAuthenticated = true;
                
                // Open floodgates
                imqSocket.send(JSON.stringify({
                  type: 'msg_c2g_open_floodgates',
                  data: {},
                }));

                // Subscribe to room queue
                const queueName = `room-${roomId}`;
                console.log(`Subscribing to queue: ${queueName}`);
                imqSocket.send(JSON.stringify({
                  type: 'msg_c2g_subscribe',
                  data: [queueName],
                }));

                socket.send(JSON.stringify({
                  type: 'connected',
                  roomId: roomId,
                }));
              } else {
                console.error('IMQ authentication failed:', message.data.error);
                socket.send(JSON.stringify({
                  type: 'error',
                  message: 'IMQ authentication failed',
                }));
                socket.close();
              }
            } else if (message.type === 'msg_g2c_recv_message') {
              // Forward chat message to client
              console.log('Chat message received');
              socket.send(JSON.stringify({
                type: 'message',
                data: message.data,
              }));
            } else if (message.type === 'msg_g2c_state_change') {
              // Forward state change to client
              console.log('State change received');
              socket.send(JSON.stringify({
                type: 'state',
                data: message.data,
              }));
            }
          } catch (error) {
            console.error('Error processing IMQ message:', error);
          }
        };

        imqSocket.onerror = (error) => {
          console.error('IMQ WebSocket error:', error);
          socket.send(JSON.stringify({
            type: 'error',
            message: 'IMQ connection error',
          }));
        };

        imqSocket.onclose = () => {
          console.log('IMQ WebSocket closed');
          socket.close();
        };

        // Handle client socket close
        socket.onclose = () => {
          console.log('Client disconnected, closing IMQ connection');
          imqSocket.close();
        };

      } catch (error) {
        console.error('Error connecting to room:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: error.message,
        }));
        socket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
    };

    return response;
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
