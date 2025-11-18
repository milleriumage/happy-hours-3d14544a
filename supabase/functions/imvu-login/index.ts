/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error('Usuário e senha são obrigatórios');
    }

    // Login direto na API do IMVU
    const loginResponse = await fetch('https://api.imvu.com/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gdpr_cookie_acceptance: true,
        username,
        password,
        remember_device: true,
      }),
    });

    const loginData = await loginResponse.json();

    if (loginData.status === 'failure') {
      throw new Error(loginData.message || 'Falha no login');
    }

    // Buscar informações do usuário autenticado
    const cookies = loginResponse.headers.get('set-cookie') || '';
    const meResponse = await fetch('https://api.imvu.com/login/me', {
      headers: {
        'Cookie': cookies,
      },
    });

    const meData = await meResponse.json();
    const resource = meData.denormalized[meData.id];
    const sauce = resource.data.sauce;
    const cid = parseInt(resource?.relations?.quick_chat_profile ?? '0', 10);

    // Buscar dados do usuário
    const userResponse = await fetch(`https://api.imvu.com/user/user-${cid}`, {
      headers: {
        'Cookie': cookies,
      },
    });

    const userData = await userResponse.json();
    const userResource = userData.denormalized[userData.id];

    return new Response(
      JSON.stringify({
        user: {
          id: userResource.data.id,
          username: userResource.data.username,
          avatarImage: userResource.data.avatar_image || '',
        },
        session: {
          sauce,
          cid,
          cookies,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ message: error.message || 'Falha no login' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
