import React from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { api, getApiBase } from '../lib/api.js';
import { getAuth, setAuth, clearAuth } from '../lib/authStore.js';
import Admin from './Admin.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import HowToUse from './HowToUse.jsx';
import Contact from './Contact.jsx';
import Pricing from './Pricing.jsx';
import FAQ from './FAQ.jsx';
import Download from './Download.jsx';
import PrivacyPolicy from './legal/PrivacyPolicy.jsx';
import TermsAndConditions from './legal/TermsAndConditions.jsx';
import RefundPolicy from './legal/RefundPolicy.jsx';
import ServicePolicy from './legal/ServicePolicy.jsx';
import ShippingPolicy from './legal/ShippingPolicy.jsx';

function Layout({ children }) {
  const nav = useNavigate();
  const auth = getAuth();
  return (
    <div className="container">
      <div className="nav">
        <Link className="logo" to="/">
          <span className="badge">UI</span>
          <span>UIMS</span>
        </Link>
        <div className="navlinks">
          <a href="#features">Features</a>
          <a href="#setup">Setup</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="cta">
          {auth?.token ? (
            <>
              <button className="btn" onClick={() => nav('/dashboard')}>Dashboard</button>
              <button className="btn" onClick={() => nav('/admin')}>Admin</button>
              <button className="btn" onClick={() => { clearAuth(); nav('/'); }}>Logout</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => nav('/login')}>Login</button>
              <button className="btn primary" onClick={() => nav('/signup')}>Create Account</button>
            </>
          )}
        </div>
      </div>
      {children}
      <SiteFooter />
    </div>
  );
}

function Home() {
  return (
    <>
      <div className="hero">
        <h1>Universal Inventory Management System</h1>
        <p>
          Offline-first desktop app for Retail, Agriculture, Medical, and Real Estate businesses — with
          optional paid cloud sync and professional licensing (14‑day free trial per PC).
        </p>
        <div className="cta">
          <Link className="btn" to="/download">Download</Link>
          <Link className="btn primary" to="/signup">Start Free Trial</Link>
          <Link className="btn" to="/login">Already have an account?</Link>
        </div>
      </div>

      <div id="features" className="sectionTitle">Highlights</div>
      <div className="grid">
        {[
          ['Offline-first', 'Works without internet. Fast local encrypted database.'],
          ['Multi-industry', 'Retail / General Store, Agriculture, Medical, Real Estate niches.'],
          ['Professional Ledger', 'Customer/Supplier/Distributor ledgers, settlements, export.'],
          ['Inventory', 'Stock movements, reorder alerts, batching, serial tracking (industry-based).'],
          ['Reports', 'Daily summaries, receipts, analytics.'],
          ['Optional Cloud Sync (Paid)', 'Sync encrypted snapshots to your VPS for remote safety.'],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>

      <div id="setup" className="sectionTitle">Setup Guide (Quick)</div>
      <div className="panel">
        <div className="muted">
          1) Install the desktop app → 2) Create Account here → 3) Login inside desktop app →
          4) Trial starts automatically (14 days) → 5) Pay before expiry to keep using on that PC.
        </div>
      </div>

      <div id="pricing" className="sectionTitle">Pricing</div>
      <div className="twoCol">
        <div className="panel">
          <h2>Offline App (One-time)</h2>
          <div className="muted">
            One-time payment per PC license. Price is set by the system admin.
          </div>
        </div>
        <div className="panel">
          <h2>Cloud Sync (Monthly)</h2>
          <div className="muted">
            Monthly subscription based on record usage (all core tables). Tiers can be updated by admin.
          </div>
        </div>
      </div>

      <div id="faq" className="sectionTitle">FAQ</div>
      <div className="panel">
        <div className="muted">
          <strong>Q:</strong> What if I don’t pay after 14 days? <br />
          <strong>A:</strong> The app locks on that PC until payment is completed.
        </div>
      </div>
    </>
  );
}

function Signup() {
  const nav = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [msg, setMsg] = React.useState(null);
  return (
    <div className="panel">
      <h2>Create Account</h2>
      <div className="muted">Create your account first, then activate your PC via the desktop app.</div>
      <div className="formRow">
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Password (min 8 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary" onClick={async () => {
          try {
            setMsg(null);
            await api('/api/auth/signup', { method: 'POST', body: { email, password } });
            setMsg({ type: 'ok', text: 'Account created. Please login.' });
            setTimeout(() => nav('/login'), 700);
          } catch (e) {
            setMsg({ type: 'err', text: e.message });
          }
        }}>Create</button>
        {msg && <div className="muted" style={{ color: msg.type === 'err' ? '#ffb3b3' : '#b9ffcf' }}>{msg.text}</div>}
      </div>
    </div>
  );
}

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [msg, setMsg] = React.useState(null);
  return (
    <div className="panel">
      <h2>Login</h2>
      <div className="muted">Access your dashboard, payments, and license status.</div>
      <div className="formRow">
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary" onClick={async () => {
          try {
            setMsg(null);
            const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
            setAuth(res.data);
            nav('/dashboard');
          } catch (e) {
            setMsg({ type: 'err', text: e.message });
          }
        }}>Login</button>
        {msg && <div className="muted" style={{ color: '#ffb3b3' }}>{msg.text}</div>}
      </div>
    </div>
  );
}

function Dashboard() {
  const auth = getAuth();
  const nav = useNavigate();
  const [overview, setOverview] = React.useState(null);
  const [pricing, setPricing] = React.useState(null);
  const [myDevices, setMyDevices] = React.useState(null);
  const [myPayments, setMyPayments] = React.useState(null);
  const [mySyncKeys, setMySyncKeys] = React.useState(null);
  const [mySyncSubs, setMySyncSubs] = React.useState(null);
  const [fingerprint, setFingerprint] = React.useState('');
  const [license, setLicense] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const [syncRecordCount, setSyncRecordCount] = React.useState('10000');
  const [syncMonths, setSyncMonths] = React.useState('1');

  React.useEffect(() => {
    if (!auth?.token) nav('/login');
  }, [auth, nav]);

  React.useEffect(() => {
    api('/api/public/pricing').then((r) => setPricing(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!auth?.token) return;
    api('/api/me/devices', { token: auth.token }).then((r) => setMyDevices(r.data)).catch(() => {});
    api('/api/me/payments', { token: auth.token }).then((r) => setMyPayments(r.data)).catch(() => {});
    api('/api/me/sync/keys', { token: auth.token }).then((r) => setMySyncKeys(r.data)).catch(() => {});
    api('/api/me/sync/subscriptions', { token: auth.token }).then((r) => setMySyncSubs(r.data)).catch(() => {});
  }, [auth?.token]);

  return (
    <div className="twoCol">
      <div className="panel">
        <h2>My Dashboard</h2>
        <div className="muted">Paste your PC fingerprint from the desktop app to view/activate its trial/license.</div>
        <div className="formRow">
          <input className="input" placeholder="Hardware Fingerprint" value={fingerprint} onChange={(e) => setFingerprint(e.target.value)} />
          <button className="btn" onClick={async () => {
            try {
              setMsg(null);
              const res = await api('/api/device/register', { method: 'POST', token: auth.token, body: { fingerprint } });
              setLicense(res.data.license);
              setMsg({ type: 'ok', text: `Device registered. Status: ${res.data.license.status}` });
            } catch (e) {
              setMsg({ type: 'err', text: e.message });
            }
          }}>Register Device (Start Trial)</button>

          <button className="btn primary" onClick={async () => {
            try {
              setMsg(null);
              const res = await api('/api/payments/start', { method: 'POST', token: auth.token, body: { fingerprint, type: 'OFFLINE_ONE_TIME' } });
              window.location.href = res.data.checkoutUrl;
            } catch (e) {
              setMsg({ type: 'err', text: e.message });
            }
          }}>Buy Offline License</button>

          <button className="btn" onClick={async () => {
            try {
              setMsg(null);
              const res = await api('/api/payments/start', {
                method: 'POST',
                token: auth.token,
                body: {
                  fingerprint,
                  type: 'SYNC_MONTHLY',
                  recordCount: Number(syncRecordCount) || 0,
                  months: Number(syncMonths) || 1,
                },
              });
              window.location.href = res.data.checkoutUrl;
            } catch (e) {
              setMsg({ type: 'err', text: e.message });
            }
          }}>Buy Sync Monthly</button>

          {msg && <div className="muted" style={{ color: msg.type === 'err' ? '#ffb3b3' : '#b9ffcf' }}>{msg.text}</div>}
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <h2>Sync Monthly Payment</h2>
          <div className="muted">Enter your estimated record count to select the correct pricing tier.</div>
          <div className="formRow">
            <input className="input" placeholder="Record count (e.g. 12000)" value={syncRecordCount} onChange={(e) => setSyncRecordCount(e.target.value)} />
            <input className="input" placeholder="Months (1-24)" value={syncMonths} onChange={(e) => setSyncMonths(e.target.value)} />
          </div>
        </div>

        {license && (
          <div className="panel" style={{ marginTop: 14 }}>
            <h2>License Status</h2>
            <div className="muted"><strong>Status:</strong> {license.status}</div>
            {license.daysLeft != null && <div className="muted"><strong>Days left:</strong> {license.daysLeft}</div>}
            {license.trialEndsAt && <div className="muted"><strong>Trial ends:</strong> {license.trialEndsAt}</div>}
          </div>
        )}

        <div className="panel" style={{ marginTop: 14 }}>
          <h2>My Devices</h2>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{myDevices ? JSON.stringify(myDevices, null, 2) : '—'}</pre>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <h2>My Payments</h2>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{myPayments ? JSON.stringify(myPayments, null, 2) : '—'}</pre>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <h2>My Sync</h2>
          <div className="muted">Sync uses a paid monthly subscription per device. Ask admin to issue an API key for your fingerprint.</div>
          <div className="muted" style={{ marginTop: 8 }}><strong>My Sync Subscriptions</strong></div>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{mySyncSubs ? JSON.stringify(mySyncSubs, null, 2) : '—'}</pre>
          <div className="muted" style={{ marginTop: 8 }}><strong>My Sync Keys (masked)</strong></div>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{mySyncKeys ? JSON.stringify(mySyncKeys, null, 2) : '—'}</pre>
        </div>
      </div>

      <div className="panel">
        <h2>Admin (Optional)</h2>
        <div className="muted">In MVP, admin APIs exist; UI will be expanded in Phase 2.</div>
        <button className="btn" onClick={async () => {
          try {
            const res = await api('/api/admin/overview', { token: auth?.token });
            setOverview(res.data);
          } catch (e) {
            setOverview({ error: e.message });
          }
        }}>Fetch Overview</button>
        <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{overview ? JSON.stringify(overview, null, 2) : '—'}</pre>
        <div className="muted" style={{ marginTop: 10 }}>
          <strong>Current Offline One-Time Price (PKR):</strong> {pricing?.offlineOneTimePrice ?? '—'}
        </div>
      </div>
    </div>
  );
}

function Checkout() {
  const { paymentId } = useParams();
  const [msg, setMsg] = React.useState(null);
  const [checkout, setCheckout] = React.useState(null);

  React.useEffect(() => {
    api(`/api/payments/checkout/${paymentId}`).then((r) => setCheckout(r.data)).catch((e) => setMsg({ type: 'err', text: e.message }));
  }, [paymentId]);

  React.useEffect(() => {
    if (checkout?.gateway === 'payfastpk' && checkout?.actionUrl && checkout?.fields) {
      // Auto-submit after render
      setTimeout(() => {
        const form = document.getElementById('payfastpk-form');
        if (form) form.submit();
      }, 250);
    }
  }, [checkout]);

  return (
    <div className="panel">
      <h2>Checkout</h2>
      <div className="muted">
        {checkout?.gateway === 'payfastpk'
          ? 'Redirecting you to PayFast checkout…'
          : 'PayFast is not configured on server yet. Use mock completion for development.'}
      </div>
      <div className="formRow">
        <div className="muted"><strong>Payment ID:</strong> {paymentId}</div>
        {checkout?.gateway === 'mock' && (
          <button className="btn primary" onClick={async () => {
            try {
              setMsg(null);
              await api('/api/payments/mock/complete', { method: 'POST', body: { paymentId } });
              setMsg({ type: 'ok', text: 'Payment marked PAID (mock). You can now reopen desktop app.' });
            } catch (e) {
              setMsg({ type: 'err', text: e.message });
            }
          }}>Complete Payment (Mock)</button>
        )}

        {checkout?.gateway === 'payfastpk' && (
          <form id="payfastpk-form" method="POST" action={checkout.actionUrl}>
            {Object.entries(checkout.fields || {}).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={String(v)} />
            ))}
            <button className="btn primary" type="submit">Continue to PayFast</button>
          </form>
        )}
        {msg && <div className="muted" style={{ color: msg.type === 'err' ? '#ffb3b3' : '#b9ffcf' }}>{msg.text}</div>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/download" element={<Download />} />
        <Route path="/how-to-use" element={<HowToUse />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/service-policy" element={<ServicePolicy />} />
        <Route path="/shipping-policy" element={<ShippingPolicy />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/checkout/:paymentId" element={<Checkout />} />
      </Routes>
    </Layout>
  );
}

