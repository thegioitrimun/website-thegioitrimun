// Add a type declaration for the Deno global object to satisfy TypeScript
// in environments where Deno types are not automatically recognized.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions/track-ghtk-order/index.ts
// Securely fetches real-time tracking information for a GHTK order.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables/secrets from Supabase project settings.
const GHTK_TOKEN = Deno.env.get('GHTK_TOKEN')
const GHTK_API_URL = 'https://services.giaohangtietkiem.vn'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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
     if (!GHTK_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables in Supabase secrets.');
    }

    const { order_id } = await req.json();
    if (!order_id) {
        throw new Error("Missing 'order_id' in request body.");
    }
    
    // Initialize Supabase admin client.
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Get the GHTK label from your database using the order ID.
    const { data: order, error } = await supabaseAdmin
        .from('product_orders')
        .select('ghtk_label')
        .eq('id', order_id)
        .single();

    if (error || !order || !order.ghtk_label) {
        throw new Error('Không tìm thấy thông tin vận đơn cho đơn hàng này.');
    }
    
    // 2. Call the GHTK API with the label to get the order status.
    const response = await fetch(`${GHTK_API_URL}/services/shipment/v2/${order.ghtk_label}`, {
      headers: { 'Token': GHTK_TOKEN }
    });
    
    if (!response.ok) {
        const errorBody = await response.json();
        console.error('GHTK Tracking API Error:', errorBody);
        throw new Error('Failed to fetch tracking status from GHTK.');
    }

    const data = await response.json();

    // 3. Format the response from GHTK into a clean timeline for the frontend.
    // The tracking history is in the `log` array of the `order` object.
    const trackingHistory = data.order.log?.map((log: any) => ({
        status: log.status_text,
        timestamp: log.created,
        location: log.address || 'N/A'
    })) || [];
    
    // 4. (Optional but recommended) Update the latest status text in your own database.
    const latestStatus = data.order.status_text;
    if (latestStatus) {
        await supabaseAdmin
            .from('product_orders')
            .update({ ghtk_status_text: latestStatus })
            .eq('id', order_id);
    }
    
    // 5. Send the formatted timeline back to the frontend.
    return new Response(JSON.stringify(trackingHistory), {
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