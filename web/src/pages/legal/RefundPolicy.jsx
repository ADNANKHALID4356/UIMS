import React from 'react';
import LegalPage from './LegalPage.jsx';
import { COMPANY } from '../../content/company.js';

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund Policy" updatedAt="2026-04-30">
      <p className="muted">This Refund Policy applies to purchases of UIMS products and subscriptions.</p>

      <h3>1. Offline one-time license</h3>
      <ul>
        <li>Licenses are activated per device (hardware fingerprint).</li>
        <li>Refund requests must be submitted with proof of purchase and the device fingerprint.</li>
      </ul>

      <h3>2. Monthly cloud sync subscription</h3>
      <ul>
        <li>Subscriptions are billed for the selected period (e.g., monthly).</li>
        <li>If you cancel, service remains active until the end of the paid period unless required by law.</li>
      </ul>

      <h3>3. Eligibility and processing</h3>
      <ul>
        <li>Refund eligibility may depend on usage, activation status, and fraud checks.</li>
        <li>Approved refunds are processed to the original payment method where possible.</li>
      </ul>

      <h3>4. How to request a refund</h3>
      <p>
        Email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> with:
      </p>
      <ul>
        <li>Registered email</li>
        <li>Payment reference / transaction ID</li>
        <li>Device fingerprint</li>
        <li>Reason for request</li>
      </ul>
    </LegalPage>
  );
}

