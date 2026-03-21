import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service — Corpus-Based System',
}

export default function TermsPage() {
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

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: March 2026</p>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. About This Service</h2>
            <p>
              The Corpus-Based System is an educational web application developed as part of the
              undergraduate thesis &ldquo;Acceptability Evaluation of a Corpus-Based System for
              Detecting (Non) Standard Phraseology in Philippine Aviation English Training&rdquo;
              at the Institute of Liberal Arts and Sciences (ILAS), National Aviation Academy of
              the Philippines (formerly Philippine State College of Aeronautics). It is powered by
              the Philippine Aeronautical English Corpus (PAEC) — a specialized collection of
              authentic, manually transcribed pilot–ATC communications recorded at Ninoy Aquino
              International Airport (RPLL) in Manila.
            </p>
            <p className="mt-3">
              The system provides four interactive training modules and in-depth corpus analysis
              tools designed to support aviation English training by helping users practice
              ICAO-standard phraseology with real Philippine data, receive instant feedback, and
              explore authentic communication patterns from RPLL.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Eligibility</h2>
            <p>
              This service is intended for aviation students, aviation English instructors,
              ATC and flight operations professionals, and researchers with a legitimate interest
              in aviation English communication. By creating an account, you confirm that your
              use of this system is for educational or research purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Your Account</h2>
            <p>You are responsible for:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Providing accurate information during registration.</li>
              <li>Keeping your login credentials secure and confidential.</li>
              <li>All activity that occurs under your account.</li>
            </ul>
            <p className="mt-3">
              You may delete your account at any time from the Settings page. Upon deletion,
              your personal data and training history will be permanently removed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Acceptable Use</h2>
            <p>You agree to use the Corpus-Based System solely for educational and research purposes. You must not:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Scrape, copy, or redistribute corpus data or training content without authorization.</li>
              <li>Attempt to reverse-engineer, disable, or interfere with the system.</li>
              <li>Use the system to train external AI models or commercial products.</li>
              <li>Share your account credentials with others.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Intellectual Property</h2>
            <p>
              The Philippine Aeronautical English Corpus (PAEC), including all transcriptions,
              annotations, and derived training materials, is the intellectual property of the
              research team at PhilSCA. The system interface, training question content, and
              analysis tools are likewise protected.
            </p>
            <p className="mt-3">
              Nothing in these Terms grants you ownership of any corpus data or system content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Limitation of Liability</h2>
            <p>
              The Corpus-Based System is provided on an <span className="italic">&ldquo;as is&rdquo;</span> basis
              for educational use only. It is not a substitute for official ICAO training, formal
              aviation English certification, or any regulatory requirement.
            </p>
            <p className="mt-3">
              We make no warranties about the accuracy, completeness, or fitness of the system
              for any specific purpose. To the extent permitted by law, we are not liable for
              any damages arising from your use of this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Changes to These Terms</h2>
            <p>
              We may update these Terms of Service from time to time. The date at the top of
              this page reflects the most recent revision. Continued use of the system after
              changes are posted constitutes your acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact</h2>
            <p>
              For questions about these terms, please contact the AELP program at the Institute
              of Liberal Arts and Sciences (ILAS), Philippine State College of Aeronautics
              (PhilSCA).
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
