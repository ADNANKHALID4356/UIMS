import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useToast } from '../components/common/Toast';

/**
 * EntityLedgerPage - Professional Ledger System
 * Shows complete transaction history and running balance
 * Industry-aware: all UI text adapts to AGRICULTURE or RETAIL niche
 */
const EntityLedgerPage = () => {
  const navigate = useNavigate();
  const { entityType, entityId } = useParams();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { industryConfig, settings } = useSelector((state) => state.organization);
  const toast = useToast();

  // State for entity and ledger data
  const [entity, setEntity] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState('RECEIVED');

  // Export state
  const [exporting, setExporting] = useState(false);

  // Settlement modal state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementPreview, setSettlementPreview] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState(null);

  // Extract navigation state
  const { displayLabel } = location.state || {};
  const terminology = industryConfig?.terminology || {};

  // ─────────────────────────────────────────────────────────────
  // STEP 1: Resolve entity label (dynamic by niche + entity type)
  //
  // Priority order (highest → lowest):
  //   1. Industry niche override  ← ALWAYS wins; prevents stale
  //      navigation state (e.g. displayLabel="Farmer") from
  //      leaking into a Retail session.
  //   2. Industry config terminology fallback
  //   3. displayLabel from navigation state (secondary)
  //   4. Hard default
  // ─────────────────────────────────────────────────────────────
  const entityLabel = useMemo(() => {
    const lowerType = entityType?.toLowerCase();
    const rawIndustry = industryConfig?.industry || settings?.industry_type || '';
    const industryType = rawIndustry.toString().toUpperCase();

    // ── 1. Industry niche override (HIGHEST PRIORITY) ─────────
    // Map the internal type to the terminology key
    let terminologyKey = 'customer';
    if (lowerType === 'dealer' || lowerType === 'distributor' || lowerType === 'agent') {
      terminologyKey = 'dealer';
    } else if (lowerType === 'company' || lowerType === 'supplier' || lowerType === 'owner') {
      terminologyKey = 'supplier';
    }

    // Use terminology from config if available, but guard against
    // "mixed terminology" configs after niche switching (e.g. customers="Customers"
    // while customer="Farmer"). In RETAIL we must not show agri-only labels.
    if (terminology[terminologyKey]) {
      const configured = terminology[terminologyKey];
      const isRetail = industryType.includes('RETAIL') || industryType.includes('GENERAL_STORE');

      if (isRetail) {
        const normalized = String(configured || '').trim().toLowerCase();
        if (terminologyKey === 'customer' && normalized === 'farmer') return 'Customer';
        if (terminologyKey === 'dealer' && normalized === 'dealer') return 'Distributor';
        if (terminologyKey === 'supplier' && normalized === 'company') return 'Supplier';
      }

      return configured;
    }

    // ── 2. Navigation state label (secondary) ─────────────────
    if (displayLabel) return displayLabel;

    // ── 3. Hardcoded Fallbacks (last resort) ──────────────────
    if (industryType.includes('RETAIL') || industryType.includes('GENERAL_STORE')) {
      if (terminologyKey === 'customer') return 'Customer';
      if (terminologyKey === 'dealer') return 'Distributor';
      if (terminologyKey === 'supplier') return 'Supplier';
    }

    if (industryType.includes('AGRI') || industryType.includes('FARM')) {
      if (terminologyKey === 'customer') return 'Farmer';
      if (terminologyKey === 'dealer') return 'Dealer';
      if (terminologyKey === 'supplier') return 'Company';
    }

    if (industryType.includes('MEDICAL') || industryType.includes('PHARMA')) {
      if (terminologyKey === 'customer') return 'Patient';
      if (terminologyKey === 'dealer') return 'Distributor';
      if (terminologyKey === 'supplier') return 'Pharma Company';
    }

    if (industryType.includes('REAL_ESTATE') || industryType.includes('PROPERTY')) {
      if (terminologyKey === 'customer') return 'Client';
      if (terminologyKey === 'dealer') return 'Agent';
      if (terminologyKey === 'supplier') return 'Property Owner';
    }

    // ── 4. Hard default ───────────────────────────────────────
    return 'Entity';
  }, [entityType, terminology, displayLabel, industryConfig, settings]);

  // ─────────────────────────────────────────────────────────────
  // STEP 2: Context-aware directional labels (Receive vs Pay)
  // ─────────────────────────────────────────────────────────────
  const labels = useMemo(() => {
    return {
      backTitle: `Back to ${entityLabel} Management`,
    };
  }, [entityLabel]);

  // ─────────────────────────────────────────────────────────────
  // STEP 3: Full industry vocabulary — ALL UI text lives here.
  //         Any new string must be added here, never inline.
  // ─────────────────────────────────────────────────────────────
  const ledgerTerms = useMemo(() => {
    const rawIndustry = industryConfig?.industry || settings?.industry_type || '';
    const industryType = rawIndustry.toString().toUpperCase();
    
    const isAgri = industryType.includes('AGRI') || industryType.includes('FARM');
    const isMedical = industryType.includes('MEDICAL') || industryType.includes('PHARMA');
    const isRealEstate = industryType.includes('REAL_ESTATE') || industryType.includes('PROPERTY');

    return {
      // ── Column headers ──────────────────────────────────────
      debitFull:  isAgri ? 'Naam (Debit)' : 'Debit',
      creditFull: isAgri ? 'Jama (Credit)' : 'Credit',
      debitSmall:  isAgri ? 'Naam' : 'Dr',
      creditSmall: isAgri ? 'Jama' : 'Cr',

      // ── Balance state labels ─────────────────────────────────
      positiveBalance:      isAgri ? 'Advance'          : (isRealEstate ? 'Credit' : (isMedical ? 'Prepayment' : 'Payable')),
      negativeBalance:      isAgri ? 'Loan / Debt'      : (isRealEstate ? 'Receivable' : (isMedical ? 'Due Amount' : 'Receivable')),
      negativeBalanceShort: isAgri ? 'Loan'             : (isRealEstate ? 'Receivable' : (isMedical ? 'Due' : 'Receivable')),
      netPositive:          isAgri ? 'Net Advance'      : (isRealEstate ? 'Net Credit' : (isMedical ? 'Net Prepayment' : 'Net Payable')),
      netNegative:          isAgri ? 'Net Loan / Debt'  : (isRealEstate ? 'Net Receivable' : (isMedical ? 'Net Due' : 'Net Receivable')),

      // ── Sign convention footer ───────────────────────────────
      signConvention: isAgri
        ? 'Sign Convention: Positive = Advance | Negative = Loan'
        : `Sign Convention: Positive = ${isRealEstate ? 'Credit' : 'Payable'} | Negative = ${isRealEstate ? 'Receivable' : 'Receivable'}`,

      // ── Page subtitle ────────────────────────────────────────
      pageSubtitle: isAgri
        ? 'Transaction History & Account Position'
        : (isMedical ? 'Patient History & Medical Billing' : (isRealEstate ? 'Deal History & Commission Tracking' : 'Complete Sales & Payment History')),

      // ── Header action buttons ────────────────────────────────
      receiveButtonText: `Receive from ${entityLabel}`,
      payButtonText:     `Pay to ${entityLabel}`,

      // ── Statistics row sublabels ─────────────────────────────
      cashReceivedFrom:   isAgri ? `Cash from ${entityLabel}`              : `Payments from ${entityLabel}`,
      creditGivenTo:      isAgri ? `${entityLabel}'s outstanding loan`     : `${entityLabel}'s receivable`,
      totalActivityHint:  isAgri ? 'Purchases, payments & entries'         : (isMedical ? 'Dispensing, payments & entries' : 'Deals, payments & entries'),

      // ── Payment modal — titles ───────────────────────────────
      receiveModalTitle: isAgri
        ? `💰 Receive Payment from ${entityLabel}`
        : `💰 Record Payment from ${entityLabel}`,
      payModalTitle: isAgri
        ? `💸 Pay to ${entityLabel}`
        : `💸 Issue Payment to ${entityLabel}`,

      // ── Payment modal — direction info banner ────────────────
      receiveDirectionInfo: isAgri
        ? `${entityLabel} is clearing their loan or building an advance`
        : `${entityLabel} is settling their outstanding balance`,
      payDirectionInfo: isAgri
        ? `Shop is issuing an advance payment to ${entityLabel}`
        : `Shop is issuing payment to ${entityLabel}`,

      // ── Payment modal — current balance labels ───────────────
      modalCreditLabel:  isAgri ? `${entityLabel}'s Outstanding Loan:`  : `${entityLabel} Owes Shop:`,
      modalBalanceLabel: isAgri ? `Shop Owes ${entityLabel} (Advance):` : `Shop Owes ${entityLabel}:`,

      // ── Payment modal — hint below current balances ──────────
      paymentReceivedHint: isAgri
        ? `This clears ${entityLabel}'s loan or creates an advance for the next transaction`
        : `This reduces ${entityLabel}'s outstanding balance or creates a prepayment credit`,
      paymentMadeHint: isAgri
        ? `This reduces the advance liability owed to ${entityLabel}`
        : `This settles the amount shop owes to ${entityLabel}`,

      // ── Payment modal — excess amount notice ─────────────────
      excessPaymentType: isAgri ? 'advance' : 'prepayment credit',
      excessPaymentHint: isAgri
        ? 'This advance will auto-apply against their next purchase transaction.'
        : 'This prepayment will be applied as credit on their next invoice.',

      // ── Entity relation badge ────────────────────────────────
      entityRelationBadge: isAgri ? 'Agricultural Entity' : (isMedical ? 'Medical / Healthcare Entity' : (isRealEstate ? 'Real Estate Entity' : 'Business Entity')),
    };
  }, [industryConfig, settings, entityLabel]);

  // ─────────────────────────────────────────────────────────────
  // Navigation helpers
  // ─────────────────────────────────────────────────────────────
  const handleBackToManagement = () => {
    const routes = {
      farmer:      '/entities/customers',
      customer:    '/entities/customers',
      dealer:      '/entities/dealers',
      distributor: '/entities/dealers',
      company:     '/entities/suppliers',
      supplier:    '/entities/suppliers',
    };
    navigate(routes[entityType?.toLowerCase()] || '/dashboard');
  };

  // Update document title dynamically
  useEffect(() => {
    if (entityLabel) {
      document.title = `${entityLabel} Ledger | ${industryConfig?.businessName || 'EIS'}`;
    }
  }, [entityLabel, industryConfig]);

  // Handle transaction click
  const handleTransactionClick = (entry) => {
    if (entry.entry_source === 'TRANSACTION' && entry.source_id) {
      navigate(`/transactions/${entry.source_id}`, {
        state: {
          from: 'ledger',
          entityType,
          entityId,
          entityName: entity?.name || entity?.company_name,
        },
      });
    }
  };

  // Load entity + ledger data
  const loadLedgerData = useCallback(
    async (applyFilter = false) => {
      try {
        setLoading(true);
        setError(null);

        const options = {};
        if (applyFilter && dateFrom) options.dateFrom = dateFrom;
        if (applyFilter && dateTo)   options.dateTo   = dateTo;

        const entityResult = await window.electronAPI.ledger.getEntityDetails(
          entityType, parseInt(entityId)
        );
        if (!entityResult.success) throw new Error(entityResult.message || 'Failed to load entity details');
        setEntity(entityResult.data);

        const ledgerResult = await window.electronAPI.ledger.getEntityLedger(
          entityType, parseInt(entityId), options
        );
        if (!ledgerResult.success) throw new Error(ledgerResult.message || 'Failed to load ledger');
        setLedgerEntries(ledgerResult.data.entries || []);
        setStatistics(ledgerResult.data.summary || ledgerResult.data.statistics || null);
      } catch (err) {
        console.error('Error loading ledger:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [entityType, entityId, dateFrom, dateTo]
  );

  useEffect(() => {
    if (entityType && entityId) loadLedgerData();
  }, [entityType, entityId, loadLedgerData]);

  const handleApplyFilter = () => { setFilterApplied(true); loadLedgerData(true); };
  const handleClearFilter = () => {
    setDateFrom(''); setDateTo(''); setFilterApplied(false); loadLedgerData(false);
  };

  // Record payment
  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.warning('Please enter a valid payment amount');
      return;
    }
    try {
      setPaymentLoading(true);
      const result = await window.electronAPI.ledger.recordPayment({
        entityType,
        entityId: parseInt(entityId),
        amount: parseFloat(paymentAmount),
        paymentType: paymentDirection,
        description:
          paymentDescription ||
          (paymentDirection === 'RECEIVED' ? 'Payment received' : 'Payment made'),
        createdBy: user?.user_id || 1,
      });
      if (!result.success) throw new Error(result.message || 'Failed to record payment');
      await loadLedgerData(filterApplied);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentDescription('');
    } catch (err) {
      console.error('Error recording payment:', err);
      toast.error(` ${err.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      setExporting(true);
      const options = {};
      if (filterApplied && dateFrom) options.dateFrom = dateFrom;
      if (filterApplied && dateTo)   options.dateTo   = dateTo;

      const result = await window.electronAPI.ledger.export(entityType, parseInt(entityId), options);
      if (!result.success) throw new Error(result.message || 'Failed to export ledger');

      const blob = new Blob([result.data], { type: 'text/csv' });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${entityType}_${entityId}_ledger_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting ledger:', err);
      toast.error(`Export Error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Settlement
  const handleOpenSettlement = async () => {
    try {
      setSettlementLoading(true);
      setSettlementError(null);
      const result = await window.electronAPI.ledger.getSettlementPreview(entityType, parseInt(entityId));
      if (!result.success) throw new Error(result.message || 'Failed to get settlement preview');
      setSettlementPreview(result.data);
      setShowSettlementModal(true);
    } catch (err) {
      console.error('Error getting settlement preview:', err);
      setSettlementError(err.message);
      toast.error(` ${err.message}`);
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleConfirmSettlement = async () => {
    try {
      setSettlementLoading(true);
      const result = await window.electronAPI.ledger.settleBalance(
        entityType, parseInt(entityId), user?.user_id || 1
      );
      if (!result.success) throw new Error(result.message || 'Failed to settle balance');
      setShowSettlementModal(false);
      setSettlementPreview(null);
      await loadLedgerData(filterApplied);
      toast.success(result.data?.message || 'Settlement completed successfully!');
    } catch (err) {
      console.error('Error settling balance:', err);
      toast.error(`Settlement Error: ${err.message}`);
    } finally {
      setSettlementLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Formatting helpers
  // ─────────────────────────────────────────────────────────────
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount) || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getBalanceColor = (balance) => {
    const num = parseFloat(balance) || 0;
    if (num > 0) return 'text-red-600';
    if (num < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  // ─────────────────────────────────────────────────────────────
  // Loading / Error states
  // ─────────────────────────────────────────────────────────────
  if (loading && !entity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-white text-lg">Loading {entityLabel} Ledger...</p>
        </div>
      </div>
    );
  }

  if (error && !entity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Error Loading Ledger</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={handleBackToManagement}
            className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">

            <div className="flex items-center space-x-4">
              <button onClick={handleBackToManagement}
                className="p-2 hover:bg-slate-700 rounded-lg transition group"
                title={labels.backTitle}>
                <svg className="w-6 h-6 group-hover:text-cyan-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                {/* ✅ FIX: uses entityLabel — "Customer Ledger", "Supplier Ledger", etc. */}
                <h1 className="text-2xl font-bold">{entityLabel} Ledger</h1>
                {/* ✅ FIX: industry-aware subtitle via ledgerTerms */}
                <p className="text-gray-400 text-sm">{ledgerTerms.pageSubtitle}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* ✅ FIX: Button text uses ledgerTerms.receiveButtonText */}
              <button
                onClick={() => { setPaymentDirection('RECEIVED'); setShowPaymentModal(true); }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2 shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{ledgerTerms.receiveButtonText}</span>
              </button>

              {/* ✅ FIX: Button text uses ledgerTerms.payButtonText */}
              <button
                onClick={() => { setPaymentDirection('MADE'); setShowPaymentModal(true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2 shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{ledgerTerms.payButtonText}</span>
              </button>

              <button onClick={handleExport} disabled={exporting}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition flex items-center space-x-2 disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Entity Info Card */}
        {entity && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

              {/* Entity details */}
              <div className="md:col-span-2">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                    {(entity.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{entity.name}</h2>
                    <p className="text-gray-400">ID: {entity.specific_id || entity.id}</p>
                    {entity.phone   && <p className="text-gray-400">📞 {entity.phone}</p>}
                    {entity.address && <p className="text-gray-400 text-sm">📍 {entity.address}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${entity.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {entity.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {/* ✅ FIX: Industry-aware entity type badge */}
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {ledgerTerms.entityRelationBadge}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unified balance display */}
              <div className={`md:col-span-3 rounded-2xl p-6 text-center border-4 shadow-xl transition-all ${
                (entity.account_balance || 0) > 0
                  ? 'bg-green-500/10 border-green-500/40'
                  : ((entity.account_balance || 0) < 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-700/50 border-slate-600')
              }`}>
                <p className="text-gray-400 text-xs uppercase font-black tracking-[0.2em] mb-2">
                  Current Account Balance
                </p>
                <div className="flex items-baseline gap-2 justify-center mb-2">
                  <span className={`text-5xl font-black ${
                    (entity.account_balance || 0) > 0 ? 'text-green-400' : ((entity.account_balance || 0) < 0 ? 'text-red-400' : 'text-gray-400')
                  }`}>
                    {formatCurrency(Math.abs(entity.account_balance || 0))}
                  </span>
                  {/* ✅ FIX: Balance state label via ledgerTerms */}
                  <span className={`text-sm font-bold uppercase ${
                    (entity.account_balance || 0) > 0 ? 'text-green-500' : ((entity.account_balance || 0) < 0 ? 'text-red-500' : 'text-gray-500')
                  }`}>
                    {(entity.account_balance || 0) > 0
                      ? ledgerTerms.positiveBalance
                      : ((entity.account_balance || 0) < 0 ? ledgerTerms.negativeBalance : 'Settled')}
                  </span>
                </div>
                <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block ${
                  (entity.account_balance || 0) > 0
                    ? 'bg-green-500/20 text-green-400'
                    : ((entity.account_balance || 0) < 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-600 text-gray-300')
                }`}>
                  {entity.net_position_label}
                </div>
              </div>
            </div>

            {/* Sign convention footer */}
            <div className="mt-6 p-3 bg-slate-900/50 border border-slate-700 rounded-lg flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${entity.account_balance > 0 ? 'bg-green-500' : (entity.account_balance < 0 ? 'bg-red-500' : 'bg-gray-500')}`} />
                {/* ✅ FIX: Sign convention label via ledgerTerms */}
                <span className="text-[10px] text-gray-500 uppercase font-bold">{ledgerTerms.signConvention}</span>
              </div>
            </div>

            {/* ✅ FIX: Statistics row — sublabels now use ledgerTerms (no more "From farmer" / "Farmer's loan") */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-700">

                <div className="text-center p-4 bg-slate-700/10 rounded-lg border border-slate-700/40">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-1">Transactions</p>
                  <p className="text-xl font-bold text-white">{statistics.total_transactions || 0}</p>
                  <p className="text-gray-500 text-xs mt-1">{ledgerTerms.totalActivityHint}</p>
                </div>

                <div className="text-center p-4 bg-green-900/10 rounded-lg border border-green-700/20">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-1">Cash Received</p>
                  <p className="text-xl font-bold text-green-400">
                    {formatCurrency(statistics.total_received || statistics.total_cash_received || 0)}
                  </p>
                  {/* ✅ FIX: "From farmer" → dynamic via ledgerTerms.cashReceivedFrom */}
                  <p className="text-gray-500 text-xs mt-1">{ledgerTerms.cashReceivedFrom}</p>
                </div>

                <div className="text-center p-4 bg-red-900/10 rounded-lg border border-red-700/20">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-1">Credit Given</p>
                  <p className="text-xl font-bold text-red-400">
                    {formatCurrency(statistics.total_credit || statistics.total_credit_given || 0)}
                  </p>
                  {/* ✅ FIX: "Farmer's loan" → dynamic via ledgerTerms.creditGivenTo */}
                  <p className="text-gray-500 text-xs mt-1">{ledgerTerms.creditGivenTo}</p>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-gray-400 text-sm">From:</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-gray-400 text-sm">To:</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <button onClick={handleApplyFilter}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
              Apply Filter
            </button>
            {filterApplied && (
              <button onClick={handleClearFilter}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition">
                Clear Filter
              </button>
            )}
            <div className="ml-auto text-gray-400 text-sm">
              Showing {ledgerEntries.length} entries
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/80 border-b border-slate-600">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-400">Date</th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-400">Reference</th>
                  <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-400">Description</th>
                  {/* ✅ FIX: Column headers via ledgerTerms */}
                  <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-widest text-red-400 border-l border-slate-700">{ledgerTerms.debitFull}</th>
                  <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-widest text-green-400">{ledgerTerms.creditFull}</th>
                  <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-widest text-cyan-400 border-l border-slate-700">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-16 text-center text-gray-500">
                      <div className="text-5xl mb-4 opacity-20">📂</div>
                      <p className="font-bold text-lg">No history available for this {entityLabel.toLowerCase()}</p>
                      <p className="text-sm">Complete a transaction to see it reflected here.</p>
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry, index) => {
                    const isClickable = entry.entry_source === 'TRANSACTION' && entry.source_id;
                    return (
                      <tr
                        key={`ledger-row-${entry.source_id}-${index}`}
                        className={`hover:bg-slate-700/40 transition-all group ${isClickable ? 'cursor-pointer' : ''}`}
                        onClick={() => isClickable && handleTransactionClick(entry)}>
                        <td className="px-4 py-4 text-sm text-gray-400 font-medium whitespace-nowrap">
                          {formatDate(entry.entry_date)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex flex-col">
                            <span className="text-cyan-500 font-bold font-mono text-xs">
                              {entry.reference_number || `PAY-${entry.source_id}`}
                            </span>
                            <span className="text-[10px] text-gray-600 uppercase font-black">
                              {entry.transaction_type?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-300">
                          <div className="max-w-[300px] lg:max-w-[450px] leading-relaxed break-words italic group-hover:text-white transition-colors">
                            {entry.item_description || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-right font-bold text-red-400/90 border-l border-slate-700/50">
                          {parseFloat(entry.debit) > 0 ? (
                            <div className="flex flex-col items-end">
                              <span>{formatCurrency(entry.debit)}</span>
                              {/* ✅ FIX: column micro-label via ledgerTerms */}
                              <span className="text-[9px] text-red-500/50 uppercase tracking-tighter">{ledgerTerms.debitSmall}</span>
                            </div>
                          ) : <span className="text-slate-700">-</span>}
                        </td>
                        <td className="px-4 py-4 text-sm text-right font-bold text-green-400/90">
                          {parseFloat(entry.credit) > 0 ? (
                            <div className="flex flex-col items-end">
                              <span>{formatCurrency(entry.credit)}</span>
                              {/* ✅ FIX: column micro-label via ledgerTerms */}
                              <span className="text-[9px] text-green-500/50 uppercase tracking-tighter">{ledgerTerms.creditSmall}</span>
                            </div>
                          ) : <span className="text-slate-700">-</span>}
                        </td>
                        <td className="px-4 py-4 text-sm text-right border-l border-slate-700/50">
                          <div className="flex flex-col items-end">
                            <span className={`text-base font-black ${getBalanceColor(entry.running_balance)}`}>
                              {formatCurrency(Math.abs(entry.running_balance))}
                            </span>
                            {/* ✅ FIX: Running balance state label via ledgerTerms */}
                            <span className={`text-[9px] uppercase font-black tracking-widest ${getBalanceColor(entry.running_balance)}`}>
                              {entry.running_balance > 0
                                ? ledgerTerms.positiveBalance
                                : (entry.running_balance < 0 ? ledgerTerms.negativeBalanceShort : 'Settled')}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Print footer */}
        <div className="mt-6 text-center text-gray-500 text-sm print:block hidden">
          <p>Ledger generated on {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* ── Payment Modal ───────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">

            {/* ✅ FIX: Modal title via ledgerTerms */}
            <h3 className="text-xl font-bold mb-4">
              {paymentDirection === 'RECEIVED' ? ledgerTerms.receiveModalTitle : ledgerTerms.payModalTitle}
            </h3>

            {/* ✅ FIX: Direction info banner via ledgerTerms */}
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
              <p className="text-blue-300 text-sm">
                {paymentDirection === 'RECEIVED'
                  ? ledgerTerms.receiveDirectionInfo
                  : ledgerTerms.payDirectionInfo}
              </p>
            </div>

            {/* Current balances */}
            <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                {/* ✅ FIX: Balance labels via ledgerTerms */}
                <span className="text-gray-400 text-sm">{ledgerTerms.modalCreditLabel}</span>
                <span className="text-lg font-bold text-red-400">{formatCurrency(entity?.credit || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">{ledgerTerms.modalBalanceLabel}</span>
                <span className="text-lg font-bold text-green-400">{formatCurrency(entity?.balance || 0)}</span>
              </div>
              {/* ✅ FIX: Hint text via ledgerTerms — no more hardcoded "advance balance" */}
              <p className="text-gray-500 text-xs mt-2">
                {paymentDirection === 'RECEIVED'
                  ? ledgerTerms.paymentReceivedHint
                  : ledgerTerms.paymentMadeHint}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Payment Amount (PKR)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />

                {/* ✅ FIX: Excess payment notice via ledgerTerms — no more hardcoded "advance balance" */}
                {paymentAmount && parseFloat(paymentAmount) > parseFloat(entity?.credit || 0) && !entity?.has_advance && (
                  <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded-lg">
                    <p className="text-green-400 text-sm font-medium">
                      ✓ Payment exceeds outstanding by {formatCurrency(parseFloat(paymentAmount) - parseFloat(entity?.credit || 0))}
                    </p>
                    <p className="text-green-300/70 text-xs">
                      {ledgerTerms.excessPaymentHint}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                <textarea
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder="Add notes about this payment..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none" />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => { setShowPaymentModal(false); setPaymentAmount(''); setPaymentDescription(''); }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition">
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={paymentLoading || !paymentAmount}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                {paymentLoading
                  ? (<><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" /><span>Recording...</span></>)
                  : <span>Record Payment</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settlement Modal (unchanged — already generic) ─────── */}
      {showSettlementModal && settlementPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center space-x-2">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>Settlement Calculation</span>
              </h3>
              <button onClick={() => { setShowSettlementModal(false); setSettlementPreview(null); }}
                className="p-2 hover:bg-slate-700 rounded-lg transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm">Entity</p>
              <p className="text-lg font-bold">{settlementPreview.entityName}</p>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-medium text-gray-400">Current Balances</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                  <p className="text-green-400 text-xs mb-1">Shop Owes {entityLabel}</p>
                  <p className="text-xl font-bold text-green-400">{formatCurrency(settlementPreview.currentBalance)}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <p className="text-red-400 text-xs mb-1">{entityLabel} Owes Shop</p>
                  <p className="text-xl font-bold text-red-400">{formatCurrency(settlementPreview.currentCredit)}</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-amber-400 mb-3">Settlement Result</h4>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">Offset Amount:</span>
                <span className="text-white font-bold">{formatCurrency(settlementPreview.offsetAmount)}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">Net Amount:</span>
                <span className={`font-bold ${settlementPreview.netAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(Math.abs(settlementPreview.netAmount))}
                </span>
              </div>
              <div className="pt-3 border-t border-amber-500/30">
                <p className={`text-center font-medium ${settlementPreview.netAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {settlementPreview.message}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-medium text-gray-400">After Settlement</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">New Balance</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(settlementPreview.newBalance)}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">New Credit</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(settlementPreview.newCredit)}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button onClick={() => { setShowSettlementModal(false); setSettlementPreview(null); }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition">
                Cancel
              </button>
              <button
                onClick={handleConfirmSettlement}
                disabled={settlementLoading || (settlementPreview.currentBalance === 0 && settlementPreview.currentCredit === 0)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                {settlementLoading
                  ? (<><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" /><span>Processing...</span></>)
                  : <span>Confirm Settlement</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EntityLedgerPage;