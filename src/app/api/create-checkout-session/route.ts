import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

export async function POST(request: Request) {
  try {
    // Check if the item has already been sold
    const { data: saleStatus, error: saleError } = await supabase
      .from('sale_status')
      .select('is_sold')
      .single();

    if (saleError) throw saleError;
    
    // TEMPORARY: Force sold state for local testing
    // Comment this out when not testing
    // if (process.env.NODE_ENV === 'development') {
    //   return NextResponse.json(
    //     { error: 'This item has already been sold' },
    //     { status: 400 }
    //   );
    // }
    
    if (saleStatus?.is_sold) {
      return NextResponse.json(
        { error: 'This item has already been sold' },
        { status: 400 }
      );
    }

    const { price } = await request.json();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ['payment_method'],
          },
        },
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Purchase of Optic',
              description: 'Purchase of withoptic.com app',
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}`,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
} 