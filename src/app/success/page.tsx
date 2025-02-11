'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Verify the payment and mark as sold
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error('Payment verification failed');
        }

        setLoading(false);
      } catch {
        setError('There was an error verifying your payment. Please contact support.');
        setLoading(false);
      }
    };

    if (sessionId) {
      verifyPayment();
    }
  }, [sessionId]);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-16">
      <div className="rounded-xl border bg-white p-8 shadow-sm text-center">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 mb-4">{error}</div>
        ) : (
          <>
            <div className="mb-8">
              <div className="mx-auto w-16 h-16 mb-6">
                <CheckCircle2 className="w-16 h-16 text-primary" />
              </div>
              <h1 className="text-4xl font-bold mb-2">Thank You for Your Purchase!</h1>
              <p className="text-xl text-muted-foreground mb-8">
                Your transaction has been completed successfully.
              </p>
            </div>

            <div className="rounded-lg bg-background p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
              <p className="text-muted-foreground">
                We will contact you shortly with instructions for the website transfer process.
                Please check your email for further details.
              </p>
            </div>

            <Button asChild size="lg" className="font-medium">
              <Link href="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Home
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Suspense fallback={
        <div className="container max-w-4xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </main>
  );
} 