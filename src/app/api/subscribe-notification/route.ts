import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { calculateCurrentPrice } from '@/lib/price-calculator';
import { hashIP } from '@/lib/supabase';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function POST(request: Request) {
  try {
    // Check if the item has already been sold
    const { data: saleStatus, error: saleError } = await supabase
      .from('sale_status')
      .select('is_sold')
      .single();

    if (saleError) throw saleError;
    
    if (saleStatus?.is_sold) {
      return new NextResponse(JSON.stringify({ 
        error: 'The auction has ended. No new price notifications can be created.'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const hashedIP = await hashIP(ip);
    
    try {
      await limiter.check(5, ip); // 5 requests per minute per IP
    } catch {
      return new NextResponse(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { email, targetPrice } = await request.json();

    if (!email || !targetPrice) {
      return new NextResponse(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const lowerEmail = email.toLowerCase();
    
    // Block example.com and test email addresses
    if (lowerEmail.endsWith('@example.com') || lowerEmail.includes('test')) {
      return new NextResponse(JSON.stringify({ 
        error: 'Invalid email address'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Validate target price is greater than 0
    if (targetPrice <= 0) {
      return new NextResponse(JSON.stringify({ 
        error: 'Target price must be greater than 0',
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Validate target price is less than starting price
    const startingPrice = (parseInt(process.env.NEXT_PUBLIC_STARTING_PRICE!) || 2500000) / 100;
    if (targetPrice >= startingPrice) {
      return new NextResponse(JSON.stringify({ 
        error: 'Target price must be less than the starting price',
        startingPrice
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Get current price and validate target price
    const currentPrice = calculateCurrentPrice();
    if (targetPrice >= currentPrice) {
      return new NextResponse(JSON.stringify({ 
        error: 'Target price must be less than the current price',
        currentPrice
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Check if IP has reached the notification limit
    const { data: existingNotifications, error: countError } = await supabase
      .from('email_notifications')
      .select('id')
      .eq('ip_address', hashedIP);

    if (countError) throw countError;

    if (existingNotifications && existingNotifications.length >= 3) {
      return new NextResponse(JSON.stringify({ 
        error: 'You have reached the maximum number of price notifications (3) for your IP address'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { error } = await supabase
      .from('email_notifications')
      .insert([
        {
          email,
          target_price: targetPrice,
          ip_address: hashedIP
        },
      ]);

    if (error) throw error;

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in subscribe-notification:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 