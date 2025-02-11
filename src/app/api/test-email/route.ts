import { NextResponse } from 'next/server';
import { ServerClient } from 'postmark';

// Verify Postmark API key exists
if (!process.env.POSTMARK_API_KEY) {
  throw new Error('POSTMARK_API_KEY environment variable is required');
}

const postmark = new ServerClient(process.env.POSTMARK_API_KEY);

export async function POST(request: Request) {
  console.log('🧪 Testing Postmark email integration...');
  
  try {
    const { email } = await request.json();

    if (!email) {
      return new NextResponse(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`📤 Attempting to send test email to ${email}`);
    
    const emailResult = await postmark.sendEmail({
      From: 'hello@withoptic.com',
      To: email,
      Subject: '🧪 Test Email from Optic Sale',
      HtmlBody: `
        <h1>Test Email</h1>
        <p>This is a test email to verify the Postmark integration is working correctly.</p>
        <p>Best regards,<br>The Optic Team</p>
      `,
      TextBody: `
Test Email

This is a test email to verify the Postmark integration is working correctly.

Best regards,
The Optic Team
      `,
      MessageStream: 'outbound'
    });

    console.log('📨 Postmark API response:', emailResult);

    return new NextResponse(JSON.stringify({ 
      success: true,
      result: emailResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in test-email:', error);
    return new NextResponse(JSON.stringify({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 