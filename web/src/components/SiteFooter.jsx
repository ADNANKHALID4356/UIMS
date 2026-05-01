import React from 'react';
import { Link } from 'react-router-dom';
import { COMPANY } from '../content/company.js';

function FooterLink({ to, children }) {
  return <Link className="footerLink" to={to}>{children}</Link>;
}

export default function SiteFooter() {
  return (
    <footer className="siteFooter" aria-label="Site footer">
      <div className="footerInner">
        <div className="footerBrand">
          <div className="logoRow">
            <span className="badge">UI</span>
            <span className="brandName">UIMS</span>
          </div>
          <div className="footerText">
            Universal Inventory Management System — offline-first desktop software with optional cloud sync and licensing.
          </div>
          <div className="footerMeta">
            <div><strong>Support:</strong> <a className="footerLink" href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a></div>
            <div><strong>Hours:</strong> {COMPANY.businessHours}</div>
            {COMPANY.phone ? <div><strong>Phone:</strong> {COMPANY.phone}</div> : null}
            {COMPANY.address ? <div><strong>Address:</strong> {COMPANY.address}</div> : null}
          </div>
        </div>

        <nav className="footerCol" aria-label="Product">
          <div className="footerColTitle">Product</div>
          <FooterLink to="/">Overview</FooterLink>
          <FooterLink to="/download">Download</FooterLink>
          <FooterLink to="/how-to-use">How to Use</FooterLink>
          <FooterLink to="/pricing">Pricing</FooterLink>
          <FooterLink to="/faq">FAQ</FooterLink>
        </nav>

        <nav className="footerCol" aria-label="Legal">
          <div className="footerColTitle">Legal</div>
          <FooterLink to="/privacy-policy">Privacy Policy</FooterLink>
          <FooterLink to="/terms-and-conditions">Terms & Conditions</FooterLink>
          <FooterLink to="/refund-policy">Refund Policy</FooterLink>
          <FooterLink to="/service-policy">Service Policy</FooterLink>
          <FooterLink to="/shipping-policy">Shipping Policy</FooterLink>
        </nav>

        <nav className="footerCol" aria-label="Company">
          <div className="footerColTitle">Company</div>
          <FooterLink to="/contact">Contact</FooterLink>
          <a className="footerLink" href={COMPANY.website} target="_blank" rel="noreferrer">UmmahTech Innovations</a>
          <a className="footerLink" href={COMPANY.contactPage} target="_blank" rel="noreferrer">Main Website Contact</a>
        </nav>
      </div>

      <div className="footerBottom">
        <div>© {new Date().getFullYear()} {COMPANY.name}. All rights reserved.</div>
        <div className="footerBottomRight">
          <span className="muted">API:</span> <span className="muted">{window.location.origin}</span>
        </div>
      </div>
    </footer>
  );
}

