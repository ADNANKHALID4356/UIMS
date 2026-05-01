import React from 'react';
import { COMPANY } from '../content/company.js';

export default function Download() {
  const exeName = 'UIMS-Setup.exe';
  const exePath = `/downloads/${exeName}`;

  return (
    <div className="panel">
      <h2>Download UIMS (Windows)</h2>
      <div className="muted">
        Download the latest UIMS desktop installer for Windows. If the download does not start or is blocked by your browser,
        contact support at <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="muted"><strong>Installer:</strong> {exeName}</div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn primary" href={exePath} download>Download EXE</a>
          <a className="btn" href={exePath}>Open download link</a>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          If Windows SmartScreen shows a warning, choose “More info” → “Run anyway” (only if you trust the source).
        </div>
      </div>

      <div className="legalBody" style={{ marginTop: 14 }}>
        <h3>Installation steps</h3>
        <ol>
          <li>Download the installer.</li>
          <li>Run the setup and complete installation.</li>
          <li>Open UIMS and login using your portal account.</li>
          <li>Your 14-day trial starts automatically on that PC.</li>
        </ol>
      </div>
    </div>
  );
}

