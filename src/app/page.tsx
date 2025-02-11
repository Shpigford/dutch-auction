/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import { Timer, DollarSign, Mail, Twitter, Phone, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { VisitorCount } from '@/components/VisitorCount';
import { HoverStats } from '@/components/HoverStats';
import { AverageTargetPrice } from '@/components/AverageTargetPrice';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import PriceNotification from '@/components/PriceNotification';
import { calculateCurrentPrice, START_DATE, AUCTION_DURATION_MS } from '@/lib/price-calculator';
import { PriceDisplay } from '@/components/PriceDisplay';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

const UPDATE_INTERVAL_MS = 1000; // Update every second

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const calculateTimeLeft = (ms: number): TimeLeft => {
  if (ms < 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);

  return { days, hours, minutes, seconds };
};

// Add these new components before the Home component
const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgb(0,0,0) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 2, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
};

const GradientBackground = () => {
  return (
    <motion.div
      className="fixed inset-0 -z-20 pointer-events-none bg-gradient-to-br"
      animate={{
        background: [
          'linear-gradient(120deg, rgba(255,255,255,1) 0%, rgba(238,240,245,1) 100%)',
          'linear-gradient(120deg, rgba(240,242,247,1) 0%, rgba(250,251,254,1) 100%)',
          'linear-gradient(120deg, rgba(242,244,249,1) 0%, rgba(235,237,242,1) 100%)',
          'linear-gradient(120deg, rgba(255,255,255,1) 0%, rgba(238,240,245,1) 100%)',
        ]
      }}
      transition={{
        duration: 15,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut"
      }}
    />
  );
};

export default function Home() {
  const [auctionStart] = useState(() => START_DATE.getTime());
  const [auctionEnd] = useState(() => auctionStart + AUCTION_DURATION_MS);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 7, hours: 0, minutes: 0, seconds: 0 });
  const [timeUntilStart, setTimeUntilStart] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSold, setIsSold] = useState(false);
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true on mount and initialize state
  useEffect(() => {
    setIsClient(true);
    const now = Date.now();
    setHasStarted(now >= START_DATE.getTime());
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const updateState = () => {
      const now = Date.now();
      const hasStartedNow = now >= START_DATE.getTime();
      
      if (hasStartedNow !== hasStarted) {
        setHasStarted(hasStartedNow);
      }
      
      if (!hasStartedNow) {
        const timeToStart = calculateTimeLeft(START_DATE.getTime() - now);
        setTimeUntilStart(timeToStart);
      } else {
        setTimeLeft(calculateTimeLeft(auctionEnd - now));
      }
    };

    // Initial update and start interval
    updateState();
    const timer = setInterval(updateState, UPDATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [auctionEnd, hasStarted, isClient]);

  useEffect(() => {
    // Check if item is sold
    const checkSaleStatus = async () => {
      const { data: saleStatus, error } = await supabase
        .from('sale_status')
        .select('is_sold, sale_price')
        .single();
      
      if (!error && saleStatus) {
        setIsSold(saleStatus.is_sold);
        setSalePrice(saleStatus.sale_price);
      }
    };

    checkSaleStatus();

    // Subscribe to sale_status changes
    const channel = supabase
      .channel('sale_status_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sale_status',
        },
        (payload) => {
          setIsSold(payload.new.is_sold);
          setSalePrice(payload.new.sale_price);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Clean up any existing hover timer when component unmounts
    return () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
    };
  }, [hoverTimer]);

  const handlePurchase = async () => {
    try {
      setLoading(true);
      // Track the click as a hover
      await fetch('/api/track-hover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await axios.post('/api/create-checkout-session', {
        price: calculateCurrentPrice(),
      });
      
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      const { error } = await stripe.redirectToCheckout({
        sessionId: response.data.sessionId,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Failed to initiate purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleButtonHover = () => {
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/track-hover', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Error tracking hover:', error);
      }
    }, 1000); // 1 second delay
    
    setHoverTimer(timer);
  };

  const handleButtonHoverEnd = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
  };

  return (
    <main className="min-h-screen bg-transparent text-foreground relative">
      <AnimatedBackground />
      <GradientBackground />
      <div className="mx-auto px-4 sm:px-6 py-8 sm:py-16 w-full max-w-4xl relative">
        <motion.div 
          className="flex flex-col items-center mb-4 sm:mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Link href="https://withoptic.com" target="_blank" rel="noopener noreferrer">
              <Image
                src="/optic-logo.svg"
                alt="Optic Logo"
                width={120}
                height={40}
                className="mb-6 sm:mb-8"
                priority
              />
            </Link>
          </motion.div>
          <motion.h1 
            className="text-5xl sm:text-7xl font-bold text-center tracking-tight mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            {isSold ? 'Optic has been sold!' : 'Optic is for sale'}
          </motion.h1>
          <motion.div 
            className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <VisitorCount />
            <HoverStats />
            <AverageTargetPrice />
          </motion.div>
        </motion.div>
        
        <motion.div 
          className="rounded-xl border bg-white/80 backdrop-blur-sm p-4 sm:p-8 shadow-sm mb-8 w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="text-center mb-6 sm:mb-8 space-y-4">            
            {isSold ? (
              <div className="space-y-8">
                <motion.div 
                  className="flex flex-col items-center justify-center gap-8"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="text-center w-full"
                  >
                    <div className="rounded-lg bg-background/50 border border-border backdrop-blur-sm p-8">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Check className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Auction Complete</h2>
                      </div>
                      
                      {salePrice && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
                          className="mt-8"
                        >
                          <div className="text-4xl sm:text-6xl font-bold text-primary tracking-tight font-mono">
                            ${(salePrice / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>

                <motion.div 
                  className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto mt-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  <div className="rounded-lg bg-background/50 border border-border backdrop-blur-sm p-6">
                    <h3 className="font-semibold mb-2 text-foreground">What's Next?</h3>
                    <p className="text-muted-foreground">
                      The website will be transferred to its new owner soon. All assets and access will be handed over securely.
                    </p>
                  </div>
                  <div className="rounded-lg bg-background/50 border border-border backdrop-blur-sm p-6">
                    <h3 className="font-semibold mb-2 text-foreground">Thank You</h3>
                    <p className="text-muted-foreground">
                      Thank you for your interest in Optic. We appreciate everyone who participated in this experiment.
                    </p>
                  </div>
                </motion.div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-xl sm:text-2xl font-semibold text-muted-foreground mb-4">
                  {hasStarted ? (
                    <>
                      <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                      <h2>Current Price</h2>
                    </>
                  ) : (
                    <>
                      <Timer className="w-5 h-5 sm:w-6 sm:h-6" />
                      <h2>Auction Starts Soon!</h2>
                    </>
                  )}
                </div>
                {hasStarted ? (
                  <div className="relative w-full">
                    <PriceDisplay />
                  </div>
                ) : (
                  <>
                    <div className="relative w-full mb-6 sm:mb-8">
                      <PriceDisplay static />
                    </div>
                    <div className="font-mono text-base sm:text-lg grid grid-cols-4 gap-2 sm:flex sm:items-center sm:justify-center sm:gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeUntilStart.days.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">days</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeUntilStart.hours.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">hrs</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeUntilStart.minutes.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">min</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeUntilStart.seconds.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">sec</span>
                      </div>
                    </div>
                  </>
                )}
                {hasStarted && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Timer className="w-4 h-4" />
                    <div className="font-mono text-base sm:text-lg grid grid-cols-4 gap-2 sm:flex sm:items-center sm:justify-center sm:gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeLeft.days.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">days</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeLeft.hours.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">hrs</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">min</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold text-xl sm:text-2xl">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                        <span className="text-muted-foreground text-xs uppercase">sec</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-6">
            {!isSold && (hasStarted ? (
              <>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25
                  }}
                >
                  <Button
                    onClick={handlePurchase}
                    onMouseEnter={handleButtonHover}
                    onMouseLeave={handleButtonHoverEnd}
                    disabled={loading}
                    className="w-full py-6 text-lg font-medium relative overflow-hidden group"
                    size="lg"
                  >
                    <motion.span
                      initial={{ opacity: 1 }}
                      whileHover={{ opacity: 0.9 }}
                    >
                      {loading ? 'Processing...' : 'Purchase Now'}
                    </motion.span>
                  </Button>
                </motion.div>

                <div className="mt-8 p-4 bg-background/50 backdrop-blur-sm rounded-lg border">
                  <PriceNotification />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground">Don&apos;t want to wait for the auction?</p>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25
                  }}
                >
                  <Button
                    onClick={handlePurchase}
                    onMouseEnter={handleButtonHover}
                    onMouseLeave={handleButtonHoverEnd}
                    disabled={loading}
                    className="w-full py-6 text-lg font-medium relative overflow-hidden group"
                    size="lg"
                  >
                    <motion.span
                      initial={{ opacity: 1 }}
                      whileHover={{ opacity: 0.9 }}
                    >
                      {loading ? 'Processing...' : 'Buy now at full price'}
                    </motion.span>
                  </Button>
                </motion.div>

                <div className="mt-8 p-4 bg-background/50 backdrop-blur-sm rounded-lg border">
                  <p className="text-muted-foreground mb-4">Want to wait? Get notified when the auction starts:</p>
                  <PriceNotification />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-background/70 border border-border p-6 prose prose-sm max-w-none w-full mt-8">
            <h3 className="text-xl font-semibold mb-4">About This Auction</h3>
            <p className="text-muted-foreground">
              This is a Dutch auction for a fully functioning web app called <a href="https://withoptic.com" target="_blank" rel="noopener noreferrer">Optic</a>. Optic is a competitive monitoring and analysis platform that tracks your competitors&apos; pricing, offerings, and messaging around the clock, then instantly surfaces actionable insights via AI-powered chat.
            </p>
            <p className="text-muted-foreground">
              This is a Dutch auction. The price started at $25,000 and will continually decrease over 7 days until it reaches $1. Once purchased, the auction ends and the website is transferred to the buyer.
            </p>
            <p className="text-muted-foreground">
              You&apos;re definitely not buying a product that&apos;s already profitable. Currently, Optic has two paying customers totaling $118/month. We haven&apos;t done any marketing yet - what you&apos;re getting is a fully-built technical foundation that&apos;s ready for you to launch and grow into a successful business.
            </p>
          </div>
          
          <div className="mt-4 p-6 bg-yellow-50 rounded-lg border border-yellow-200" style={{
            background: "repeating-linear-gradient(0deg, #fefce8, #fefce8 23px, #fef9c3 24px)"
          }}>
              <p className="text-gray-700 leading-7" style={{ lineHeight: '24px' }}>
                This whole dutch auction thing is a bit of an experiment. It's possible nobody is interested or it only sells for $1. But regardless, I'm committed to the experiment because it's fun to try weird things. That being said, I have absolutely zero intention of taking advantage of anyone. I want you to be happy with your purchase and if for some reason we can't make this work, no harm done.
              </p>
          </div>
        </motion.div>

        {/* Key Benefits */}
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg bg-white p-4 border">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">First Come, First Served</h3>
                <p className="text-muted-foreground text-sm">The first buyer to purchase at the current price wins the auction.</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg bg-white p-4 border">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Complete Ownership</h3>
                <p className="text-muted-foreground text-sm">Get full rights to the source code and intellectual property.</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg bg-white p-4 border">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">3 Months Support</h3>
                <p className="text-muted-foreground text-sm">Get 3 months of support following the sale to ensure a smooth transition.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Information */}
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-bold mb-8">Details</h2>
          
          {/* Creator Information */}
          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <Image
                    src="/josh.jpg"
                    alt="Josh Pigford"
                    width={120}
                    height={120}
                    className="rounded-lg w-24 md:w-[120px] mx-auto md:mx-0"
                    priority
                  />
                  <div className="space-y-4 w-full">
                    <p className="text-muted-foreground mb-4 text-center md:text-left">
                      Created by <a href="https://joshpigford.com/projects" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Josh Pigford</a>, a serial entrepreneur who has created 70+ products over the past 20 years.
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                      <a 
                        href="https://x.com/Shpigford" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-all px-4 py-2 rounded-lg bg-gray-50 hover:bg-primary/10 border border-gray-100"
                      >
                        <Twitter className="w-5 h-5" />
                        <span className="font-medium">@Shpigford</span>
                      </a>
                      <a 
                        href="mailto:josh@joshpigford.com"
                        className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-all px-4 py-2 rounded-lg bg-gray-50 hover:bg-primary/10 border border-gray-100"
                      >
                        <Mail className="w-5 h-5" />
                        <span className="font-medium">Email</span>
                      </a>
                      <a 
                        href="tel:2052358875"
                        className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-all px-4 py-2 rounded-lg bg-gray-50 hover:bg-primary/10 border border-gray-100"
                      >
                        <Phone className="w-5 h-5" />
                        <span className="font-medium">Text +1 (205) 235-8875</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo Video */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Demo Video</h3>
              <div className="rounded-lg overflow-hidden w-full">
                <div style={{ position: "relative", paddingTop: "62.28373702422145%" }}>
                  <iframe 
                    src="https://customer-9munimwol5ontc4s.cloudflarestream.com/c4c9cfab876ee5a10ec8f934499ab175/iframe?poster=https%3A%2F%2Fcustomer-9munimwol5ontc4s.cloudflarestream.com%2Fc4c9cfab876ee5a10ec8f934499ab175%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600" 
                    loading="lazy" 
                    style={{ border: "none", position: "absolute", top: 0, left: 0, height: "100%", width: "100%" }}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen={true}
                  />
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <div className="grid md:grid-cols-2 gap-8 max-w-full">
              <div className="space-y-4 min-w-0">
                <h3 className="text-xl font-semibold">Technical Stack</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Domain:</span>
                    <a href="http://withoptic.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      withoptic.com
                    </a>
                  </li>
                  <li className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Tech:</span>
                    <span>Ruby (~3.3), Rails (~8), Postgres (16), GPT-4</span>
                  </li>
                  <li className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Hosting:</span>
                    <span>Hetzner, Digital Ocean, Hatchbox</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4 min-w-0">
                <h3 className="text-xl font-semibold">Current Numbers</h3>
                <p className="text-muted-foreground">
                  You&apos;re definitely not buying a product that&apos;s already profitable. Currently, Optic has two paying customers totaling $118/month. We haven&apos;t done any marketing yet - what you&apos;re getting is a fully-built technical foundation that&apos;s ready for you to launch and grow into a successful business.
                </p>
              </div>
            </div>

            {/* Monthly Expenses */}
            <div className="space-y-4 w-full">
              <h3 className="text-xl font-semibold">Monthly Expenses</h3>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>~$50/mo — Hetzner/Digital Ocean/Hatchbox (shared resources, low usage)</li>
                <li>OpenAI costs are usage-based (currently &lt;$20/mo, single-digit % of revenue)</li>
                <li>Firecrawl.dev — $100/mo plan for scraping (plenty of capacity)</li>
                <li>Podcscan.fm — $39/mo — Handles podcast monitoring</li>
                <li>SocialData.tools — $5-10/mo — Handles Twitter/X monitoring</li>
              </ul>
            </div>

            {/* Features */}
            <div className="space-y-4 w-full">
              <h3 className="text-xl font-semibold">Core Features</h3>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>Competitor monitoring via Watchers</li>
                <li>Smart Alerts — AI-powered change detection and notification</li>
                <li>Competitive chat — Analysis and insights across all competitors</li>
              </ul>

              <h4 className="text-lg font-semibold mt-6">Watcher Types</h4>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>URL/page monitoring</li>
                <li>Design monitoring (GPT vision analysis)</li>
                <li>Twitter/X profile monitoring</li>
                <li>Twitter/X post monitoring</li>
                <li>Twitter/X mention monitoring</li>
                <li>Customer review monitoring</li>
                <li>Podcast mention monitoring</li>
                <li>News monitoring</li>
              </ul>
            </div>

            {/* Growth Opportunities */}
            <div className="space-y-4 w-full">
              <h3 className="text-xl font-semibold">Growth Opportunities</h3>
              <p className="text-muted-foreground mb-4">
                This project never really got its big "launch". Here are some ideas on ways to grow:
              </p>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>LinkedIn monitoring</li>
                <li>Ecommerce monitoring (MASSIVE vertical potential)</li>
                <li>Generate detailed competitive analysis reports</li>
                <li>Generate market trend/analysis reports/white papers</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Going mid-market and up could be very viable as those companies have entire roles/teams dedicated to this sort of thing.
              </p>
            </div>

            {/* Assets & Requirements */}
            <div className="grid md:grid-cols-2 gap-8 max-w-full">
              <div className="space-y-4 min-w-0">
                <h3 className="text-xl font-semibold">Included Assets</h3>
                <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                  <li>Domain: withoptic.com</li>
                  <li>X account: @withoptic</li>
                  <li>Codebase</li>
                  <li>Database</li>
                </ul>
              </div>

              <div className="space-y-4 min-w-0">
                <h3 className="text-xl font-semibold">Requirements</h3>
                <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                  <li>Hosting/server</li>
                  <li>Stripe account</li>
                  <li>OpenAI account</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
