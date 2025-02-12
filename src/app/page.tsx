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
              This is a Dutch auction for a fully functioning web app called <a href="https://example.com" target="_blank" rel="noopener noreferrer">SquirrelGPT</a>. SquirrelGPT is a chatbot that uses GPT-4 to answer questions about squirrels.
            </p>
            <p className="text-muted-foreground">
              This is a Dutch auction. The price started at $25,000 and will continually decrease over 7 days until it reaches $1. Once purchased, the auction ends and the website is transferred to the buyer.
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
                    src="/dwight.jpg"
                    alt="Dwight Schrute"
                    width={120}
                    height={120}
                    className="rounded-lg w-24 md:w-[120px] mx-auto md:mx-0"
                    priority
                  />
                  <div className="space-y-4 w-full">
                    <p className="text-muted-foreground mb-4 text-center md:text-left">
                      Created by Dwight Schrute, a serial entrepreneur who has created 70+ products for squirrels over the past 20 years.
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                      <a 
                        href="https://x.com/DwightSchrute" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-all px-4 py-2 rounded-lg bg-gray-50 hover:bg-primary/10 border border-gray-100"
                      >
                        <Twitter className="w-5 h-5" />
                        <span className="font-medium">@DwightSchrute</span>
                      </a>
                      <a 
                        href="mailto:you@example.com"
                        className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-all px-4 py-2 rounded-lg bg-gray-50 hover:bg-primary/10 border border-gray-100"
                      >
                        <Mail className="w-5 h-5" />
                        <span className="font-medium">Email</span>
                      </a>
                      <a 
                        href="tel:5555555555"
                        className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-all px-4 py-2 rounded-lg bg-gray-50 hover:bg-primary/10 border border-gray-100"
                      >
                        <Phone className="w-5 h-5" />
                        <span className="font-medium">Text +1 (555) 555-5555</span>
                      </a>
                    </div>
                  </div>
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
                    <a href="http://example.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      example.com
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
                  You&apos;re definitely not buying a product that&apos;s already profitable. Currently, SquirrelGPT has two paying customers totaling $118/month. We haven&apos;t done any marketing yet - what you&apos;re getting is a fully-built technical foundation that&apos;s ready for you to launch and grow into a successful business.
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
                  <li>Domain: example.com</li>
                  <li>X account: @example</li>
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

        {/* Footer */}
        <motion.div 
          className="mt-16 text-center text-sm text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="inline-flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>This site uses an</span>
            <Link
              href="https://github.com/Shpigford/dutch-auction"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900 underline"
            >
              open source Dutch auction template
            </Link>
            <span>by</span>
            <Link
              href="https://x.com/shpigford"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900 underline"
            >
              @shpigford
            </Link>
            <span>!</span>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
