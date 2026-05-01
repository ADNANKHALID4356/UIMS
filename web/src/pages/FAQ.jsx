import React from 'react';

export default function FAQ() {
  return (
    <div className="panel">
      <h2>FAQ</h2>
      <div className="legalBody" style={{ marginTop: 14 }}>
        <h3>What happens after the 14‑day trial ends?</h3>
        <p>The app locks on that PC until the offline license is paid/activated for that fingerprint.</p>

        <h3>Is my business data stored online?</h3>
        <p>By default, no. UIMS is offline-first. Only optional services (licensing validation and optional cloud sync) use the internet.</p>

        <h3>How does Cloud Sync pricing work?</h3>
        <p>Cloud Sync is billed monthly based on record-count tiers. The desktop app estimates record count and the server enforces the tier limit.</p>

        <h3>Can I use one license on multiple PCs?</h3>
        <p>No. Licensing is per PC (one hardware fingerprint = one license).</p>
      </div>
    </div>
  );
}

