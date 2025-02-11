'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { calculateCurrentPrice } from '@/lib/price-calculator';

export default function PriceNotification() {
  const [email, setEmail] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      // Frontend validation
      const targetPrice = parseInt(price);
      const currentPrice = calculateCurrentPrice();
      
      if (targetPrice >= currentPrice / 100) { // Compare in dollars
        const formattedCurrentPrice = (currentPrice / 100).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2
        });
        setStatus('error');
        setMessage(`Your target price must be less than the current price (${formattedCurrentPrice})`);
        return;
      }

      const response = await fetch('/api/subscribe-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          targetPrice: parseInt(price), // Send price in dollars to the API
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Target price must be less than the current price') {
          const formattedCurrentPrice = (data.currentPrice / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
          });
          setStatus('error');
          setMessage(`Your target price must be less than the current price (${formattedCurrentPrice})`);
        } else {
          throw new Error(data.error || 'Failed to subscribe');
        }
        return;
      }

      setStatus('success');
      setMessage('You will be notified when the price reaches your target!');
      setEmail('');
      setPrice('');
    } catch (error) {
      setStatus('error');
      setMessage(`Failed to subscribe: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove any non-digit characters
    const value = e.target.value.replace(/\D/g, '');
    setPrice(value);
  };

  return (
    <div className="w-full">
      <h3 className="text-center mb-4 text-lg font-medium">Not ready to buy? Get notified when the price drops to your target!</h3>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          className="flex-1 h-10 rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Enter your email"
          type="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          required
        />
        <input
          className="flex-1 h-10 rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Target price"
          type="number"
          min="1"
          step="1"
          value={price}
          onChange={handlePriceChange}
          required
        />
        <Button
          type="submit"
          disabled={status === 'loading'}
          size="default"
          className="whitespace-nowrap"
        >
          {status === 'loading' ? 'Subscribing...' : 'Notify Me'}
        </Button>
      </form>
      {message && (
        <p className={`text-sm mt-2 text-center ${status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
} 