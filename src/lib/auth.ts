import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import {
  getUserByEmail,
  getUserById,
  createGoogleUser,
  verifyPassword,
  linkGoogleAccount,
  getGoogleAccount,
  hasGoogleLinked,
} from './authHelpers'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase()
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        const user = await getUserByEmail(email)
        if (!user) return null

        // Google-only account — no password set
        if (!user.password_hash) return null

        const valid = await verifyPassword(password, user.password_hash)
        if (!valid) return null

        if (!user.email_verified) {
          throw new Error('EmailNotVerified')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? '',
          role: user.role,
          hasPassword: true,
          onboardingCompleted: user.onboarding_completed,
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true

      const email = profile?.email?.toLowerCase()
      if (!email) return false

      const googleSub = account.providerAccountId

      // ── Linking flow: user is already authenticated ──────────────────────
      const currentSession = await auth()
      if (currentSession?.user?.id) {
        const currentUserId = currentSession.user.id
        const existing = await getGoogleAccount(googleSub)

        if (existing && existing.user_id !== currentUserId) {
          // Google account belongs to a different user — block without signing out
          return '/dashboard/settings?error=google-taken'
        }

        if (!existing) {
          await linkGoogleAccount(
            currentUserId, googleSub,
            account.access_token ?? undefined,
            account.refresh_token ?? undefined,
            account.expires_at ?? undefined
          )
        }
        return true
      }

      // ── Normal sign-in flow: user is NOT authenticated ───────────────────
      const emailUser = await getUserByEmail(email)
      if (emailUser?.password_hash) {
        return '/auth/login?error=OAuthAccountNotLinked'
      }

      const existing = await getGoogleAccount(googleSub)
      if (existing) return true

      if (emailUser) {
        await linkGoogleAccount(
          emailUser.id, googleSub,
          account.access_token ?? undefined,
          account.refresh_token ?? undefined,
          account.expires_at ?? undefined
        )
        return true
      }

      // Brand new user — create account and link Google
      const newUser = await createGoogleUser(
        email,
        (profile?.name as string | undefined) ?? email,
        (profile?.picture as string | undefined) ?? undefined
      )
      await linkGoogleAccount(
        newUser.id, googleSub,
        account.access_token ?? undefined,
        account.refresh_token ?? undefined,
        account.expires_at ?? undefined
      )
      return true
    },

    async jwt({ token, user, account, session, trigger }) {
      // Refresh token when session.update() is called from the client
      if (trigger === 'update' && session?.onboardingCompleted !== undefined) {
        token.onboardingCompleted = session.onboardingCompleted
      }
      // On first sign-in, populate token with DB user data
      if (account && user) {
        if (account.provider === 'credentials') {
          // user comes from authorize() — already has our DB fields
          const u = user as { id: string; role: string; hasPassword: boolean; onboardingCompleted: boolean }
          token.id = u.id
          token.role = u.role
          token.hasPassword = u.hasPassword
          token.onboardingCompleted = u.onboardingCompleted
          token.googleLinked = await hasGoogleLinked(u.id)
        } else if (account.provider === 'google') {
          // Look up by Google sub first (handles cross-email linking correctly),
          // fall back to email for brand-new users before the link is recorded
          const googleAcct = await getGoogleAccount(account.providerAccountId)
          const dbUser = googleAcct
            ? await getUserById(googleAcct.user_id)
            : await getUserByEmail(token.email?.toLowerCase() ?? '')
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
            token.hasPassword = !!dbUser.password_hash
            token.googleLinked = true
            token.onboardingCompleted = dbUser.onboarding_completed
          }
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.hasPassword = token.hasPassword as boolean
        session.user.googleLinked = token.googleLinked as boolean
        session.user.onboardingCompleted = token.onboardingCompleted as boolean
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
})
