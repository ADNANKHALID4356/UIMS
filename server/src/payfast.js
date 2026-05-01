/**
 * PayFast Integration (MVP placeholder)
 * ===================================
 * We will replace this with real PayFast parameter signing + webhook verification
 * once you provide merchant credentials and the exact PayFast Pakistan docs endpoints.
 *
 * For now:
 * - createCheckout returns a payment URL on our website (hosted checkout page)
 * - webhook is simulated by calling /api/payments/mock/complete in dev
 */

import { createPayment, markPaymentPaid } from './repo.js';

export function createCheckout({ userId, fingerprint, type, amountPkr, createPaymentFn }) {
  // Persisted payment record
  const paymentPromise = (createPaymentFn || createPayment)({ userId, fingerprint, type, amountPkr });

  // In production this would be PayFast hosted payment URL
  return paymentPromise.then((payment) => {
    const checkoutUrl = `${process.env.PUBLIC_WEB_BASE_URL || 'http://localhost:3000'}/checkout/${payment.id}`;
    return { payment, checkoutUrl };
  });
}

export function markPaid(paymentId, providerRef = 'mock') {
  return markPaymentPaid({ paymentId, providerRef }).then((p) => {
    if (!p) throw new Error('Payment not found');
    return p;
  });
}

