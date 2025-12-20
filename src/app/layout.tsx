import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PAEC - Philippine Aeronautical English Corpus',
  description: 'Corpus-Based Training System for Aviation Communication Excellence',
  keywords: ['aviation', 'english', 'training', 'ICAO', 'phraseology', 'pilot', 'ATC'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-white antialiased">
        {children}
      </body>
    </html>
  )
}
