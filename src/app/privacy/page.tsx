import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy — Corpus-Based System',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">

        <Link
          href="/auth/register"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Register
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: March 2026</p>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
            <p>When you create an account and use the Corpus-Based System, we collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li><span className="font-medium text-gray-800">Account information</span> — your full name and email address.</li>
              <li><span className="font-medium text-gray-800">Authentication data</span> — a securely hashed password (if using email/password), or your Google profile name, email, and profile picture (if using Google Sign-In).</li>
              <li><span className="font-medium text-gray-800">Training activity</span> — your session history, scores, and progress across training modules.</li>
            </ul>
            <p className="mt-3">We do not collect payment information, location data, or any sensitive personal information beyond the above.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Create and manage your account.</li>
              <li>Provide access to training modules and corpus analysis tools.</li>
              <li>Track and display your training progress within the system.</li>
              <li>Support ongoing research and development of the AELP program at PhilSCA.</li>
            </ul>
            <p className="mt-3">We do not sell your personal data to third parties or use it for advertising.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Storage</h2>
            <p>
              Your data is stored in a PostgreSQL database hosted on{' '}
              <span className="font-medium text-gray-800">Neon</span> (US East region).
              Authentication sessions are managed using secure, server-side JSON Web Tokens (JWT)
              and are not stored in browser cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p>This system relies on the following third-party services:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li><span className="font-medium text-gray-800">Google OAuth</span> — for optional Google Sign-In. Governed by Google&apos;s Privacy Policy.</li>
              <li><span className="font-medium text-gray-800">Vercel</span> — for application hosting and deployment.</li>
              <li><span className="font-medium text-gray-800">Neon</span> — for database hosting.</li>
            </ul>
            <p className="mt-3">
              Each of these providers operates under their own privacy policies and data handling
              practices. We encourage you to review them if you have concerns.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              Your data is retained for as long as your account remains active. If you delete
              your account through the Settings page, all personal data and training history
              associated with your account will be permanently and irreversibly removed from
              our database.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li><span className="font-medium text-gray-800">Access</span> — view the personal information associated with your account from your profile.</li>
              <li><span className="font-medium text-gray-800">Correction</span> — update your name or password from the Settings page.</li>
              <li><span className="font-medium text-gray-800">Deletion</span> — permanently delete your account and all associated data from Settings → Delete Account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contact</h2>
            <p>
              If you have questions or concerns about how your data is handled, please contact
              the AELP program at the Institute of Liberal Arts and Sciences (ILAS), Philippine
              State College of Aeronautics (PhilSCA).
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
