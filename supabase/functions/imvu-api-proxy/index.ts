/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { session, action, productId, username, userId } = await req.json();

    if (!session?.sauce) {
      return new Response(
        JSON.stringify({ error: 'Sessão inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[IMVU-API-PROXY] Action: ${action}`);

    // Buscar produto
    if (action === 'getProduct' && productId) {
      const response = await fetch(
        `https://api.imvu.com/product/product-${productId}`,
        { headers: buildHeaders(session) }
      );

      if (!response.ok) {
        console.error(`[IMVU-API-PROXY] Product fetch error: ${response.status}`);
        return new Response(
          JSON.stringify({ error: 'Produto não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const product = Object.values(data.denormalized || {}).find((item: any) => 
        item.data?.name || item.data?.product_name
      ) as any;

      return new Response(
        JSON.stringify({ product: product?.data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar usuário por username
    if (action === 'getUser' && username) {
      const response = await fetch(
        `https://api.imvu.com/user?username=${encodeURIComponent(username)}`,
        { headers: buildHeaders(session) }
      );

      if (!response.ok) {
        console.error(`[IMVU-API-PROXY] User fetch error: ${response.status}`);
        return new Response(
          JSON.stringify({ error: 'Usuário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const user = Object.values(data.denormalized || {})[0] as any;

      return new Response(
        JSON.stringify({ user: user?.data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar outfit do usuário
    if (action === 'getOutfit' && userId) {
      const response = await fetch(
        `https://api.imvu.com/user/user-${userId}/outfit`,
        { headers: buildHeaders(session) }
      );

      if (!response.ok) {
        console.error(`[IMVU-API-PROXY] Outfit fetch error: ${response.status}`);
        return new Response(
          JSON.stringify({ error: 'Outfit não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const outfit = Object.values(data.denormalized || {}).filter((item: any) => 
        item.data?.product_id
      ).map((item: any) => item.data);

      return new Response(
        JSON.stringify({ outfit }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[IMVU-API-PROXY] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
