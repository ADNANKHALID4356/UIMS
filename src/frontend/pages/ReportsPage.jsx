import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeftIcon,
  DocumentChartBarIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ChevronRightIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ClockIcon,
  HomeModernIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  TrophyIcon,
  ArchiveBoxXMarkIcon,
  BeakerIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { exportToCSV, exportToPDF, exportToExcel, buildHTMLTable, buildSummaryCards } from '../components/ExportService';

/**
 * ReportsPage - Sprint 7: Reporting & Analytics
 * Central hub for all report types
 */
const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  
  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Entity filter for ledger report
  const [entityType, setEntityType] = useState('farmer');
  const [entityId, setEntityId] = useState('');
  const [entities, setEntities] = useState([]);

  // Expiry report threshold
  const [expiryDays, setExpiryDays] = useState(90);

  // Industry Configuration
  const { industryConfig } = useSelector((state) => state.organization);
  const t = industryConfig?.terminology || {};

  // Report types (Dynamic)
  const reportTypes = [
    {
      id: 'daily_sales',
      name: 'Daily Sales Report',
      description: 'View sales transactions by date with totals',
      icon: CurrencyDollarIcon,
      color: 'bg-green-500',
      needsDateRange: true
    },
    {
      id: 'outstanding_balance',
      name: 'Outstanding Balance',
      description: `View all pending ${t.receivables || 'receivables'} and ${t.payables || 'payables'}`,
      icon: BanknotesIcon,
      color: 'bg-yellow-500',
      needsDateRange: false
    },
    {
      id: 'stock',
      name: `${t.item || 'Product'} Stock Report`,
      description: `Current ${t.items || 'inventory'} levels and values`,
      icon: CubeIcon,
      color: 'bg-blue-500',
      needsDateRange: false
    },
    {
      id: 'customer_ledger',
      name: `${t.customer || 'Customer'} Ledger`,
      description: `Detailed ledger for a specific ${t.customer?.toLowerCase() || 'customer'}`,
      icon: ClipboardDocumentListIcon,
      color: 'bg-indigo-500',
      needsDateRange: true,
      needsEntity: true
    },
    {
      id: 'profit_loss',
      name: 'Profit & Loss',
      description: 'Revenue vs expenses with gross margin',
      icon: ChartBarIcon,
      color: 'bg-emerald-500',
      needsDateRange: true
    },
    {
      id: 'stock_movement',
      name: `${t.item || 'Stock'} Movement`,
      description: `Track all ${t.items || 'stock'} ins and outs`,
      icon: ArrowsRightLeftIcon,
      color: 'bg-cyan-500',
      needsDateRange: true
    },
    {
      id: 'top_selling',
      name: `Top-Selling ${t.items || 'Products'}`,
      description: 'Best performing items by revenue',
      icon: TrophyIcon,
      color: 'bg-amber-500',
      needsDateRange: true
    }
  ];

  // Load entities when needed
  useEffect(() => {
    if (activeReport === 'customer_ledger') {
      loadEntities();
    }
  }, [activeReport, entityType]);

  const loadEntities = async () => {
    try {
      let result;
      if (entityType === 'farmer') {
        result = await window.electronAPI.farmer.getAll(true);
      } else if (entityType === 'dealer') {
        result = await window.electronAPI.dealer.getAll(true);
      } else if (entityType === 'company') {
        result = await window.electronAPI.company.getAll(true);
      }
      if (result && result.success) setEntities(result.data);
    } catch (err) {
      console.error('Error loading entities:', err);
    }
  };

  const generateReport = async () => {
    if (!activeReport) return;
    
    setLoading(true);
    setError('');
    setReportData(null);

    try {
      let result;

      switch (activeReport) {
        case 'daily_sales':
          result = await window.electronAPI.report.dailySales(startDate, endDate);
          break;
        case 'outstanding_balance':
          result = await window.electronAPI.report.outstandingBalance();
          break;
        case 'stock':
          result = await window.electronAPI.report.stock();
          break;
        case 'cash_flow':
          result = await window.electronAPI.report.cashFlow(startDate, endDate);
          break;
        case 'customer_ledger':
          if (!entityId) {
            setError('Please select a customer');
            setLoading(false);
            return;
          }
          result = await window.electronAPI.report.customerLedger(entityType, parseInt(entityId), startDate, endDate);
          break;
        case 'profit_loss':
          result = await window.electronAPI.report.profitAndLoss(startDate, endDate);
          break;
        case 'expiry':
          result = await window.electronAPI.report.expiry(expiryDays);
          break;
        case 'property_portfolio':
          result = await window.electronAPI.report.propertyPortfolio();
          break;
        case 'stock_movement':
          result = await window.electronAPI.report.stockMovement(startDate, endDate);
          break;
        case 'top_selling':
          result = await window.electronAPI.report.topSelling(startDate, endDate, 20);
          break;
        case 'dead_stock':
          result = await window.electronAPI.report.deadStock(expiryDays);
          break;
        case 'batch_wise_stock':
          result = await window.electronAPI.report.batchWiseStock();
          break;
        case 'patient_history':
          result = await window.electronAPI.report.patientHistory(null);
          break;
        case 'commission_earned':
          result = await window.electronAPI.report.commissionEarned(startDate, endDate);
          break;
        case 'credit_aging':
          result = await window.electronAPI.report.creditAging();
          break;
        case 'controlled_substance':
          result = await window.electronAPI.report.controlledSubstance(startDate, endDate);
          break;
        default:
          setError('Unknown report type');
          setLoading(false);
          return;
      }

      if (result.success) {
        setReportData(result.data);
      } else {
        setError(result.message || 'Failed to generate report');
      }

    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const printReport = () => {
    window.print();
  };

  // ---- CSV Export ----
  const handleExportCSV = () => {
    if (!reportData) return;
    const reportName = currentReportType?.name?.replace(/\s+/g, '_') || 'report';
    const dateStr = new Date().toISOString().split('T')[0];

    switch (activeReport) {
      case 'daily_sales':
        exportToCSV(reportData.daily_breakdown, `${reportName}_${dateStr}`,
          ['date', 'transaction_count', 'cash_received', 'credit_given', 'total_amount']);
        break;
      case 'outstanding_balance': {
        const all = [
          ...reportData.farmers.list,
          ...reportData.dealers.list,
          ...reportData.companies.list,
        ];
        exportToCSV(all, `${reportName}_${dateStr}`,
          ['entity_type', 'specific_id', 'name', 'phone', 'balance', 'credit', 'net_position']);
        break;
      }
      case 'stock': {
        const allStock = [...reportData.products.list, ...reportData.grains.list];
        exportToCSV(allStock, `${reportName}_${dateStr}`,
          ['item_type', 'code', 'name', 'category', 'unit', 'quantity', 'avg_price', 'total_value']);
        break;
      }
      case 'cash_flow':
        exportToCSV(reportData.daily_summary, `${reportName}_${dateStr}`,
          ['date', 'cash_in', 'cash_out', 'net_cash']);
        break;
      case 'customer_ledger':
        exportToCSV(reportData.ledger_entries, `${reportName}_${dateStr}`,
          ['entry_date', 'entry_type', 'description', 'debit', 'credit', 'running_balance']);
        break;
      case 'profit_loss': {
        const plRows = [
          ...reportData.revenue.breakdown.map((r) => ({ category: 'Revenue', type: r.transaction_type, count: r.count, amount: r.total })),
          ...reportData.cost_of_goods_sold.breakdown.map((c) => ({ category: 'COGS', type: c.transaction_type, count: c.count, amount: c.total })),
          { category: 'Summary', type: 'Gross Profit', count: '', amount: reportData.gross_profit },
        ];
        exportToCSV(plRows, `${reportName}_${dateStr}`, ['category', 'type', 'count', 'amount']);
        break;
      }
      case 'expiry':
        exportToCSV(reportData.batches, `${reportName}_${dateStr}`,
          ['product_name', 'product_code', 'batch_number', 'expiry_date', 'remaining_quantity', 'unit_cost']);
        break;
      case 'property_portfolio':
        exportToCSV(reportData.properties, `${reportName}_${dateStr}`,
          ['title', 'property_type', 'status', 'city', 'area_value', 'asking_price']);
        break;
      case 'stock_movement':
        exportToCSV(reportData.movements, `${reportName}_${dateStr}`,
          ['movement_date', 'item_name', 'item_code', 'movement_type', 'quantity', 'reference', 'performed_by_name']);
        break;
      case 'top_selling':
        exportToCSV(reportData.products, `${reportName}_${dateStr}`,
          ['item_name', 'item_code', 'total_quantity_sold', 'total_revenue', 'transaction_count']);
        break;
      case 'dead_stock':
        exportToCSV(reportData.items, `${reportName}_${dateStr}`,
          ['product_code', 'product_name', 'category', 'current_qty', 'stock_value', 'days_idle', 'last_movement_date']);
        break;
      case 'batch_wise_stock':
        exportToCSV(reportData.batches, `${reportName}_${dateStr}`,
          ['product_name', 'product_code', 'batch_number', 'expiry_date', 'remaining_quantity', 'unit_cost', 'batch_value', 'expiry_status']);
        break;
      case 'patient_history':
        exportToCSV(reportData.patients, `${reportName}_${dateStr}`,
          ['patient_code', 'patient_name', 'phone', 'total_transactions', 'total_spent', 'outstanding_credit', 'last_purchase_date']);
        break;
      case 'commission_earned':
        exportToCSV(reportData.commissions, `${reportName}_${dateStr}`,
          ['agent_name', 'client_name', 'deal_description', 'deal_amount', 'commission_rate', 'commission_amount', 'status', 'created_at']);
        break;
      case 'credit_aging':
        exportToCSV(reportData.aging_data, `${reportName}_${dateStr}`,
          ['entity_type', 'entity_name', 'bucket_0_30', 'bucket_31_60', 'bucket_61_90', 'bucket_90_plus', 'total_outstanding']);
        break;
      case 'controlled_substance':
        exportToCSV(reportData.entries, `${reportName}_${dateStr}`,
          ['product_name', 'product_code', 'batch_number', 'transaction_type', 'quantity', 'patient_name', 'performed_by_name', 'created_at']);
        break;
      default:
        break;
    }
  };

  // ---- PDF Export ----
  const handleExportPDF = () => {
    if (!reportData) return;
    const title = currentReportType?.name || 'Report';
    const meta = { start_date: startDate, end_date: endDate, generated_at: reportData.generated_at };
    const fmt = (v) => formatCurrency(v);

    // Helper for dynamic labels in exports
    const getDynamicLabel = (backendType) => {
      const type = (backendType || '').toLowerCase();
      if (type.includes('farmer') || type.includes('customer')) return t.customer || 'Customer';
      if (type.includes('dealer') || type.includes('distributor')) return t.dealer || 'Dealer';
      if (type.includes('compan') || type.includes('supplier')) return t.supplier || 'Supplier';
      return backendType;
    };

    switch (activeReport) {
      case 'daily_sales': {
        const summary = buildSummaryCards([
          { label: 'Transactions', value: reportData.totals.total_transactions },
          { label: 'Total Cash', value: fmt(reportData.totals.total_cash) },
          { label: 'Total Credit', value: fmt(reportData.totals.total_credit) },
          { label: 'Grand Total', value: fmt(reportData.totals.grand_total) },
        ]);
        const table = buildHTMLTable(reportData.daily_breakdown, [
          { key: 'date', label: 'Date' },
          { key: 'transaction_count', label: 'Txns', align: 'right' },
          { key: 'cash_received', label: 'Cash', align: 'right', format: fmt },
          { key: 'credit_given', label: 'Credit', align: 'right', format: fmt },
          { key: 'total_amount', label: 'Total', align: 'right', format: fmt },
        ]);
        exportToPDF(title, summary + table, meta);
        break;
      }
      case 'outstanding_balance': {
        const mappedData = [...reportData.farmers.list, ...reportData.dealers.list, ...reportData.companies.list]
          .map(item => ({
            ...item,
            display_type: getDynamicLabel(item.entity_type)
          }));

        const table = buildHTMLTable(mappedData, [
          { key: 'display_type', label: 'Type' },
          { key: 'specific_id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'balance', label: 'Advance (Jama)', align: 'right', format: fmt },
          { key: 'credit', label: 'Loan (Naam)', align: 'right', format: fmt },
          { key: 'net_position', label: 'Net Balance', align: 'right', format: fmt },
        ]);
        exportToPDF(title, table, meta);
        break;
      }
      case 'profit_loss': {
        const summary = buildSummaryCards([
          { label: 'Revenue', value: fmt(reportData.revenue?.total) },
          { label: 'COGS', value: fmt(reportData.cost_of_goods_sold?.total) },
          { label: 'Gross Profit', value: fmt(reportData.gross_profit) },
          { label: 'Margin', value: reportData.gross_margin_pct + '%' },
        ]);
        exportToPDF(title, summary, meta);
        break;
      }
      case 'expiry': {
        const expSummary = buildSummaryCards([
          { label: 'Total Batches', value: reportData.batches?.length },
          { label: 'Expired', value: reportData.expired?.count },
          { label: 'Critical (30d)', value: reportData.critical?.count },
          { label: 'Value at Risk', value: fmt(reportData.total_value_at_risk) },
        ]);
        const expTable = buildHTMLTable(reportData.batches, [
          { key: 'product_name', label: 'Medicine' },
          { key: 'batch_number', label: 'Batch' },
          { key: 'expiry_date', label: 'Expiry Date' },
          { key: 'remaining_quantity', label: 'Qty', align: 'right' },
          { key: 'unit_cost', label: 'Cost', align: 'right', format: fmt },
        ]);
        exportToPDF(title, expSummary + expTable, meta);
        break;
      }
      case 'property_portfolio': {
        const propSummary = buildSummaryCards([
          { label: 'Total Listings', value: reportData.total_listings },
          { label: 'Portfolio Value', value: fmt(reportData.total_portfolio_value) },
        ]);
        const propTable = buildHTMLTable(reportData.properties, [
          { key: 'title', label: 'Property' },
          { key: 'property_type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'city', label: 'City' },
          { key: 'asking_price', label: 'Price', align: 'right', format: fmt },
        ]);
        exportToPDF(title, propSummary + propTable, meta);
        break;
      }
      case 'stock_movement': {
        const smSummary = buildSummaryCards([
          { label: 'Total Movements', value: reportData.summary?.total_movements },
          { label: 'Total In', value: reportData.summary?.total_in },
          { label: 'Total Out', value: reportData.summary?.total_out },
          { label: 'Net Change', value: reportData.summary?.net_change },
        ]);
        const smTable = buildHTMLTable(reportData.movements, [
          { key: 'movement_date', label: 'Date' },
          { key: 'item_name', label: 'Item' },
          { key: 'movement_type', label: 'Type' },
          { key: 'quantity', label: 'Qty', align: 'right' },
          { key: 'performed_by_name', label: 'By' },
        ]);
        exportToPDF(title, smSummary + smTable, meta);
        break;
      }
      case 'top_selling': {
        const tsSummary = buildSummaryCards([
          { label: 'Products', value: reportData.summary?.total_products },
          { label: 'Total Revenue', value: fmt(reportData.summary?.grand_total_revenue) },
        ]);
        const tsTable = buildHTMLTable(reportData.products, [
          { key: 'item_name', label: 'Product' },
          { key: 'item_code', label: 'Code' },
          { key: 'total_quantity_sold', label: 'Qty Sold', align: 'right' },
          { key: 'total_revenue', label: 'Revenue', align: 'right', format: fmt },
          { key: 'transaction_count', label: 'Txns', align: 'right' },
        ]);
        exportToPDF(title, tsSummary + tsTable, meta);
        break;
      }
      case 'dead_stock': {
        const dsSummary = buildSummaryCards([
          { label: 'Dead Items', value: reportData.summary?.total_dead_items },
          { label: 'Dead Value', value: fmt(reportData.summary?.total_dead_value) },
        ]);
        const dsTable = buildHTMLTable(reportData.items, [
          { key: 'product_code', label: 'Code' },
          { key: 'product_name', label: 'Product' },
          { key: 'category', label: 'Category' },
          { key: 'current_qty', label: 'Qty', align: 'right' },
          { key: 'stock_value', label: 'Value', align: 'right', format: fmt },
          { key: 'days_idle', label: 'Days Idle', align: 'right' },
        ]);
        exportToPDF(title, dsSummary + dsTable, meta);
        break;
      }
      case 'batch_wise_stock': {
        const bwSummary = buildSummaryCards([
          { label: 'Total Batches', value: reportData.summary?.total_batches },
          { label: 'Total Qty', value: reportData.summary?.total_quantity },
          { label: 'Total Value', value: fmt(reportData.summary?.total_value) },
          { label: 'Expired', value: reportData.summary?.expired_batches },
        ]);
        const bwTable = buildHTMLTable(reportData.batches, [
          { key: 'product_name', label: 'Medicine' },
          { key: 'batch_number', label: 'Batch' },
          { key: 'expiry_date', label: 'Expiry' },
          { key: 'remaining_quantity', label: 'Qty', align: 'right' },
          { key: 'unit_cost', label: 'Cost', align: 'right', format: fmt },
          { key: 'expiry_status', label: 'Status' },
        ]);
        exportToPDF(title, bwSummary + bwTable, meta);
        break;
      }
      case 'patient_history': {
        const phSummary = buildSummaryCards([
          { label: 'Total Patients', value: reportData.summary?.total_patients },
          { label: 'Total Revenue', value: fmt(reportData.summary?.total_revenue) },
          { label: 'Outstanding', value: fmt(reportData.summary?.total_outstanding) },
        ]);
        const phTable = buildHTMLTable(reportData.patients, [
          { key: 'patient_code', label: 'Code' },
          { key: 'patient_name', label: 'Name' },
          { key: 'total_transactions', label: 'Txns', align: 'right' },
          { key: 'total_spent', label: 'Spent', align: 'right', format: fmt },
          { key: 'outstanding_credit', label: 'Credit', align: 'right', format: fmt },
        ]);
        exportToPDF(title, phSummary + phTable, meta);
        break;
      }
      case 'commission_earned': {
        const ceSummary = buildSummaryCards([
          { label: 'Total Commissions', value: reportData.summary?.total_commissions },
          { label: 'Total Earned', value: fmt(reportData.summary?.total_earned) },
          { label: 'Paid', value: fmt(reportData.summary?.total_paid) },
          { label: 'Pending', value: fmt(reportData.summary?.total_pending) },
        ]);
        const ceTable = buildHTMLTable(reportData.commissions, [
          { key: 'agent_name', label: 'Agent' },
          { key: 'deal_description', label: 'Deal' },
          { key: 'deal_amount', label: 'Deal Amt', align: 'right', format: fmt },
          { key: 'commission_amount', label: 'Commission', align: 'right', format: fmt },
          { key: 'status', label: 'Status' },
        ]);
        exportToPDF(title, ceSummary + ceTable, meta);
        break;
      }
      case 'customer_ledger': {
        const entityLabel = getDynamicLabel(entityType);
        const ledgerSummary = buildSummaryCards([
          { label: entityLabel, value: reportData.entity.name },
          { label: 'Total Naam (Loan)', value: fmt(reportData.totals.total_debit) },
          { label: 'Total Jama (Advance)', value: fmt(reportData.totals.total_credit) },
          { label: 'Closing Balance', value: fmt(Math.abs(reportData.totals.closing_balance)) },
        ]);
        const ledgerTable = buildHTMLTable(reportData.ledger_entries, [
          { key: 'entry_date', label: 'Date', format: (d) => new Date(d).toLocaleDateString() },
          { key: 'description', label: 'Description' },
          { key: 'transaction_number', label: 'Ref #' },
          { key: 'debit', label: 'Naam', align: 'right', format: fmt },
          { key: 'credit', label: 'Jama', align: 'right', format: fmt },
          { key: 'running_balance', label: 'Balance', align: 'right', format: fmt },
        ]);
        exportToPDF(`${entityLabel} Ledger - ${reportData.entity.name}`, ledgerSummary + ledgerTable, meta);
        break;
      }
      case 'credit_aging': {
        const caSummary = buildSummaryCards([
          { label: 'Entities', value: reportData.summary?.total_entities },
          { label: '0-30 Days', value: fmt(reportData.summary?.bucket_0_30) },
          { label: '31-60 Days', value: fmt(reportData.summary?.bucket_31_60) },
          { label: '90+ Days', value: fmt(reportData.summary?.bucket_90_plus) },
        ]);
        const caTable = buildHTMLTable(reportData.aging_data, [
          { key: 'entity_type', label: 'Type' },
          { key: 'entity_name', label: 'Name' },
          { key: 'bucket_0_30', label: '0-30d', align: 'right', format: fmt },
          { key: 'bucket_31_60', label: '31-60d', align: 'right', format: fmt },
          { key: 'bucket_61_90', label: '61-90d', align: 'right', format: fmt },
          { key: 'bucket_90_plus', label: '90+d', align: 'right', format: fmt },
          { key: 'total_outstanding', label: 'Total', align: 'right', format: fmt },
        ]);
        exportToPDF(title, caSummary + caTable, meta);
        break;
      }
      case 'controlled_substance': {
        const csSummary = buildSummaryCards([
          { label: 'Total Entries', value: reportData.summary?.total_entries },
          { label: 'Total In', value: reportData.summary?.total_in },
          { label: 'Total Out', value: reportData.summary?.total_out },
          { label: 'Net Stock', value: reportData.summary?.net_stock },
        ]);
        const csTable = buildHTMLTable(reportData.entries, [
          { key: 'product_name', label: 'Medicine' },
          { key: 'batch_number', label: 'Batch' },
          { key: 'transaction_type', label: 'Type' },
          { key: 'quantity', label: 'Qty', align: 'right' },
          { key: 'patient_name', label: 'Patient' },
          { key: 'performed_by_name', label: 'Staff' },
          { key: 'created_at', label: 'Date' },
        ]);
        exportToPDF(title, csSummary + csTable, meta);
        break;
      }
      default:
        // Generic: just print current view
        printReport();
        break;
    }
  };

  // ---- Excel Export ----
  const handleExportExcel = async () => {
    if (!reportData) return;
    const reportName = currentReportType?.name?.replace(/\s+/g, '_') || 'report';
    const dateStr = new Date().toISOString().split('T')[0];
    const meta = { start_date: startDate, end_date: endDate, generated_at: reportData.generated_at };
    const opts = { title: currentReportType?.name || 'Report', sheetName: reportName.substring(0, 31), meta };

    switch (activeReport) {
      case 'daily_sales':
        await exportToExcel(reportData.daily_breakdown, `${reportName}_${dateStr}`, [
          { key: 'date', label: 'Date' },
          { key: 'transaction_count', label: 'Transactions' },
          { key: 'cash_received', label: 'Cash Received' },
          { key: 'credit_given', label: 'Credit Given' },
          { key: 'total_amount', label: 'Total Amount' },
        ], opts);
        break;
      case 'outstanding_balance': {
        const mappedData = [...reportData.farmers.list, ...reportData.dealers.list, ...reportData.companies.list]
          .map(item => ({
            ...item,
            display_type: getDynamicLabel(item.entity_type)
          }));
        await exportToExcel(mappedData, `${reportName}_${dateStr}`, [
          { key: 'display_type', label: 'Type' },
          { key: 'specific_id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'balance', label: 'Advance (Jama)' },
          { key: 'credit', label: 'Loan (Naam)' },
          { key: 'net_position', label: 'Net Position' },
        ], opts);
        break;
      }
      case 'stock': {
        const allStock = [...reportData.products.list, ...reportData.grains.list];
        await exportToExcel(allStock, `${reportName}_${dateStr}`, [
          { key: 'item_type', label: 'Type' },
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'category', label: 'Category' },
          { key: 'unit', label: 'Unit' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'avg_price', label: 'Avg Price' },
          { key: 'total_value', label: 'Total Value' },
        ], opts);
        break;
      }
      case 'cash_flow':
        await exportToExcel(reportData.daily_summary, `${reportName}_${dateStr}`, [
          { key: 'date', label: 'Date' },
          { key: 'cash_in', label: 'Cash In' },
          { key: 'cash_out', label: 'Cash Out' },
          { key: 'net_cash', label: 'Net Cash' },
        ], opts);
        break;
      case 'customer_ledger':
        const entityLabel = getDynamicLabel(entityType);
        await exportToExcel(reportData.ledger_entries, `${reportName}_${dateStr}`, [
          { key: 'entry_date', label: 'Date' },
          { key: 'transaction_type', label: 'Type' },
          { key: 'description', label: 'Description' },
          { key: 'debit', label: 'Naam (Loan)' },
          { key: 'credit', label: 'Jama (Advance)' },
          { key: 'running_balance', label: 'Balance' },
        ], { ...opts, title: `${entityLabel} Ledger - ${reportData.entity.name}` });
        break;
      case 'profit_loss': {
        const plRows = [
          ...reportData.revenue.breakdown.map((r) => ({ category: 'Revenue', type: r.transaction_type, count: r.count, amount: r.total })),
          ...reportData.cost_of_goods_sold.breakdown.map((c) => ({ category: 'COGS', type: c.transaction_type, count: c.count, amount: c.total })),
          { category: 'Summary', type: 'Gross Profit', count: '', amount: reportData.gross_profit },
        ];
        await exportToExcel(plRows, `${reportName}_${dateStr}`, [
          { key: 'category', label: 'Category' },
          { key: 'type', label: 'Type' },
          { key: 'count', label: 'Count' },
          { key: 'amount', label: 'Amount' },
        ], opts);
        break;
      }
      case 'expiry':
        await exportToExcel(reportData.batches, `${reportName}_${dateStr}`, [
          { key: 'product_name', label: 'Medicine' },
          { key: 'product_code', label: 'Code' },
          { key: 'batch_number', label: 'Batch #' },
          { key: 'expiry_date', label: 'Expiry Date' },
          { key: 'remaining_quantity', label: 'Qty' },
          { key: 'unit_cost', label: 'Unit Cost' },
        ], opts);
        break;
      case 'property_portfolio':
        await exportToExcel(reportData.properties, `${reportName}_${dateStr}`, [
          { key: 'title', label: 'Property' },
          { key: 'property_type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'city', label: 'City' },
          { key: 'area_value', label: 'Area' },
          { key: 'asking_price', label: 'Asking Price' },
        ], opts);
        break;
      case 'stock_movement':
        await exportToExcel(reportData.movements, `${reportName}_${dateStr}`, [
          { key: 'movement_date', label: 'Date' },
          { key: 'item_name', label: 'Item' },
          { key: 'item_code', label: 'Code' },
          { key: 'movement_type', label: 'Type' },
          { key: 'quantity', label: 'Qty' },
          { key: 'reference', label: 'Reference' },
          { key: 'performed_by_name', label: 'By' },
        ], opts);
        break;
      case 'top_selling':
        await exportToExcel(reportData.products, `${reportName}_${dateStr}`, [
          { key: 'item_name', label: 'Product' },
          { key: 'item_code', label: 'Code' },
          { key: 'total_quantity_sold', label: 'Qty Sold' },
          { key: 'total_revenue', label: 'Revenue' },
          { key: 'transaction_count', label: 'Transactions' },
        ], opts);
        break;
      case 'dead_stock':
        await exportToExcel(reportData.items, `${reportName}_${dateStr}`, [
          { key: 'product_code', label: 'Code' },
          { key: 'product_name', label: 'Product' },
          { key: 'category', label: 'Category' },
          { key: 'current_qty', label: 'Qty' },
          { key: 'stock_value', label: 'Value' },
          { key: 'days_idle', label: 'Days Idle' },
          { key: 'last_movement_date', label: 'Last Movement' },
        ], opts);
        break;
      case 'batch_wise_stock':
        await exportToExcel(reportData.batches, `${reportName}_${dateStr}`, [
          { key: 'product_name', label: 'Medicine' },
          { key: 'product_code', label: 'Code' },
          { key: 'batch_number', label: 'Batch #' },
          { key: 'expiry_date', label: 'Expiry' },
          { key: 'remaining_quantity', label: 'Qty' },
          { key: 'unit_cost', label: 'Cost' },
          { key: 'batch_value', label: 'Value' },
          { key: 'expiry_status', label: 'Status' },
        ], opts);
        break;
      case 'patient_history':
        await exportToExcel(reportData.patients, `${reportName}_${dateStr}`, [
          { key: 'patient_code', label: 'Code' },
          { key: 'patient_name', label: 'Patient' },
          { key: 'phone', label: 'Phone' },
          { key: 'total_transactions', label: 'Transactions' },
          { key: 'total_spent', label: 'Total Spent' },
          { key: 'outstanding_credit', label: 'Outstanding' },
          { key: 'last_purchase_date', label: 'Last Purchase' },
        ], opts);
        break;
      case 'commission_earned':
        await exportToExcel(reportData.commissions, `${reportName}_${dateStr}`, [
          { key: 'agent_name', label: 'Agent' },
          { key: 'client_name', label: 'Client' },
          { key: 'deal_description', label: 'Deal' },
          { key: 'deal_amount', label: 'Deal Amount' },
          { key: 'commission_rate', label: 'Rate %' },
          { key: 'commission_amount', label: 'Commission' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Date' },
        ], opts);
        break;
      case 'credit_aging':
        await exportToExcel(reportData.aging_data, `${reportName}_${dateStr}`, [
          { key: 'entity_type', label: 'Type' },
          { key: 'entity_name', label: 'Name' },
          { key: 'bucket_0_30', label: '0-30 Days' },
          { key: 'bucket_31_60', label: '31-60 Days' },
          { key: 'bucket_61_90', label: '61-90 Days' },
          { key: 'bucket_90_plus', label: '90+ Days' },
          { key: 'total_outstanding', label: 'Total' },
        ], opts);
        break;
      case 'controlled_substance':
        await exportToExcel(reportData.entries, `${reportName}_${dateStr}`, [
          { key: 'product_name', label: 'Medicine' },
          { key: 'product_code', label: 'Code' },
          { key: 'batch_number', label: 'Batch' },
          { key: 'transaction_type', label: 'Type' },
          { key: 'quantity', label: 'Qty' },
          { key: 'patient_name', label: 'Patient' },
          { key: 'performed_by_name', label: 'Staff' },
          { key: 'created_at', label: 'Date' },
        ], opts);
        break;
      default:
        break;
    }
  };

  const renderReportContent = () => {
    if (!reportData) return null;

    switch (activeReport) {
      case 'daily_sales':
        return (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total Transactions</div>
                <div className="text-2xl font-bold text-blue-800">{reportData.totals.total_transactions}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Cash</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.totals.total_cash)}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Total Credit</div>
                <div className="text-2xl font-bold text-yellow-800">{formatCurrency(reportData.totals.total_credit)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Grand Total</div>
                <div className="text-2xl font-bold text-purple-800">{formatCurrency(reportData.totals.grand_total)}</div>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-800">Daily Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cash</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.daily_breakdown.map((day, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{day.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{day.transaction_count}</td>
                        <td className="px-4 py-3 text-sm text-green-600 text-right">{formatCurrency(day.cash_received)}</td>
                        <td className="px-4 py-3 text-sm text-yellow-600 text-right">{formatCurrency(day.credit_given)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(day.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'outstanding_balance':
        return (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Receivables (Loan)</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.summary.total_receivables)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Total Payables (Advance)</div>
                <div className="text-2xl font-bold text-red-800">{formatCurrency(reportData.summary.total_payables)}</div>
              </div>
              <div className={`${reportData.summary.net_position >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-lg p-4`}>
                <div className={`text-sm font-medium ${reportData.summary.net_position >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net Position</div>
                <div className={`text-2xl font-bold ${reportData.summary.net_position >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                  {formatCurrency(reportData.summary.net_position)}
                </div>
              </div>
            </div>

            {/* Customers/Farmers */}
            {reportData.farmers.list.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-4 py-3 bg-green-50 border-b flex items-center gap-2">
                  <UserGroupIcon className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-gray-800">{t.customers || 'Farmers'} ({reportData.farmers.count})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Advance (We Owe)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loan (They Owe)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.farmers.list.map((farmer) => (
                        <tr key={farmer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{farmer.specific_id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{farmer.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{farmer.phone}</td>
                          <td className="px-4 py-3 text-sm text-red-600 text-right">{formatCurrency(farmer.balance)}</td>
                          <td className="px-4 py-3 text-sm text-green-600 text-right">{formatCurrency(farmer.credit)}</td>
                          <td className={`px-4 py-3 text-sm font-medium text-right ${farmer.net_position >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(farmer.net_position)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dealers/Distributors */}
            {reportData.dealers.list.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 mt-6">
                <div className="px-4 py-3 bg-blue-50 border-b flex items-center gap-2">
                  <UserGroupIcon className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-800">{t.dealers || 'Dealers'} ({reportData.dealers.count})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Advance</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loan</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.dealers.list.map((dealer) => (
                        <tr key={dealer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{dealer.specific_id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{dealer.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{dealer.phone}</td>
                          <td className="px-4 py-3 text-sm text-red-600 text-right">{formatCurrency(dealer.balance)}</td>
                          <td className="px-4 py-3 text-sm text-green-600 text-right">{formatCurrency(dealer.credit)}</td>
                          <td className={`px-4 py-3 text-sm font-medium text-right ${dealer.net_position >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(dealer.net_position)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Companies/Suppliers */}
            {reportData.companies.list.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 mt-6">
                <div className="px-4 py-3 bg-purple-50 border-b flex items-center gap-2">
                  <BuildingStorefrontIcon className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-800">{t.suppliers || 'Suppliers'} ({reportData.companies.count})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Advance</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loan</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.companies.list.map((company) => (
                        <tr key={company.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{company.specific_id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{company.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{company.phone}</td>
                          <td className="px-4 py-3 text-sm text-red-600 text-right">{formatCurrency(company.balance)}</td>
                          <td className="px-4 py-3 text-sm text-green-600 text-right">{formatCurrency(company.credit)}</td>
                          <td className={`px-4 py-3 text-sm font-medium text-right ${company.net_position >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(company.net_position)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case 'stock':
        return (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total {t.items || 'Products'}</div>
                <div className="text-2xl font-bold text-blue-800">{reportData.summary.total_products}</div>
              </div>
              {industryConfig?.features?.hasSecondaryItem && (
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-green-600 font-medium">Total {t.secondaryItems || 'Grains'}</div>
                  <div className="text-2xl font-bold text-green-800">{reportData.summary.total_grains}</div>
                </div>
              )}
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Low Stock Items</div>
                <div className="text-2xl font-bold text-yellow-800">{reportData.low_stock.count}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Total Inventory Value</div>
                <div className="text-2xl font-bold text-purple-800">{formatCurrency(reportData.summary.total_inventory_value)}</div>
              </div>
            </div>

            {/* Primary Items */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 bg-blue-50 border-b">
                <h3 className="font-semibold text-gray-800">{t.items || 'Products'} ({reportData.products.count})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.products.list.map((product) => (
                      <tr key={product.id} className={`hover:bg-gray-50 ${parseFloat(product.quantity) < 10 ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{product.category}</td>
                        <td className="px-4 py-3 text-sm text-right">{product.quantity} {product.unit}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(product.avg_price)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-right">{formatCurrency(product.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan="5" className="px-4 py-3 text-sm font-semibold text-right">Total {t.items || 'Products'} Value:</td>
                      <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(reportData.products.total_value)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Secondary Items (Grains) */}
            {industryConfig?.features?.hasSecondaryItem && reportData.grains.list.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 mt-6">
                <div className="px-4 py-3 bg-green-50 border-b">
                  <h3 className="font-semibold text-gray-800">{t.secondaryItems || 'Grains'} ({reportData.grains.count})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.grains.list.map((grain) => (
                        <tr key={grain.id} className={`hover:bg-gray-50 ${parseFloat(grain.quantity) < 10 ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 text-sm text-gray-900">{grain.code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{grain.name}</td>
                          <td className="px-4 py-3 text-sm text-right">{grain.quantity} {grain.unit}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(grain.avg_price)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-right">{formatCurrency(grain.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td colSpan="4" className="px-4 py-3 text-sm font-semibold text-right">Total {t.secondaryItems || 'Grains'} Value:</td>
                        <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(reportData.grains.total_value)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case 'cash_flow':
        return (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Inflow</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.summary.total_inflow)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Total Outflow</div>
                <div className="text-2xl font-bold text-red-800">{formatCurrency(reportData.summary.total_outflow)}</div>
              </div>
              <div className={`${reportData.summary.net_cash_flow >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-lg p-4`}>
                <div className={`text-sm font-medium ${reportData.summary.net_cash_flow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net Cash Flow</div>
                <div className={`text-2xl font-bold ${reportData.summary.net_cash_flow >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                  {formatCurrency(reportData.summary.net_cash_flow)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Transaction Count</div>
                <div className="text-2xl font-bold text-purple-800">{reportData.summary.transaction_count}</div>
              </div>
            </div>

            {/* Inflows Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b">
                <h3 className="font-semibold text-gray-800">Cash Inflows (Payments Received)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction #</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.inflows && reportData.inflows.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.transaction_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.entity_name || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-blue-600">{item.transaction_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-sm font-semibold text-right">Total Inflows:</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">{formatCurrency(reportData.summary.total_inflow)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Outflows Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b">
                <h3 className="font-semibold text-gray-800">Cash Outflows (Payments Made)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction #</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.outflows && reportData.outflows.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.transaction_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.entity_name || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-blue-600">{item.transaction_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600 text-right">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-sm font-semibold text-right">Total Outflows:</td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">{formatCurrency(reportData.summary.total_outflow)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );

      case 'customer_ledger':
        const entityLabel = entityType === 'farmer' ? (t.customer || 'Customer') : (entityType === 'dealer' ? (t.dealer || 'Dealer') : (t.supplier || 'Supplier'));
        const currentBalance = reportData.totals.closing_balance || 0;
        return (
          <div className="space-y-6">
            {/* Entity Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">{entityLabel}</div>
                  <div className="font-semibold">{reportData.entity.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">ID</div>
                  <div className="font-semibold">{reportData.entity.specific_id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Account State</div>
                  <div className={`font-bold ${currentBalance > 0 ? 'text-green-600' : (currentBalance < 0 ? 'text-red-600' : 'text-gray-600')}`}>
                    {currentBalance > 0 ? 'Advance' : (currentBalance < 0 ? 'Loan / Debt' : 'Settled')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Final Position</div>
                  <div className={`font-black ${currentBalance > 0 ? 'text-green-600' : (currentBalance < 0 ? 'text-red-600' : 'text-gray-600')}`}>
                    {formatCurrency(Math.abs(currentBalance))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ledger Entries */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-800">Ledger Entries</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref #</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-red-500 uppercase">Naam (Loan)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-green-500 uppercase">Jama (Advance)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.ledger_entries.map((entry, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(entry.entry_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{entry.description}</td>
                        <td className="px-4 py-3 text-sm text-blue-600 font-mono">{entry.transaction_number}</td>
                        <td className="px-4 py-3 text-sm text-red-600 text-right">{parseFloat(entry.debit || 0) > 0 ? formatCurrency(entry.debit) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-green-600 text-right">{parseFloat(entry.credit || 0) > 0 ? formatCurrency(entry.credit) : '-'}</td>
                        <td className={`px-4 py-3 text-sm font-bold text-right ${entry.running_balance > 0 ? 'text-green-600' : (entry.running_balance < 0 ? 'text-red-600' : 'text-gray-600')}`}>
                          {formatCurrency(Math.abs(entry.running_balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-sm font-semibold text-right">Closing Totals:</td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">{formatCurrency(reportData.totals.total_debit)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">{formatCurrency(reportData.totals.total_credit)}</td>
                      <td className={`px-4 py-3 text-sm font-black text-right ${currentBalance > 0 ? 'text-green-600' : (currentBalance < 0 ? 'text-red-600' : 'text-gray-800')}`}>
                        {formatCurrency(Math.abs(currentBalance))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );

      case 'profit_loss':
        return (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Revenue</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.revenue?.total)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Cost of Goods Sold</div>
                <div className="text-2xl font-bold text-red-800">{formatCurrency(reportData.cost_of_goods_sold?.total)}</div>
              </div>
              <div className={`${reportData.gross_profit >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-lg p-4`}>
                <div className={`text-sm font-medium ${reportData.gross_profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Gross Profit</div>
                <div className={`text-2xl font-bold ${reportData.gross_profit >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                  {formatCurrency(reportData.gross_profit)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Gross Margin</div>
                <div className="text-2xl font-bold text-purple-800">{reportData.gross_margin_pct}%</div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            {reportData.revenue?.breakdown?.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-green-50 border-b"><h3 className="font-semibold text-gray-800">Revenue Breakdown</h3></div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.revenue.breakdown.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{r.transaction_type}</td>
                        <td className="px-4 py-3 text-sm text-right">{r.count}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-700">{formatCurrency(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* COGS Breakdown */}
            {reportData.cost_of_goods_sold?.breakdown?.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b"><h3 className="font-semibold text-gray-800">Cost of Goods Sold</h3></div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.cost_of_goods_sold.breakdown.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{c.transaction_type}</td>
                        <td className="px-4 py-3 text-sm text-right">{c.count}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-700">{formatCurrency(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cash Position */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Payments Received</div>
                <div className="text-xl font-bold text-green-700">{formatCurrency(reportData.payments_received)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Payments Made</div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(reportData.payments_made)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Net Cash Position</div>
                <div className={`text-xl font-bold ${reportData.net_cash_position >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(reportData.net_cash_position)}
                </div>
              </div>
            </div>
          </div>
        );

      case 'expiry':
        return (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Expired</div>
                <div className="text-2xl font-bold text-red-800">{reportData.expired?.count || 0}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-orange-600 font-medium">Critical (≤30 days)</div>
                <div className="text-2xl font-bold text-orange-800">{reportData.critical?.count || 0}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Warning (31-60 days)</div>
                <div className="text-2xl font-bold text-yellow-800">{reportData.warning?.count || 0}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Value at Risk</div>
                <div className="text-2xl font-bold text-purple-800">{formatCurrency(reportData.total_value_at_risk)}</div>
              </div>
            </div>

            {/* Batches Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-gray-800">Expiring Batches ({reportData.batches?.length || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.batches || []).map((batch, index) => {
                      const isExpired = new Date(batch.expiry_date) < new Date();
                      const daysLeft = Math.ceil((new Date(batch.expiry_date) - new Date()) / 86400000);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{batch.product_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{batch.product_code}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{batch.batch_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{batch.expiry_date}</td>
                          <td className="px-4 py-3 text-sm text-right">{batch.remaining_quantity}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(batch.unit_cost)}</td>
                          <td className="px-4 py-3 text-sm">
                            {isExpired ? (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">EXPIRED</span>
                            ) : daysLeft <= 30 ? (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Critical ({daysLeft}d)</span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Warning ({daysLeft}d)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(!reportData.batches || reportData.batches.length === 0) && (
                <div className="text-center py-8 text-gray-500">No expiring batches found within the threshold</div>
              )}
            </div>
          </div>
        );

      case 'property_portfolio':
        return (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total Listings</div>
                <div className="text-2xl font-bold text-blue-800">{reportData.total_listings || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Portfolio Value</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.total_portfolio_value)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">By Status</div>
                <div className="text-sm mt-1 space-y-1">
                  {Object.entries(reportData.by_status || {}).map(([status, count]) => (
                    <div key={status} className="flex justify-between">
                      <span className="text-gray-600">{status}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* By Type Breakdown */}
            {Object.keys(reportData.by_type || {}).length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">By Property Type</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(reportData.by_type).map(([type, count]) => (
                    <div key={type} className="px-4 py-2 bg-teal-50 rounded-lg">
                      <span className="text-teal-700 font-medium">{type}</span>
                      <span className="ml-2 text-teal-900 font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Properties Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-teal-50 border-b flex items-center gap-2">
                <HomeModernIcon className="h-5 w-5 text-teal-600" />
                <h3 className="font-semibold text-gray-800">All Listings ({reportData.total_listings || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.properties || []).map((prop, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{prop.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{prop.property_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{prop.city}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{prop.area_value} {prop.area_unit}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            prop.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                            prop.status === 'SOLD' ? 'bg-blue-100 text-blue-700' :
                            prop.status === 'RENTED' ? 'bg-purple-100 text-purple-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{prop.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-right">{formatCurrency(prop.asking_price || prop.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.properties || reportData.properties.length === 0) && (
                <div className="text-center py-8 text-gray-500">No property listings found</div>
              )}
            </div>
          </div>
        );

      case 'stock_movement':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total Movements</div>
                <div className="text-2xl font-bold text-blue-800">{reportData.summary?.total_movements || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total In</div>
                <div className="text-2xl font-bold text-green-800">{reportData.summary?.total_in || 0}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Total Out</div>
                <div className="text-2xl font-bold text-red-800">{reportData.summary?.total_out || 0}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Net Change</div>
                <div className="text-2xl font-bold text-purple-800">{reportData.summary?.net_change || 0}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-cyan-50 border-b">
                <h3 className="font-semibold text-gray-800">Movement Log ({reportData.movements?.length || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.movements || []).map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(m.movement_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.item_name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            m.movement_type === 'IN' || m.movement_type === 'PURCHASE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{m.movement_type}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{m.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.reference || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.performed_by_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.movements || reportData.movements.length === 0) && (
                <div className="text-center py-8 text-gray-500">No stock movements found in this period</div>
              )}
            </div>
          </div>
        );

      case 'top_selling':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="text-sm text-amber-600 font-medium">Products</div>
                <div className="text-2xl font-bold text-amber-800">{reportData.summary?.total_products || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Revenue</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.summary?.grand_total_revenue)}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b">
                <h3 className="font-semibold text-gray-800">Top-Selling Products</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Sold</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Txns</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.products || []).map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.item_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.item_code}</td>
                        <td className="px-4 py-3 text-sm text-right">{p.total_quantity_sold}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-700 text-right">{formatCurrency(p.total_revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right">{p.transaction_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'dead_stock':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="text-sm text-gray-600 font-medium">Dead Stock Items</div>
                <div className="text-2xl font-bold text-gray-800">{reportData.summary?.total_dead_items || 0}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Dead Stock Value</div>
                <div className="text-2xl font-bold text-red-800">{formatCurrency(reportData.summary?.total_dead_value)}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-100 border-b">
                <h3 className="font-semibold text-gray-800">Items with No Movement ({reportData.summary?.total_dead_items || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days Idle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Movement</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.items || []).map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{item.product_code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.product_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.category || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.current_qty}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(item.stock_value)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-orange-600">{item.days_idle}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.last_movement_date ? new Date(item.last_movement_date).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.items || reportData.items.length === 0) && (
                <div className="text-center py-8 text-gray-500">No dead stock found with the given threshold</div>
              )}
            </div>
          </div>
        );

      case 'batch_wise_stock':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-pink-50 rounded-lg p-4">
                <div className="text-sm text-pink-600 font-medium">Total Batches</div>
                <div className="text-2xl font-bold text-pink-800">{reportData.summary?.total_batches || 0}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total Quantity</div>
                <div className="text-2xl font-bold text-blue-800">{reportData.summary?.total_quantity || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Value</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.summary?.total_value)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Expired Batches</div>
                <div className="text-2xl font-bold text-red-800">{reportData.summary?.expired_batches || 0}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-pink-50 border-b">
                <h3 className="font-semibold text-gray-800">All Batches ({reportData.batches?.length || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.batches || []).map((b, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.product_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{b.batch_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{b.expiry_date || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-right">{b.remaining_quantity}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(b.unit_cost)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(b.batch_value)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            b.expiry_status === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                            b.expiry_status === 'CRITICAL' ? 'bg-orange-100 text-orange-700' :
                            b.expiry_status === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>{b.expiry_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.batches || reportData.batches.length === 0) && (
                <div className="text-center py-8 text-gray-500">No medicine batches found</div>
              )}
            </div>
          </div>
        );

      case 'patient_history':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-violet-50 rounded-lg p-4">
                <div className="text-sm text-violet-600 font-medium">Total Patients</div>
                <div className="text-2xl font-bold text-violet-800">{reportData.summary?.total_patients || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Revenue</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.summary?.total_revenue)}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Outstanding Credit</div>
                <div className="text-2xl font-bold text-yellow-800">{formatCurrency(reportData.summary?.total_outstanding)}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-violet-50 border-b">
                <h3 className="font-semibold text-gray-800">Patient List ({reportData.patients?.length || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prescriptions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Purchase</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.patients || []).map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{p.patient_code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.patient_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.phone || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right">{p.total_transactions || 0}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(p.total_spent)}</td>
                        <td className="px-4 py-3 text-sm text-right text-yellow-700">{formatCurrency(p.outstanding_credit)}</td>
                        <td className="px-4 py-3 text-sm text-right">{p.total_prescriptions || 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.last_purchase_date ? new Date(p.last_purchase_date).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.patients || reportData.patients.length === 0) && (
                <div className="text-center py-8 text-gray-500">No patient records found</div>
              )}
            </div>
          </div>
        );

      case 'commission_earned':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-lime-50 rounded-lg p-4">
                <div className="text-sm text-lime-600 font-medium">Total Commissions</div>
                <div className="text-2xl font-bold text-lime-800">{reportData.summary?.total_commissions || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total Earned</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.summary?.total_earned)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Paid</div>
                <div className="text-2xl font-bold text-blue-800">{formatCurrency(reportData.summary?.total_paid)}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Pending</div>
                <div className="text-2xl font-bold text-yellow-800">{formatCurrency(reportData.summary?.total_pending)}</div>
              </div>
            </div>
            {/* By Agent Breakdown */}
            {Object.keys(reportData.by_agent || {}).length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">By Agent</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(reportData.by_agent).map(([agent, data]) => (
                    <div key={agent} className="p-3 bg-lime-50 rounded-lg">
                      <div className="font-medium text-gray-900">{agent}</div>
                      <div className="text-sm text-gray-600">{data.count} deals · {formatCurrency(data.earned)} earned</div>
                      <div className="text-xs mt-1">
                        <span className="text-blue-600">Paid: {formatCurrency(data.paid)}</span>
                        <span className="ml-2 text-yellow-600">Pending: {formatCurrency(data.pending)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-lime-50 border-b">
                <h3 className="font-semibold text-gray-800">Commission Records ({reportData.commissions?.length || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deal Amt</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.commissions || []).map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.agent_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{c.deal_description || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(c.deal_amount)}</td>
                        <td className="px-4 py-3 text-sm text-right">{c.commission_rate}%</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-700">{formatCurrency(c.commission_amount)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            c.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.commissions || reportData.commissions.length === 0) && (
                <div className="text-center py-8 text-gray-500">No commission records found</div>
              )}
            </div>
          </div>
        );

      case 'credit_aging':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">0-30 Days</div>
                <div className="text-2xl font-bold text-green-800">{formatCurrency(reportData.summary?.bucket_0_30)}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">31-60 Days</div>
                <div className="text-2xl font-bold text-yellow-800">{formatCurrency(reportData.summary?.bucket_31_60)}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-orange-600 font-medium">61-90 Days</div>
                <div className="text-2xl font-bold text-orange-800">{formatCurrency(reportData.summary?.bucket_61_90)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">90+ Days</div>
                <div className="text-2xl font-bold text-red-800">{formatCurrency(reportData.summary?.bucket_90_plus)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Total Outstanding</div>
                <div className="text-2xl font-bold text-purple-800">{formatCurrency(reportData.summary?.total)}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-rose-50 border-b">
                <h3 className="font-semibold text-gray-800">Aging Details ({reportData.aging_data?.length || 0} entities)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">0-30d</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">31-60d</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">61-90d</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">90+d</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.aging_data || []).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">{row.entity_type}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.entity_name}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(row.bucket_0_30)}</td>
                        <td className="px-4 py-3 text-sm text-right text-yellow-700">{formatCurrency(row.bucket_31_60)}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-700">{formatCurrency(row.bucket_61_90)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-700">{formatCurrency(row.bucket_90_plus)}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(row.total_outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.aging_data || reportData.aging_data.length === 0) && (
                <div className="text-center py-8 text-gray-500">No outstanding credit balances found</div>
              )}
            </div>
          </div>
        );

      case 'controlled_substance':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Total Entries</div>
                <div className="text-2xl font-bold text-red-800">{reportData.summary?.total_entries || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Total In</div>
                <div className="text-2xl font-bold text-green-800">{reportData.summary?.total_in || 0}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-orange-600 font-medium">Total Out</div>
                <div className="text-2xl font-bold text-orange-800">{reportData.summary?.total_out || 0}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Net Stock</div>
                <div className="text-2xl font-bold text-blue-800">{reportData.summary?.net_stock || 0}</div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-gray-800">Controlled Substance Register ({reportData.entries?.length || 0})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData.entries || []).map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(e.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{e.product_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{e.batch_number || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            e.transaction_type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{e.transaction_type}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{e.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{e.patient_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{e.performed_by_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{e.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!reportData.entries || reportData.entries.length === 0) && (
                <div className="text-center py-8 text-gray-500">No controlled substance records found</div>
              )}
            </div>
          </div>
        );

      default:
        return <div className="text-center text-gray-500 py-8">Select a report type to view</div>;
    }
  };

  const currentReportType = reportTypes.find(r => r.id === activeReport);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DocumentChartBarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
                  <p className="text-sm text-gray-500">Generate business reports</p>
                </div>
              </div>
            </div>
            {reportData && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={printReport}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <PrinterIcon className="h-5 w-5" />
                  <span>Print</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Report Selection Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-800">Report Types</h2>
              </div>
              <div className="p-2">
                {reportTypes.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      setActiveReport(report.id);
                      setReportData(null);
                      setError('');
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      activeReport === report.id
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${report.color}`}>
                      <report.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{report.name}</div>
                      <div className="text-xs text-gray-500">{report.description}</div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="lg:col-span-3">
            {!activeReport ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <DocumentChartBarIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Report</h3>
                <p className="text-gray-500">Choose a report type from the sidebar to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex flex-wrap items-end gap-4">
                    {currentReportType?.needsDateRange && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </>
                    )}
                    
                    {currentReportType?.needsThreshold && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Days Threshold</label>
                        <select
                          value={expiryDays}
                          onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value={30}>30 days</option>
                          <option value={60}>60 days</option>
                          <option value={90}>90 days</option>
                          <option value={180}>180 days</option>
                          <option value={365}>1 year</option>
                        </select>
                      </div>
                    )}

                    {currentReportType?.needsEntity && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                          <select
                            value={entityType}
                            onChange={(e) => {
                              setEntityType(e.target.value);
                              setEntityId('');
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="farmer">Farmer</option>
                            <option value="dealer">Dealer</option>
                            <option value="company">Company</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer</label>
                          <select
                            value={entityId}
                            onChange={(e) => setEntityId(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-w-[200px]"
                          >
                            <option value="">-- Select --</option>
                            {entities.map((entity) => (
                              <option 
                                key={entity.farmer_id || entity.dealer_id || entity.company_id} 
                                value={entity.farmer_id || entity.dealer_id || entity.company_id}
                              >
                                {entity.specific_id} - {entity.name || entity.company_name || entity.dealer_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    
                    <button
                      onClick={generateReport}
                      disabled={loading}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <DocumentChartBarIcon className="h-5 w-5" />
                          <span>Generate Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                {/* Report Header */}
                {reportData && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{currentReportType?.name}</h2>
                        <p className="text-sm text-gray-500">
                          Generated on {new Date(reportData.generated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Report Content */}
                {reportData && (
                  <div className="print:shadow-none">
                    {renderReportContent()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
