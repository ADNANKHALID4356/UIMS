import { pool } from './db.js';
import { nextId } from './storage/memoryDb.js';
import crypto from 'crypto';

// NOTE: nextId is fine for MVP; Postgres sequences/uuid can be used later.

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex');
}

export function generateApiKey() {
  // 32 bytes -> 64 hex chars; good enough for MVP.
  return crypto.randomBytes(32).toString('hex');
}

export async function findUserByEmail(email) {
  const r = await pool.query('SELECT id,email,password_hash,is_admin,created_at FROM users WHERE email = $1', [email]);
  return r.rows[0] || null;
}

export async function createUserRow({ email, passwordHash, isAdmin }) {
  const id = nextId('u');
  const r = await pool.query(
    'INSERT INTO users(id,email,password_hash,is_admin) VALUES ($1,$2,$3,$4) RETURNING id,email,is_admin,created_at',
    [id, email, passwordHash, !!isAdmin]
  );
  return r.rows[0];
}

export async function anyAdminExists() {
  const r = await pool.query('SELECT 1 FROM users WHERE is_admin = TRUE LIMIT 1');
  return r.rowCount > 0;
}

export async function getDevice(fingerprint) {
  const r = await pool.query('SELECT * FROM devices WHERE fingerprint = $1', [fingerprint]);
  return r.rows[0] || null;
}

export async function upsertDeviceTrial({ fingerprint, userId, trialEndsAtIso }) {
  const r = await pool.query(
    `INSERT INTO devices (fingerprint, user_id, trial_ends_at, license_status)
     VALUES ($1,$2,$3,'TRIAL')
     ON CONFLICT(fingerprint) DO NOTHING
     RETURNING *`,
    [fingerprint, userId, trialEndsAtIso]
  );
  if (r.rowCount === 0) return await getDevice(fingerprint);
  return r.rows[0];
}

export async function markDeviceOfflinePaid({ fingerprint, amountPkr }) {
  const r = await pool.query(
    `UPDATE devices
     SET offline_paid=TRUE, offline_paid_at=NOW(), offline_price_pkr=$2, license_status='ACTIVE'
     WHERE fingerprint=$1
     RETURNING *`,
    [fingerprint, amountPkr]
  );
  return r.rows[0] || null;
}

export async function createPayment({ userId, fingerprint, type, amountPkr }) {
  const id = nextId('pay');
  const r = await pool.query(
    `INSERT INTO payments(id,user_id,fingerprint,type,amount_pkr,status, sync_tier_limit_records, sync_months)
     VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7)
     RETURNING *`,
    [id, userId, fingerprint, type, amountPkr, null, 1]
  );
  return r.rows[0];
}

export async function createSyncMonthlyPayment({ userId, fingerprint, amountPkr, tierLimitRecords, months }) {
  const id = nextId('pay');
  const m = Math.max(1, Number(months || 1));
  const r = await pool.query(
    `INSERT INTO payments(id,user_id,fingerprint,type,amount_pkr,status, sync_tier_limit_records, sync_months)
     VALUES ($1,$2,$3,'SYNC_MONTHLY',$4,'PENDING',$5,$6)
     RETURNING *`,
    [id, userId, fingerprint, amountPkr, Number(tierLimitRecords) || 10000, m]
  );
  return r.rows[0];
}

export async function markPaymentPaid({ paymentId, providerRef }) {
  const r = await pool.query(
    `UPDATE payments SET status='PAID', provider_ref=$2 WHERE id=$1 RETURNING *`,
    [paymentId, providerRef]
  );
  return r.rows[0] || null;
}

export async function adminOverview() {
  const u = await pool.query('SELECT COUNT(*)::int as c FROM users');
  const d = await pool.query('SELECT COUNT(*)::int as c FROM devices');
  const p = await pool.query('SELECT COUNT(*)::int as c FROM payments');
  return { users: u.rows[0].c, devices: d.rows[0].c, payments: p.rows[0].c };
}

export async function countDevicesForUser(userId) {
  const r = await pool.query('SELECT COUNT(*)::int as c FROM devices WHERE user_id = $1', [userId]);
  return r.rows[0].c;
}

export async function listDevicesForUser(userId) {
  const r = await pool.query(
    `SELECT fingerprint, first_seen_at, trial_ends_at, license_status, offline_paid, offline_paid_at, offline_price_pkr
     FROM devices WHERE user_id=$1 ORDER BY first_seen_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function listPaymentsForUser(userId) {
  const r = await pool.query(
    `SELECT id, fingerprint, type, amount_pkr, status, provider_ref, created_at
     FROM payments WHERE user_id=$1 ORDER BY created_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function setDeviceBlocked(fingerprint, blocked = true) {
  const status = blocked ? 'BLOCKED' : 'TRIAL';
  const r = await pool.query(
    `UPDATE devices SET license_status=$2 WHERE fingerprint=$1 RETURNING *`,
    [fingerprint, status]
  );
  return r.rows[0] || null;
}

function monthKeyFromDate(d = new Date()) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getSyncKeyByHash(apiKeyHash) {
  const r = await pool.query(
    `SELECT id, fingerprint, user_id, api_key_hash, created_at, revoked_at
     FROM sync_keys WHERE api_key_hash=$1`,
    [apiKeyHash]
  );
  return r.rows[0] || null;
}

export async function listSyncKeysForUser(userId) {
  const r = await pool.query(
    `SELECT id, fingerprint, created_at, revoked_at
     FROM sync_keys WHERE user_id=$1 ORDER BY created_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function listSyncSubscriptionsForUser(userId) {
  const r = await pool.query(
    `SELECT s.fingerprint, s.tier_limit_records, s.paid_until, s.status, s.updated_at
     FROM sync_subscriptions s
     JOIN devices d ON d.fingerprint = s.fingerprint
     WHERE d.user_id = $1
     ORDER BY s.updated_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function createSyncKeyForDevice({ fingerprint, userId }) {
  const apiKey = generateApiKey();
  const apiKeyHash = sha256Hex(apiKey);
  const id = nextId('sk');
  const r = await pool.query(
    `INSERT INTO sync_keys(id, fingerprint, user_id, api_key_hash)
     VALUES ($1,$2,$3,$4)
     RETURNING id, fingerprint, user_id, created_at, revoked_at`,
    [id, fingerprint, userId, apiKeyHash]
  );
  return { apiKey, row: r.rows[0] };
}

export async function revokeSyncKey({ id }) {
  const r = await pool.query(`UPDATE sync_keys SET revoked_at=NOW() WHERE id=$1 RETURNING *`, [id]);
  return r.rows[0] || null;
}

export async function getSyncSubscription(fingerprint) {
  const r = await pool.query(
    `SELECT fingerprint, tier_limit_records, paid_until, status, updated_at
     FROM sync_subscriptions WHERE fingerprint=$1`,
    [fingerprint]
  );
  return r.rows[0] || null;
}

export async function upsertSyncSubscription({ fingerprint, tierLimitRecords, paidUntilIso, status }) {
  const r = await pool.query(
    `INSERT INTO sync_subscriptions(fingerprint, tier_limit_records, paid_until, status)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT(fingerprint) DO UPDATE SET
       tier_limit_records=EXCLUDED.tier_limit_records,
       paid_until=EXCLUDED.paid_until,
       status=EXCLUDED.status,
       updated_at=NOW()
     RETURNING *`,
    [fingerprint, tierLimitRecords, paidUntilIso || null, status || 'INACTIVE']
  );
  return r.rows[0];
}

export async function recordSyncUsagePush({ fingerprint, recordCount }) {
  const monthKey = monthKeyFromDate(new Date());
  const rc = Math.max(0, Number(recordCount || 0));
  const r = await pool.query(
    `INSERT INTO sync_usage_monthly(fingerprint, month_key, last_record_count, max_record_count, pushes, last_push_at)
     VALUES ($1,$2,$3,$3,1,NOW())
     ON CONFLICT(fingerprint, month_key) DO UPDATE SET
       last_record_count=EXCLUDED.last_record_count,
       max_record_count=GREATEST(sync_usage_monthly.max_record_count, EXCLUDED.max_record_count),
       pushes=sync_usage_monthly.pushes + 1,
       last_push_at=NOW()
     RETURNING *`,
    [fingerprint, monthKey, rc]
  );
  return r.rows[0];
}

export async function getSyncUsageMonth({ fingerprint, monthKey }) {
  const r = await pool.query(
    `SELECT fingerprint, month_key, last_record_count, max_record_count, pushes, last_push_at
     FROM sync_usage_monthly WHERE fingerprint=$1 AND month_key=$2`,
    [fingerprint, monthKey]
  );
  return r.rows[0] || null;
}

export async function createSyncAudit({ fingerprint, userId, action, ok, message, recordCount, ip }) {
  const id = nextId('sa');
  const r = await pool.query(
    `INSERT INTO sync_audit(id,fingerprint,user_id,action,ok,message,record_count,ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [id, fingerprint || null, userId || null, action, !!ok, message || null, recordCount ?? null, ip || null]
  );
  return r.rows[0];
}

