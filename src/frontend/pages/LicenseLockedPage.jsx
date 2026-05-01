import React from 'react';

const PAY_URL_BASE = import.meta.env.VITE_UIMS_PAY_URL_BASE || 'https://uims.ummahtechinnovations.com';

export default function LicenseLockedPage({ fingerprint, license }) {
  const status = license?.status || 'EXPIRED';
  const trialEndsAt = license?.trialEndsAt;
  const reason = license?.reason || '';

  const payUrl = `${PAY_URL_BASE}/login?fp=${encodeURIComponent(fingerprint || '')}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-xl w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-white">
        <h1 className="text-2xl font-bold">License Locked</h1>
        <p className="text-white/70 mt-2">
          Your 14‑day free trial has ended on this PC. Please complete payment to continue using UIMS.
        </p>

        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-white/60">Status</span>
            <span className="font-semibold">{status}</span>
          </div>
          {trialEndsAt && (
            <div className="flex justify-between gap-4">
              <span className="text-white/60">Trial ended</span>
              <span className="font-semibold">{trialEndsAt}</span>
            </div>
          )}
          {reason && (
            <div className="flex justify-between gap-4">
              <span className="text-white/60">Reason</span>
              <span className="font-semibold">{reason}</span>
            </div>
          )}
          {fingerprint && (
            <div className="pt-4 mt-4 border-t border-white/10">
              <div className="text-white/60 text-xs mb-1">PC Fingerprint</div>
              <code className="block w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs break-all">
                {fingerprint}
              </code>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition"
          >
            Retry Validation
          </button>
          <button
            onClick={() => window.open(payUrl, '_blank')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:brightness-110 transition font-semibold"
          >
            Pay Now
          </button>
        </div>

        <p className="text-white/50 text-xs mt-4">
          If you already paid, click “Retry Validation”.
        </p>
      </div>
    </div>
  );
}

