import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  // Optional but nice for caching preflight
  "Access-Control-Max-Age": "86400",
};

interface CreateOrderRequest {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, unknown>;
}

serve(async (req) => {
  // ── CORS Preflight ── (must be first)
  if (req.method === "OPTIONS") {
    return new Response(null, {   // 204 is standard for preflight
      status: 204,
      headers: corsHeaders,
    });
  }

  // ── Only allow POST ──
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = (await req.json()) as CreateOrderRequest;

    if (!body.amount || typeof body.amount !== "number" || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Valid amount is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const currency = body.currency || "INR";

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!keyId || !keySecret) {
      console.error("Razorpay env vars missing");
      return new Response(
        JSON.stringify({ error: "Razorpay is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = "Basic " + btoa(`${keyId}:${keySecret}`);

    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        // `body.amount` is already expressed in paise from the frontend, so
        // we should send it directly. The earlier version multiplied by 100
        // again which caused excessively large amounts and resulted in a
        // 400 response from Razorpay.
        amount: body.amount,
        currency,
        receipt: body.receipt,
        notes: body.notes,
      }),
    });

    const data = await razorpayRes.json();

    return new Response(JSON.stringify(data), {
      status: razorpayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating Razorpay order", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});