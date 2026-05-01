import React from 'react';
import { COMPANY } from '../content/company.js';

export default function Contact() {
  return (
    <div className="panel">
      <h2>Contact</h2>
      <div className="muted">For inquiries, support, and sales.</div>

      <div className="twoCol" style={{ marginTop: 14 }}>
        <div className="panel">
          <h2>Support Email</h2>
          <div className="muted">
            <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
          </div>
        </div>

        <div className="panel">
          <h2>Business Hours</h2>
          <div className="muted">{COMPANY.businessHours}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h2>Main Website</h2>
        <div className="muted">
          You can also contact us from the company website contact form at{' '}
          <a href={COMPANY.contactPage} target="_blank" rel="noreferrer">{COMPANY.contactPage}</a>.
        </div>
      </div>
    </div>
  );
}

