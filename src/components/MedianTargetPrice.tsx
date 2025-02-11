import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AverageTargetPrice() {
  const [averagePrice, setAveragePrice] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchAveragePrice = async () => {
      try {
        setIsUpdating(true);
        const { data, error } = await supabase
          .from('email_notifications')
          .select('target_price')
          .gt('target_price', 0);

        if (!error && data && data.length > 0) {
          const average = data.reduce((sum, item) => sum + item.target_price, 0) / data.length;
          setAveragePrice(average);
        }
      } catch (error) {
        console.error('Error fetching average price:', error);
      } finally {
        setIsUpdating(false);
      }
    };

    fetchAveragePrice();

    // Subscribe to changes
    const channel = supabase
      .channel('email_notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_notifications'
        },
        () => {
          fetchAveragePrice();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  if (!averagePrice) return null;

  return (
    <motion.div 
      className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full text-sm text-primary font-medium"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <DollarSign className="w-4 h-4" />
      <AnimatePresence mode="wait">
        <motion.span
          key={averagePrice}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`tabular-nums ${isUpdating ? 'opacity-50' : ''}`}
        >
          ${(averagePrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} avg notification price
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
} 