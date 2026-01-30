/**
 * One-time script to add referral reward notification to Stripe service and webhook.
 * Run from viewbait dir: node scripts/patch-referral-notification.js
 */
const fs = require('fs');
const path = require('path');

const viewbaitDir = path.resolve(__dirname, '..');

// 1. stripe.ts: add import and return referrerUserId from recordPurchaseAndProcessReferrals
const stripePath = path.join(viewbaitDir, 'lib/services/stripe.ts');
let stripeContent = fs.readFileSync(stripePath, 'utf8');

if (!stripeContent.includes("createNotification")) {
  stripeContent = stripeContent.replace(
    "import { logError } from '@/lib/server/utils/logger'",
    "import { logError } from '@/lib/server/utils/logger'\nimport { createNotification } from '@/lib/server/notifications/create'"
  );
}

const stripeBlock = `      } else if (grantResult && typeof grantResult === 'object' && 'status' in grantResult) {
        const result = grantResult as { status: string; message: string; already_rewarded?: boolean }
        if (result.status !== 'success' && !result.already_rewarded) {
          return {
            success: false,
            error: new Error(result.message || 'Failed to grant referral credits'),
          }
        }
      }
    }`;

const stripeBlockWithNotify = `      } else if (grantResult && typeof grantResult === 'object' && 'status' in grantResult) {
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
    }`;

if (!stripeContent.includes('Referral reward claimed')) {
  stripeContent = stripeContent.replace(stripeBlock, stripeBlockWithNotify);
}

fs.writeFileSync(stripePath, stripeContent);
console.log('stripe.ts patched');

// 2. webhook: add import and notify when referrerUserId returned (if we ever add that return)
const webhookPath = path.join(viewbaitDir, 'app/api/webhooks/stripe/route.ts');
let webhookContent = fs.readFileSync(webhookPath, 'utf8');

if (!webhookContent.includes("createNotification")) {
  webhookContent = webhookContent.replace(
    "import { createServiceClient } from '@/lib/supabase/service'",
    "import { createServiceClient } from '@/lib/supabase/service'\nimport { createNotification } from '@/lib/server/notifications/create'"
  );
}

fs.writeFileSync(webhookPath, webhookContent);
console.log('webhook route patched (import only; notification is sent from stripe.ts)');
