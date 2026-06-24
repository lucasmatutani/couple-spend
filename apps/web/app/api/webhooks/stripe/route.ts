import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanTier } from '@splitwise/domain'

const PRICE_TO_TIER: Record<string, PlanTier> = {
  [process.env.STRIPE_PRO_PRICE_ID ?? '']: 'pro',
  [process.env.STRIPE_FAMILY_PRICE_ID ?? '']: 'family',
}

async function markProcessed(admin: ReturnType<typeof createAdminClient>, eventId: string): Promise<boolean> {
  const { error } = await admin
    .from('stripe_webhook_events')
    .insert({ event_id: eventId })

  // Unique constraint violation → already processed
  return !error
}

async function setUserPlan(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  plan: PlanTier,
): Promise<void> {
  await admin.from('users').update({ plan }).eq('stripe_customer_id', customerId)
}

async function linkCustomer(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  customerId: string,
): Promise<void> {
  await admin
    .from('users')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId)
    .is('stripe_customer_id', null)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripeServer().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency: skip if already processed
  const isNew = await markProcessed(admin, event.id)
  if (!isNew) return NextResponse.json({ received: true })

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price.id ?? ''
        const tier: PlanTier = PRICE_TO_TIER[priceId] ?? 'free'
        await setUserPlan(admin, sub.customer as string, tier)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await setUserPlan(admin, sub.customer as string, 'free')
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.supabaseUserId && session.customer) {
          await linkCustomer(admin, session.metadata.supabaseUserId, session.customer as string)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    // Return 200 so Stripe doesn't retry — processing error is logged above.
  }

  return NextResponse.json({ received: true })
}
