import React from 'react';
import { Link } from 'react-router-dom';

export default function HowToUse() {
  return (
    <div className="panel">
      <h2>How to Use UIMS</h2>
      <div className="muted">
        This guide explains the standard setup flow for UIMS (Universal Inventory Management System).
      </div>

      <div className="legalBody" style={{ marginTop: 14 }}>
        <h3>1) Install the desktop app</h3>
        <p>Install UIMS on the PC you want to license (1 PC = 1 license).</p>

        <h3>2) Create your account</h3>
        <p>
          Create an account on this portal, then login from inside the desktop app.
          If you haven’t created an account yet, go to <Link to="/signup">Create Account</Link>.
        </p>

        <h3>3) Start the 14‑day free trial</h3>
        <p>
          When you login on a PC, the system registers that PC fingerprint and starts the trial automatically.
          You can view the fingerprint in the desktop app.
        </p>

        <h3>4) Choose your business niche (industry)</h3>
        <p>
          Open Settings → Industry/Niche and select your business type (Retail / Agriculture / Medical / Real Estate).
          UIMS adjusts terminologies (e.g., Customer/Distributor/Supplier) based on the niche.
        </p>

        <h3>5) Daily usage</h3>
        <ul>
          <li>Create transactions (sales, purchases, payments).</li>
          <li>Maintain inventory and stock movements.</li>
          <li>Use ledgers to track balances and settlements.</li>
          <li>Generate reports and exports.</li>
        </ul>

        <h3>6) Backups (recommended)</h3>
        <p>
          Create regular backups from the Backup section. Backups protect you even without any cloud features enabled.
        </p>

        <h3>7) Optional: Cloud Sync (paid)</h3>
        <p>
          If you want cloud sync, the admin must issue an API key for your PC fingerprint and activate a subscription.
          Then configure Settings → Cloud Sync in the desktop app.
        </p>
      </div>
    </div>
  );
}

