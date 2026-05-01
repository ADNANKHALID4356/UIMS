import React from 'react';
import LegalPage from './LegalPage.jsx';
import { COMPANY } from '../../content/company.js';

export default function ServicePolicy() {
  return (
    <LegalPage title="Service Policy" updatedAt="2026-04-30">
      <p className="muted">This policy describes how UIMS services and support are delivered.</p>

      <h3>1. Service scope</h3>
      <ul>
        <li>Offline desktop functionality is available without internet.</li>
        <li>Online services (licensing validation, optional cloud sync) require internet access and server availability.</li>
      </ul>

      <h3>2. Support channels</h3>
      <ul>
        <li>Email support: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a></li>
        <li>Business hours: {COMPANY.businessHours}</li>
      </ul>

      <h3>3. Maintenance and updates</h3>
      <p>
        We may release updates to improve stability, security, or features. For hosted services, we may perform maintenance that temporarily affects availability.
      </p>

      <h3>4. Abuse and suspension</h3>
      <p>
        We may suspend devices or revoke API keys if we detect abuse, fraud, or attempts to bypass licensing.
      </p>
    </LegalPage>
  );
}

