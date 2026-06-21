import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VendoAI',
  description: 'Fleet-Management für Automaten-Betreiber',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
