import React from 'react';
import LegalPage from './LegalPage.jsx';
import { COMPANY } from '../../content/company.js';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updatedAt="2026-04-30">
      <p className="muted">
        This Privacy Policy explains how {COMPANY.name} collects, uses, and protects information for UIMS (Universal Inventory Management System).
      </p>

      <h3>1. Scope</h3>
      <p>
        UIMS is an offline-first desktop application. Most of your business data is stored locally on your PC. If you enable optional cloud services (e.g., licensing validation or cloud sync),
        limited data is transmitted to our server to provide those services.
      </p>

      <h3>2. Information we collect</h3>
      <ul>
        <li><strong>Account information</strong>: email and password hash for portal login.</li>
        <li><strong>Device information</strong>: a hardware fingerprint used for per-PC licensing and sync entitlement.</li>
        <li><strong>Service metadata</strong>: subscription status, tier limit, paid-until, and basic audit logs (verify/push/pull events, timestamps, and IP).</li>
        <li><strong>Payment records</strong>: transaction IDs, amounts, and statuses (when payments are used).</li>
      </ul>

      <h3>3. Information you control</h3>
      <ul>
        <li><strong>Business database</strong>: stored locally on your PC.</li>
        <li><strong>Cloud Sync snapshots (optional)</strong>: if enabled, UIMS uploads an encrypted snapshot to the configured server endpoint.</li>
      </ul>

      <h3>4. How we use information</h3>
      <ul>
        <li>To authenticate users and secure access to the portal.</li>
        <li>To enforce per-PC licensing and trial periods.</li>
        <li>To enable and enforce paid cloud sync subscriptions and tier limits.</li>
        <li>To prevent fraud and abuse (e.g., blocked devices, revoked keys).</li>
      </ul>

      <h3>5. Data retention</h3>
      <p>
        We retain account, device, and audit data as long as necessary to provide services and comply with legal obligations. You can request deletion by contacting support.
      </p>

      <h3>6. Security</h3>
      <ul>
        <li>Passwords are stored as secure hashes (never plain text).</li>
        <li>Sync API keys are stored as hashes on the server (cannot be recovered; must be re-issued).</li>
        <li>We recommend using HTTPS on production deployments.</li>
      </ul>

      <h3>7. Your choices</h3>
      <ul>
        <li>You can use UIMS offline without enabling cloud sync.</li>
        <li>You can disable cloud sync at any time from Settings.</li>
      </ul>

      <h3>8. Contact</h3>
      <p>
        For privacy questions, contact <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}

