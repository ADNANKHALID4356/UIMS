import React from 'react';
import { api } from '../lib/api.js';
import { getAuth } from '../lib/authStore.js';

export default function Admin() {
  const auth = getAuth();
  const [overview, setOverview] = React.useState(null);
  const [pricing, setPricing] = React.useState(null);
  const [offlinePrice, setOfflinePrice] = React.useState('');
  const [tierJson, setTierJson] = React.useState('');
  const [msg, setMsg] = React.useState(null);
  const [fingerprint, setFingerprint] = React.useState('');
  const [blocked, setBlocked] = React.useState(true);
  const [syncTierLimit, setSyncTierLimit] = React.useState('10000');
  const [syncPaidUntil, setSyncPaidUntil] = React.useState('');
  const [syncStatus, setSyncStatus] = React.useState('ACTIVE');
  const [issuedKey, setIssuedKey] = React.useState(null);
  const [revokeKeyId, setRevokeKeyId] = React.useState('');

  React.useEffect(() => {
    if (!auth?.token) return;
    api('/api/admin/overview', { token: auth.token }).then((r) => {
      setOverview(r.data);
      setPricing(r.data.pricing);
      setOfflinePrice(String(r.data.pricing?.offlineOneTimePrice ?? '0'));
      setTierJson(JSON.stringify(r.data.pricing?.syncTiers ?? [], null, 2));
    }).catch((e) => setMsg({ type: 'err', text: e.message }));
  }, [auth?.token]);

  return (
    <div className="twoCol">
      <div className="panel">
        <h2>Admin Dashboard</h2>
        <div className="muted">Manage pricing and device access. (PayFast integration can be added later.)</div>
        <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{overview ? JSON.stringify(overview, null, 2) : '—'}</pre>
      </div>

      <div className="panel">
        <h2>Pricing Editor</h2>
        <div className="formRow">
          <input className="input" placeholder="Offline one-time price (PKR)" value={offlinePrice} onChange={(e) => setOfflinePrice(e.target.value)} />
          <textarea className="input" style={{ minHeight: 160 }} value={tierJson} onChange={(e) => setTierJson(e.target.value)} />
          <button className="btn primary" onClick={async () => {
            try {
              setMsg(null);
              const tiers = JSON.parse(tierJson || '[]');
              const res = await api('/api/admin/pricing', {
                method: 'POST',
                token: auth.token,
                body: { offlineOneTimePrice: Number(offlinePrice) || 0, syncTiers: tiers },
              });
              setPricing(res.data);
              setMsg({ type: 'ok', text: 'Pricing saved.' });
            } catch (e) {
              setMsg({ type: 'err', text: e.message });
            }
          }}>Save Pricing</button>

          <div className="panel">
            <h2>Block / Unblock Device</h2>
            <div className="muted">Use fingerprint to block a PC instantly.</div>
            <div className="formRow">
              <input className="input" placeholder="Device fingerprint" value={fingerprint} onChange={(e) => setFingerprint(e.target.value)} />
              <label className="muted">
                <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} /> Blocked
              </label>
              <button className="btn" onClick={async () => {
                try {
                  setMsg(null);
                  await api('/api/admin/device/block', { method: 'POST', token: auth.token, body: { fingerprint, blocked } });
                  setMsg({ type: 'ok', text: blocked ? 'Device blocked.' : 'Device unblocked.' });
                } catch (e) {
                  setMsg({ type: 'err', text: e.message });
                }
              }}>Apply</button>
            </div>
          </div>

          <div className="panel">
            <h2>Sync Subscription (Per PC)</h2>
            <div className="muted">Issue a Sync API key for a device and set its monthly tier + paid-until.</div>
            <div className="formRow">
              <input className="input" placeholder="Device fingerprint" value={fingerprint} onChange={(e) => setFingerprint(e.target.value)} />
              <div className="muted">Tier limit (records)</div>
              <input className="input" placeholder="e.g. 10000" value={syncTierLimit} onChange={(e) => setSyncTierLimit(e.target.value)} />
              <div className="muted">Paid until (UTC)</div>
              <input className="input" type="datetime-local" value={syncPaidUntil} onChange={(e) => setSyncPaidUntil(e.target.value)} />
              <div className="muted">Status</div>
              <select className="input" value={syncStatus} onChange={(e) => setSyncStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="PAST_DUE">PAST_DUE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>

              <button className="btn" onClick={async () => {
                try {
                  setMsg(null);
                  setIssuedKey(null);
                  const res = await api('/api/admin/sync/key/issue', {
                    method: 'POST',
                    token: auth.token,
                    body: { fingerprint },
                  });
                  setIssuedKey(res.data.apiKey);
                  setMsg({ type: 'ok', text: 'Sync API key issued (copy it now — it will not be shown again).' });
                } catch (e) {
                  setMsg({ type: 'err', text: e.message });
                }
              }}>Issue Sync API Key</button>

              <button className="btn primary" onClick={async () => {
                try {
                  setMsg(null);
                  const paidUntilIso = syncPaidUntil ? new Date(syncPaidUntil).toISOString() : undefined;
                  await api('/api/admin/sync/subscription/set', {
                    method: 'POST',
                    token: auth.token,
                    body: {
                      fingerprint,
                      tierLimitRecords: Number(syncTierLimit) || 10000,
                      paidUntilIso,
                      status: syncStatus,
                    },
                  });
                  setMsg({ type: 'ok', text: 'Sync subscription updated.' });
                } catch (e) {
                  setMsg({ type: 'err', text: e.message });
                }
              }}>Save Sync Subscription</button>

              {issuedKey && (
                <div className="panel" style={{ marginTop: 10 }}>
                  <div className="muted"><strong>Issued API Key:</strong></div>
                  <pre className="muted" style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>{issuedKey}</pre>
                </div>
              )}

              <div className="panel" style={{ marginTop: 10 }}>
                <div className="muted"><strong>Revoke Sync Key</strong> (paste key id)</div>
                <div className="formRow">
                  <input className="input" placeholder="Sync key id (e.g. sk...)" value={revokeKeyId} onChange={(e) => setRevokeKeyId(e.target.value)} />
                  <button className="btn" onClick={async () => {
                    try {
                      setMsg(null);
                      await api('/api/admin/sync/key/revoke', { method: 'POST', token: auth.token, body: { id: revokeKeyId } });
                      setMsg({ type: 'ok', text: 'Sync key revoked.' });
                    } catch (e) {
                      setMsg({ type: 'err', text: e.message });
                    }
                  }}>Revoke</button>
                </div>
              </div>
            </div>
          </div>

          {msg && <div className="muted" style={{ color: msg.type === 'err' ? '#ffb3b3' : '#b9ffcf' }}>{msg.text}</div>}
        </div>
      </div>
    </div>
  );
}

