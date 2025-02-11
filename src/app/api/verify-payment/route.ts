import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    // Verify the session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Mark the item as sold in Supabase
      const { error: updateError } = await supabase
        .from('sale_status')
        .update({ 
          is_sold: true,
          sold_at: new Date().toISOString(),
          sale_price: session.amount_total
        })
        .eq('id', 1);

      if (updateError) {
        console.error('Error updating sale status:', updateError);
        throw new Error('Failed to mark item as sold');
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Payment not completed' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Error verifying payment' },
      { status: 500 }
    );
  }
} 