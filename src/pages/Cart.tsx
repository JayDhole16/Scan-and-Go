import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  ShoppingCart, 
  Trash2, 
  CreditCard, 
  Store, 
  Package,
  ArrowLeft,
  ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function Cart() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const { cart, totalAmount, itemCount, removeFromCart, loading: cartLoading } = useCart();
  const [storeName, setStoreName] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (!authLoading && role !== 'user') {
      navigate('/');
      return;
    }
  }, [user, role, authLoading, navigate]);

  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    
    script.onload = () => {
      console.log('Razorpay script loaded successfully');
    };
    
    script.onerror = () => {
      console.error('Failed to load Razorpay script');
      toast.error('Failed to load payment system. Please refresh the page.');
    };
    
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    const fetchStoreName = async () => {
      if (cart?.store_id) {
        const { data } = await supabase
          .from('stores')
          .select('name')
          .eq('id', cart.store_id)
          .single();
        
        if (data) {
          setStoreName(data.name);
        }
      }
    };

    fetchStoreName();
  }, [cart?.store_id]);

  const finalizeSuccessfulPayment = async (
    paymentId: string,
    orderId?: string,
    signature?: string
  ) => {
    if (!cart || !user) return;

    try {
      // Call backend function to verify payment and update database
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/verify-razorpay-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // we send both headers just like the create-order call;
            // the anon key acts as a public JWT so the runtime accepts it.
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            payment_id: paymentId,
            order_id: orderId,
            signature: signature,
            cart_id: cart.id,
          }),
        }
      );

      const verifyData = await response.json();

      if (!response.ok) {
        console.error('Payment verification failed:', verifyData);
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      const productIds = cart.items.map(item => item.product_id);
      const productNames = cart.items.map(item => item.product.name);
      
      // Calculate total with 2% GST
      const totalWithTax = totalAmount * 1.02;

      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          store_id: cart.store_id,
          cart_id: cart.id,
          product_ids: productIds,
          product_names: productNames,
          total_amount: totalWithTax,
          payment_status: 'completed',
          payment_id: paymentId,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      navigate('/payment-success', {
        state: {
          transaction,
          productNames,
          storeName,
        },
      });
    } catch (error) {
      console.error('Error in finalizeSuccessfulPayment:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    console.log('=== PAYMENT FLOW START ===');
    console.log('Razorpay window object:', !!window.Razorpay);

    if (!window.Razorpay) {
      console.error('Razorpay not loaded. Script may not have loaded yet.');
      toast.error('Payment system is not ready yet. Please try again in a moment.');
      return;
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
    console.log('Razorpay Key available:', !!razorpayKey);
    console.log('Razorpay Key ID:', razorpayKey?.substring(0, 15) + '...' || 'NOT SET');
    
    if (!razorpayKey) {
      console.error('VITE_RAZORPAY_KEY_ID is not set in .env');
      toast.error('Razorpay key is not configured. Please set VITE_RAZORPAY_KEY_ID in your .env file.');
      setIsProcessingPayment(false);
      return;
    }
    
    // Check if key looks valid (should start with rzp_test_ or rzp_live_)
    if (!razorpayKey.startsWith('rzp_')) {
      console.error('Invalid Razorpay key format. Key should start with "rzp_"');
      toast.error('Invalid Razorpay configuration. Please check your key.');
      setIsProcessingPayment(false);
      return;
    }
    if (!razorpayKey) {
      console.error('VITE_RAZORPAY_KEY_ID is not set');
      toast.error('Razorpay key is not configured. Please set VITE_RAZORPAY_KEY_ID in your .env');
      return;
    }

    setIsProcessingPayment(true);

    try {
      const totalWithTax = totalAmount * 1.02;
      const amountInPaise = Math.round(totalWithTax * 100);

      console.log('Creating order with amount:', amountInPaise, 'paise');
      
      // Create order on backend
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;   // ← Make sure this is in your .env

      // When calling a Supabase Edge Function from the browser, you must send
      // both the `apikey` header and an `Authorization: Bearer <anon key>`
      // header. The latter is treated as the JWT by the runtime; since we're
      // not using a real user token here we just reuse the anon key.
      const createRes = await fetch(`${supabaseUrl}/functions/v1/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: cart.id,
        }),
    });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        // log full error object for debugging
        console.error('create order response not ok', err);
        // prefer a human-readable string if available
        let message = 'Failed to create Razorpay order';
        if (err.error) {
          if (typeof err.error === 'string') {
            message = err.error;
          } else {
            // sometimes Razorpay embeds details inside an object
            message = JSON.stringify(err.error);
          }
        } else if (err.message) {
          message = err.message;
        }
        throw new Error(message);
      }

      const order = await createRes.json();
      console.log('Using order from backend:', order.id);

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'Scan & Go',
        description: 'Store purchase',
        prefill: {
          email: user?.email ?? '',
        },
        notes: {
          cart_id: cart.id,
          store_id: cart.store_id,
          user_id: user?.id ?? '',
        },
        handler: async (response: any) => {
          console.log('Payment successful:', response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
          try {
            await finalizeSuccessfulPayment(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
          } catch (error) {
            console.error('Error finalizing payment:', error);
            toast.error('Payment succeeded but finalization failed. Please contact support.');
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal dismissed');
            setIsProcessingPayment(false);
          },
        },
      };

      console.log('Opening Razorpay with key:', razorpayKey.substring(0, 10) + '...');
      console.log('Payment options:', {
        amount: options.amount,
        currency: options.currency,
        order_id: options.order_id,
        email: options.prefill.email,
      });
      
      const rzp = new window.Razorpay(options);
      console.log('Razorpay instance created');
      
      rzp.on('payment.failed', (error: any) => {
        console.error('Payment failed event:', error);
        toast.error(`Payment failed: ${error.error?.description || 'Unknown error'}`);
        setIsProcessingPayment(false);
      });
      
      console.log('Opening Razorpay modal...');
      rzp.open();
      console.log('Razorpay modal opened');
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessingPayment(false);
    }
  };

  if (authLoading || cartLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Your Cart</h1>
          {storeName && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Store className="w-3 h-3" />
              <span>{storeName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      {!cart || cart.items.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground text-center mb-6">
              Start scanning products to add them to your cart
            </p>
            <Button onClick={() => navigate('/scan')}>
              Start Scanning
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5" />
                {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.items.map((item, index) => (
                <div key={item.id}>
                  <div className="flex items-center gap-4 cart-item p-2 -mx-2 rounded-lg">
                    <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      {item.product.image_url ? (
                        <img 
                          src={item.product.image_url} 
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{item.product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-display font-semibold text-lg">
                        ₹{(item.product.price * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {index < cart.items.length - 1 && <Separator className="my-3" />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (GST)</span>
                <span>₹{(totalAmount * 0.02).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-display font-bold text-xl">
                <span>Total</span>
                <span className="text-primary">₹{(totalAmount * 1.02).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Button */}
          <div className="fixed bottom-24 left-0 right-0 px-4">
            <Button
              className="w-full max-w-md mx-auto flex items-center justify-center gap-2 glow-button bg-primary hover:bg-primary/90 h-14 text-lg"
              onClick={handlePayment}
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay ₹{(totalAmount * 1.02).toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
