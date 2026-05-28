import Stripe from 'stripe'
import { loadStripe, type Stripe as StripeClient } from '@stripe/stripe-js'

export const stripeServer = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

let stripeClientPromise: Promise<StripeClient | null> | null = null

/** Lazy browser-side Stripe singleton for future client-side integrations (Phase 7+). */
export function getStripeClient(): Promise<StripeClient | null> {
  if (!stripeClientPromise) {
    stripeClientPromise = loadStripe(process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']!)
  }
  return stripeClientPromise
}
