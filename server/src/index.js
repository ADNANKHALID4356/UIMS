import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { z } from 'zod';
import { createUser, login, requireAuth, requireAdmin } from './auth.js';
import { migrate, getPricing, setPricing } from './db.js';
import { ensureDevice, computeLicenseStatus, recordOfflinePayment } from './license.js';
import { createCheckout, markPaid } from './payfast.js';
import { createHostedCheckoutPayload } from './payfastPk.js';
import {
  anyAdminExists,
  adminOverview,
  createSyncAudit,
  createSyncMonthlyPayment,
  createSyncKeyForDevice,
  getDevice,
  getSyncKeyByHash,
  getSyncSubscription,
  listDevicesForUser,
  listPaymentsForUser,
  listSyncSubscriptionsForUser,
  listSyncKeysForUser,
  recordSyncUsagePush,
  revokeSyncKey,
  setDeviceBlocked,
  sha256Hex,
  upsertSyncSubscription,
} from './repo.js';
import { readSnapshotBase64, writeSnapshotBase64 } from './syncStorage.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false }));

await migrate();

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/public/pricing', async (_req, res, next) => {
  try {
    const pricing = await getPricing();
    res.json({ success: true, data: pricing });
  } catch (e) { next(e); }
});

// ---- Auth ----
app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);
    const user = await createUser({ email: body.email, password: body.password, isAdmin: false });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const out = await login(body);
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
});

app.get('/api/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ success: true, data: { id: req.user.id, isAdmin: req.user.isAdmin } });
  } catch (e) { next(e); }
});

app.get('/api/me/devices', requireAuth, (req, res, next) => {
  listDevicesForUser(req.user.id).then((rows) => res.json({ success: true, data: rows })).catch(next);
});

app.get('/api/me/payments', requireAuth, (req, res, next) => {
  listPaymentsForUser(req.user.id).then((rows) => res.json({ success: true, data: rows })).catch(next);
});

app.get('/api/me/sync/keys', requireAuth, (req, res, next) => {
  listSyncKeysForUser(req.user.id).then((rows) => res.json({ success: true, data: rows })).catch(next);
});

app.get('/api/me/sync/subscriptions', requireAuth, (req, res, next) => {
  listSyncSubscriptionsForUser(req.user.id).then((rows) => res.json({ success: true, data: rows })).catch(next);
});

// ---- Device trial start / license validate (Desktop calls these) ----
app.post('/api/device/register', requireAuth, (req, res, next) => {
  try {
    const body = z.object({ fingerprint: z.string().min(16) }).parse(req.body);
    ensureDevice({ fingerprint: body.fingerprint, userId: req.user.id }).then(async (device) => {
      const status = computeLicenseStatus(device);
      const pricing = await getPricing();
      res.json({ success: true, data: { device, license: status, pricing } });
    }).catch(next);
  } catch (e) { next(e); }
});

app.post('/api/license/validate', requireAuth, (req, res, next) => {
  try {
    const body = z.object({ fingerprint: z.string().min(16) }).parse(req.body);
    ensureDevice({ fingerprint: body.fingerprint, userId: req.user.id }).then((device) => {
      const license = computeLicenseStatus(device);
      res.json({ success: true, data: { license, device } });
    }).catch(next);
  } catch (e) { next(e); }
});

// ---- Payments ----
app.post('/api/payments/start', requireAuth, (req, res, next) => {
  try {
    const body = z.object({
      fingerprint: z.string().min(16),
      type: z.enum(['OFFLINE_ONE_TIME', 'SYNC_MONTHLY']),
      recordCount: z.number().int().nonnegative().optional(),
      months: z.number().int().positive().max(24).optional(),
    }).parse(req.body);

    (async () => {
      const pricing = await getPricing();
      const offlinePrice = Number(pricing?.offlineOneTimePrice || 0);
      const tiers = Array.isArray(pricing?.syncTiers) ? pricing.syncTiers : [];
      const months = Math.max(1, Number(body.months || 1));

      if (body.type === 'OFFLINE_ONE_TIME') {
        const amount = offlinePrice;
        const out = await createCheckout({ userId: req.user.id, fingerprint: body.fingerprint, type: body.type, amountPkr: amount });
        return res.json({ success: true, data: { paymentId: out.payment.id, checkoutUrl: out.checkoutUrl, amountPkr: amount } });
      }

      // SYNC_MONTHLY: pick tier by recordCount (client estimate)
      const rc = Math.max(0, Number(body.recordCount || 0));
      const sorted = tiers.slice().sort((a, b) => Number(a.upTo) - Number(b.upTo));
      const tier = sorted.find((t) => rc <= Number(t.upTo)) || sorted[sorted.length - 1];
      if (!tier) throw new Error('Sync pricing tiers are not configured');

      const tierLimitRecords = Number(tier.upTo);
      const monthly = Number(tier.price || 0);
      const amount = monthly * months;

      const out = await createCheckout({
        userId: req.user.id,
        fingerprint: body.fingerprint,
        type: body.type,
        amountPkr: amount,
        createPaymentFn: ({ userId, fingerprint, type, amountPkr }) => (
          createSyncMonthlyPayment({ userId, fingerprint, amountPkr, tierLimitRecords, months })
        ),
      });
      return res.json({
        success: true,
        data: {
          paymentId: out.payment.id,
          checkoutUrl: out.checkoutUrl,
          amountPkr: amount,
          months,
          tierLimitRecords,
          recordCount: rc,
        },
      });
    })().catch(next);
  } catch (e) { next(e); }
});

// DEV ONLY: simulate PayFast callback
app.post('/api/payments/mock/complete', (req, res, next) => {
  try {
    const body = z.object({ paymentId: z.string() }).parse(req.body);
    (async () => {
      const p = await markPaid(body.paymentId, 'mock');
      if (p.type === 'OFFLINE_ONE_TIME') {
        await recordOfflinePayment({ fingerprint: p.fingerprint, amountPkr: p.amount_pkr });
      }
      if (p.type === 'SYNC_MONTHLY') {
        const now = new Date();
        const months = Math.max(1, Number(p.sync_months || 1));
        const paidUntil = new Date(now);
        paidUntil.setMonth(paidUntil.getMonth() + months);
        await upsertSyncSubscription({
          fingerprint: p.fingerprint,
          tierLimitRecords: Number(p.sync_tier_limit_records || 10000),
          paidUntilIso: paidUntil.toISOString(),
          status: 'ACTIVE',
        });
      }
      res.json({ success: true, data: p });
    })().catch(next);
  } catch (e) { next(e); }
});

// Hosted checkout payload for PayFastPK (web calls this on /checkout/:id)
app.get('/api/payments/checkout/:paymentId', async (req, res, next) => {
  try {
    const params = z.object({ paymentId: z.string().min(3) }).parse(req.params);
    const r = await pool.query('SELECT * FROM payments WHERE id=$1', [params.paymentId]);
    const p = r.rows[0];
    if (!p) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (p.status !== 'PENDING') return res.json({ success: true, data: { status: p.status } });

    // If PayFastPK env not set, fall back to the existing mock checkout screen.
    const payfastEnabled = !!process.env.PAYFASTPK_MERCHANT_ID;
    if (!payfastEnabled) {
      return res.json({ success: true, data: { gateway: 'mock', paymentId: p.id, amountPkr: p.amount_pkr } });
    }

    const { actionUrl, payload } = await createHostedCheckoutPayload({
      orderId: p.id,
      amountPkr: p.amount_pkr,
      customerEmail: '', // optional (can be supplied later from user profile)
      customerMobile: '',
    });
    return res.json({ success: true, data: { gateway: 'payfastpk', actionUrl, fields: payload, paymentId: p.id, amountPkr: p.amount_pkr } });
  } catch (e) { next(e); }
});

// PayFastPK callbacks (browser redirects). We still rely on server-side verification later (IPN/webhook can be added).
app.get('/api/payfastpk/success', async (req, res, next) => {
  try {
    const q = z.object({ order_id: z.string().min(3).optional(), orderId: z.string().min(3).optional(), paymentId: z.string().min(3).optional() }).parse(req.query);
    const paymentId = q.order_id || q.orderId || q.paymentId;
    if (!paymentId) return res.status(400).json({ success: false, message: 'Missing payment id' });
    // Mark paid (for now) when PayFast redirects success.
    const p = await markPaid(paymentId, 'payfastpk-success');
    if (p.type === 'OFFLINE_ONE_TIME') {
      await recordOfflinePayment({ fingerprint: p.fingerprint, amountPkr: p.amount_pkr });
    }
    if (p.type === 'SYNC_MONTHLY') {
      const now = new Date();
      const months = Math.max(1, Number(p.sync_months || 1));
      const paidUntil = new Date(now);
      paidUntil.setMonth(paidUntil.getMonth() + months);
      await upsertSyncSubscription({
        fingerprint: p.fingerprint,
        tierLimitRecords: Number(p.sync_tier_limit_records || 10000),
        paidUntilIso: paidUntil.toISOString(),
        status: 'ACTIVE',
      });
    }
    return res.redirect(`${process.env.PUBLIC_WEB_BASE_URL || 'http://localhost:3000'}/checkout/${paymentId}?paid=1`);
  } catch (e) { next(e); }
});

app.get('/api/payfastpk/failure', async (req, res) => {
  const web = process.env.PUBLIC_WEB_BASE_URL || 'http://localhost:3000';
  res.redirect(`${web}/checkout/failure`);
});

// ---- Admin ----
app.post('/api/admin/bootstrap', async (req, res, next) => {
  // One-time creation of an admin account in MVP
  try {
    if (await anyAdminExists()) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }
    const body = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);
    const user = await createUser({ email: body.email, password: body.password, isAdmin: true });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
  (async () => {
    const overview = await adminOverview();
    const pricing = await getPricing();
    res.json({ success: true, data: { ...overview, pricing } });
  })().catch((e) => res.status(400).json({ success: false, message: e.message }));
});

app.post('/api/admin/pricing', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = z.object({
      offlineOneTimePrice: z.number().int().nonnegative(),
      syncTiers: z.array(z.object({ upTo: z.number().int().positive(), price: z.number().int().nonnegative() })).min(1),
    }).parse(req.body);
    setPricing({
      offlineOneTimePrice: body.offlineOneTimePrice,
      syncTiers: body.syncTiers.map((t) => ({ upTo: t.upTo, price: t.price })),
    }).then(async () => {
      const pricing = await getPricing();
      res.json({ success: true, data: pricing });
    }).catch(next);
  } catch (e) { next(e); }
});

app.post('/api/admin/device/block', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = z.object({ fingerprint: z.string().min(16), blocked: z.boolean() }).parse(req.body);
    setDeviceBlocked(body.fingerprint, body.blocked).then((d) => res.json({ success: true, data: d })).catch(next);
  } catch (e) { next(e); }
});

// ---- Sync (API-key based, used by Desktop SyncService) ----
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
  return req.ip;
}

async function authorizeSync({ apiKey, fingerprint }) {
  const apiKeyHash = sha256Hex(apiKey);
  const keyRow = await getSyncKeyByHash(apiKeyHash);
  if (!keyRow || keyRow.revoked_at) {
    return { ok: false, status: 401, message: 'Invalid or revoked API key' };
  }
  if (String(keyRow.fingerprint) !== String(fingerprint)) {
    return { ok: false, status: 403, message: 'API key is not valid for this device' };
  }
  const device = await getDevice(fingerprint);
  if (!device) return { ok: false, status: 404, message: 'Device not registered' };
  if (device.license_status === 'BLOCKED') {
    return { ok: false, status: 403, message: 'Device is blocked' };
  }
  const sub = await getSyncSubscription(fingerprint);
  return { ok: true, keyRow, device, sub };
}

function subscriptionAllows({ sub, recordCount }) {
  const now = Date.now();
  if (!sub || sub.status !== 'ACTIVE') return { ok: false, message: 'Sync subscription is not active' };
  const paidUntil = sub.paid_until ? new Date(sub.paid_until).getTime() : 0;
  if (!paidUntil || paidUntil < now) return { ok: false, message: 'Sync subscription is past due' };
  const limit = Number(sub.tier_limit_records || 0);
  const rc = Math.max(0, Number(recordCount || 0));
  if (limit > 0 && rc > limit) return { ok: false, message: `Record count exceeds tier limit (${rc} > ${limit})` };
  return { ok: true };
}

app.post('/api/sync/verify', async (req, res, next) => {
  try {
    const body = z.object({
      apiKey: z.string().min(16),
      fingerprint: z.string().min(16),
      recordCount: z.number().int().nonnegative().optional(),
    }).parse(req.body);

    const auth = await authorizeSync({ apiKey: body.apiKey, fingerprint: body.fingerprint });
    if (!auth.ok) {
      await createSyncAudit({ fingerprint: body.fingerprint, userId: null, action: 'VERIFY', ok: false, message: auth.message, recordCount: body.recordCount, ip: clientIp(req) });
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const allow = subscriptionAllows({ sub: auth.sub, recordCount: body.recordCount || 0 });
    await createSyncAudit({ fingerprint: body.fingerprint, userId: auth.keyRow.user_id, action: 'VERIFY', ok: allow.ok, message: allow.ok ? 'OK' : allow.message, recordCount: body.recordCount, ip: clientIp(req) });
    if (!allow.ok) return res.status(402).json({ success: false, message: allow.message, data: { subscription: auth.sub } });

    return res.json({ success: true, data: { subscription: auth.sub } });
  } catch (e) { next(e); }
});

app.post('/api/sync/push', async (req, res, next) => {
  try {
    const body = z.object({
      apiKey: z.string().min(16),
      fingerprint: z.string().min(16),
      businessId: z.string().min(6),
      recordCount: z.number().int().nonnegative(),
      hash: z.string().min(16).optional(),
      snapshotB64: z.string().min(100),
    }).parse(req.body);

    const auth = await authorizeSync({ apiKey: body.apiKey, fingerprint: body.fingerprint });
    if (!auth.ok) {
      await createSyncAudit({ fingerprint: body.fingerprint, userId: null, action: 'PUSH', ok: false, message: auth.message, recordCount: body.recordCount, ip: clientIp(req) });
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const allow = subscriptionAllows({ sub: auth.sub, recordCount: body.recordCount });
    if (!allow.ok) {
      await createSyncAudit({ fingerprint: body.fingerprint, userId: auth.keyRow.user_id, action: 'PUSH', ok: false, message: allow.message, recordCount: body.recordCount, ip: clientIp(req) });
      return res.status(402).json({ success: false, message: allow.message, data: { subscription: auth.sub } });
    }

    const w = writeSnapshotBase64(body.businessId, body.snapshotB64);
    const usage = await recordSyncUsagePush({ fingerprint: body.fingerprint, recordCount: body.recordCount });
    await createSyncAudit({ fingerprint: body.fingerprint, userId: auth.keyRow.user_id, action: 'PUSH', ok: true, message: 'OK', recordCount: body.recordCount, ip: clientIp(req) });
    return res.json({ success: true, data: { bytes: w.bytes, usage, hash: body.hash || null } });
  } catch (e) { next(e); }
});

app.post('/api/sync/pull', async (req, res, next) => {
  try {
    const body = z.object({
      apiKey: z.string().min(16),
      fingerprint: z.string().min(16),
      businessId: z.string().min(6),
    }).parse(req.body);

    const auth = await authorizeSync({ apiKey: body.apiKey, fingerprint: body.fingerprint });
    if (!auth.ok) {
      await createSyncAudit({ fingerprint: body.fingerprint, userId: null, action: 'PULL', ok: false, message: auth.message, recordCount: null, ip: clientIp(req) });
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const allow = subscriptionAllows({ sub: auth.sub, recordCount: 0 });
    if (!allow.ok) {
      await createSyncAudit({ fingerprint: body.fingerprint, userId: auth.keyRow.user_id, action: 'PULL', ok: false, message: allow.message, recordCount: null, ip: clientIp(req) });
      return res.status(402).json({ success: false, message: allow.message, data: { subscription: auth.sub } });
    }

    const snapshotB64 = readSnapshotBase64(body.businessId);
    await createSyncAudit({ fingerprint: body.fingerprint, userId: auth.keyRow.user_id, action: 'PULL', ok: !!snapshotB64, message: snapshotB64 ? 'OK' : 'No snapshot found', recordCount: null, ip: clientIp(req) });
    if (!snapshotB64) return res.status(404).json({ success: false, message: 'No snapshot found for this businessId' });
    return res.json({ success: true, data: { snapshotB64 } });
  } catch (e) { next(e); }
});

// ---- Admin Sync management ----
app.get('/api/admin/sync/keys', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const q = z.object({ userId: z.string().optional() }).parse(req.query);
    const userId = q.userId || req.user.id;
    listSyncKeysForUser(userId).then((rows) => res.json({ success: true, data: rows })).catch(next);
  } catch (e) { next(e); }
});

app.post('/api/admin/sync/key/issue', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({ fingerprint: z.string().min(16) }).parse(req.body);
    const device = await getDevice(body.fingerprint);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    const out = await createSyncKeyForDevice({ fingerprint: body.fingerprint, userId: device.user_id });
    res.json({ success: true, data: { apiKey: out.apiKey, key: out.row } });
  } catch (e) { next(e); }
});

app.post('/api/admin/sync/key/revoke', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = z.object({ id: z.string().min(3) }).parse(req.body);
    revokeSyncKey({ id: body.id }).then((row) => res.json({ success: true, data: row })).catch(next);
  } catch (e) { next(e); }
});

app.post('/api/admin/sync/subscription/set', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = z.object({
      fingerprint: z.string().min(16),
      tierLimitRecords: z.number().int().positive(),
      paidUntilIso: z.string().datetime().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'PAST_DUE', 'SUSPENDED']).optional(),
    }).parse(req.body);
    upsertSyncSubscription({
      fingerprint: body.fingerprint,
      tierLimitRecords: body.tierLimitRecords,
      paidUntilIso: body.paidUntilIso,
      status: body.status || 'INACTIVE',
    }).then((row) => res.json({ success: true, data: row })).catch(next);
  } catch (e) { next(e); }
});

// ---- Error handling ----
app.use((err, _req, res, _next) => {
  const status = err.status || 400;
  res.status(status).json({ success: false, message: err.message || 'Error' });
});

const port = Number(process.env.PORT || 8788);
app.listen(port, () => {
  console.log(`[uims-vps-server] listening on http://localhost:${port}`);
});

