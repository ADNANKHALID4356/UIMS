/**
 * PayFast Pakistan (GoPayFast) Hosted Checkout (MVP)
 * ==================================================
 * This module creates a hosted-checkout payload.
 *
 * Notes:
 * - Exact endpoints/fields may vary by merchant plan.
 * - We keep this isolated so we can swap providers later.
 */

import crypto from 'crypto';

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for PayFast checkout`);
  return v;
}

function apiBase() {
  const mode = String(process.env.PAYFASTPK_MODE || 'sandbox').toLowerCase();
  if (mode === 'production' || mode === 'prod') return requiredEnv('PAYFASTPK_API_URL');
  return requiredEnv('PAYFASTPK_SANDBOX_URL');
}

export async function getAccessToken() {
  const url = `${apiBase().replace(/\/+$/, '')}/token`;
  const grantType = process.env.PAYFASTPK_GRANT_TYPE || 'client_credentials';
  const merchantId = requiredEnv('PAYFASTPK_MERCHANT_ID');
  const securedKey = requiredEnv('PAYFASTPK_SECURED_KEY');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: grantType,
      merchant_id: merchantId,
      secured_key: securedKey,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `PayFast token error (${res.status})`);
  // Common field names seen in community docs
  const token = json?.token || json?.access_token;
  const code = json?.code;
  if (code && String(code) !== '00') throw new Error(json?.message || `PayFast token rejected (code=${code})`);
  if (!token) throw new Error('PayFast token missing in response');
  return token;
}

export function computeSignature({ merchantId, merchantName, amountPkr, orderId }) {
  const s = `${merchantId}:${merchantName}:${amountPkr}:${orderId}`;
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

export async function createHostedCheckoutPayload({ orderId, amountPkr, customerEmail, customerMobile }) {
  const token = await getAccessToken();
  const merchantId = requiredEnv('PAYFASTPK_MERCHANT_ID');
  const merchantName = requiredEnv('PAYFASTPK_MERCHANT_NAME');
  const successUrl = requiredEnv('PAYFASTPK_SUCCESS_URL');
  const failureUrl = requiredEnv('PAYFASTPK_FAILURE_URL');

  const signature = computeSignature({ merchantId, merchantName, amountPkr, orderId });
  const checkoutCallback = `signature=${signature}&order_id=${orderId}`;

  const payload = {
    MERCHANT_ID: merchantId,
    MERCHANT_NAME: merchantName,
    TOKEN: token,
    PROCCODE: '00',
    TXNAMT: String(amountPkr),
    CUSTOMER_EMAIL_ADDRESS: customerEmail || '',
    CUSTOMER_MOBILE_NO: customerMobile || '',
    SIGNATURE: signature,
    VERSION: process.env.PAYFASTPK_VERSION || 'UIMS-PAYFASTPK-0.1',
    TXNDESC: `UIMS Payment ${orderId}`,
    SUCCESS_URL: encodeURIComponent(successUrl),
    FAILURE_URL: encodeURIComponent(failureUrl),
    BASKET_ID: orderId,
    ORDER_DATE: new Date().toISOString().replace('T', ' ').slice(0, 19),
    CHECKOUT_URL: encodeURIComponent(checkoutCallback),
  };

  // Community docs typically post to "/payment" under base URL.
  const actionUrl = `${apiBase().replace(/\/+$/, '')}/payment`;
  return { actionUrl, payload };
}

