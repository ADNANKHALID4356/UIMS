import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { checkAuth } from './store/slices/authSlice';
import { checkOrganizationSetup, fetchIndustryConfig, fetchOrganizationSettings } from './store/slices/organizationSlice';
import { ToastProvider } from './components/common/Toast';

// Core pages
import LoginPage from './pages/LoginPage';
import LoadingPage from './pages/LoadingPage';
import LicenseActivationPage from './pages/LicenseActivationPage';
import LicenseLockedPage from './pages/LicenseLockedPage';
import { getCachedLicense, setCachedLicense, computeOfflineStrictValidity } from './lib/licenseCache';
import FirstRunSetupPage from './pages/FirstRunSetupPage';

// v2.0 Architecture
import IndustrySetupWizard from './pages/IndustrySetupWizard';
import DashboardPageV2 from './pages/DashboardPageV2';
import MainLayout from './components/MainLayout';
import SettingsPage from './pages/SettingsPage';
import EntitiesPage from './pages/EntitiesPage';

// Inventory Management
import ProductCategoriesPage from './pages/ProductCategoriesPage';
import ProductsPage from './pages/ProductsPage';
import GrainsPage from './pages/GrainsPage';
import StockMovementsPage from './pages/StockMovementsPage';
import TransactionsPage from './pages/TransactionsPage';
import TransactionDetailsPage from './pages/TransactionDetailsPage';
import EditTransactionPage from './pages/EditTransactionPage';
import ReturnTransactionPage from './pages/ReturnTransactionPage';
import UniversalTransactionPage from './pages/UniversalTransactionPage';
import ReportsPage from './pages/ReportsPage';
import BackupPage from './pages/BackupPage';
import EntityLedgerPage from './pages/EntityLedgerPage';
import HistoryPage from './pages/HistoryPage';

// RBAC (Sprint 6)
import UserManagementPage from './pages/UserManagementPage';

// Placeholder pages for niche-specific features
import { 
  PrescriptionsPage, 
  CommissionsPage 
} from './pages/PlaceholderPage';

// Medicine and Property placeholders (mapped to PlaceholderPage generic component)
import PlaceholderPage from './pages/PlaceholderPage';
const MedicineBatchesPage = () => <PlaceholderPage title="Medicine Batches" description="Track medicine batches, expiry dates, and stock levels." sprint="Sprint 4" />;
const PropertyListingsPage = () => <PlaceholderPage title="Property Listings" description="Manage property listings, status, and details." sprint="Sprint 4" />;


/**
 * ProtectedRoute - Wraps content in MainLayout and redirects if unauthenticated
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <MainLayout>{children}</MainLayout>;
};

const App = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const { isConfigured, isCheckingSetup } = useAppSelector((state) => state.organization);

  const [appReady, setAppReady] = useState(false);
  const [licenseValid, setLicenseValid] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [fingerprint, setFingerprint] = useState('');
  const [checkingLicense, setCheckingLicense] = useState(true);
  const [forceProceed, setForceProceed] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Step 0: Get hardware fingerprint
        const fp = await window.electronAPI.getSystemFingerprint();
        setFingerprint(fp);

        // Step 1: Check Local SQLite License First (Offline Support)
        const localLicense = await window.electronAPI.getLicenseInfo();
        console.log('[App v2.0] Local license check:', localLicense);

        if (localLicense && localLicense.isValid) {
          setLicenseValid(true);
          setLicenseInfo({ status: 'ACTIVE', ...localLicense });
          
          // Proceed to check first run / auth
          const firstRun = await window.electronAPI.isFirstRun();
          setIsFirstRun(firstRun);
          if (!firstRun) {
            dispatch(checkAuth());
            dispatch(checkOrganizationSetup());
          }
          
          // Background verification with VPS (non-blocking)
          const token = localStorage.getItem('uims_vps_token');
          if (token) {
            const base = import.meta.env.VITE_UIMS_API_BASE || 'http://localhost:8788';
            fetch(`${base}/api/license/validate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ fingerprint: fp }),
            }).then(r => r.json()).then(json => {
              if (json.success && json.data.license.status === 'BLOCKED') {
                setLicenseValid(false);
                setLicenseInfo(json.data.license);
              }
            }).catch(() => {/* ignore background errors */});
          }
          
          setCheckingLicense(false);
          setAppReady(true);
          return;
        }

        // Step 2: No local license, check VPS (requires internet)
        const token = localStorage.getItem('uims_vps_token') || '';
        if (!token) {
          setLicenseValid(false);
          setLicenseInfo({ status: 'UNREGISTERED' });
          setCheckingLicense(false);
          setAppReady(true);
          return;
        }

        const base = import.meta.env.VITE_UIMS_API_BASE || 'http://localhost:8788';
        let res;
        let json;
        try {
          res = await fetch(`${base}/api/license/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ fingerprint: fp }),
          });
          json = await res.json().catch(() => ({}));
        } catch (netErr) {
          // If offline and no local license, we must activate online once
          setLicenseValid(false);
          setLicenseInfo({ status: 'OFFLINE', message: 'Initial activation requires internet connection.' });
          setCheckingLicense(false);
          setAppReady(true);
          return;
        }

        if (!res.ok || json?.success === false) {
          setLicenseValid(false);
          setLicenseInfo({ status: 'ERROR', message: json?.message || 'License validation failed' });
          setCheckingLicense(false);
          setAppReady(true);
          return;
        }

        const lic = json?.data?.license;
        setLicenseInfo(lic);
        setCachedLicense({ fingerprint: fp, license: lic, cachedAt: new Date().toISOString() });

        const isValid = lic?.status === 'ACTIVE' || lic?.status === 'TRIAL';
        setLicenseValid(isValid);

        if (isValid) {
          // Sync online license to local SQLite for future offline use
          await window.electronAPI.activateLicense({
            shopName: 'UIMS Account',
            shopOwnerName: 'User',
            licenseKey: `ONLINE_VERIFIED_${lic.status}`,
          });

          const firstRun = await window.electronAPI.isFirstRun();
          setIsFirstRun(firstRun);
          if (!firstRun) {
            dispatch(checkAuth());
            dispatch(checkOrganizationSetup());
          }
        }
      } catch (error) {
        console.error('[App v2.0] Initialization error:', error);
        setLicenseValid(false);
        setLicenseInfo({ status: 'ERROR', message: error?.message || 'Initialization failed' });
      } finally {
        setCheckingLicense(false);
        setAppReady(true);
      }
    };

    initializeApp();
  }, [dispatch]);

  // When org is configured, load industry config
  useEffect(() => {
    if (isConfigured && !setupComplete) {
      console.log('[App v2.0] Organization configured, loading industry config...');
      dispatch(fetchOrganizationSettings());
      dispatch(fetchIndustryConfig());
      setSetupComplete(true);
    }
  }, [isConfigured, setupComplete, dispatch]);

  const handleLicenseVerified = () => {
    setForceProceed(true);
    setLicenseValid(true);
    // Re-check first run after license validation
    window.electronAPI.isFirstRun().then((firstRun) => {
      setIsFirstRun(firstRun);
      if (!firstRun) {
        dispatch(checkAuth());
        dispatch(checkOrganizationSetup());
      }
    });
  };

  const handleFirstRunComplete = (username) => {
    console.log('[App v2.0] First-run setup completed for user:', username);
    setIsFirstRun(false);
    // Now proceed to normal boot: check auth + org setup
    dispatch(checkAuth());
    dispatch(checkOrganizationSetup());
  };

  const handleSetupComplete = () => {
    console.log('[App v2.0] Setup wizard completed');
    dispatch(checkOrganizationSetup());
    dispatch(fetchOrganizationSettings());
    dispatch(fetchIndustryConfig());
    setSetupComplete(true);
  };

  // Show loading during initialization
  if (!appReady || checkingLicense) {
    return <LoadingPage />;
  }

  if (isLoading && !appReady) {
    return <LoadingPage />;
  }

  // Show license activation if invalid
  if (!licenseValid && !forceProceed) {
    return (
      <ToastProvider>
        <Router>
          <Routes>
            <Route
              path="*"
              element={
                licenseInfo?.status === 'EXPIRED' || licenseInfo?.status === 'BLOCKED'
                  ? <LicenseLockedPage fingerprint={fingerprint} license={licenseInfo} />
                  : <LicenseActivationPage onLicenseVerified={handleLicenseVerified} fingerprint={fingerprint} />
              }
            />
          </Routes>
        </Router>
      </ToastProvider>
    );
  }

  // Show first-run credential setup (SRS Sprint 2: user sets own email + password)
  if (isFirstRun) {
    return (
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="*" element={<FirstRunSetupPage onSetupComplete={handleFirstRunComplete} />} />
          </Routes>
        </Router>
      </ToastProvider>
    );
  }

  // Show loading while checking org setup
  if (isCheckingSetup) {
    return <LoadingPage />;
  }

  // Show industry setup wizard if not configured (v2.0)
  if (!isConfigured && !isCheckingSetup) {
    return (
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="*" element={<IndustrySetupWizard onComplete={handleSetupComplete} />} />
          </Routes>
        </Router>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* v2.0 Dashboard with MainLayout */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPageV2 /></ProtectedRoute>} />

          {/* === Entity Management (v2.0 universal) === */}
          <Route path="/entities/customers" element={<ProtectedRoute><EntitiesPage entityType="customer" /></ProtectedRoute>} />
          <Route path="/entities/dealers" element={<ProtectedRoute><EntitiesPage entityType="dealer" /></ProtectedRoute>} />
          <Route path="/entities/suppliers" element={<ProtectedRoute><EntitiesPage entityType="supplier" /></ProtectedRoute>} />

          {/* === Inventory Management === */}
          <Route path="/product-categories" element={<ProtectedRoute><ProductCategoriesPage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="/grains" element={<ProtectedRoute><GrainsPage /></ProtectedRoute>} />
          <Route path="/stock-movements" element={<ProtectedRoute><StockMovementsPage /></ProtectedRoute>} />

          {/* === Transactions === */}
          <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
          <Route path="/transactions/:transactionId" element={<ProtectedRoute><TransactionDetailsPage /></ProtectedRoute>} />
          <Route path="/transactions/edit/:transactionId" element={<ProtectedRoute><EditTransactionPage /></ProtectedRoute>} />
          <Route path="/transactions/return/:transactionId" element={<ProtectedRoute><ReturnTransactionPage /></ProtectedRoute>} />
          <Route path="/transactions/new" element={<ProtectedRoute><UniversalTransactionPage /></ProtectedRoute>} />

          {/* === Reports & Backup === */}
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/backup" element={<ProtectedRoute><BackupPage /></ProtectedRoute>} />

          {/* === Ledger === */}
          <Route path="/ledger/:entityType/:entityId" element={<ProtectedRoute><EntityLedgerPage /></ProtectedRoute>} />

          {/* === Industry-Specific (v2.0) === */}
          <Route path="/medicine-batches" element={<ProtectedRoute><MedicineBatchesPage /></ProtectedRoute>} />
          <Route path="/properties" element={<ProtectedRoute><PropertyListingsPage /></ProtectedRoute>} />
          <Route path="/prescriptions" element={<ProtectedRoute><PrescriptionsPage /></ProtectedRoute>} />
          <Route path="/commissions" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />

          {/* === Activity Log / History (v2.0 Sprint 3) === */}
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

          {/* === Settings (v2.0) === */}
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

          {/* === User Management (Sprint 6 RBAC) === */}
          <Route path="/user-management" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />

          {/* Default redirects */}
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
};

export default App;
