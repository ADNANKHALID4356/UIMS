const KEY = 'uims_license_cache_v1';

export function getCachedLicense() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function setCachedLicense(cache) {
  localStorage.setItem(KEY, JSON.stringify(cache));
}

export function clearCachedLicense() {
  localStorage.removeItem(KEY);
}

export function computeOfflineStrictValidity(cached) {
  if (!cached?.license) return { ok: false, reason: 'NO_CACHE' };
  const lic = cached.license;
  if (lic.status === 'ACTIVE') return { ok: true, status: 'ACTIVE' };
  if (lic.status === 'TRIAL') {
    const trialEnd = Date.parse(lic.trialEndsAt || '');
    if (!Number.isFinite(trialEnd)) return { ok: false, reason: 'BAD_TRIAL_END' };
    const now = Date.now();
    if (now <= trialEnd) return { ok: true, status: 'TRIAL' };
    return { ok: false, status: 'EXPIRED', reason: 'TRIAL_ENDED', trialEndsAt: lic.trialEndsAt };
  }
  if (lic.status === 'EXPIRED' || lic.status === 'BLOCKED') return { ok: false, status: lic.status, reason: lic.reason, trialEndsAt: lic.trialEndsAt };
  return { ok: false, status: 'UNKNOWN' };
}

