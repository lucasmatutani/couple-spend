import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Splitwise',
  description: 'Shared expense splitting and personal finance tracking',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
