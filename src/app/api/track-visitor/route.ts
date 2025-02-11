import { headers } from 'next/headers'
import { supabase, hashIP } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

export const dynamic = 'force-dynamic'

const getVisitorCount = unstable_cache(
  async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: visitors, error } = await supabase
      .from('page_visitors')
      .select('ip_address')
      .gte('last_seen', fiveMinutesAgo)

    if (error) throw error
    return visitors?.length || 0
  },
  ['visitor-count'],
  {
    revalidate: 300, // 5 minutes
    tags: ['visitor-count']
  }
)

export async function POST() {
  try {
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0] || 'unknown'
    const hashedIP = await hashIP(ip)
    
    // Update or insert the visitor
    const { error: upsertError } = await supabase
      .from('page_visitors')
      .upsert(
        {
          ip_address: hashedIP,
          last_seen: new Date().toISOString(),
          page: 'auction'
        },
        { onConflict: 'ip_address' }
      )

    if (upsertError) throw upsertError

    // Get cached visitor count
    const visitorCount = await getVisitorCount()

    return NextResponse.json({ visitorCount })
  } catch (error) {
    console.error('Error tracking visitor:', error)
    return NextResponse.json({ error: 'Failed to track visitor' }, { status: 500 })
  }
} 