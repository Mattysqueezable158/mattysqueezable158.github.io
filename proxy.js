import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { decrypt } from './lib/session'

const cleanUrl = (val) => {
  const match = val?.match(/(https?:\/\/[^\s"'\\]+)/)
  return match ? match[1] : val
}

const cleanKey = (val) => {
  const match = val?.match(/([a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+)/)
  return match ? match[0] : val
}

export default async function proxy(request) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseKey = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // create client to query DB
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get session cookie and decrypt user ID
  const sessionCookie = request.cookies.get('haci_session')
  const userId = sessionCookie ? decrypt(sessionCookie.value) : null

  const url = request.nextUrl.clone()

  // If user is not logged in and is accessing a protected page
  if (!userId && url.pathname !== '/login') {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in
  if (userId) {
    // Redirect logged-in users away from /login
    if (url.pathname === '/login') {
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Verify user role for /admin paths
    if (url.pathname.startsWith('/admin')) {
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (!userRow || userRow.role !== 'admin') {
        url.pathname = '/'
        return NextResponse.redirect(url) // Redirect to home if not admin
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization services)
     * - favicon.ico (favicon file)
     * - firmware (static firmware folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|firmware).*)',
  ],
}

