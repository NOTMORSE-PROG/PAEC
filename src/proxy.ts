import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const onboardingCompleted = req.auth?.user?.onboardingCompleted ?? true

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard') && !isLoggedIn) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to onboarding if logged in but hasn't completed it
  if (pathname.startsWith('/dashboard') && isLoggedIn && !onboardingCompleted) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }

  // Redirect logged-in users away from auth pages
  if ((pathname.startsWith('/auth/login') || pathname.startsWith('/auth/register')) && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Protect onboarding — must be logged in
  if (pathname === '/onboarding' && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Skip onboarding if already completed
  if (pathname === '/onboarding' && isLoggedIn && onboardingCompleted) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/auth/login', '/auth/register', '/onboarding'],
}
