import React from 'react';
import LegalPage from './LegalPage.jsx';

export default function ShippingPolicy() {
  return (
    <LegalPage title="Shipping Policy" updatedAt="2026-04-30">
      <p className="muted">
        UIMS is a software product delivered electronically. No physical shipping is required unless explicitly stated in a separate written agreement.
      </p>

      <h3>1. Delivery method</h3>
      <ul>
        <li>Software downloads and license activation are provided online.</li>
        <li>Access to the portal and optional cloud services is provided via your account.</li>
      </ul>

      <h3>2. Delivery timing</h3>
      <ul>
        <li>Access is typically immediate after successful registration/payment.</li>
        <li>In rare cases (verification or maintenance), activation may be delayed.</li>
      </ul>

      <h3>3. Physical delivery (if applicable)</h3>
      <p>
        If a physical delivery is agreed (e.g., USB installer, printed invoice), terms will be provided separately including shipping fees and timelines.
      </p>
    </LegalPage>
  );
}

