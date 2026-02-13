/**
 * Stripe Service
 * 
 * Handles all Stripe-related operations for subscriptions and payments.
 * Provides functions for checkout sessions, customer portal, and subscription checks.
 */

import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getTierByProductId as getTierByProductIdServer } from '@/lib/server/data/subscription-tiers'
import { logError } from '@/lib/server/utils/logger'
import { createNotification } from '@/lib/server/notifications/create'

// Initialize Stripe client
let stripeInstance: Stripe | null = null

function getStripe(): Stripe {
  if (stripeInstance) {
    return stripeInstance
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }

  stripeInstance = new Stripe(secretKey, {
    // Using latest API version - type assertion to bypass SDK type constraints
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  })

  return stripeInstance
}

/**
 * Check user subscription status
 * Queries database directly (no external API call needed)
 */
export async function checkSubscription(
  userId: string
): Promise<{
  subscribed: boolean
  status: string
  tier: string
  product_id: string | null
  subscription_end: string | null
  credits_remaining: number
  credits_total: number
  error: Error | null
}> {
  try {
    const supabase = await createClient()

    const { data: subscription, error: dbError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (dbError && dbError.code !== 'PGRST116') {
      return {
        subscribed: false,
        status: 'free',
        tier: 'free',
        product_id: null,
        subscription_end: null,
        credits_remaining: 10,
        credits_total: 10,
        error: dbError as Error,
      }
    }

    // If no subscription found, return free tier defaults
    if (!subscription) {
      return {
        subscribed: false,
        status: 'free',
        tier: 'free',
        product_id: null,
        subscription_end: null,
        credits_remaining: 10,
        credits_total: 10,
        error: null,
      }
    }

    // Return subscription data
    // Get tier name from tier config
    const tierConfig = await getTierByProductIdServer(subscription.product_id)
    // Map tier config name to tier name string
    const nameToTier: Record<string, string> = {
      'Free': 'free',
      'Starter': 'starter',
      'Advanced': 'advanced',
      'Pro': 'pro',
    }
    const tierName = nameToTier[tierConfig.name] || 'free'
    return {
      subscribed: subscription.status !== 'free' && subscription.status !== 'cancelled',
      status: subscription.status,
      tier: tierName,
      product_id: subscription.product_id,
      subscription_end: subscription.current_period_end,
      credits_remaining: subscription.credits_remaining,
      credits_total: subscription.credits_total,
      error: null,
    }
  } catch (error) {
    return {
      subscribed: false,
      status: 'free',
      tier: 'free',
      product_id: null,
      subscription_end: null,
      credits_remaining: 10,
      credits_total: 10,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Get or create Stripe customer ID for user
 * Validates existing customer ID exists in Stripe (handles test->live migration)
 */
async function getOrCreateStripeCustomer(
  userId: string,
  userEmail: string
): Promise<string> {
  const supabase = await createClient()
  const stripe = getStripe()

  // Check if user already has a Stripe customer ID
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (subscription?.stripe_customer_id) {
    // Verify the customer exists in Stripe (handles test->live migration)
    try {
      await stripe.customers.retrieve(subscription.stripe_customer_id)
      // Customer exists, return it
      return subscription.stripe_customer_id
    } catch (error) {
      // Customer doesn't exist (likely from test mode, now in live mode)
      // Log the error and create a new customer
      logError(error as Error, {
        operation: 'validate-stripe-customer',
        userId,
        customerId: subscription.stripe_customer_id,
        route: 'getOrCreateStripeCustomer',
      })
      // Fall through to create new customer
    }
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: userEmail,
    metadata: {
      user_id: userId,
    },
  })

  // Save customer ID to database using service role client (bypasses RLS)
  const supabaseService = createServiceClient()
  const { data: existingSub } = await supabaseService
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existingSub) {
    await supabaseService
      .from('user_subscriptions')
      .update({ stripe_customer_id: customer.id })
      .eq('user_id', userId)
  } else {
    await supabaseService
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        stripe_customer_id: customer.id,
        status: 'free',
        credits_total: 10,
        credits_remaining: 10,
      })
  }

  return customer.id
}

/**
 * Detect Stripe mode (test vs live) from secret key
 */
function getStripeMode(): 'test' | 'live' {
  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  return secretKey.startsWith('sk_test_') ? 'test' : 'live'
}

/**
 * Create Stripe checkout session
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  priceId: string
): Promise<{
  url: string | null
  error: Error | null
}> {
  try {
    const stripe = getStripe()
    const stripeMode = getStripeMode()

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(userId, userEmail)

    // Determine success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    const successUrl = `${baseUrl}/studio?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/studio`

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
      },
    })

    return {
      url: session.url,
      error: null,
    }
  } catch (error) {
    // Enhanced error handling for price ID mismatches
    if (error instanceof Error && error.message.includes('No such price')) {
      const stripeMode = getStripeMode()
      const modeMismatchError = new Error(
        `Price ID '${priceId}' not found in Stripe ${stripeMode} mode. ` +
        `Please ensure your database has ${stripeMode} mode price IDs. ` +
        `If you're running locally, you need test mode price IDs (price_1...). ` +
        `If you're in production, you need live mode price IDs.`
      )
      logError(error, {
        operation: 'create-checkout-session',
        userId,
        priceId,
        stripeMode,
        route: 'createCheckoutSession',
      })
      return {
        url: null,
        error: modeMismatchError,
      }
    }

    logError(error as Error, {
      operation: 'create-checkout-session',
      userId,
      priceId,
      route: 'createCheckoutSession',
    })
    return {
      url: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Process a completed checkout session and update subscription
 * This is called by webhooks or when user returns from checkout.
 * When expectedUserId is provided (e.g. from the process-checkout route), the session
 * must belong to that user; otherwise the request is rejected (security hardening).
 */
export async function processCheckoutSession(
  sessionId: string,
  expectedUserId?: string
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const stripe = getStripe()
    const supabaseService = createServiceClient()

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items'],
    })

    // Only process completed sessions
    if (session.status !== 'complete') {
      return {
        success: false,
        error: new Error(`Checkout session not complete. Status: ${session.status}`),
      }
    }

    // Get user ID from session metadata
    const userId = session.metadata?.user_id
    if (!userId) {
      return {
        success: false,
        error: new Error('User ID not found in checkout session metadata'),
      }
    }

    // Security: when called from the return flow, only the user who owned the checkout can complete it
    if (expectedUserId != null && userId !== expectedUserId) {
      return {
        success: false,
        error: new Error('Session does not belong to the authenticated user'),
      }
    }

    // Get subscription from Stripe if available
    let subscription: Stripe.Subscription | null = null
    if (session.subscription) {
      if (typeof session.subscription === 'string') {
        subscription = await stripe.subscriptions.retrieve(session.subscription)
      } else {
        subscription = session.subscription
      }
    }

    if (!subscription) {
      return {
        success: false,
        error: new Error('Subscription not found in checkout session'),
      }
    }

    // Get product ID from subscription
    const priceId = subscription.items.data[0]?.price.id
    if (!priceId) {
      return {
        success: false,
        error: new Error('Price ID not found in subscription'),
      }
    }

    // Get price details to find product ID
    const price = await stripe.prices.retrieve(priceId)
    const productId = price.product as string

    // Find tier configuration by product ID
    const tierConfig = await getTierByProductIdServer(productId)

    if (!tierConfig || !tierConfig.product_id) {
      return {
        success: false,
        error: new Error(`Tier not found for product ID: ${productId}`),
      }
    }

    // Get customer ID
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    // Update or create subscription record
    const { data: existingSub } = await supabaseService
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Determine if this is a tier change (upgrade/downgrade)
    const isTierChange = existingSub && existingSub.product_id !== productId
    // Reset credits on new subscription or tier change
    const creditsToSet = isTierChange || !existingSub 
      ? tierConfig.credits_per_month 
      : existingSub.credits_remaining

    const subscriptionData = {
      stripe_customer_id: customerId,
      subscription_id: subscription.id,
      product_id: productId,
      status: subscription.status === 'active' ? 'active' : subscription.status,
      credits_total: tierConfig.credits_per_month,
      credits_remaining: creditsToSet,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    }

    if (existingSub) {
      // Update existing subscription
      const { error: updateError, data: updateData } = await supabaseService
        .from('user_subscriptions')
        .update(subscriptionData)
        .eq('user_id', userId)
        .select()
        .single()
      if (updateError) {
        return {
          success: false,
          error: updateError as Error,
        }
      }
    } else {
      // Create new subscription
      const { error: insertError, data: insertData } = await supabaseService
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          ...subscriptionData,
        })
        .select()
        .single()
      if (insertError) {
        return {
          success: false,
          error: insertError as Error,
        }
      }
    }

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Record purchase and process referral rewards
 * Called from webhook handler after successful purchase
 */
export async function recordPurchaseAndProcessReferrals(
  userId: string,
  paymentIntentId: string,
  amountCents: number,
  currency: string = 'usd'
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const supabaseService = createServiceClient()

    // 1. Record the purchase
    const { error: purchaseError } = await supabaseService
      .from('user_purchases')
      .insert({
        user_id: userId,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: amountCents,
        currency,
      })

    if (purchaseError) {
      // If it's a unique violation, purchase already recorded (idempotent)
      if (purchaseError.code === '23505') {
        // Purchase already exists, continue with referral processing
      } else {
        return { success: false, error: purchaseError as Error }
      }
    }

    // 2. Check if user has a pending referral (they were referred by someone)
    // Note: Referral code creation is now opt-in via the UI, not automatic on purchase
    const { data: pendingReferral } = await supabaseService
      .from('referrals')
      .select('*')
      .eq('referred_user_id', userId)
      .eq('status', 'pending')
      .single()

    if (pendingReferral) {
      // 5. Qualify the referral (mark as qualified)
      const { error: qualifyError } = await supabaseService
        .from('referrals')
        .update({
          status: 'qualified',
          qualified_at: new Date().toISOString(),
        })
        .eq('id', pendingReferral.id)

      if (qualifyError) {
        return { success: false, error: qualifyError as Error }
      }

      // 6. Grant credits using RPC function (idempotent)
      const { data: grantResult, error: grantError } = await supabaseService.rpc(
        'rpc_grant_referral_credits',
        {
          referral_id_input: pendingReferral.id,
          referrer_user_id_input: pendingReferral.referrer_user_id,
          referred_user_id_input: pendingReferral.referred_user_id,
          credits_amount: 10, // Default reward amount
        }
      )

      if (grantError) {
        // Log but don't fail - credits might have already been granted
        logError(grantError, {
          operation: 'grant-referral-credits',
          referralId: pendingReferral.id,
          userId,
        })
      } else if (grantResult && typeof grantResult === 'object' && 'status' in grantResult) {
        const result = grantResult as { status: string; message: string; already_rewarded?: boolean }
        if (result.status !== 'success' && !result.already_rewarded) {
          return {
            success: false,
            error: new Error(result.message || 'Failed to grant referral credits'),
          }
        }
        if (result.status === 'success') {
          await createNotification({
            user_id: pendingReferral.referrer_user_id,
            type: 'reward',
            title: 'Referral reward claimed',
            body: 'Someone joined with your link. Credits have been added to your account.',
            severity: 'success',
            action_url: '/studio',
            action_label: 'View credits',
          })
        }
      }
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
 * Create Stripe customer portal session
 */
export async function createCustomerPortalSession(
  userId: string
): Promise<{
  url: string | null
  error: Error | null
}> {
  try {
    const supabase = await createClient()

    // Get Stripe customer ID from database
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    if (!subscription?.stripe_customer_id) {
      return {
        url: null,
        error: new Error('No Stripe customer found. Please create a subscription first.'),
      }
    }

    const stripe = getStripe()

    // Determine return URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    const returnUrl = `${baseUrl}/studio`

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    })

    return {
      url: session.url,
      error: null,
    }
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}
