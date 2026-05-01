import crypto from 'crypto';

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function ensureIds(cfg) {
  const now = Date.now();
  let changed = false;
  const out = { ...cfg };
  if (!out.deviceId) {
    out.deviceId = crypto.randomBytes(8).toString('hex');
    changed = true;
  }
  if (!out.businessId) {
    out.businessId = `biz_${now.toString(36)}`;
    changed = true;
  }
  return { cfg: out, changed };
}

