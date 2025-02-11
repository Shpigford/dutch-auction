import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MousePointer } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function HoverStats() {
  const [stats, setStats] = useState({ uniqueHovers: 0, totalHovers: 0 })
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchStats = async () => {
    try {
      setIsUpdating(true)
      const { data: hoverData } = await supabase
        .from('button_hovers')
        .select('ip_address, hover_count')
      
      if (hoverData) {
        setStats({
          uniqueHovers: hoverData.length,
          totalHovers: hoverData.reduce((sum, stat) => sum + (stat.hover_count || 0), 0)
        })
      }
    } catch (error) {
      console.error('Error fetching hover stats:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchStats()

    // Set up real-time subscription
    const channel = supabase
      .channel('button_hovers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'button_hovers',
        },
        () => {
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  return (
    <motion.div 
      className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full text-sm text-primary font-medium"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <MousePointer className="w-4 h-4" />
      <AnimatePresence mode="wait">
        <motion.span
          key={`${stats.uniqueHovers}-${stats.totalHovers}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`tabular-nums ${isUpdating ? 'opacity-50' : ''}`}
        >
          {stats.uniqueHovers} {stats.uniqueHovers === 1 ? 'person has' : 'people have'} considered buying
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
} 