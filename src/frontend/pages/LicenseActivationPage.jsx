import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_UIMS_API_BASE || 'http://localhost:8788';

const LicenseActivationPage = ({ onLicenseVerified, fingerprint: providedFingerprint }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopOwner, setShopOwner] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hardwareFingerprint, setHardwareFingerprint] = useState('');
  const [activationMethod, setActivationMethod] = useState('online');
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Get hardware fingerprint on load
    const getFingerprint = async () => {
      try {
        const fp = providedFingerprint || await window.electronAPI.getSystemFingerprint();
        setHardwareFingerprint(fp);
      } catch (err) {
        console.error('Failed to get fingerprint:', err);
      }
    };

    // Check if license already exists
    const checkLicense = async () => {
      try {
        const info = await window.electronAPI.getLicenseInfo();
        if (info.isValid) {
          setLicenseInfo(info);
        }
      } catch (err) {
        console.error('Failed to check license:', err);
      }
    };

    getFingerprint();
    checkLicense();
  }, [providedFingerprint]);

  const handleAccountLoginAndTrial = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 1) Login to VPS
      const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginJson = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok || loginJson?.success === false) {
        throw new Error(loginJson?.message || 'Invalid email or password');
      }
      const token = loginJson?.data?.token;
      if (!token) throw new Error('Missing token from server');
      localStorage.setItem('uims_vps_token', token);

      // 2) Register device → This will now enforce the 1-PC lock on the server
      const regRes = await fetch(`${API_BASE}/api/device/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fingerprint: hardwareFingerprint }),
      });
      const regJson = await regRes.json().catch(() => ({}));
      
      if (!regRes.ok || regJson?.success === false) {
        throw new Error(regJson?.message || 'Device registration failed');
      }

      const lic = regJson.data.license;
      
      // 3) Sync to local SQLite so it works offline
      await window.electronAPI.activateLicense({
        shopName: 'UIMS Account',
        shopOwnerName: email,
        licenseKey: `ONLINE_VERIFIED_${lic.status}`,
      });

      // 4) Auto-create local user for offline login (Seamless Multi-tenancy)
      const isFirstRun = await window.electronAPI.isFirstRun();
      if (isFirstRun) {
        try {
          // Extract name from email or use a default
          const namePrefix = email.split('@')[0];
          const displayName = namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1);
          
          await window.electronAPI.createFirstUser(
            `${displayName} (Admin)`, // Full Name
            email,                    // Username (use email for uniqueness)
            email,                    // Email
            password                  // Sync password to local
          );
          console.log('[App] Local admin created automatically.');
          
          // 5) Auto-login locally so the session is active after reload
          await window.electronAPI.login(email, password);
        } catch (localErr) {
          console.error('[App] Failed to auto-create local user:', localErr);
          // Non-blocking: user can still use FirstRunSetupPage if this fails
        }
      }

      setSuccess(`Account activated! Status: ${lic.status}. Loading application...`);
      setTimeout(() => {
        if (onLicenseVerified) onLicenseVerified();
        else window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err?.message || 'Activation failed');
      localStorage.removeItem('uims_vps_token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnlineActivation = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await window.electronAPI.activateLicense({
        shopName,
        shopOwnerName: shopOwner,
        licenseKey: licenseKey || undefined,
      });

      if (result.success) {
        setSuccess('License activated successfully! Application will reload...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(result.error || 'Activation failed');
      }
    } catch (err) {
      setError(`Activation error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineActivation = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!licenseKey.trim()) {
      setError('Please enter the license key provided by the administrator');
      setIsLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI.activateLicense({
        shopName,
        shopOwnerName: shopOwner,
        licenseKey: licenseKey,
      });

      if (result.success) {
        setSuccess('License activated successfully! Application will reload...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(result.error || 'Invalid license key');
      }
    } catch (err) {
      setError(`Activation error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyFingerprint = () => {
    navigator.clipboard.writeText(hardwareFingerprint);
    setSuccess('Hardware fingerprint copied to clipboard');
    setTimeout(() => setSuccess(null), 3000);
  };

  // If license already exists and is valid
  if (licenseInfo && licenseInfo.isValid) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-primary to-secondary p-5">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">✓ License Active</h1>
            <p className="text-gray-600">Your software is licensed and ready to use</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-600">Shop Name:</span>
              <span className="text-gray-800">{licenseInfo.shopName || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-600">Owner:</span>
              <span className="text-gray-800">{licenseInfo.shopOwner || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-600">Activated:</span>
              <span className="text-gray-800">
                {licenseInfo.activationDate
                  ? new Date(licenseInfo.activationDate).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="font-semibold text-gray-600">Status:</span>
              <span className="text-success font-semibold">Active</span>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm mb-6">For license issues, contact your system administrator</p>
            <button
              onClick={() => onLicenseVerified && onLicenseVerified()}
              className="bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition duration-200"
            >
              Continue to Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Activation form
  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-primary to-secondary p-5">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Activate UIMS on This PC</h1>
          <p className="text-gray-600">Login with your web account to start your 14‑day free trial</p>
        </div>

        {/* Activation method selection */}
        <div className="flex gap-3 mb-8 p-1.5 bg-gray-100 rounded-lg">
          <button
            type="button"
            className={`flex-1 py-3 px-5 rounded-md text-base font-medium transition-all ${
              activationMethod === 'online'
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                : 'bg-transparent text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setActivationMethod('online')}
          >
            Online Activation
          </button>
          <button
            type="button"
            className={`flex-1 py-3 px-5 rounded-md text-base font-medium transition-all ${
              activationMethod === 'offline'
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                : 'bg-transparent text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setActivationMethod('offline')}
          >
            Offline Activation
          </button>
        </div>

        {/* Hardware Fingerprint Display */}
        <div className="mb-8 p-5 bg-gray-50 rounded-lg border border-gray-200">
          <label className="block font-semibold text-gray-800 mb-3">Hardware Fingerprint:</label>
          <div className="flex gap-3 items-center bg-white p-3 rounded-md border border-gray-300">
            <code className="flex-1 font-mono text-sm text-primary break-all">
              {hardwareFingerprint || 'Generating...'}
            </code>
            <button
              type="button"
              onClick={copyFingerprint}
              className="py-2 px-4 bg-primary text-white rounded-md text-sm hover:bg-primary-dark transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-600 italic">
            {activationMethod === 'offline'
              ? 'Send this fingerprint to your administrator to receive a license key'
              : 'This fingerprint uniquely identifies your computer'}
          </p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 bg-green-50 border border-green-200 text-green-700 p-4 rounded-md text-sm font-medium">
            {success}
          </div>
        )}

        {/* Online Activation Form (Account-based) */}
        {activationMethod === 'online' && (
          <form onSubmit={handleAccountLoginAndTrial} className="mt-5">
            <div className="mb-5">
              <label htmlFor="email" className="block mb-2 text-gray-800 font-medium">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-md text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="password" className="block mb-2 text-gray-800 font-medium">
                Password *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isLoading}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-md text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-md text-base font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed mt-3"
            >
              {isLoading ? 'Activating...' : 'Login & Start Trial'}
            </button>

            <div className="mt-5 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Note:</strong> Trial starts on first activation on this PC. If you don’t pay within 14 days, the app will lock on this PC.
              </p>
            </div>
          </form>
        )}

        {/* Offline Activation Form */}
        {activationMethod === 'offline' && (
          <form onSubmit={handleOfflineActivation} className="mt-5">
            <div className="mb-5">
              <label htmlFor="shopNameOffline" className="block mb-2 text-gray-800 font-medium">
                Shop Name *
              </label>
              <input
                id="shopNameOffline"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Enter your shop name"
                disabled={isLoading}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-md text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="shopOwnerOffline" className="block mb-2 text-gray-800 font-medium">
                Shop Owner Name *
              </label>
              <input
                id="shopOwnerOffline"
                type="text"
                value={shopOwner}
                onChange={(e) => setShopOwner(e.target.value)}
                placeholder="Enter owner name"
                disabled={isLoading}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-md text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="licenseKey" className="block mb-2 text-gray-800 font-medium">
                License Key *
              </label>
              <textarea
                id="licenseKey"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Paste the license key provided by your administrator"
                disabled={isLoading}
                rows={4}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-md text-sm font-mono resize-y transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-md text-base font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed mt-3"
            >
              {isLoading ? 'Activating...' : 'Activate with Key'}
            </button>

            <div className="mt-5 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Offline Activation Steps:</strong>
              </p>
              <ol className="mt-2 ml-5 text-sm text-gray-700 list-decimal space-y-1.5">
                <li>Copy your hardware fingerprint (button above)</li>
                <li>Contact your system administrator with the fingerprint</li>
                <li>Receive and paste the license key in the field above</li>
                <li>Click "Activate with Key" to complete activation</li>
              </ol>
            </div>
          </form>
        )}

        <div className="mt-8 text-center pt-5 border-t border-gray-200">
          <p className="text-gray-500 text-sm">For support, contact: support@ummahtechinnovations.com</p>
        </div>
      </div>
    </div>
  );
};

export default LicenseActivationPage;
