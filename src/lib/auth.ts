import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import {
  getUserByEmail,
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

      // Check if this Google account is already linked
      const existing = await getGoogleAccount(googleSub)
      if (existing) return true // already linked → allow

      // Check if an email-registered user exists with this email
      const emailUser = await getUserByEmail(email)

      if (emailUser) {
        // Auto-link Google to existing email account
        await linkGoogleAccount(
          emailUser.id,
          googleSub,
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
        newUser.id,
        googleSub,
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
          // Look up the DB user by email (created/linked in signIn callback)
          const email = token.email?.toLowerCase()
          if (email) {
            const dbUser = await getUserByEmail(email)
            if (dbUser) {
              token.id = dbUser.id
              token.role = dbUser.role
              token.hasPassword = !!dbUser.password_hash
              token.googleLinked = true
              token.onboardingCompleted = dbUser.onboarding_completed
            }
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
