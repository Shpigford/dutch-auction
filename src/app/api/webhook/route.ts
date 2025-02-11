import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  try {
    if (!sig) throw new Error('No Stripe signature found');
    
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
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
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
} 