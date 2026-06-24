'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getStripeServer } from '@/lib/stripe'
import type { PlanTier } from '@splitwise/domain'

const PRICE_TO_TIER: Record<string, PlanTier> = {
  [process.env.STRIPE_PRO_PRICE_ID!]: 'pro',
  [process.env.STRIPE_FAMILY_PRICE_ID!]: 'family',
}

async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (data?.stripe_customer_id) return data.stripe_customer_id

  const customer = await getStripeServer().customers.create({ email, metadata: { supabaseUserId: userId } })

  await supabase
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  return customer.id
}

async function getOrigin(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}

export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const customerId = await getOrCreateCustomer(user.id, user.email!)
  const origin = await getOrigin()

  const session = await getStripeServer().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/billing?success=true`,
    cancel_url: `${origin}/dashboard/billing`,
    allow_promotion_codes: true,
  })

  return { url: session.url! }
}

export async function createPortalSession(): Promise<{ url: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!data?.stripe_customer_id) redirect('/dashboard/billing')

  const origin = await getOrigin()
  const session = await getStripeServer().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/dashboard/billing`,
  })

  return { url: session.url }
}

export async function getCurrentSubscription(): Promise<{
  tier: PlanTier
  status: string
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!data?.stripe_customer_id) return null

  const subscriptions = await getStripeServer().subscriptions.list({
    customer: data.stripe_customer_id,
    status: 'active',
    limit: 1,
  })

  const sub = subscriptions.data[0]
  if (!sub) return null

  const priceId = sub.items.data[0]?.price.id ?? ''
  const tier: PlanTier = PRICE_TO_TIER[priceId] ?? 'free'

  return {
    tier,
    status: sub.status,
    currentPeriodEnd: new Date((sub.items.data[0]?.current_period_end ?? sub.billing_cycle_anchor) * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  }
}
