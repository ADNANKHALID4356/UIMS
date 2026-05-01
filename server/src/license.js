import { getDevice, upsertDeviceTrial, markDeviceOfflinePaid, countDevicesForUser } from './repo.js';

const TRIAL_DAYS = 14;
const MAX_DEVICES_PER_USER = 1;

export async function ensureDevice({ fingerprint, userId }) {
  const now = Date.now();
  let d = await getDevice(fingerprint);
  
  if (!d) {
    // New device for this fingerprint.
    // Check if user has reached their device limit.
    const count = await countDevicesForUser(userId);
    if (count >= MAX_DEVICES_PER_USER) {
      throw new Error(`Device limit reached (${MAX_DEVICES_PER_USER}). Your account is already bound to another computer.`);
    }

    const trialEndsAt = new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    d = await upsertDeviceTrial({ fingerprint, userId, trialEndsAtIso: trialEndsAt });
  } else {
    // Device exists. Ensure it belongs to this user.
    if (String(d.user_id) !== String(userId)) {
      throw new Error('This computer is already registered to another user account.');
    }
  }
  
  return d;
}

export function computeLicenseStatus(device) {
  if (device.license_status === 'BLOCKED') return { status: 'BLOCKED' };

  if (device.offline_paid) {
    return { status: 'ACTIVE', type: 'OFFLINE_ONE_TIME' };
  }

  const now = Date.now();
  const trialEnd = Date.parse(device.trial_ends_at);
  if (Number.isFinite(trialEnd) && now <= trialEnd) {
    const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
    return { status: 'TRIAL', daysLeft, trialEndsAt: device.trial_ends_at };
  }

  return { status: 'EXPIRED', reason: 'TRIAL_ENDED', trialEndsAt: device.trial_ends_at };
}

export async function recordOfflinePayment({ fingerprint, amountPkr }) {
  const d = await markDeviceOfflinePaid({ fingerprint, amountPkr });
  if (!d) throw new Error('Unknown device');
  return d;
}

