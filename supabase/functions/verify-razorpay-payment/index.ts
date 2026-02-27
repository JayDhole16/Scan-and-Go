import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

interface VerifyPaymentRequest {
  payment_id: string;
  order_id?: string;
  signature?: string;
  cart_id: string;
}

async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const message = `${orderId}|${paymentId}`;
    const keyData = encoder.encode(keySecret);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const hashArray = Array.from(new Uint8Array(signatureBuf));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex === signature;
  } catch (err) {
    console.error('Error computing HMAC:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = (await req.json()) as VerifyPaymentRequest;

    if (!body.payment_id || !body.cart_id) {
      return new Response(
        JSON.stringify({ error: "payment_id and cart_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const authHeader = "Basic " + btoa(`${keyId}:${razorpayKeySecret}`);

    // Fetch payment
    const res = await fetch(`https://api.razorpay.com/v1/payments/${body.payment_id}`, {
      headers: { Authorization: authHeader },
    });

    const paymentData = await res.json();

    if (!res.ok) {
      console.error("Razorpay fetch failed:", paymentData);
      return new Response(JSON.stringify({ error: "Payment verification failed", details: paymentData }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    console.log(`Payment ${body.payment_id} status: ${paymentData.status}`);

    // Signature check (if using orders)
    if (body.order_id && body.signature) {
      const valid = await verifySignature(body.order_id, body.payment_id, body.signature, razorpayKeySecret!);
      if (!valid) return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // === WITH AUTO-CAPTURE ENABLED, accept both states ===
    if (paymentData.status !== "captured" && paymentData.status !== "authorized") {
      console.error("Payment not in final state:", paymentData.status);
      return new Response(
        JSON.stringify({ error: "Payment not captured", status: paymentData.status }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    console.log(`✅ Payment ${body.payment_id} ready (status: ${paymentData.status})`);

    // === Your business logic (unchanged) ===
    const { data: cart } = await supabase
      .from("carts")
      .select("id, user_id, store_id")
      .eq("id", body.cart_id)
      .single();

    if (!cart) return new Response(JSON.stringify({ error: "Cart not found" }), { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

    const { data: cartItems } = await supabase
      .from("cart_items")
      .select("product_id")
      .eq("cart_id", body.cart_id);

    const productIds = cartItems?.map(i => i.product_id) || [];

    await supabase.from("products").update({ is_paid: true }).in("id", productIds);
    await supabase.from("carts").update({ is_active: false }).eq("id", body.cart_id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: body.payment_id,
        cart_id: body.cart_id,
        status: paymentData.status,   // "captured" or "authorized"
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});