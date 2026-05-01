import React from 'react';
import LegalPage from './LegalPage.jsx';
import { COMPANY } from '../../content/company.js';

export default function TermsAndConditions() {
  return (
    <LegalPage title="Terms & Conditions" updatedAt="2026-04-30">
      <p className="muted">
        These Terms govern your use of UIMS (Universal Inventory Management System) provided by {COMPANY.name}.
      </p>

      <h3>1. License and permitted use</h3>
      <ul>
        <li>UIMS is licensed per PC (one hardware fingerprint = one license).</li>
        <li>A 14-day free trial may be provided per device. After expiry, the app may lock until payment/activation.</li>
        <li>You must not attempt to bypass licensing, tamper with security controls, or misuse API keys.</li>
      </ul>

      <h3>2. Optional cloud services</h3>
      <ul>
        <li>Cloud Sync is optional and may require a paid subscription.</li>
        <li>Subscription enforcement may include tier limits (record-count based) and paid-until dates.</li>
        <li>We may suspend or revoke access for non-payment, fraud, or abuse.</li>
      </ul>

      <h3>3. Customer responsibilities</h3>
      <ul>
        <li>You are responsible for maintaining backups and safeguarding access to your devices/accounts.</li>
        <li>You must keep your Sync API key confidential (treat it like a password).</li>
        <li>You are responsible for complying with local laws and regulations regarding your business records.</li>
      </ul>

      <h3>4. Support</h3>
      <p>
        Support is provided via email at <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> during stated business hours (best-effort in MVP).
      </p>

      <h3>5. Disclaimer</h3>
      <p>
        UIMS is provided “as is” to the maximum extent permitted by law. We do not guarantee uninterrupted availability of optional online services.
      </p>

      <h3>6. Limitation of liability</h3>
      <p>
        To the maximum extent permitted by law, {COMPANY.name} will not be liable for indirect, incidental, or consequential damages, including loss of data or profits.
      </p>

      <h3>7. Changes</h3>
      <p>
        We may update these Terms from time to time. The updated date above reflects the latest revision.
      </p>

      <h3>8. Contact</h3>
      <p>
        Questions about these Terms: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}

