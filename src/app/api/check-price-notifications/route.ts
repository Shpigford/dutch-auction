import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerClient } from 'postmark';
import { parseISO } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify Postmark API key exists
if (!process.env.POSTMARK_API_KEY) {
  throw new Error('POSTMARK_API_KEY environment variable is required');
}

const postmark = new ServerClient(process.env.POSTMARK_API_KEY);

// Get auction settings from environment variables
const AUCTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const STARTING_PRICE = parseInt(process.env.NEXT_PUBLIC_STARTING_PRICE!) || 2500000;
const FINAL_PRICE = parseInt(process.env.NEXT_PUBLIC_FINAL_PRICE!) || 100;

// Ensure we have required environment variables
if (!process.env.NEXT_PUBLIC_START_DATE) {
  throw new Error('NEXT_PUBLIC_START_DATE environment variable is required');
}
if (!process.env.NEXT_PUBLIC_STARTING_PRICE) {
  throw new Error('NEXT_PUBLIC_STARTING_PRICE environment variable is required');
}
if (!process.env.NEXT_PUBLIC_FINAL_PRICE) {
  throw new Error('NEXT_PUBLIC_FINAL_PRICE environment variable is required');
}

// Parse the start date
const START_DATE = parseISO(process.env.NEXT_PUBLIC_START_DATE);

export async function GET(request: Request) {
  console.log('🔔 Starting price notification check...');
  
  try {
    // Verify the request is authorized
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ Unauthorized request attempt');
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate current price
    const now = Date.now();
    const startTime = START_DATE.getTime();
    const hasStarted = now >= startTime;
    
    let currentPrice = STARTING_PRICE;
    
    if (hasStarted) {
      const timeElapsed = now - startTime;
      const progress = Math.min(timeElapsed / AUCTION_DURATION_MS, 1);
      const priceRange = STARTING_PRICE - FINAL_PRICE;
      currentPrice = Math.max(
        Math.round(STARTING_PRICE - (priceRange * progress)),
        FINAL_PRICE
      );
    }

    console.log(`💰 Current price: $${(currentPrice / 100).toFixed(2)}`);

    // Get all unnotified subscriptions that match the criteria
    const { data: notifications, error: notifyError } = await supabase
      .from('email_notifications')
      .select('*')
      .eq('notified', false)
      .gte('target_price', Math.floor(currentPrice / 100)); // Convert currentPrice to whole dollars for comparison

    if (notifyError) {
      console.error('❌ Error fetching notifications:', notifyError);
      throw notifyError;
    }

    console.log(`📧 Found ${notifications?.length || 0} notifications to process (current price: $${(currentPrice / 100).toFixed(2)})`);

    // Send emails to all matching subscribers
    const results = [];
    for (const notification of notifications || []) {
      try {
        const targetPriceFormatted = notification.target_price.toString(); // Already in dollars
        const currentPriceFormatted = (currentPrice / 100).toFixed(2);
        
        console.log(`📤 Attempting to send email to ${notification.email} (target: $${targetPriceFormatted})`);
        
        const emailResult = await postmark.sendEmail({
          From: 'hello@withoptic.com',
          To: notification.email,
          Subject: '🎉 Optic Sale Price Alert: Price Has Dropped to Your Target!',
          HtmlBody: `
            <h2>Your Optic Sale Price Alert Has Been Triggered!</h2>
            <p>Great news! The current price has dropped to $${currentPriceFormatted}, which means it has reached your target price of $${targetPriceFormatted}.</p>
            <p>Visit <a href="https://sale.withoptic.com">sale.withoptic.com</a> to check it out!</p>
            <p>Best regards,<br>The Optic Team</p>
          `,
          TextBody: `
Your Optic Sale Price Alert Has Been Triggered!

Great news! The current price has dropped to $${currentPriceFormatted}, which means it has reached your target price of $${targetPriceFormatted}.

Visit sale.withoptic.com to check it out!

Best regards,
The Optic Team
          `,
          MessageStream: 'outbound'
        });

        console.log('📨 Postmark API response:', emailResult);

        // Only mark as notified if email was sent successfully
        if (emailResult?.MessageID) {
          const { error: updateError } = await supabase
            .from('email_notifications')
            .update({ notified: true })
            .eq('id', notification.id);

          if (updateError) {
            console.error(`❌ Error marking notification as sent for ${notification.email}:`, updateError);
            results.push({ email: notification.email, success: false, error: updateError });
          } else {
            console.log(`✅ Successfully notified ${notification.email}`);
            results.push({ email: notification.email, success: true, messageId: emailResult.MessageID });
          }
        } else {
          throw new Error('No message ID returned from Postmark');
        }

      } catch (error) {
        console.error(`❌ Error sending email to ${notification.email}:`, error);
        results.push({ email: notification.email, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log('✨ Notification check completed');

    return new NextResponse(JSON.stringify({ 
      success: true,
      currentPrice,
      notificationsSent: notifications?.length || 0,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in check-price-notifications:', error);
    return new NextResponse(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 