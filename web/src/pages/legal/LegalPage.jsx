import React from 'react';
import { COMPANY } from '../../content/company.js';

export default function LegalPage({ title, updatedAt, children }) {
  return (
    <div className="panel legalPage">
      <div className="legalHeader">
        <h2>{title}</h2>
        <div className="muted">Last updated: {updatedAt}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Provider: <strong>{COMPANY.name}</strong> • Support: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
        </div>
      </div>
      <div className="legalBody">
        {children}
      </div>
    </div>
  );
}

