'use client';

import { useEffect, useState } from 'react';
import { calculateCurrentPrice } from '@/lib/price-calculator';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price / 100);
};

type PriceDisplayProps = {
  static?: boolean;
};

export function PriceDisplay({ static: isStatic = false }: PriceDisplayProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPrice(calculateCurrentPrice());
    
    if (!isStatic) {
      const timer = setInterval(() => {
        setPrice(calculateCurrentPrice());
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isStatic]);

  if (!mounted) {
    return <div className="h-[72px]" />; // Placeholder with same height
  }

  return (
    <p className="text-5xl sm:text-6xl font-bold text-primary tracking-tighter tabular-nums font-mono break-words">
      ${price !== null ? formatPrice(price) : '...'}
    </p>
  );
} 