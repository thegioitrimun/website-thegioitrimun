// Add a type declaration for the Deno global object to satisfy TypeScript
// in environments where Deno types are not automatically recognized.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions/get-ghtk-pick-address-detail/index.ts
// Securely fetches detailed information for a specific GHTK pick-up address.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Environment variables from Supabase project settings.
const GHTK_TOKEN = Deno.env.get('GHTK_TOKEN')
const GHTK_API_URL = 'https://services.giaohangtietkiem.vn'

// CORS headers to allow requests from your web app.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Replace with your domain for production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!GHTK_TOKEN) {
      throw new Error('Missing GHTK_TOKEN in Supabase secrets.');
    }
    
    const { pick_address_id } = await req.json();
    if (!pick_address_id) {
        throw new Error("Missing 'pick_address_id' in request body.");
    }

    const fullUrl = `${GHTK_API_URL}/services/shipment/get_pick_addr?pick_address_id=${pick_address_id}`;
    
    // Call the GHTK API to get the address detail.
    const ghtkResponse = await fetch(fullUrl, {
      method: 'GET',
      headers: { 'Token': GHTK_TOKEN }
    });
    
    const ghtkResponseBody = await ghtkResponse.json();

    if (!ghtkResponse.ok || !ghtkResponseBody.success) {
        console.error('GHTK API Error:', ghtkResponseBody);
        throw new Error(ghtkResponseBody.message || 'Failed to fetch pick-up address detail from GHTK.');
    }

    // Return the `data` object which contains the address details.
    return new Response(JSON.stringify(ghtkResponseBody.data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})