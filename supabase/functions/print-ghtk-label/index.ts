
// Add a type declaration for the Deno global object to satisfy TypeScript
// in environments where Deno types are not automatically recognized.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions/print-ghtk-label/index.ts
// Securely fetches a PDF shipping label from GHTK and returns it to the client.

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
    
    // 2. Call the GHTK API to get the print label PDF.
    const ghtkResponse = await fetch(`${GHTK_API_URL}/services/label/${label_id}`, {
      headers: { 'Token': GHTK_TOKEN }
    });

    if (!ghtkResponse.ok) {
        const errorText = await ghtkResponse.text();
        console.error('GHTK Print API Error:', errorText);
        throw new Error('Failed to fetch print label from GHTK.');
    }

    // 3. Get the PDF data as a Blob.
    const pdfBlob = await ghtkResponse.blob();

    // 4. Return the PDF blob with the correct content-type header.
    // This tells the browser to handle it as a PDF file.
    return new Response(pdfBlob, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/pdf' },
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
