import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

/**
 * DashboardPage v2.0
 * ==================
 * Industry-aware dashboard that adapts stats, labels, and quick actions
 * based on the configured industry type.
 * SRS v2.0 Sprint 1 — Foundation + Sprint 4 — Dashboard Alerts
 */
const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { industryConfig, settings } = useAppSelector((state) => state.organization);

  const [systemInfo, setSystemInfo] = useState(null);
  const [reorderAlerts, setReorderAlerts] = useState(null);
  const [expiryAlerts, setExpiryAlerts] = useState(null);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inventoryItems: 0,
    todayTransactions: 0,
    totalRevenue: 0,
    lowStockItems: 0,
    commissionEarned: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch system info
        const sysInfo = await window.electronAPI.getSystemInfo();
        setSystemInfo(sysInfo);

        // Fetch entity statistics (farmer stats for backward compat)
        try {
          const farmerStats = await window.electronAPI.farmer.getStatistics();
          if (farmerStats.success) {
            setStats((prev) => ({
              ...prev,
              totalCustomers: farmerStats.data.total_farmers || 0,
              activeCustomers: farmerStats.data.active_farmers || 0,
            }));
          }
        } catch (e) {
          // Farmer stats might not be available for non-agricultural industries
        }

        // Fetch inventory item count (products + grains)
        try {
          const productStats = await window.electronAPI.product.getStatistics();
          const grainStats = await window.electronAPI.grain.getStatistics();
          const productCount = productStats?.success ? (productStats.data?.total_products || productStats.data?.total || 0) : 0;
          const grainCount = grainStats?.success ? (grainStats.data?.total_grains || grainStats.data?.total || 0) : 0;
          setStats((prev) => ({ ...prev, inventoryItems: productCount + grainCount }));
        } catch (e) {
          // Inventory stats may not be available in all setups
        }

        // Fetch today's transaction count
        try {
          const today = new Date().toISOString().split('T')[0];
          const txnResult = await window.electronAPI.transaction.getDailySummary(today);
          if (txnResult?.success && txnResult.data) {
            setStats((prev) => ({
              ...prev,
              todayTransactions: txnResult.data.total_transactions || 0,
              totalRevenue: txnResult.data.total_sales || txnResult.data.total_amount || 0,
            }));
          }
        } catch (e) {
          // Transaction stats may not be available
        }

        // Fetch reorder alerts (all industries)
        try {
          const reorderData = await window.electronAPI.stock.getReorderAlerts();
          if (reorderData?.success) {
            setReorderAlerts(reorderData);
            setStats((prev) => ({ ...prev, lowStockItems: reorderData.total || 0 }));
          }
        } catch (e) {
          console.error('Reorder alerts fetch error:', e);
        }

        // Fetch expiry alerts (Medical industry only)
        const industryType = industryConfig?.industry || industryConfig?.industryType;

        // Fetch commission stats (Real Estate industry)
        if (industryType === 'REAL_ESTATE') {
          try {
            const commResult = await window.electronAPI.commission.getStatistics({});
            if (commResult?.success && commResult.data?.summary) {
              setStats((prev) => ({
                ...prev,
                commissionEarned: commResult.data.summary.total_commission || 0,
              }));
            }
          } catch (e) {
            // Commission stats not available
          }
        }

        if (industryType === 'MEDICAL') {
          try {
            const expiryData = await window.electronAPI.stock.getExpiryAlerts(90);
            if (expiryData?.success) {
              setExpiryAlerts(expiryData);
            }
          } catch (e) {
            console.error('Expiry alerts fetch error:', e);
          }
        }
      } catch (error) {
        console.error('Dashboard data fetch error:', error);
      }
    };

    fetchDashboardData();
  }, [industryConfig]);

  // Get terminology
  const t = industryConfig?.terminology || {};
  const currency = industryConfig?.currency || 'PKR';
  const dashboardStats = industryConfig?.dashboardStats || [
    { id: 'activeCustomers', label: 'Active Entities', icon: 'users', color: 'blue' },
    { id: 'inventoryItems', label: 'Inventory Items', icon: 'package', color: 'green' },
    { id: 'todayTransactions', label: "Today's Transactions", icon: 'receipt', color: 'purple' },
    { id: 'totalRevenue', label: 'Revenue', icon: 'currency', color: 'yellow' },
  ];

  const getStatValue = (statId) => {
    switch (statId) {
      case 'activeFarmers':
      case 'activeCustomers':
      case 'activePatients':
      case 'activeClients':
        return stats.activeCustomers;
      case 'inventoryItems':
      case 'totalMedicines':
      case 'availableProperties':
        return stats.inventoryItems;
      case 'todayTransactions':
      case 'todayDispensing':
      case 'todaySales':
      case 'activeDeals':
        return stats.todayTransactions;
      case 'totalRevenue':
        return `${currency} ${stats.totalRevenue.toLocaleString()}`;
      case 'commissionEarned':
        return `${currency} ${stats.commissionEarned.toLocaleString()}`;
      case 'expiringMedicines':
        return stats.lowStockItems;
      default:
        return 0;
    }
  };

  const colorClasses = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
  };

  // Quick action cards
  const getQuickActions = () => {
    const industryType = industryConfig?.industryType || industryConfig?.industry || 'AGRICULTURAL';
    
    const commonActions = [
      { label: 'View Transactions', path: '/transactions', icon: '📋', description: 'View all transactions' },
      { label: 'Reports', path: '/reports', icon: '📊', description: 'Generate reports' },
      { label: 'Backup', path: '/backup', icon: '🛡️', description: 'Backup your data' },
    ];

    const customerLabel = t.customer || 'Customer';
    const itemLabel = t.item || 'Product';

    switch (industryType) {
      case 'RETAIL':
        return [
          { label: `New ${customerLabel}`, path: '/entities/customers', icon: '👤', description: `Add a new ${customerLabel.toLowerCase()}` },
          { label: 'New Transaction', path: '/transactions/new', icon: '🛒', description: 'Process sale or purchase' },
          { label: 'Stock Check', path: '/stock-movements', icon: '📦', description: 'Check stock levels' },
          ...commonActions,
        ];
      case 'MEDICAL':
        return [
          { label: `New ${customerLabel}`, path: '/entities/customers', icon: '🏥', description: `Register a new ${customerLabel.toLowerCase()}` },
          { label: `Dispense ${itemLabel}`, path: '/transactions/new', icon: '💊', description: 'Process prescription' },
          { label: 'Expiry Alerts', path: '/stock-movements', icon: '⚠️', description: 'Check expiring medicines' },
          ...commonActions,
        ];
      case 'REAL_ESTATE':
        return [
          { label: `New ${customerLabel}`, path: '/entities/customers', icon: '🏠', description: `Register a new ${customerLabel.toLowerCase()}` },
          { label: 'New Deal', path: '/transactions/new', icon: '🤝', description: 'Create a new deal' },
          { label: itemLabel === 'Property' ? 'Properties' : itemLabel, path: '/products', icon: '🏗️', description: `Manage ${itemLabel.toLowerCase()} listings` },
          ...commonActions,
        ];
      case 'AGRICULTURAL':
      default:
        return [
          { label: `New ${customerLabel}`, path: '/entities/customers', icon: '🌾', description: `Add a new ${customerLabel.toLowerCase()}` },
          { label: 'New Transaction', path: '/transactions/new', icon: '💰', description: 'Process transaction' },
          { label: 'Stock Overview', path: '/stock-movements', icon: '📦', description: 'Check inventory levels' },
          ...commonActions,
        ];
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Welcome back, <span className="font-medium text-gray-700">{user?.full_name || 'User'}</span>. 
          Here's your business overview.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {dashboardStats.map((stat) => {
          const colors = colorClasses[stat.color] || colorClasses.blue;
          // Navigate to the relevant page based on stat type
          const getStatNavPath = (statId) => {
            switch (statId) {
              case 'activeFarmers':
              case 'activeCustomers':
              case 'activePatients':
              case 'activeClients':
                return '/entities/customers';
              case 'inventoryItems':
              case 'totalMedicines':
              case 'availableProperties':
                return '/products';
              case 'todayTransactions':
              case 'todayDispensing':
              case 'todaySales':
              case 'activeDeals':
                return '/transactions';
              case 'totalRevenue':
              case 'commissionEarned':
                return '/reports';
              case 'expiringMedicines':
                return '/stock-movements';
              default:
                return '/dashboard';
            }
          };
          return (
            <div
              key={stat.id}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(getStatNavPath(stat.id))}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${colors.bg}`}>
                  <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-2xl font-bold text-gray-800">
                  {getStatValue(stat.id)}
                </span>
              </div>
              <h3 className="text-sm text-gray-600 font-medium">{stat.label}</h3>
            </div>
          );
        })}
      </div>

      {/* Quick Actions Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {getQuickActions().map((action) => (
            <button
              key={action.path + action.label}
              onClick={() => navigate(action.path)}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{action.icon}</span>
                <div>
                  <h3 className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Alert Widgets — Reorder + Expiry */}
      {(reorderAlerts?.total > 0 || expiryAlerts?.total > 0) && (
        <div className="mb-8 space-y-4">
          {/* Reorder Alerts Widget */}
          {reorderAlerts?.total > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="font-bold">Low Stock Alerts</h3>
                  <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs font-bold">{reorderAlerts.total} items</span>
                </div>
                <button onClick={() => navigate('/stock-movements')} className="text-white text-xs underline hover:no-underline">View All</button>
              </div>
              <div className="p-4">
                <div className="flex gap-4 mb-3">
                  {reorderAlerts.out_of_stock > 0 && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                      {reorderAlerts.out_of_stock} Out of Stock
                    </span>
                  )}
                  {reorderAlerts.critical > 0 && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full">
                      {reorderAlerts.critical} Critical
                    </span>
                  )}
                  {reorderAlerts.low > 0 && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
                      {reorderAlerts.low} Low
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {reorderAlerts.items?.slice(0, 6).map((item) => (
                    <div key={`${item.item_type}-${item.item_id}`} className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                      item.urgency === 'OUT_OF_STOCK' ? 'bg-red-50 border border-red-200' :
                      item.urgency === 'CRITICAL' ? 'bg-orange-50 border border-orange-200' :
                      'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <div>
                        <p className="font-medium text-gray-800 text-xs">{item.item_name}</p>
                        <p className="text-xs text-gray-500">{item.item_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xs">{item.current_stock}/{item.reorder_level}</p>
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1">
                          <div className={`h-1.5 rounded-full ${
                            item.stock_percentage <= 25 ? 'bg-red-500' : item.stock_percentage <= 50 ? 'bg-orange-500' : 'bg-yellow-500'
                          }`} style={{ width: `${Math.min(item.stock_percentage, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Expiry Alerts Widget (Medical only) */}
          {expiryAlerts?.total > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-pink-500 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="font-bold">Medicine Expiry Alerts</h3>
                  <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs font-bold">{expiryAlerts.total} batches</span>
                </div>
                <button onClick={() => navigate('/medicine-batches')} className="text-white text-xs underline hover:no-underline">View All</button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center p-2 bg-gray-900 rounded-lg">
                    <p className="text-lg font-bold text-red-400">{expiryAlerts.expired_count}</p>
                    <p className="text-xs text-gray-400">Expired</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-lg font-bold text-red-700">{expiryAlerts.critical_count}</p>
                    <p className="text-xs text-red-600">{"<"} 30 Days</p>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-lg font-bold text-orange-700">{expiryAlerts.warning_count}</p>
                    <p className="text-xs text-orange-600">{"<"} 60 Days</p>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-lg font-bold text-yellow-700">{expiryAlerts.notice_count}</p>
                    <p className="text-xs text-yellow-600">{"<"} 90 Days</p>
                  </div>
                </div>
                {expiryAlerts.total_value_at_risk > 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    Total value at risk: <span className="font-bold text-red-600">Rs. {expiryAlerts.total_value_at_risk.toLocaleString()}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Info & Industry Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Business Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Business Name</span>
              <span className="font-medium text-gray-800">{industryConfig?.businessName || 'Not configured'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Industry</span>
              <span className="font-medium text-gray-800">{industryConfig?.displayName || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Currency</span>
              <span className="font-medium text-gray-800">{currency}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Version</span>
              <span className="font-medium text-gray-800">v2.0</span>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            System Information
          </h2>
          {systemInfo ? (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Platform</span>
                <span className="font-medium text-gray-800">{systemInfo.platform}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Architecture</span>
                <span className="font-medium text-gray-800">{systemInfo.arch}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Node Version</span>
                <span className="font-medium text-gray-800">{systemInfo.nodeVersion}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">App Version</span>
                <span className="font-medium text-gray-800">{systemInfo.appVersion}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading system information...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
