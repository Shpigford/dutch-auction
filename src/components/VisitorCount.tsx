import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function VisitorCount() {
  const [visitorCount, setVisitorCount] = useState<number>(0)
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchVisitorCount = async () => {
    try {
      setIsUpdating(true)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: visitors } = await supabase
        .from('page_visitors')
        .select('ip_address')
        .gte('last_seen', fiveMinutesAgo)
      
      setVisitorCount(visitors?.length || 0)
    } catch (error) {
      console.error('Error fetching visitor count:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchVisitorCount()

    // Set up real-time subscription
    const channel = supabase
      .channel('page_visitors_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'page_visitors',
        },
        () => {
          fetchVisitorCount()
        }
      )
      .subscribe()

    // Update count every minute to keep session alive
    const interval = setInterval(async () => {
      // Track this visitor
      try {
        const response = await fetch('/api/track-visitor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) throw new Error('Failed to track visitor')
      } catch (error) {
        console.error('Error tracking visitor:', error)
      }
    }, 60000)

    return () => {
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  return (
    <motion.div 
      className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full text-sm text-primary font-medium"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Users className="w-4 h-4" />
      <AnimatePresence mode="wait">
        <motion.span
          key={visitorCount}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`tabular-nums ${isUpdating ? 'opacity-50' : ''}`}
        >
          {visitorCount} {visitorCount === 1 ? 'person' : 'people'} viewing
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
} 