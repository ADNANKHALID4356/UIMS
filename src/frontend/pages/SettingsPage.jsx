import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchOrganizationSettings, updateOrganizationSettings, fetchIndustryConfig, changeIndustry } from '../store/slices/organizationSlice';
import { setTheme } from '../store/slices/uiSlice';

const INDUSTRY_OPTIONS = [
  { value: 'AGRICULTURAL', label: 'Agricultural / General Store', icon: '🌾', description: 'Farmers, dealers, grains, fertilizers' },
  { value: 'RETAIL', label: 'Retail Store', icon: '🏪', description: 'Customers, distributors, products, inventory' },
  { value: 'MEDICAL', label: 'Medical Store', icon: '💊', description: 'Patients, medicines, batches, prescriptions' },
  { value: 'REAL_ESTATE', label: 'Real Estate', icon: '🏠', description: 'Clients, agents, properties, deals' },
];

const SettingsPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { settings, industryConfig, isLoading } = useAppSelector((state) => state.organization);
  const { user } = useAppSelector((state) => state.auth);
  const { theme } = useAppSelector((state) => state.ui);

  const [activeTab, setActiveTab] = useState('business');
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    email: '',
    address: '',
    currency: 'PKR',
    gstin: '',
    license_number: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Industry switch state
  const [showIndustryModal, setShowIndustryModal] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(null);

  // Preferences state
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(30);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupTime, setAutoBackupTime] = useState('02:00');
  const [autoBackupRetention, setAutoBackupRetention] = useState(30);
  const [reorderLevel, setReorderLevel] = useState(10);

  // Cloud Sync (paid optional feature) state
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncServerUrl, setSyncServerUrl] = useState('');
  const [syncApiKey, setSyncApiKey] = useState('');
  const [syncBusinessId, setSyncBusinessId] = useState('');
  const [syncDeviceId, setSyncDeviceId] = useState('');
  const [syncInterval, setSyncInterval] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncWorking, setSyncWorking] = useState(false);
  const [syncVerifyMessage, setSyncVerifyMessage] = useState(null);
  const [syncEstimate, setSyncEstimate] = useState(null);
  const [syncSubscription, setSyncSubscription] = useState(null);

  useEffect(() => {
    dispatch(fetchOrganizationSettings());
    dispatch(fetchIndustryConfig());
  }, [dispatch]);

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || '',
        owner_name: settings.owner_name || '',
        phone: settings.phone || '',
        email: settings.email || '',
        address: settings.address || '',
        currency: settings.currency_symbol || settings.currency || 'PKR',
        gstin: settings.gstin || '',
        license_number: settings.license_number || '',
      });
      // Load preferences
      setAutoLogoutMinutes(settings.auto_logout_minutes || 30);
      setDateFormat(settings.date_format || 'DD/MM/YYYY');
      setReceiptHeader(settings.receipt_header || '');
      setReceiptFooter(settings.receipt_footer || '');
      setAutoBackupEnabled(!!settings.auto_backup_enabled);
      setAutoBackupTime(settings.auto_backup_time || '02:00');
      setAutoBackupRetention(settings.auto_backup_retention || 30);
      setReorderLevel(settings.default_reorder_level || 10);
    }
  }, [settings]);

  // Load sync config/status when entering Sync tab
  useEffect(() => {
    const load = async () => {
      try {
        if (!window.electronAPI?.sync) return;
        const cfgRes = await window.electronAPI.sync.getConfig();
        if (cfgRes?.success && cfgRes.data) {
          setSyncEnabled(!!cfgRes.data.enabled);
          setSyncServerUrl(cfgRes.data.serverUrl || '');
          setSyncBusinessId(cfgRes.data.businessId || '');
          setSyncDeviceId(cfgRes.data.deviceId || '');
          setSyncInterval(cfgRes.data.autoIntervalMinutes || 0);
          // apiKey is masked when reading; allow user to paste a new one
          setSyncApiKey('');
        }
        const statusRes = await window.electronAPI.sync.getStatus();
        if (statusRes?.success) setSyncStatus(statusRes.data);
        const estRes = await window.electronAPI.sync.estimate?.();
        if (estRes?.success) setSyncEstimate(estRes.data);
      } catch {
        // ignore: sync is optional
      }
    };
    if (activeTab === 'sync') load();
  }, [activeTab]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Map snake_case form fields to camelCase expected by backend OrganizationService
      const updatePayload = {
        businessName: formData.business_name,
        ownerName: formData.owner_name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        currency: formData.currency,
      };
      await dispatch(updateOrganizationSettings(updatePayload)).unwrap();
      // Refresh settings and industry config
      dispatch(fetchOrganizationSettings());
      dispatch(fetchIndustryConfig());
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      const errorText = typeof err === 'string' ? err : (err?.message || 'Failed to save settings.');
      setSaveMessage({ type: 'error', text: errorText });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'business', label: 'Business Info', icon: 'building' },
    { id: 'system', label: 'System', icon: 'cog' },
    { id: 'preferences', label: 'Preferences', icon: 'palette' },
    { id: 'sync', label: 'Cloud Sync', icon: 'cloud' },
    { id: 'about', label: 'About', icon: 'info' },
  ];

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const prefPayload = {
        auto_logout_minutes: autoLogoutMinutes,
        date_format: dateFormat,
        receipt_header: receiptHeader,
        receipt_footer: receiptFooter,
        auto_backup_enabled: autoBackupEnabled ? 1 : 0,
        auto_backup_time: autoBackupTime,
        auto_backup_retention: autoBackupRetention,
        default_reorder_level: reorderLevel,
      };
      await dispatch(updateOrganizationSettings(prefPayload)).unwrap();

      // Manage auto-backup scheduling
      if (autoBackupEnabled) {
        await window.electronAPI.backup.startAutoBackup(autoBackupTime, autoBackupRetention);
      } else {
        await window.electronAPI.backup.stopAutoBackup();
      }

      dispatch(fetchOrganizationSettings());
      setSaveMessage({ type: 'success', text: 'Preferences saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      const errorText = typeof err === 'string' ? err : (err?.message || 'Failed to save preferences.');
      setSaveMessage({ type: 'error', text: errorText });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchIndustry = async () => {
    if (!selectedIndustry) return;
    setIsSwitching(true);
    setSwitchError(null);
    try {
      await dispatch(changeIndustry(selectedIndustry)).unwrap();
      // Refresh all organization state
      await dispatch(fetchOrganizationSettings()).unwrap();
      await dispatch(fetchIndustryConfig()).unwrap();
      setShowIndustryModal(false);
      setSelectedIndustry(null);
      setSaveMessage({ type: 'success', text: 'Industry switched successfully! Redirecting to dashboard...' });
      setTimeout(() => {
        setSaveMessage(null);
        navigate('/');
      }, 1500);
    } catch (err) {
      const errorText = typeof err === 'string' ? err : (err?.message || 'Failed to switch industry.');
      setSwitchError(errorText);
    } finally {
      setIsSwitching(false);
    }
  };

  const currentIndustryType = settings?.industry_type || industryConfig?.type;

  const tabIcons = {
    building: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    cog: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    cloud: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h10a4 4 0 000-8 5 5 0 10-9.9 1.5" />
      </svg>
    ),
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your business and application settings</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tabIcons[tab.icon]}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Business Info Tab */}
      {activeTab === 'business' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Business Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <input
                type="text"
                value={formData.business_name}
                onChange={(e) => handleChange('business_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Enter business name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
              <input
                type="text"
                value={formData.owner_name}
                onChange={(e) => handleChange('owner_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Enter owner name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Enter email address"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={3}
                placeholder="Enter business address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="PKR">PKR - Pakistani Rupee</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="SAR">SAR - Saudi Riyal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN / Tax ID</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => handleChange('gstin', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Enter tax identification number"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || !formData.business_name || !formData.owner_name}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Industry Configuration</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Industry Type</p>
                  <p className="text-xs text-gray-500">Current industry configuration</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {industryConfig?.displayName || settings?.industry_type || 'Not Set'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Configuration Version</p>
                  <p className="text-xs text-gray-500">Industry config version</p>
                </div>
                <span className="text-sm text-gray-600">{industryConfig?.version || '2.0'}</span>
              </div>
            </div>

            {/* Switch Industry Button — Admin only */}
            {user?.role === 'admin' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Switch Industry Mode</p>
                    <p className="text-xs text-gray-500">Change the industry type to test different configurations</p>
                  </div>
                  <button
                    onClick={() => { setShowIndustryModal(true); setSwitchError(null); setSelectedIndustry(null); }}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Switch Industry
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">User Account</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Username</p>
                  <p className="text-xs text-gray-500">Logged in as</p>
                </div>
                <span className="text-sm text-gray-600">{user?.username || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Role</p>
                  <p className="text-xs text-gray-500">Account privilege level</p>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium capitalize">
                  {user?.role || 'user'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Database</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Database Engine</p>
                  <p className="text-xs text-gray-500">Local storage engine</p>
                </div>
                <span className="text-sm text-gray-600">SQLite (better-sqlite3)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Data Location</p>
                  <p className="text-xs text-gray-500">Stored in application data directory</p>
                </div>
                <span className="text-sm text-gray-600 truncate max-w-[200px]">%APPDATA%/ais/</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="space-y-4">
          {/* Theme Toggle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Appearance</h2>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Theme</p>
                <p className="text-xs text-gray-500">Switch between light and dark mode</p>
              </div>
              <div className="flex items-center gap-2">
                {['light', 'dark'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      dispatch(setTheme(t));
                      document.documentElement.classList.toggle('dark', t === 'dark');
                      localStorage.setItem('ais-theme', t);
                    }}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors capitalize ${
                      theme === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'light' ? '☀️ Light' : '🌙 Dark'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Date Format</p>
                <p className="text-xs text-gray-500">Display format for dates throughout the app</p>
              </div>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
              </select>
            </div>
          </div>

          {/* Security: Auto-Logout */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Security</h2>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Auto-Logout Timeout</p>
                <p className="text-xs text-gray-500">Automatically log out after inactivity (minutes)</p>
              </div>
              <select
                value={autoLogoutMinutes}
                onChange={(e) => setAutoLogoutMinutes(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={0}>Never</option>
              </select>
            </div>
          </div>

          {/* Inventory Defaults */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Inventory Defaults</h2>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Default Reorder Level</p>
                <p className="text-xs text-gray-500">Low-stock warning threshold for new products</p>
              </div>
              <input
                type="number"
                min="0"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Backup Schedule */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Automatic Backup</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">Enable Daily Auto-Backup</p>
                  <p className="text-xs text-gray-500">Automatically back up the database daily</p>
                </div>
                <button
                  onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoBackupEnabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoBackupEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {autoBackupEnabled && (
                <>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Backup Time</p>
                      <p className="text-xs text-gray-500">Time of day to run auto-backup (24h)</p>
                    </div>
                    <input
                      type="time"
                      value={autoBackupTime}
                      onChange={(e) => setAutoBackupTime(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Retention Period</p>
                      <p className="text-xs text-gray-500">Days to keep automatic backups</p>
                    </div>
                    <select
                      value={autoBackupRetention}
                      onChange={(e) => setAutoBackupRetention(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Receipt Customization */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Receipt Customization</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Header</label>
                <textarea
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Custom text to appear at the top of receipts (e.g., business slogan)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Footer</label>
                <textarea
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Custom text to appear at the bottom of receipts (e.g., thank you message, return policy)"
                />
              </div>
            </div>
          </div>

          {/* Save Preferences Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePreferences}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Keyboard Shortcuts</h2>
            <div className="space-y-2">
              {[
                { keys: 'Ctrl + N', action: 'New Transaction' },
                { keys: 'Ctrl + S', action: 'Save / Submit Form' },
                { keys: 'Ctrl + P', action: 'Print Current View' },
                { keys: 'Ctrl + B', action: 'Create Backup' },
                { keys: 'Ctrl + F', action: 'Search / Filter' },
                { keys: 'Ctrl + D', action: 'Go to Dashboard' },
                { keys: 'Escape', action: 'Close Modal / Cancel' },
              ].map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{shortcut.action}</span>
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-mono text-gray-600 shadow-sm">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cloud Sync Tab (Paid Optional Feature) */}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Cloud Sync (Paid)</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Optional feature: securely sync your encrypted business database to a server you control.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${syncEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {syncEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  onClick={() => setSyncEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${syncEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  type="button"
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${syncEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sync Server URL</label>
                <input
                  value={syncServerUrl}
                  onChange={(e) => setSyncServerUrl(e.target.value)}
                  placeholder="e.g. http://localhost:8787"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">For testing, run: <span className="font-mono">npm run sync:server</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sync API Key (Paid)</label>
                <input
                  value={syncApiKey}
                  onChange={(e) => setSyncApiKey(e.target.value)}
                  placeholder="Paste your paid sync key here"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Key is stored locally; it’s masked when re-opened.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business ID</label>
                <input
                  value={syncBusinessId}
                  onChange={(e) => setSyncBusinessId(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
                <input
                  value={syncDeviceId}
                  onChange={(e) => setSyncDeviceId(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auto Sync Interval (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">0 disables auto-sync. (MVP stores this value; scheduler can be added next.)</p>
              </div>
            </div>

            {syncVerifyMessage && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${syncVerifyMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {syncVerifyMessage.text}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500">This PC Fingerprint</p>
                <p className="text-sm font-medium text-gray-800 break-words">{syncEstimate?.fingerprint || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500">Estimated Record Count (tier)</p>
                <p className="text-sm font-medium text-gray-800">{syncEstimate?.recordCount != null ? String(syncEstimate.recordCount) : '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 md:col-span-2">
                <p className="text-xs text-gray-500">Subscription (server)</p>
                <p className="text-sm font-medium text-gray-800 break-words">
                  {syncSubscription
                    ? `Status: ${syncSubscription.status || '-'} • Tier limit: ${syncSubscription.tier_limit_records || '-'} • Paid until: ${syncSubscription.paid_until || '-'}`
                    : '-'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                disabled={syncWorking}
                onClick={async () => {
                  setSyncWorking(true);
                  setSyncVerifyMessage(null);
                  try {
                    await window.electronAPI.sync.setConfig({
                      enabled: syncEnabled,
                      serverUrl: syncServerUrl,
                      apiKey: syncApiKey || undefined,
                      businessId: syncBusinessId,
                      deviceId: syncDeviceId,
                      autoIntervalMinutes: syncInterval,
                    });
                    const statusRes = await window.electronAPI.sync.getStatus();
                    if (statusRes?.success) setSyncStatus(statusRes.data);
                    setSyncVerifyMessage({ type: 'success', text: 'Sync settings saved.' });
                  } catch (e) {
                    setSyncVerifyMessage({ type: 'error', text: e?.message || 'Failed to save sync settings' });
                  } finally {
                    setSyncWorking(false);
                  }
                }}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {syncWorking ? 'Saving...' : 'Save Sync Settings'}
              </button>

              <button
                type="button"
                disabled={syncWorking}
                onClick={async () => {
                  setSyncWorking(true);
                  setSyncVerifyMessage(null);
                  try {
                    const res = await window.electronAPI.sync.verify();
                    if (res?.success) {
                      setSyncSubscription(res?.data?.subscription || null);
                      const estRes = await window.electronAPI.sync.estimate?.();
                      if (estRes?.success) setSyncEstimate(estRes.data);
                    }
                    setSyncVerifyMessage({ type: res?.success ? 'success' : 'error', text: res?.success ? 'Entitlement verified successfully.' : (res?.message || 'Verification failed') });
                  } finally {
                    setSyncWorking(false);
                  }
                }}
                className="px-5 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm font-medium"
              >
                Verify Paid Access
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Manual Sync</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                disabled={syncWorking}
                onClick={async () => {
                  setSyncWorking(true);
                  setSyncVerifyMessage(null);
                  try {
                    const res = await window.electronAPI.sync.push();
                    const statusRes = await window.electronAPI.sync.getStatus();
                    if (statusRes?.success) setSyncStatus(statusRes.data);
                    setSyncVerifyMessage({ type: res?.success ? 'success' : 'error', text: res?.success ? 'Push completed successfully.' : (res?.message || 'Push failed') });
                  } finally {
                    setSyncWorking(false);
                  }
                }}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                Push to Server
              </button>
              <button
                type="button"
                disabled={syncWorking}
                onClick={async () => {
                  setSyncWorking(true);
                  setSyncVerifyMessage(null);
                  try {
                    const res = await window.electronAPI.sync.pull({ restore: false });
                    const statusRes = await window.electronAPI.sync.getStatus();
                    if (statusRes?.success) setSyncStatus(statusRes.data);
                    setSyncVerifyMessage({ type: res?.success ? 'success' : 'error', text: res?.success ? (res?.data?.upToDate ? 'Already up to date.' : 'Pulled latest snapshot (saved locally).') : (res?.message || 'Pull failed') });
                  } finally {
                    setSyncWorking(false);
                  }
                }}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
              >
                Pull Latest
              </button>
              <button
                type="button"
                disabled={syncWorking}
                onClick={async () => {
                  setSyncWorking(true);
                  setSyncVerifyMessage(null);
                  try {
                    const res = await window.electronAPI.sync.pull({ restore: true });
                    const statusRes = await window.electronAPI.sync.getStatus();
                    if (statusRes?.success) setSyncStatus(statusRes.data);
                    setSyncVerifyMessage({ type: res?.success ? 'success' : 'error', text: res?.success ? 'Pulled and restored. (If UI looks stale, restart app.)' : (res?.message || 'Restore failed') });
                  } finally {
                    setSyncWorking(false);
                  }
                }}
                className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
              >
                Pull + Restore
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500">Last Push</p>
                <p className="text-sm font-medium text-gray-800">{syncStatus?.lastPushAt || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500">Last Pull</p>
                <p className="text-sm font-medium text-gray-800">{syncStatus?.lastPullAt || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 md:col-span-2">
                <p className="text-xs text-gray-500">Last Error</p>
                <p className="text-sm font-medium text-gray-800 break-words">{syncStatus?.lastError || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">UE</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Universal Enterprise Inventory System</h2>
            <p className="text-gray-500 text-sm mt-1">Version 2.0.0</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Application</span>
              <span className="text-sm text-gray-600">Universal Enterprise Inventory System</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Version</span>
              <span className="text-sm text-gray-600">2.0.0</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Framework</span>
              <span className="text-sm text-gray-600">Electron + React</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">License</span>
              <span className="text-sm text-gray-600">Proprietary</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 text-center">
              © 2026 Universal Enterprise Inventory System. All rights reserved.
            </p>
          </div>
        </div>
      )}

      {/* Switch Industry Modal */}
      {showIndustryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500">
              <h3 className="text-lg font-bold text-white">Switch Industry Mode</h3>
              <p className="text-amber-100 text-sm mt-1">Select a new industry configuration to apply</p>
            </div>

            {/* Body */}
            <div className="p-6">
              {switchError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                  {switchError}
                </div>
              )}

              <div className="space-y-2">
                {INDUSTRY_OPTIONS.map((option) => {
                  const isCurrent = currentIndustryType === option.value;
                  const isSelected = selectedIndustry === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => !isCurrent && setSelectedIndustry(option.value)}
                      disabled={isCurrent}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        isCurrent
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-amber-500 bg-amber-50 shadow-sm'
                          : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer'
                      }`}
                    >
                      <span className="text-2xl">{option.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">
                          {option.label}
                          {isCurrent && (
                            <span className="ml-2 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                      </div>
                      {isSelected && !isCurrent && (
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedIndustry && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <strong>Note:</strong> Switching industry will change all UI labels, navigation, and entity terminology. 
                    Your existing data will be preserved. The sidebar and terminology will update to match the new industry.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowIndustryModal(false); setSelectedIndustry(null); setSwitchError(null); }}
                disabled={isSwitching}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchIndustry}
                disabled={!selectedIndustry || isSwitching}
                className="px-5 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSwitching ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Switching...
                  </>
                ) : (
                  'Confirm Switch'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
