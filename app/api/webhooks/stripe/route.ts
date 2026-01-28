/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events for subscription updates.
 * Processes checkout.session.completed and customer.subscription.updated events.
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { processCheckoutSession } from '@/lib/services/stripe'
import { logError } from '@/lib/server/utils/logger'
import { createServiceClient } from '@/lib/supabase/service'
import { getTierByProductId } from '@/lib/server/data/subscription-tiers'

// Create Stripe instance for webhook verification
function getStripeInstance(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }
  return new Stripe(secretKey, {
    // Using latest API version - type assertion to bypass SDK type constraints
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  })
}

const stripe = getStripeInstance()

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: Request) {
  if (!webhookSecret) {
    logError(new Error('STRIPE_WEBHOOK_SECRET not configured'), {
      route: 'POST /api/webhooks/stripe',
      operation: 'webhook-config-check',
    })
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    logError(err as Error, {
      route: 'POST /api/webhooks/stripe',
      operation: 'webhook-verification',
    })
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  // Check if event has already been processed (idempotency check)
  const supabaseService = createServiceClient()
  const { data: existingEvent } = await supabaseService
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single()

  if (existingEvent) {
    // Event already processed - return success (idempotent)
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    // Handle different event types
    let processingSuccess = false

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Only process subscription checkouts
        if (session.mode === 'subscription') {
          const result = await processCheckoutSession(session.id)

          if (!result.success) {
            logError(result.error || new Error('Unknown error'), {
              route: 'POST /api/webhooks/stripe',
              operation: 'process-checkout-session',
              sessionId: session.id,
            })
          } else {
            processingSuccess = true
            // Process referral rewards after successful checkout
            const userId = session.metadata?.user_id
            if (userId) {
              // Get payment intent from session or subscription
              let paymentIntentId: string | null = null
              let amountCents = session.amount_total || 0
              const currency = session.currency || 'usd'

              // Try to get payment intent from session
              if (session.payment_intent) {
                paymentIntentId =
                  typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent.id
              } else if (session.subscription) {
                // For subscriptions, use subscription ID as identifier
                // Get the latest invoice to find payment intent
                const subscriptionId =
                  typeof session.subscription === 'string'
                    ? session.subscription
                    : session.subscription.id

                try {
                  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
                    expand: ['latest_invoice.payment_intent'],
                  })
                  if (
                    subscription.latest_invoice &&
                    typeof subscription.latest_invoice !== 'string'
                  ) {
                    const invoice = subscription.latest_invoice
                    if (invoice.payment_intent) {
                      paymentIntentId =
                        typeof invoice.payment_intent === 'string'
                          ? invoice.payment_intent
                          : invoice.payment_intent.id
                    }
                    amountCents = invoice.amount_paid || amountCents
                  }
                } catch (err) {
                  // Fallback to using subscription ID as identifier
                  paymentIntentId = `sub_${subscriptionId}`
                }
              }

              // If we have a payment intent or subscription ID, record purchase and process referrals
              if (paymentIntentId) {
                const { recordPurchaseAndProcessReferrals } = await import(
                  '@/lib/services/stripe'
                )
                const referralResult = await recordPurchaseAndProcessReferrals(
                  userId,
                  paymentIntentId,
                  amountCents,
                  currency
                )

                if (!referralResult.success) {
                  logError(referralResult.error || new Error('Unknown error'), {
                    route: 'POST /api/webhooks/stripe',
                    operation: 'record-purchase-and-process-referrals',
                    sessionId: session.id,
                    userId,
                  })
                }
              }
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        const result = await handleSubscriptionUpdate(subscription)
        processingSuccess = result.success
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const result = await handleSubscriptionCancellation(subscription)
        processingSuccess = result.success
        break
      }

      default:
        // Unhandled event type - still record as processed
        processingSuccess = true
        break
    }

    // Record event after successful processing
    // Handle race conditions (unique constraint violation = already processed by another request)
    if (processingSuccess) {
      const { error: insertError } = await supabaseService
        .from('stripe_webhook_events')
        .insert({
          event_id: event.id,
          event_type: event.type,
          data: event.data,
        })

      if (insertError) {
        // If unique constraint violation, event was processed by another request
        // This is fine - return success (idempotent)
        if (insertError.code === '23505') {
          // Unique violation - already processed
          return NextResponse.json({ received: true, duplicate: true })
        }
        // Other database errors - log but don't fail the webhook
        logError(insertError as Error, {
          route: 'POST /api/webhooks/stripe',
          operation: 'record-webhook-event',
          eventId: event.id,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logError(error as Error, {
      route: 'POST /api/webhooks/stripe',
      operation: 'webhook-processing',
      eventType: event.type,
    })
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle subscription update event
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const supabaseService = createServiceClient()

    // Get product ID from subscription
    const priceId = subscription.items.data[0]?.price.id
    if (!priceId) {
      return { success: false, error: new Error('Price ID not found') }
    }

    const price = await stripe.prices.retrieve(priceId)
    const productId = price.product as string

    // Find tier configuration
    const tierConfig = await getTierByProductId(productId)

    if (!tierConfig || !tierConfig.product_id) {
      return { success: false, error: new Error(`Tier not found for product ID: ${productId}`) }
    }

    // Get customer ID
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    // Find user by customer ID
    const { data: existingSub } = await supabaseService
      .from('user_subscriptions')
      .select('user_id, credits_remaining, product_id, current_period_start')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!existingSub) {
      return { success: false, error: new Error('Subscription not found in database') }
    }

    // Check if this is a tier change or new billing period
    const isTierChange = existingSub.product_id !== productId
    const isNewPeriod = !existingSub.current_period_start || 
      new Date(existingSub.current_period_start) < new Date(subscription.current_period_start * 1000)

    // Reset credits on tier change or new billing period
    const creditsToSet = (isTierChange || isNewPeriod) && subscription.status === 'active'
      ? tierConfig.credits_per_month
      : existingSub.credits_remaining

    // Update subscription
    const { error: updateError } = await supabaseService
      .from('user_subscriptions')
      .update({
        subscription_id: subscription.id,
        product_id: productId,
        status: subscription.status === 'active' ? 'active' : subscription.status,
        credits_total: tierConfig.credits_per_month,
        credits_remaining: creditsToSet,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('user_id', existingSub.user_id)

    if (updateError) {
      return { success: false, error: updateError as Error }
    }

    return { success: true, error: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const supabaseService = createServiceClient()

    // Get customer ID
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    // Update subscription to cancelled status
    const { error: updateError } = await supabaseService
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        // Keep existing credits but don't allow new ones
      })
      .eq('stripe_customer_id', customerId)

    if (updateError) {
      return { success: false, error: updateError as Error }
    }

    return { success: true, error: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}
