import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') ? rawNext : '/'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session?.user) {
      const user = data.session.user
      const provider = user.app_metadata?.provider || 'email'
      
      if (provider === 'google' || provider === 'apple') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()
          
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
        const avatarUrl = user.user_metadata?.avatar_url || ''
        
        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: fullName,
            first_name: fullName.split(' ')[0] || '',
            avatar_url: avatarUrl,
            provider: provider,
            onboarding_completed: false
          })
        } else {
          await supabase.from('profiles').update({
            email: user.email,
            full_name: fullName,
            avatar_url: avatarUrl,
            provider: provider
          }).eq('id', user.id)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/auth/error?reason=oauth_exchange_failed`)
  }

  return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`)
}
