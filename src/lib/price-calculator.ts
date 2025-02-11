import { parseISO } from 'date-fns';

// Constants for price calculation
export const AUCTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

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

// Parse the environment variables
export const START_DATE = parseISO(process.env.NEXT_PUBLIC_START_DATE);
export const STARTING_PRICE = parseInt(process.env.NEXT_PUBLIC_STARTING_PRICE); // Price in cents
export const FINAL_PRICE = parseInt(process.env.NEXT_PUBLIC_FINAL_PRICE); // Price in cents

// Function to calculate price at a specific timestamp
export function calculatePriceAtTime(timestamp: number): number {
  const hasStarted = timestamp >= START_DATE.getTime();
  
  if (!hasStarted) {
    return STARTING_PRICE;
  }
  
  const timeElapsed = timestamp - START_DATE.getTime();
  const progress = Math.min(timeElapsed / AUCTION_DURATION_MS, 1);
  
  // Calculate price using exponential decay for smoother price drops
  const priceRange = STARTING_PRICE - FINAL_PRICE;
  const currentPrice = Math.max(
    Math.round(STARTING_PRICE - (priceRange * progress)),
    FINAL_PRICE
  );
  
  return currentPrice;
}

// Get a stable initial price for SSR
export function getInitialPrice(): number {
  if (typeof window === 'undefined') {
    // Round to nearest minute for more stable SSR
    const now = Math.floor(Date.now() / 60000) * 60000;
    return calculatePriceAtTime(now);
  }
  return calculatePriceAtTime(Date.now());
}

// Current price calculator for client-side updates
export function calculateCurrentPrice(): number {
  return calculatePriceAtTime(Date.now());
} 