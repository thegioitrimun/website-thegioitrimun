// Add a type declaration for the Deno global object to satisfy TypeScript
// in environments where Deno types are not automatically recognized.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions/ghtk-webhook/index.ts
// Handles real-time order status updates from GHTK.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables from Supabase project settings.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// A secret token you create and provide to GHTK for webhook authentication.
const GHTK_WEBHOOK_TOKEN = Deno.env.get('GHTK_WEBHOOK_TOKEN')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Maps GHTK status IDs to fulfillment states.
const statusMap: { [key: string]: 'processing' | 'shipped' | 'completed' | 'cancelled' } = {
  '-1': 'cancelled', // Hủy đơn hàng
  '2': 'processing', // Đã tiếp nhận
  '3': 'processing', // Đã lấy hàng/Đã nhập kho
  '123': 'processing',// Shipper đã lấy hàng
  '4': 'shipped',    // Đang giao hàng
  '5': 'completed',  // Đã giao hàng/Chưa đối soát
  '6': 'completed',  // Đã đối soát
  '45': 'completed', // Shipper đã giao hàng
  '12': 'cancelled', // Đã trả hàng (full)
  '21': 'cancelled', // Đã trả hàng (cod-failed)
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. Security Check: Verify the token from the query parameter.
    const url = new URL(req.url);
    const providedToken = url.searchParams.get('token');
    
    if (!GHTK_WEBHOOK_TOKEN || providedToken !== GHTK_WEBHOOK_TOKEN) {
      console.error('Unauthorized webhook attempt.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase environment variables.');
    }

    // 2. Parse the incoming GHTK payload.
    const payload = await req.json();
    const { label_id, status_id, status_text } = payload;
    
    if (!label_id || !status_id) {
        throw new Error('Invalid webhook payload. Missing label_id or status_id.');
    }
    
    // 3. Initialize Supabase Admin Client.
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // 4. Update carrier status text and resolve matching order IDs.
    const { data: matchedOrders, error: updateError } = await supabaseAdmin
      .from('product_orders')
      .update({
        ghtk_status_text: status_text || 'Trạng thái không xác định'
      })
      .eq('ghtk_label', label_id)
      .select('id');

    if (updateError) {
        throw new Error(`Failed to update order for GHTK label ${label_id}: ${updateError.message}`);
    }

    // 5. Transition fulfillment state through the state machine when possible.
    const newStatus = statusMap[String(status_id)];
    if (newStatus && Array.isArray(matchedOrders) && matchedOrders.length > 0) {
      for (const matchedOrder of matchedOrders) {
        const { error: transitionError } = await supabaseAdmin.rpc('transition_order_status', {
          p_order_id: matchedOrder.id,
          p_to_status: newStatus,
          p_note: `GHTK webhook status ${status_id}: ${status_text || 'N/A'}`,
        });

        // Webhooks may arrive out-of-order; keep the endpoint resilient.
        const transitionMessage = String(transitionError?.message || '');
        if (
          transitionError &&
          !transitionMessage.includes('trạng thái mục tiêu') &&
          !transitionMessage.includes('Không thể chuyển trạng thái')
        ) {
          throw new Error(`Failed to transition order ${matchedOrder.id}: ${transitionError.message}`);
        }
      }
    }

    // 6. Respond to GHTK to acknowledge receipt.
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('GHTK Webhook Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
