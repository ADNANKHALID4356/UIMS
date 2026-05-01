import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeftIcon,
  CalendarIcon,
  UserIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  PrinterIcon,
  PencilSquareIcon,
  BuildingStorefrontIcon,
  IdentificationIcon,
  PhoneIcon,
  MapPinIcon,
  ScaleIcon,
  TagIcon,
  ReceiptPercentIcon,
  HomeIcon,
  UserCircleIcon,
  BanknotesIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

const TransactionDetailsPage = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { industryConfig } = useSelector((state) => state.organization);
  const terminology = industryConfig?.terminology || {};

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get dynamic entity label from table name
  const getEntityLabelFromTable = (tableName) => {
    const lowerTable = (tableName || '').toLowerCase();
    if (lowerTable.includes('farmer') || lowerTable.includes('customer')) return terminology.customer || 'Customer';
    if (lowerTable.includes('dealer') || lowerTable.includes('distributor')) return terminology.dealer || 'Dealer';
    if (lowerTable.includes('compan') || lowerTable.includes('supplier')) return terminology.supplier || 'Supplier';
    return tableName || 'Entity';
  };

  // Get navigation context (where user came from)
  const fromLedger = location.state?.from === 'ledger';
  const entityContext = location.state || {};

  useEffect(() => {
    console.log('[TransactionDetailsPage] Loading transaction ID:', transactionId);
    loadTransactionDetails();
  }, [transactionId]);

  const loadTransactionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[TransactionDetailsPage] ==================== LOADING TRANSACTION ====================');
      console.log('[TransactionDetailsPage] Transaction ID from URL:', transactionId);
      
      // Try to get transaction with items (Sprint 6 multi-item support)
      let transaction;
      try {
        transaction = await window.electronAPI.transaction.getByIdWithItems(parseInt(transactionId));
        console.log('[TransactionDetailsPage] ✅ Loaded transaction with items (Sprint 6)');
      } catch (err) {
        // Fallback to legacy method if Sprint 6 API not available
        console.log('[TransactionDetailsPage] Falling back to legacy getById');
        transaction = await window.electronAPI.transaction.getById(parseInt(transactionId));
      }
      
      console.log('[TransactionDetailsPage] Transaction:', transaction);
      console.log('[TransactionDetailsPage] Has items array:', Array.isArray(transaction?.items));
      console.log('[TransactionDetailsPage] Items count:', transaction?.items?.length || 'N/A');
      
      if (transaction) {
        setTransaction(transaction);
      } else {
        console.error('[TransactionDetailsPage] No transaction returned from database');
        setError('Transaction not found');
      }
    } catch (err) {
      console.error('[TransactionDetailsPage] Error loading transaction:', err);
      setError('Failed to load transaction details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle back to ledger navigation
  const handleBackToLedger = () => {
    if (fromLedger && entityContext.entityType && entityContext.entityId) {
      navigate(`/ledger/${entityContext.entityType}/${entityContext.entityId}`);
    } else {
      navigate(-1); // Fallback to browser back
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      console.log('[TransactionDetailsPage] formatDate called with empty value:', dateString);
      return 'N/A';
    }
    try {
      const formatted = new Date(dateString).toLocaleString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return formatted;
    } catch (error) {
      console.error('[TransactionDetailsPage] Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      'FARMER_PURCHASE': 'Farmer Purchase',
      'FARMER_SALE_GRAIN': 'Farmer Grain Sale',
      'DEALER_PURCHASE': 'Dealer Purchase',
      'DEALER_SALE': 'Dealer Sale',
      'COMPANY_PURCHASE': 'Company Purchase',
      'COMPANY_SALE': 'Company Sale',
    };
    return labels[type] || type;
  };

  const getPaymentTypeBadge = (type) => {
    const colors = {
      'CASH': 'bg-green-100 text-green-800 border-green-300',
      'CREDIT': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'PARTIAL': 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Get entity badges (category + status)
  const getEntityBadges = (transaction) => {
    const badges = [];
    
    // Category Badge (Dynamic)
    if (transaction.entity_table) {
      const categoryColors = {
        'Farmer': 'bg-green-100 text-green-800 border-green-300',
        'Dealer': 'bg-blue-100 text-blue-800 border-blue-300',
        'Company': 'bg-purple-100 text-purple-800 border-purple-300'
      };

      badges.push({
        label: getEntityLabelFromTable(transaction.entity_table),
        color: categoryColors[transaction.entity_table] || 'bg-gray-100 text-gray-800 border-gray-300',
        icon: transaction.entity_table === 'Farmer' ? UserIcon :
              transaction.entity_table === 'Company' ? BuildingStorefrontIcon :
              IdentificationIcon
      });
    }    
    // Status Badge (Permanent/Walk-in)
    const statusColors = {
      'regular': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'irregular': 'bg-orange-100 text-orange-800 border-orange-300'
    };
    
    const statusLabels = {
      'regular': 'Permanent',
      'irregular': 'Walk-in'
    };
    
    badges.push({
      label: statusLabels[transaction.entity_type] || transaction.entity_type,
      color: statusColors[transaction.entity_type] || 'bg-gray-100 text-gray-800 border-gray-300',
      icon: transaction.entity_type === 'regular' ? UserCircleIcon : UserIcon
    });
    
    return badges;
  };

  const handlePrintReceipt = () => {
    console.log('[TransactionDetailsPage] Printing receipt for:', transaction.transaction_number);
    
    // Create print window with professional receipt format
    const printWindow = window.open('', '_blank');
    const receiptHTML = generateReceiptHTML(transaction);
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
    };
  };

  const generateReceiptHTML = (txn) => {
    const itemsHTML = txn.items && txn.items.length > 0 ? `
      <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #333;">
            <th style="padding: 8px; text-align: left;">#</th>
            <th style="padding: 8px; text-align: left;">Item</th>
            <th style="padding: 8px; text-align: right;">Qty</th>
            <th style="padding: 8px; text-align: right;">Price</th>
            <th style="padding: 8px; text-align: right;">Total</th>
            <th style="padding: 8px; text-align: right;">Discount</th>
            <th style="padding: 8px; text-align: right;">Final</th>
          </tr>
        </thead>
        <tbody>
          ${txn.items.map((item, idx) => `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px;">${idx + 1}</td>
              <td style="padding: 8px;">${item.item_name}<br/><small style="color: #666;">${item.item_code || ''}</small></td>
              <td style="padding: 8px; text-align: right;">${Math.round(parseFloat(item.quantity))} ${item.unit}</td>
              <td style="padding: 8px; text-align: right;">Rs. ${parseFloat(item.unit_price).toFixed(2)}</td>
              <td style="padding: 8px; text-align: right;">Rs. ${parseFloat(item.line_total).toFixed(2)}</td>
              <td style="padding: 8px; text-align: right; color: #d32f2f;">${item.discount_amount > 0 ? '- Rs. ' + parseFloat(item.discount_amount).toFixed(2) : 'Rs. 0'}</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">Rs. ${parseFloat(item.line_final_total).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background: #f5f5f5;">
            <td colspan="5" style="padding: 8px; text-align: right; font-weight: bold;">Item Discounts:</td>
            <td style="padding: 8px; text-align: right; color: #d32f2f; font-weight: bold;">
              ${txn.items.reduce((sum, i) => sum + (i.discount_amount || 0), 0) > 0 
                ? '- Rs. ' + txn.items.reduce((sum, i) => sum + (i.discount_amount || 0), 0).toFixed(2)
                : 'Rs. 0'
              }
            </td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">Rs. ${txn.items.reduce((sum, i) => sum + i.line_final_total, 0).toFixed(2)}</td>
          </tr>
          ${(() => {
            const itemsSubtotal = txn.items.reduce((sum, item) => sum + (item.line_final_total || 0), 0);
            const calculatedOverallDiscount = itemsSubtotal - (txn.total_amount || 0);
            const overallDiscount = txn.overall_discount_amount || calculatedOverallDiscount;
            
            if (overallDiscount > 0.01) {
              return `
                <tr style="background: #fff3e0;">
                  <td colspan="6" style="padding: 8px; text-align: right; font-weight: bold; color: #f57c00;">
                    Overall Discount${txn.overall_discount_type === 'percentage' ? ` (${txn.overall_discount_value}%)` : ''}:
                  </td>
                  <td style="padding: 8px; text-align: right; font-weight: bold; color: #d32f2f;">- Rs. ${parseFloat(overallDiscount).toFixed(2)}</td>
                </tr>
              `;
            }
            return '';
          })()}
          <tr style="border-top: 2px solid #333; font-size: 1.1em;">
            <td colspan="6" style="padding: 12px; text-align: right; font-weight: bold;">Grand Total:</td>
            <td style="padding: 12px; text-align: right; font-weight: bold;">Rs. ${parseFloat(txn.total_amount).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    ` : `
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span><strong>Item:</strong></span>
          <span>${txn.item_name || 'N/A'} (${txn.item_type || 'N/A'})</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span><strong>Quantity:</strong></span>
          <span>${txn.quantity || 0} ${txn.unit || 'units'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span><strong>Unit Price:</strong></span>
          <span>Rs. ${parseFloat(txn.unit_price || 0).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #333; font-size: 1.2em;">
          <span><strong>Total Amount:</strong></span>
          <span><strong>Rs. ${parseFloat(txn.total_amount).toFixed(2)}</strong></span>
        </div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${txn.transaction_number}</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #333;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .shop-name {
            font-size: 28px;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 5px;
          }
          .shop-tagline {
            font-size: 14px;
            color: #666;
            font-style: italic;
          }
          .receipt-title {
            font-size: 22px;
            font-weight: bold;
            margin: 15px 0 10px 0;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .info-box {
            padding: 12px;
            background: #f9f9f9;
            border-left: 4px solid #1e3a8a;
            border-radius: 4px;
          }
          .info-label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .info-value {
            font-size: 14px;
            color: #333;
            font-weight: bold;
          }
          .payment-section {
            margin: 25px 0;
            padding: 15px;
            background: #f0f4f8;
            border-radius: 8px;
          }
          .payment-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 16px;
          }          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            font-size: 12px;
            color: #666;
          }
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin: 40px 0 20px 0;
          }
          .signature-box {
            text-align: center;
            padding-top: 50px;
            border-top: 2px solid #333;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${industryConfig?.businessName || 'Enterprise Inventory Shop'}</div>
          <div class="shop-tagline">${industryConfig?.displayName || 'v2.0'}</div>
          <div class="receipt-title">TRANSACTION RECEIPT</div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Receipt No.</div>
            <div class="info-value">${txn.transaction_number}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Date & Time</div>
            <div class="info-value">${formatDate(txn.transaction_date)}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Transaction Type</div>
            <div class="info-value">${getTransactionTypeLabel(txn.transaction_type)}</div>
          </div>
          <div class="info-box">
            <div class="info-label">Payment Method</div>
            <div class="info-value">${txn.payment_type}</div>
          </div>
        </div>

        <div style="margin: 20px 0; padding: 15px; background: #f0f4f8; border-radius: 8px; border-left: 4px solid #1e3a8a;">
          <div class="info-label">${getEntityLabelFromTable(txn.entity_table)} Details</div>
          <div style="margin-top: 8px;">
            <strong>Name:</strong> ${txn.entity_name || txn.temp_customer_name || 'N/A'}<br/>
            ${txn.entity_type === 'regular' ? `<strong>Type:</strong> ${getEntityLabelFromTable(txn.entity_table)} (Permanent)<br/>` : `<strong>Type:</strong> Walk-in ${getEntityLabelFromTable(txn.entity_table)}<br/>`}
            ${txn.temp_customer_phone || txn.farmer_phone || txn.dealer_phone || txn.company_phone ? `<strong>Phone:</strong> ${txn.temp_customer_phone || txn.farmer_phone || txn.dealer_phone || txn.company_phone}<br/>` : ''}
          </div>
        </div>

        ${itemsHTML}

        <div class="payment-section">
          <h3 style="margin: 0 0 15px 0; color: #2c5f2d;">Payment Details</h3>
          ${(() => {
            const itemDiscounts = txn.items ? txn.items.reduce((sum, i) => sum + (i.discount_amount || 0), 0) : 0;
            const itemsSubtotal = txn.items ? txn.items.reduce((sum, item) => sum + (item.line_final_total || 0), 0) : 0;
            const calculatedOverallDiscount = itemsSubtotal - (txn.total_amount || 0);
            const overallDiscount = txn.overall_discount_amount || calculatedOverallDiscount;
            const hasAnyDiscount = itemDiscounts > 0 || overallDiscount > 0.01;
            
            if (hasAnyDiscount) {
              return `
                <div style="margin-bottom: 15px; padding: 10px; background: #fff3e0; border-radius: 6px; border-left: 3px solid #f57c00;">
                  <p style="margin: 0 0 8px 0; font-weight: bold; color: #e65100;">💰 Discounts Applied</p>
                  ${itemDiscounts > 0 ? `
                    <div class="payment-row" style="font-size: 14px; color: #d32f2f;">
                      <span>Item Discounts:</span>
                      <span>- Rs. ${itemDiscounts.toFixed(2)}</span>
                    </div>
                  ` : ''}
                  ${overallDiscount > 0.01 ? `
                    <div class="payment-row" style="font-size: 14px; color: #d32f2f;">
                      <span>Overall Discount${txn.overall_discount_type === 'percentage' ? ` (${txn.overall_discount_value}%)` : ''}:</span>
                      <span>- Rs. ${overallDiscount.toFixed(2)}</span>
                    </div>
                  ` : ''}
                  <div class="payment-row" style="font-size: 15px; font-weight: bold; border-top: 1px solid #f57c00; margin-top: 5px; padding-top: 5px; color: #d32f2f;">
                    <span>Total Discount:</span>
                    <span>- Rs. ${(itemDiscounts + overallDiscount).toFixed(2)}</span>
                  </div>
                </div>
              `;
            }
            return '';
          })()}
          <div class="payment-row">
            <span>Total Amount:</span>
            <strong>Rs. ${parseFloat(txn.total_amount).toFixed(2)}</strong>
          </div>
          <div class="payment-row" style="color: #2e7d32;">
            <span>Cash Paid:</span>
            <strong>Rs. ${parseFloat(txn.cash_paid || 0).toFixed(2)}</strong>
          </div>
          ${txn.credit_amount > 0 ? `
            <div class="payment-row" style="color: #f57c00;">
              <span>Credit Amount:</span>
              <strong>Rs. ${parseFloat(txn.credit_amount).toFixed(2)}</strong>
            </div>
          ` : ''}
          <div class="payment-row" style="border-top: 2px solid #2c5f2d; margin-top: 10px; padding-top: 10px; font-size: 18px;">
            <span><strong>Payment Status:</strong></span>
            <strong>${txn.payment_type}</strong>
          </div>
        </div>

        ${txn.description ? `
          <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
            <strong>Notes:</strong><br/>
            <span style="color: #666;">${txn.description}</span>
          </div>
        ` : ''}

        <div class="signature-section">
          <div class="signature-box">
            <div style="font-weight: bold;">Customer Signature</div>
          </div>
          <div class="signature-box">
            <div style="font-weight: bold;">Authorized Signature</div>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 5px 0;"><strong>Thank you for your business!</strong></p>
          <p style="margin: 5px 0;">This is a computer-generated receipt.</p>
          <p style="margin: 5px 0;">For any queries, please contact us.</p>
          <p style="margin: 10px 0 0 0; font-size: 10px;">Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 12px 30px; background: #2c5f2d; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-right: 10px;">🖨️ Print</button>
          <button onclick="window.close()" style="padding: 12px 30px; background: #666; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer;">✖️ Close</button>
        </div>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span className="font-medium">Back to Transactions</span>
            </button>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900">Error Loading Transaction</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
      {/* Header Navigation */}
      <header className="bg-white shadow-md border-b-2 border-purple-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {fromLedger ? (
                <button
                  onClick={handleBackToLedger}
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors group"
                  title={`Back to ${entityContext.entityName || entityContext.entityType || 'Entity'}'s Ledger`}
                >
                  <ArrowLeftIcon className="h-6 w-6 text-gray-600 group-hover:text-purple-600 transition" />
                  <div className="text-left">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Back to</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {entityContext.entityName ? `${entityContext.entityName}'s Ledger` : `${entityContext.entityType || 'Entity'} Ledger`}
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/transactions')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Transaction Details
                </h1>
                <p className="text-sm text-gray-600 mt-1">{transaction.transaction_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/transactions/edit/${transactionId}`)}
                disabled={transaction.items?.some(i => (i.returned_quantity || 0) > 0)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  transaction.items?.some(i => (i.returned_quantity || 0) > 0)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:shadow-lg hover:-translate-y-0.5'
                }`}
                title={transaction.items?.some(i => (i.returned_quantity || 0) > 0) ? 'Cannot edit transaction with returns' : 'Edit transaction'}
              >
                <PencilSquareIcon className="h-5 w-5" />
                Edit
              </button>              {/* Professional Return Button (Sprint 17) */}
              {['RETAIL_SALE', 'FARMER_PURCHASE', 'SALE', 'RETAIL_PURCHASE', 'COMPANY_DELIVERY'].includes(transaction.transaction_type) && (
                <button
                  onClick={() => navigate(`/transactions/return/${transactionId}`)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg font-medium hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <ArrowUturnLeftIcon className="h-5 w-5" />
                  Return Items
                </button>
              )}
              <button
                onClick={handlePrintReceipt}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <PrinterIcon className="h-5 w-5" />
                Print Receipt
              </button>            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Transaction Overview Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6 border-2 border-purple-100">
          <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">{transaction.transaction_number || 'N/A'}</h2>
                <p className="text-purple-100 text-lg">{getTransactionTypeLabel(transaction.transaction_type)}</p>
              </div>
              <div className="text-right">
                <p className="text-purple-100 text-sm uppercase tracking-wide mb-1">Total Amount</p>
                <p className="text-4xl font-bold text-white">{formatCurrency(transaction.total_amount || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 px-8 py-6 border-b-2 border-purple-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Status</p>
                  <p className="text-lg font-bold text-green-600">Completed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Payment Type</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border-2 ${getPaymentTypeBadge(transaction.payment_type)}`}>
                    {transaction.payment_type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <IdentificationIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Transaction ID</p>
                  <p className="text-lg font-bold text-gray-900">#{transaction.transaction_id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Entity Category & Status Badges */}
          <div className="bg-white px-8 py-4 border-b-2 border-gray-100">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-gray-600">Entity Classification:</p>
              <div className="flex gap-2">
                {getEntityBadges(transaction).map((badge, index) => {
                  const IconComponent = badge.icon;
                  return (
                    <span
                      key={index}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 ${badge.color}`}
                    >
                      <IconComponent className="h-4 w-4" />
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Date & Time Information */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:border-purple-200 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl">
                <ClockIcon className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Date & Time Information</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <CalendarIcon className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 font-semibold mb-1">Transaction Date</p>
                  <p className="text-base font-bold text-gray-900">{formatDate(transaction.transaction_date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <ClockIcon className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 font-semibold mb-1">Created At</p>
                  <p className="text-base font-bold text-gray-900">{formatDate(transaction.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer/Entity Information */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:border-purple-200 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                <UserIcon className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {transaction.entity_type === 'regular' ? 'Permanent Entity Details' : 'Walk-in Customer Details'}
              </h3>
            </div>
            
            {transaction.entity_type === 'regular' ? (
              // Permanent Entity Details
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-2">
                    {transaction.entity_table} Name
                  </p>
                  <p className="text-lg font-bold text-gray-900">{transaction.entity_name || 'N/A'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Specific ID</p>
                    <p className="text-base font-bold text-gray-900">
                      {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer' ? transaction.farmer_specific_id : null) ||
                       (transaction.entity_table === 'Dealers' || transaction.entity_table === 'Dealer' ? transaction.dealer_specific_id : null) ||
                       (transaction.entity_table === 'Companies' || transaction.entity_table === 'Company' ? transaction.company_specific_id : null) ||
                       'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Database ID</p>
                    <p className="text-base font-bold text-gray-900">#{transaction.entity_id || 'N/A'}</p>
                  </div>
                </div>

                {/* Father Name (Farmer) / Contact Person (Dealer/Company) - Always show for Company */}
                {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer' || transaction.entity_table === 'Dealers' || transaction.entity_table === 'Dealer' || transaction.entity_table === 'Companies' || transaction.entity_table === 'Company') && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <UserCircleIcon className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-1">
                        {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer') ? "Father's Name" : 'Contact Person'}
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer' ? transaction.farmer_father_name : null) ||
                         (transaction.entity_table === 'Dealers' || transaction.entity_table === 'Dealer' ? transaction.dealer_contact_person : null) ||
                         (transaction.entity_table === 'Companies' || transaction.entity_table === 'Company' ? transaction.company_contact_person : null) ||
                         'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {/* CNIC (for Farmer/Dealer only) */}
                {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer' || transaction.entity_table === 'Dealers' || transaction.entity_table === 'Dealer') && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <IdentificationIcon className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-1">CNIC Number</p>
                      <p className="text-base font-bold text-gray-900">
                        {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer' ? transaction.farmer_cnic : null) ||
                         (transaction.entity_table === 'Dealers' || transaction.entity_table === 'Dealer' ? transaction.dealer_cnic : null) ||
                         'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Phone Number - Always show */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <PhoneIcon className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Phone Number</p>
                    <p className="text-base font-bold text-gray-900">
                      {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer' ? transaction.farmer_phone : null) ||
                       (transaction.entity_table === 'Dealers' || transaction.entity_table === 'Dealer' ? transaction.dealer_phone : null) ||
                       (transaction.entity_table === 'Companies' || transaction.entity_table === 'Company' ? transaction.company_phone : null) ||
                       'N/A'}
                    </p>
                  </div>
                </div>

                {/* Address - Always show */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <MapPinIcon className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Address</p>
                    <p className="text-base text-gray-900 leading-relaxed">
                      {(transaction.entity_table === 'Farmers' || transaction.entity_table === 'Farmer' ? transaction.farmer_address : null) ||
                       (transaction.entity_table === 'Dealers' || transaction.entity_table === 'Dealer' ? transaction.dealer_address : null) ||
                       (transaction.entity_table === 'Companies' || transaction.entity_table === 'Company' ? transaction.company_address : null) ||
                       'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Walk-in Customer Details
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Customer Name</p>
                  <p className="text-lg font-bold text-gray-900">{transaction.temp_customer_name || transaction.entity_name || 'N/A'}</p>
                </div>

                {transaction.temp_customer_father_name && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <UserCircleIcon className="h-5 w-5 text-orange-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Father's Name</p>
                      <p className="text-base font-bold text-gray-900">{transaction.temp_customer_father_name}</p>
                    </div>
                  </div>
                )}

                {transaction.temp_customer_cnic && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <IdentificationIcon className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-1">CNIC Number</p>
                      <p className="text-base font-bold text-gray-900">{transaction.temp_customer_cnic}</p>
                    </div>
                  </div>
                )}

                {transaction.temp_customer_phone && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <PhoneIcon className="h-5 w-5 text-orange-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Phone Number</p>
                      <p className="text-base font-bold text-gray-900">{transaction.temp_customer_phone}</p>
                    </div>
                  </div>
                )}

                {transaction.temp_customer_address && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <MapPinIcon className="h-5 w-5 text-orange-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Address</p>
                      <p className="text-base text-gray-900 leading-relaxed">{transaction.temp_customer_address}</p>
                    </div>
                  </div>
                )}

                {!transaction.temp_customer_father_name && !transaction.temp_customer_cnic && 
                 !transaction.temp_customer_phone && !transaction.temp_customer_address && (
                  <div className="p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                    <p className="text-sm text-yellow-800 text-center">
                      No additional customer details available
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Item/Product Details - Multi-Item Support (Sprint 6) */}
        {transaction.items && transaction.items.length > 0 ? (
          // Multi-Item Transaction (Sprint 6)
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:border-purple-200 transition-colors mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl">
                  <ShoppingBagIcon className="h-7 w-7 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Transaction Items</h3>
                  <p className="text-sm text-gray-600">{transaction.items.length} item{transaction.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600 uppercase font-semibold">Subtotal</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(transaction.items.reduce((sum, item) => sum + (item.line_final_total || 0), 0))}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-100 to-blue-100 border-b-2 border-purple-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Returned</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Unit Price</th>                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Line Total</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Final Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transaction.items.map((item, index) => (
                    <tr key={item.item_id} className="hover:bg-purple-50 transition-colors">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.line_number || index + 1}</td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{item.item_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{item.item_type}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 font-mono">{item.item_code || 'N/A'}</td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">
                        {Math.round(parseFloat(item.quantity))} {item.unit}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-red-600 text-right">
                        {item.returned_quantity > 0 ? `${item.returned_quantity} ${item.unit}` : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.unit_price)}
                      </td>                      <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.line_total)}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-red-600 text-right">
                        {item.discount_amount > 0 ? `- ${formatCurrency(item.discount_amount)}` : 'Rs 0'}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-purple-600 text-right">
                        {formatCurrency(item.line_final_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Subtotal after item discounts */}
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan="6" className="px-4 py-3 text-right text-sm font-bold text-gray-700 uppercase">
                      Items Subtotal:
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                      {transaction.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0) > 0 
                        ? `- ${formatCurrency(transaction.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0))}`
                        : 'Rs 0'
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                      {formatCurrency(transaction.items.reduce((sum, item) => sum + (item.line_final_total || 0), 0))}
                    </td>
                  </tr>
                  
                  {/* Overall discount - Calculate from difference if not stored, or use stored value */}
                  {(() => {
                    const itemsSubtotal = transaction.items.reduce((sum, item) => sum + (item.line_final_total || 0), 0);
                    const grandTotal = transaction.total_amount || 0;
                    const calculatedDiscount = itemsSubtotal - grandTotal;
                    const overallDiscount = transaction.overall_discount_amount || calculatedDiscount;
                    
                    if (overallDiscount > 0.01) {
                      return (
                        <tr className="bg-orange-50 border-t border-orange-200">
                          <td colSpan="7" className="px-4 py-3 text-right text-sm font-bold text-orange-700 uppercase">
                            Overall Discount {transaction.overall_discount_type === 'percentage' ? `(${transaction.overall_discount_value}%)` : ''}:
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                            - {formatCurrency(overallDiscount)}
                          </td>
                        </tr>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Grand Total */}
                  <tr className="bg-gradient-to-r from-purple-50 to-blue-50 border-t-2 border-purple-300">
                    <td colSpan="7" className="px-4 py-4 text-right text-sm font-bold text-gray-900 uppercase">
                      Grand Total:
                    </td>
                    <td className="px-4 py-4 text-right text-xl font-bold text-purple-600">
                      {formatCurrency(transaction.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          // Single-Item Transaction (Legacy Sprint 5)
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:border-purple-200 transition-colors mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl">
                <ShoppingBagIcon className="h-7 w-7 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Item Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <TagIcon className="h-5 w-5 text-orange-600" />
                  <p className="text-xs text-gray-600 uppercase font-semibold">Item Type</p>
                </div>
                <p className="text-lg font-bold text-gray-900 capitalize">{transaction.item_type || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <BuildingStorefrontIcon className="h-5 w-5 text-orange-600" />
                  <p className="text-xs text-gray-600 uppercase font-semibold">Item Name</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{transaction.item_name || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <ScaleIcon className="h-5 w-5 text-orange-600" />
                  <p className="text-xs text-gray-600 uppercase font-semibold">Quantity</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{transaction.quantity || 0} {transaction.unit || 'units'}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <CurrencyDollarIcon className="h-5 w-5 text-orange-600" />
                  <p className="text-xs text-gray-600 uppercase font-semibold">Unit Price</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(transaction.unit_price)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Breakdown */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:border-purple-200 transition-colors mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl">
              <CurrencyDollarIcon className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Payment Breakdown</h3>
          </div>
          <div className="space-y-3">
            {/* Only show quantity/unit price for single-item transactions */}
            {(!transaction.items || transaction.items.length === 0) && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Quantity</p>
                  <p className="text-lg font-bold text-gray-900">{transaction.quantity || 0} {transaction.unit || 'units'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Unit Price</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(transaction.unit_price)}</p>
                </div>
              </div>
            )}
            
            {/* Show items summary for multi-item transactions */}
            {transaction.items && transaction.items.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200 mb-3">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Items</p>
                    <p className="text-lg font-bold text-purple-600">{transaction.items.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Quantity</p>
                    <p className="text-lg font-bold text-purple-600">
                      {Math.round(transaction.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-semibold mb-1">Items Subtotal</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatCurrency(transaction.items.reduce((sum, item) => sum + (item.line_total || 0), 0))}
                    </p>
                  </div>
                </div>
                
                {/* Show discounts breakdown */}
                {(() => {
                  const itemDiscounts = transaction.items.reduce((sum, i) => sum + (i.discount_amount || 0), 0);
                  const itemsSubtotal = transaction.items.reduce((sum, item) => sum + (item.line_final_total || 0), 0);
                  const calculatedOverallDiscount = itemsSubtotal - (transaction.total_amount || 0);
                  const overallDiscount = transaction.overall_discount_amount || calculatedOverallDiscount;
                  const hasAnyDiscount = itemDiscounts > 0 || overallDiscount > 0.01;
                  
                  if (!hasAnyDiscount) return null;
                  
                  return (
                    <div className="mt-3 pt-3 border-t-2 border-purple-300">
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Discounts Applied</p>
                      <div className="space-y-2">
                        {itemDiscounts > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Item Discounts:</span>
                            <span className="font-bold text-red-600">
                              - {formatCurrency(itemDiscounts)}
                            </span>
                          </div>
                        )}
                        {overallDiscount > 0.01 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              Overall Discount {transaction.overall_discount_type === 'percentage' ? `(${transaction.overall_discount_value}%)` : ''}:
                            </span>
                            <span className="font-bold text-red-600">- {formatCurrency(overallDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-300">
                          <span className="font-bold text-gray-700">Total Discount:</span>
                          <span className="font-bold text-red-600">
                            - {formatCurrency(itemDiscounts + overallDiscount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            <div className="flex justify-between items-center p-5 bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl border-2 border-purple-300">
              <span className="text-gray-900 font-bold text-xl">Total Amount</span>
              <span className="text-2xl font-bold text-purple-600">{formatCurrency(transaction.total_amount)}</span>
            </div>
            
            <div className="mt-4 p-1 bg-gray-100 rounded-xl">
              <div className="bg-white rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Payment Details</h4>
                
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border-2 border-green-300">
                  <div className="flex items-center gap-2">
                    <BanknotesIcon className="h-5 w-5 text-green-600" />
                    <span className="text-gray-700 font-semibold text-lg">Cash Paid</span>
                  </div>
                  <span className="text-green-600 font-bold text-xl">
                    {formatCurrency(transaction.cash_paid || 0)}
                  </span>
                </div>
                
                {transaction.credit_amount > 0 && (
                  <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-xl border-2 border-yellow-300">
                    <div className="flex items-center gap-2">
                      <CurrencyDollarIcon className="h-5 w-5 text-yellow-600" />
                      <span className="text-gray-700 font-semibold text-lg">Credit Amount</span>
                    </div>
                    <span className="text-yellow-600 font-bold text-xl">{formatCurrency(transaction.credit_amount)}</span>
                  </div>
                )}
                
                <div className="pt-3 border-t-2 border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Payment Status:</span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border-2 ${getPaymentTypeBadge(transaction.payment_type)}`}>
                      {transaction.payment_type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description/Notes */}
        {transaction.description && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:border-purple-200 transition-colors mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-gray-100 to-slate-100 rounded-xl">
                <DocumentTextIcon className="h-7 w-7 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Transaction Notes</h3>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-gray-700 leading-relaxed text-base">{transaction.description}</p>
            </div>
          </div>
        )}

        {/* Footer Information */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl shadow-lg p-6 border-2 border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <UserIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Created By</p>
                <p className="text-base font-bold text-gray-900">
                  {transaction.created_by_name || (transaction.created_by ? `User #${transaction.created_by}` : 'System')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <IdentificationIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Transaction Number</p>
                <p className="text-base font-bold font-mono text-gray-900">{transaction.transaction_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <ClockIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Record Created</p>
                <p className="text-base font-bold text-gray-900">{formatDate(transaction.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailsPage;
