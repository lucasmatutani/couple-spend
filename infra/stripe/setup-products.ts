/**
 * One-time script to create Stripe products and prices for Pro and Family plans.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx ts-node infra/stripe/setup-products.ts
 *
 * After running, copy the printed price IDs to your .env.local:
 *   STRIPE_PRO_PRICE_ID=price_...
 *   STRIPE_FAMILY_PRICE_ID=price_...
 */

import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' })

async function main() {
  const proProduct = await stripe.products.create({
    name: 'CoupleSpend Pro',
    description: 'Up to 5 household members, 24 months history, AI categorization, Open Finance.',
  })

  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    currency: 'brl',
    unit_amount: 1990,
    recurring: { interval: 'month' },
    nickname: 'Pro Monthly',
  })

  const familyProduct = await stripe.products.create({
    name: 'CoupleSpend Family',
    description: 'Up to 10 household members, 60 months history, AI categorization, Open Finance.',
  })

  const familyPrice = await stripe.prices.create({
    product: familyProduct.id,
    currency: 'brl',
    unit_amount: 3490,
    recurring: { interval: 'month' },
    nickname: 'Family Monthly',
  })

  console.log('Add these to your .env.local and production environment:\n')
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`)
  console.log(`STRIPE_FAMILY_PRICE_ID=${familyPrice.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
