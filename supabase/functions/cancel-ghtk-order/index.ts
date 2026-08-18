// Add a type declaration for the Deno global object to satisfy TypeScript
// in environments where Deno types are not automatically recognized.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions/cancel-ghtk-order/index.ts
// Securely cancels a GHTK shipment order.

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

    // 1. Get the GHTK label ID from your database.
    const { data: order, error } = await supabaseAdmin
        .from('product_orders')
        .select('ghtk_label')
        .eq('id', order_id)
        .single();

    if (error || !order || !order.ghtk_label) {
        throw new Error(`Order or GHTK label not found for ID: ${order_id}`);
    }
    
    const label_id = order.ghtk_label;
    
    // 2. Call the GHTK API to cancel the shipment.
    const ghtkResponse = await fetch(`${GHTK_API_URL}/services/shipment/cancel/${label_id}`, {
      method: 'POST',
      headers: { 'Token': GHTK_TOKEN }
    });

    const ghtkResponseBody = await ghtkResponse.json();

    if (!ghtkResponse.ok || !ghtkResponseBody.success) {
        console.error('GHTK Cancel API Error:', ghtkResponseBody);
        throw new Error(ghtkResponseBody.message || 'Failed to cancel GHTK shipment.');
    }

    // 3. Transition fulfillment state through RPC (state machine + history).
    const { error: transitionError } = await supabaseAdmin.rpc('transition_order_status', {
      p_order_id: order_id,
      p_to_status: 'cancelled',
      p_note: 'Auto transition when cancelling GHTK shipment',
    });

    if (transitionError && !String(transitionError.message || '').includes('trạng thái mục tiêu')) {
      throw new Error(`Failed to transition order status: ${transitionError.message}`);
    }

    // 4. Update shipping-related fields after carrier cancellation.
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('product_orders')
      .update({
        ghtk_label: null,
        shipping_code: null,
        ghtk_status_text: 'Đã hủy vận đơn GHTK'
      })
      .eq('id', order_id)
      .select()
      .single();
    
    if (updateError) {
        // Log the error but still return success as the GHTK order was cancelled.
        console.error(`Failed to update order in DB after cancellation: ${updateError.message}`);
        // Return a manually constructed object if DB update fails
        return new Response(JSON.stringify({ ...order, fulfillment_status: 'cancelled', status: 'cancelled' }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // 5. Return the updated order details to the frontend.
    return new Response(JSON.stringify(updatedOrder), {
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
