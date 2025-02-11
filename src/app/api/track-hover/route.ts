import { headers } from 'next/headers'
import { supabase, hashIP } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Rate limit to 1 request per IP per 5 seconds
const limiter = rateLimit({
  interval: 5000,
  uniqueTokenPerInterval: 500
})

const getHoverStats = unstable_cache(
  async () => {
    const { data: stats, error } = await supabase
      .from('button_hovers')
      .select('ip_address, hover_count')

    if (error) throw error

    return {
      uniqueHovers: stats?.length || 0,
      totalHovers: stats?.reduce((sum, stat) => sum + (stat.hover_count || 0), 0) || 0
    }
  },
  ['hover-stats'],
  {
    revalidate: 60, // 1 minute
    tags: ['hover-stats']
  }
)

export async function POST() {
  try {
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0] || 'unknown'
    
    try {
      await limiter.check(5, ip) // 5 requests per interval max
    } catch {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    
    const hashedIP = await hashIP(ip)
    
    // Check if this IP has hovered recently (within last 60 seconds)
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const { data: recentHover } = await supabase
      .from('button_hovers')
      .select('last_hover')
      .eq('ip_address', hashedIP)
      .gte('last_hover', sixtySecondsAgo)
      .single()

    // If there's a recent hover, return cached stats without updating
    if (recentHover) {
      return NextResponse.json(await getHoverStats())
    }

    // Get current hover count for this IP
    const { data: currentHover } = await supabase
      .from('button_hovers')
      .select('hover_count')
      .eq('ip_address', hashedIP)
      .single()

    // If no recent hover, update or insert
    const { error: upsertError } = await supabase
      .from('button_hovers')
      .upsert({
        ip_address: hashedIP,
        last_hover: new Date().toISOString(),
        hover_count: (currentHover?.hover_count || 0) + 1
      })

    if (upsertError) throw upsertError

    // Return cached stats (will be revalidated due to the update)
    return NextResponse.json(await getHoverStats())
  } catch (error) {
    console.error('Error tracking hover:', error)
    return NextResponse.json({ error: 'Failed to track hover' }, { status: 500 })
  }
} 