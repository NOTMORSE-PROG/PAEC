# Philippine Aeronautical English Corpus (PAEC)

A corpus-based training system for aviation English proficiency, built around authentic ATC communications from RPLL (Ninoy Aquino International Airport). The platform helps pilots and air traffic controllers practice and improve their English communication skills in compliance with ICAO standards.

## Features

### Training Modules

**Scenario-Based Simulation**
Practice full ATC clearance exchanges in realistic flight scenarios across three communication phases: Approach/Departure (APP/DEP), Ground/Taxi (GND), and Ramp/Pushback (RAMP).

**Readback/Hearback Correction**
Listen to or read pilot readbacks and identify non-standard or incorrect phraseology. Immediate feedback highlights deviations from ICAO Doc 4444 standards.

**Jumbled Clearance**
Arrange scrambled words into the correct ICAO phraseology sequence using drag-and-drop. Trains awareness of standard clearance structure and word order.

**Pronunciation Drill**
Master ICAO standard pronunciation for numbers, letters, and aviation terms. Uses the browser's Web Speech API for speech recognition and text-to-speech playback.

### Analysis Engine
Upload ATC dialogue transcripts (PDF, DOCX, or plain text) for automated analysis. Reports cover ICAO compliance, non-standard phraseology, number pronunciation errors, and safety-critical pattern detection. Results can be exported as PDF or CSV.

### User Dashboard
Tracks session history, performance scores, and improvement trends across all training modules. Charts display progress over time with per-category breakdowns.

### Authentication
- Email and password registration with email verification
- Google OAuth sign-in and account linking
- Forgot password and reset password flows
- Secure JWT sessions via NextAuth.js

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5.3 |
| Styling | Tailwind CSS 3.4 |
| Database | PostgreSQL (Neon) |
| Auth | NextAuth.js 5 (JWT, Google OAuth) |
| Email | Nodemailer (Gmail SMTP) |
| Animations | Framer Motion 11 |
| Drag and Drop | @dnd-kit |
| Charts | Recharts 2 |
| Document Parsing | PDF.js, custom DOCX extractor |
| Speech | Web Speech API (browser native) |

## Project Structure

```
src/
├── app/
│   ├── api/               # API route handlers
│   │   ├── auth/          # Register, verify email, forgot/reset password
│   │   ├── training/      # Questions, sessions, history, draft questions
│   │   ├── user/          # Profile, password, Google linking, account deletion
│   │   ├── dashboard/     # Aggregated stats
│   │   └── database/      # Schema initialization
│   ├── auth/              # Login, register, verify, reset password pages
│   ├── dashboard/         # Protected app shell
│   │   ├── training/      # Module pages (scenario, readback, jumbled, pronunciation)
│   │   ├── analysis/      # Upload and results pages
│   │   ├── profile/       # User profile
│   │   └── settings/      # Account settings
│   ├── onboarding/        # First-login onboarding flow
│   ├── privacy/           # Privacy policy
│   ├── terms/             # Terms of service
│   └── page.tsx           # Public landing page
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── database.ts        # PostgreSQL connection and schema
│   ├── email.ts           # Email templates (Nodemailer)
│   ├── analysisEngine.ts  # ICAO compliance analysis core
│   ├── atcData.ts         # ATC phraseology corpus data
│   ├── departureApproachAnalyzer.ts
│   ├── groundAnalyzer.ts
│   ├── rampAnalyzer.ts
│   ├── semanticReadbackAnalyzer.ts
│   ├── pdfExtractor.ts
│   ├── docxExtractor.ts
│   └── reportExporter.ts
├── components/
│   ├── ui/                # Reusable UI primitives
│   ├── training/          # Training-specific components
│   └── dashboard/         # Dashboard charts and stat cards
├── hooks/
│   ├── useSpeechRecognition.ts
│   └── useTextToSpeech.ts
├── data/                  # Corpus JSON files
│   ├── paecCorpus.json
│   ├── appDepCorpus.json
│   ├── gndCorpus.json
│   └── rampCorpus.json
└── types/                 # TypeScript type definitions
```

## Setup

### Prerequisites

- Node.js 18 or later
- PostgreSQL database (Neon recommended for serverless)
- Google Cloud project with OAuth 2.0 credentials
- Gmail account with an app-specific password for SMTP

### Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# NextAuth
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_SECRET=your-random-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM="PAEC System <your-email@gmail.com>"
```

**AUTH_SECRET** — Generate with `openssl rand -hex 32` or any random string generator. Keep this secret and never commit it.

**Google OAuth** — Create credentials at [Google Cloud Console](https://console.cloud.google.com/). Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.

**Gmail SMTP** — Enable 2-Step Verification on your Google account, then generate an App Password under Security settings.

### Installation

```bash
# Clone the repository
git clone https://github.com/NOTMORSE-PROG/PAEC.git
cd PAEC

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Start the development server
npm run dev
```

The database schema is created automatically on first run. Open [http://localhost:3000](http://localhost:3000) to view the app.

### Available Scripts

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run build     # Build for production
npm start         # Start production server
npm run lint      # Run ESLint
```

## Database Schema

Tables are auto-initialized via `/api/database` on startup:

| Table | Purpose |
|---|---|
| `users` | Registered accounts with role and verification status |
| `accounts` | OAuth provider links per user |
| `training_questions` | Question bank (scenario, readback, jumbled, pronunciation) |
| `training_sessions` | Completed training sessions per user |
| `session_feedback` | Per-question feedback records within sessions |

## API Reference

Interactive API documentation is available at `/api-docs` (Swagger UI) when the server is running.

## Corpus

The PAEC corpus (v3.4) consists of transcribed and annotated ATC recordings from RPLL collected by Batch Lima — 31 student pairs from the 2nd-year BSAVCOMM program at the Philippine State College of Aeronautics (PhilSCA) during the 2nd semester of AY 2024–2025, under the supervision of Dr. Ramsey S. Ferrer. Recordings were sourced from LiveATC.net covering February 1 to March 3, 2025.

## License

All rights reserved. This system and the underlying corpus are the intellectual property of their respective authors at PhilSCA.
