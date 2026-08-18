// Add a type declaration for the Deno global object to satisfy TypeScript
// in environments where Deno types are not automatically recognized.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions/calculate-shipping-fee/index.ts
// This function handles calculating shipping fees securely on the server.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Secrets are automatically injected from your Supabase project settings.
const GHTK_TOKEN = Deno.env.get('GHTK_TOKEN')
const GHTK_API_URL = 'https://services.giaohangtietkiem.vn'

// Standard CORS headers to allow your frontend to call this function.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // For production, replace '*' with your website's domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // This is required to handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!GHTK_TOKEN) {
      throw new Error('GHTK_TOKEN is not configured in Supabase secrets.');
    }

    // 1. Get and validate parameters from the request body.
    const { address, province, district, ward, weight, value } = await req.json()
    if (!address || !province || !district || !ward || !weight) {
        throw new Error('Missing required parameters: address, province, district, ward, and weight must be provided.');
    }
    
    // 2. Dynamically fetch default GHTK pick address.
    const pickAddrResponse = await fetch(`${GHTK_API_URL}/services/shipment/list_pick_addr`, {
      method: 'GET',
      headers: { 'Token': GHTK_TOKEN }
    });
    
    let finalPickAddress;
    // Define a fallback in case the API call fails
    const fallbackPickAddress = {
        pick_province: "Thành phố Hồ Chí Minh",
        pick_district: "Quận Tân Phú",
    };

    if (pickAddrResponse.ok) {
        const pickAddrBody = await pickAddrResponse.json();
        const defaultPickAddress = pickAddrBody.success ? pickAddrBody.data.find((addr: any) => addr.is_default === 1) : null;
        finalPickAddress = defaultPickAddress || fallbackPickAddress;
    } else {
        console.warn('Could not fetch GHTK pick addresses for fee calculation, using fallback.');
        finalPickAddress = fallbackPickAddress;
    }

    // 3. Prepare the parameters for GHTK's API.
    const ghtkParams: { [key: string]: string | number } = {
      pick_province: finalPickAddress.pick_province,
      pick_district: finalPickAddress.pick_district,
      province,
      district,
      ward, // Add ward for accuracy
      address,
      weight, // Must be in grams
      transport: "road",
    }
    
    if (value) {
      ghtkParams.value = value;
    }

    // 4. Construct the full URL with query parameters.
    const queryString = new URLSearchParams(
        Object.entries(ghtkParams).map(([key, val]) => [key, String(val)])
    ).toString();
    const fullGhtkUrl = `${GHTK_API_URL}/services/shipment/fee?${queryString}`
    
    // 5. Call the GHTK API using Deno's built-in fetch.
    const response = await fetch(fullGhtkUrl, {
      method: 'GET',
      headers: { 
        'Token': GHTK_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('GHTK API Error:', errorBody);
      throw new Error(errorBody.message || 'GHTK API request failed');
    }
    
    // 6. Get the JSON data from GHTK's response.
    const data = await response.json()
    
    if (!data.success) {
        console.error('GHTK Fee Calculation Unsuccessful:', data);
        throw new Error(data.message || 'Could not calculate shipping fee.');
    }

    // 7. Return the 'fee' object to the frontend.
    return new Response(JSON.stringify(data.fee), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // If anything goes wrong, return a structured server error.
    console.error('Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400, // Use 400 for client-side errors (like missing params)
    })
  }
})
