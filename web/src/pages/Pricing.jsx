import React from 'react';
import { api } from '../lib/api.js';

export default function Pricing() {
  const [pricing, setPricing] = React.useState(null);

  React.useEffect(() => {
    api('/api/public/pricing').then((r) => setPricing(r.data)).catch(() => {});
  }, []);

  return (
    <div className="panel">
      <h2>Pricing</h2>
      <div className="muted">Prices are set by the system administrator and may change over time.</div>

      <div className="twoCol" style={{ marginTop: 14 }}>
        <div className="panel">
          <h2>Offline App (One-time)</h2>
          <div className="muted">
            Per-PC license. Current price: <strong>{pricing?.offlineOneTimePrice ?? '—'}</strong> PKR
          </div>
        </div>
        <div className="panel">
          <h2>Cloud Sync (Monthly)</h2>
          <div className="muted">
            Monthly subscription based on record usage tiers.
          </div>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
            {pricing?.syncTiers ? JSON.stringify(pricing.syncTiers, null, 2) : '—'}
          </pre>
        </div>
      </div>
    </div>
  );
}

