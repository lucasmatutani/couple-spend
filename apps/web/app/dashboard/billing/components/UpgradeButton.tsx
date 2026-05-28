'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createCheckoutSession, createPortalSession } from '../actions'

type Props = {
  priceId?: string // undefined → portal session (manage subscription)
  label: string
  variant?: 'default' | 'outline'
}

export default function UpgradeButton({ priceId, label, variant = 'default' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const result = priceId
        ? await createCheckoutSession(priceId)
        : await createPortalSession()
      window.location.href = result.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} onClick={handleClick} disabled={loading} className="w-full">
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      {label}
    </Button>
  )
}
