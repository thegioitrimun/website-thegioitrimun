// Add a type declaration for the Deno global object to satisfy TypeScript
// in environments where Deno types are not automatically recognized.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions/create-ghtk-order/index.ts
// This function securely creates a shipment order with Giao Hàng Tiết Kiệm (GHTK).

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

    const { order_id } = await req.json()
    if (!order_id) {
      throw new Error("Missing 'order_id' in request body.");
    }

    // Initialize Supabase admin client to bypass RLS for server-side operations.
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Fetch complete order details from the database.
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('product_orders')
      .select('*, order_items:product_order_items(*, product:products(name))')
      .eq('id', order_id)
      .single()

    if (fetchError) throw new Error(`Could not fetch order: ${fetchError.message}`)
    if (!order) throw new Error(`Order with ID ${order_id} not found.`)
    if (!order.shipping_street || !order.shipping_province || !order.shipping_district || !order.shipping_ward) {
        throw new Error('Order is missing structured address fields.');
    }

    // Fetch default GHTK pick address dynamically for robustness.
    const pickAddrResponse = await fetch(`${GHTK_API_URL}/services/shipment/list_pick_addr`, {
      method: 'GET',
      headers: { 'Token': GHTK_TOKEN }
    });
    
    let finalPickAddress;
    const fallbackPickAddress = {
        pick_name: "Thế Giới Trị Mụn",
        pick_address: "106 Lê Đình Thám",
        pick_province: "Thành phố Hồ Chí Minh",
        pick_district: "Quận Tân Phú",
        pick_ward: "Phường Tân Sơn Nhì",
        pick_tel: "0934086843",
    };

    if (pickAddrResponse.ok) {
        const pickAddrBody = await pickAddrResponse.json();
        const defaultPickAddress = pickAddrBody.success ? pickAddrBody.data.find((addr: any) => addr.is_default === 1) : null;
        finalPickAddress = defaultPickAddress || fallbackPickAddress;
    } else {
        console.warn('Could not fetch GHTK pick addresses, using fallback.');
        finalPickAddress = fallbackPickAddress;
    }

    // 2. Sanitize the street address to prevent duplication on the label.
    // This handles cases where users copy-paste the full address into the street field.
    let sanitizedStreet = order.shipping_street;
    const ward = order.shipping_ward;
    const district = order.shipping_district;
    const province = order.shipping_province;

    // Create case-insensitive regex for replacement to remove parts that GHTK will append automatically.
    if (ward) {
        const wardRegex = new RegExp(`,?\\s*${ward.trim().replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")}`, 'gi');
        sanitizedStreet = sanitizedStreet.replace(wardRegex, '');
    }
    if (district) {
        const districtRegex = new RegExp(`,?\\s*${district.trim().replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")}`, 'gi');
        sanitizedStreet = sanitizedStreet.replace(districtRegex, '');
    }
    if (province) {
        const provinceRegex = new RegExp(`,?\\s*${province.trim().replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")}`, 'gi');
        sanitizedStreet = sanitizedStreet.replace(provinceRegex, '');
    }

    // Clean up any trailing/leading commas and multiple commas that might result from replacements.
    sanitizedStreet = sanitizedStreet.replace(/,\s*$/, '').trim().replace(/^,/, '').trim().replace(/,+/g, ',').trim();

    // 3. Prepare the data payload in the format required by GHTK.
    const ghtkOrderData = {
      products: order.order_items.map((item: any) => ({
        name: item.product.name,
        weight: 0.2, // Default weight in kg. It's better to store this in your products table.
        quantity: item.quantity,
      })),
      order: {
        id: order.order_code, // Use your unique order code.
        // --- Use dynamic or fallback pick address ---
        pick_name: finalPickAddress.pick_name,
        pick_address: finalPickAddress.pick_address,
        pick_province: finalPickAddress.pick_province,
        pick_district: finalPickAddress.pick_district,
        pick_ward: finalPickAddress.pick_ward,
        pick_tel: finalPickAddress.pick_tel,
        // --- Customer's Information (Delivery Address) ---
        name: order.customer_name,
        address: sanitizedStreet, // Use the sanitized street address
        province: order.shipping_province,
        district: order.shipping_district,
        ward: order.shipping_ward,
        hamlet: "Khác",
        tel: order.customer_phone,
        note: order.notes || 'Không có ghi chú',
        // --- Order Details ---
        is_freeship: "0", // 0 for customer pays, 1 for shop pays.
        pick_money: order.payment_method === 'bank_transfer'
          ? 0
          : Math.round(order.grand_total || order.total_price), // For COD orders
        value: Math.round(order.grand_total || order.total_price), // Total order value for insurance.
        transport: "road", // 'road' for road transport, 'fly' for air.
      },
    }

    // 4. Call GHTK API to create the shipment.
    const ghtkResponse = await fetch(`${GHTK_API_URL}/services/shipment/order`, {
      method: 'POST',
      headers: { 'Token': GHTK_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(ghtkOrderData),
    })

    const ghtkResponseBody = await ghtkResponse.json();

    if (!ghtkResponse.ok || !ghtkResponseBody.success) {
        console.error('GHTK API Error:', ghtkResponseBody);
        throw new Error(ghtkResponseBody.message || 'Failed to create GHTK shipment.');
    }
    
    const { order: shipment } = ghtkResponseBody;

    // 5. Transition fulfillment state through RPC (state machine + history).
    const { error: transitionError } = await supabaseAdmin.rpc('transition_order_status', {
      p_order_id: order_id,
      p_to_status: 'processing',
      p_note: 'Auto transition when creating GHTK shipment',
    });

    if (transitionError && !String(transitionError.message || '').includes('trạng thái mục tiêu')) {
      throw new Error(`Failed to transition order status: ${transitionError.message}`);
    }

    // 6. Persist shipping identifiers from GHTK.
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('product_orders')
      .update({
        ghtk_label: shipment.label, // This is GHTK's unique shipment ID
        shipping_code: shipment.tracking_id, // This is the customer-facing tracking code
        ghtk_status_text: 'Đã tiếp nhận'
      })
      .eq('id', order_id)
      .select()
      .single()

    if (updateError) throw new Error(`Failed to update order in DB: ${updateError.message}`)

    // 7. Return the successfully updated order to the frontend.
    return new Response(JSON.stringify(updatedOrder), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
