/**
 * MVP In-Memory DB (replace with Postgres on VPS)
 * ===============================================
 * This is a functional placeholder so we can wire end-to-end flows immediately.
 *
 * We will migrate to Postgres once API + UI flows are stabilized.
 */

export const db = {
  users: new Map(), // id -> { id,email,passwordHash,createdAt,isAdmin }
  sessions: new Map(), // token -> userId
  devices: new Map(), // fingerprint -> { fingerprint, userId, firstSeenAt, trialEndsAt, licenseStatus, offlinePaid, offlinePaidAt, offlinePrice, syncPlan, syncPaidUntil }
  payments: [], // { id, userId, fingerprint, type, amount, status, createdAt, providerRef }
  pricing: {
    offlineOneTimePrice: 0,
    syncTiers: [
      { upTo: 10000, price: 5000 },
      { upTo: 20000, price: 8000 },
      { upTo: 35000, price: 10000 },
      { upTo: Infinity, price: 15000 },
    ],
  },
};

let idSeq = 1;
export function nextId(prefix = 'id') {
  return `${prefix}_${idSeq++}`;
}

