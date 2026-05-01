import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  ArrowUturnLeftIcon, 
  ShoppingBagIcon, 
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../components/common/Toast';
import { useAppSelector } from '../store/hooks';

const ReturnTransactionPage = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAppSelector((state) => state.auth);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [originalTransaction, setOriginalTransaction] = useState(null);
  const [returnItems, setReturnItems] = useState({}); // { item_id: quantity }
  const [paymentMode, setPaymentMode] = useState('CASH'); // 'CASH' or 'CREDIT'
  const [cashRefunded, setCashRefunded] = useState(0);
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadTransaction();
  }, [transactionId]);

  const loadTransaction = async () => {
    try {
      const data = await window.electronAPI.transaction.getByIdWithItems(parseInt(transactionId));
      if (!data) {
        toast.showError('Transaction not found');
        navigate('/transactions');
        return;
      }
      
      // Initialize return quantities to 0
      const initialReturn = {};
      data.items.forEach(item => {
        initialReturn[item.item_id] = 0;
      });
      
      setOriginalTransaction(data);
      setReturnItems(initialReturn);
      setLoading(false);
    } catch (error) {
      console.error('Error loading transaction:', error);
      toast.showError('Failed to load transaction');
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemId, val, max) => {
    const qty = parseFloat(val) || 0;
    if (qty < 0) return;
    if (qty > max) {
      toast.showWarning(`Cannot return more than ${max}`);
      return;
    }
    const newItems = { ...returnItems, [itemId]: qty };
    setReturnItems(newItems);
    
    // Auto-update cash refunded if in cash mode
    if (paymentMode === 'CASH') {
      const total = calculateReturnTotal(newItems);
      setCashRefunded(total);
    }
  };

  const calculateReturnTotal = (items = returnItems) => {
    if (!originalTransaction) return 0;
    return originalTransaction.items.reduce((sum, item) => {
      const qty = items[item.item_id] || 0;
      return sum + (qty * item.unit_price);
    }, 0);
  };

  const handleSubmit = async () => {
    const total = calculateReturnTotal();
    if (total <= 0) {
      toast.showWarning('Please specify items to return');
      return;
    }

    const itemsToReturn = Object.entries(returnItems)
      .filter(([id, qty]) => qty > 0)
      .map(([id, qty]) => ({
        original_item_id: parseInt(id),
        quantity: qty
      }));

    const finalCashRefunded = paymentMode === 'CASH' ? parseFloat(cashRefunded) || 0 : 0;
    const creditAdjusted = total - finalCashRefunded;

    const returnMetadata = {
      payment_type: paymentMode,
      cash_refunded: finalCashRefunded,
      credit_adjusted: creditAdjusted,
      total_return_amount: total,
      description: description || `Return for ${originalTransaction.transaction_number}`
    };

    setProcessing(true);
    try {
      const result = await window.electronAPI.transaction.createReturnMulti({
        originalTransactionId: parseInt(transactionId),
        returnItems: itemsToReturn,
        returnMetadata,
        userId: user.user_id
      });

      if (result.success) {
        toast.showSuccess('Return processed successfully');
        navigate(`/transactions/${result.transaction_id}`);
      } else {
        toast.showError(result.message || 'Failed to process return');
      }
    } catch (error) {
      console.error('Return error:', error);
      toast.showError(error.message || 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const totalReturnAmount = calculateReturnTotal();

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Process Return</h1>
              <p className="text-sm text-gray-500">Original: {originalTransaction.transaction_number} | {originalTransaction.entity_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right mr-4">
              <p className="text-xs text-gray-500 uppercase font-bold">Total Goods Return</p>
              <p className="text-2xl font-black text-red-600">{formatCurrency(totalReturnAmount)}</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={processing || totalReturnAmount <= 0}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
                processing || totalReturnAmount <= 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:shadow-red-200 hover:-translate-y-0.5'
              }`}
            >
              {processing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <CheckCircleIcon className="h-5 w-5" />
              )}
              Confirm Return
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Items Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <ShoppingBagIcon className="h-5 w-5 text-purple-600" />
                  Select Items to Return
                </h3>
                <span className="text-xs font-medium text-gray-500 uppercase bg-gray-200 px-2 py-1 rounded">
                  {originalTransaction.items.length} Original Items
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left font-bold">Item Details</th>
                      <th className="px-6 py-3 text-right font-bold">Sold Qty</th>
                      <th className="px-6 py-3 text-right font-bold">Already Ret.</th>
                      <th className="px-6 py-3 text-right font-bold w-32">Return Qty</th>
                      <th className="px-6 py-3 text-right font-bold">Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {originalTransaction.items.map((item) => {
                      const available = item.quantity - (item.returned_quantity || 0);
                      const returnQty = returnItems[item.item_id] || 0;
                      
                      return (
                        <tr key={item.item_id} className={available === 0 ? 'bg-gray-50 opacity-60' : 'hover:bg-purple-50/30'}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{item.item_name}</div>
                            <div className="text-xs text-gray-500">{item.item_code} @ {formatCurrency(item.unit_price)}</div>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-600">{item.quantity} {item.unit}</td>
                          <td className="px-6 py-4 text-right text-red-500">{item.returned_quantity || 0}</td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              min="0"
                              max={available}
                              step="any"
                              value={returnItems[item.item_id] || ''}
                              onChange={(e) => handleQuantityChange(item.item_id, e.target.value, available)}
                              disabled={available === 0}
                              placeholder="0"
                              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-0 text-right font-bold"
                            />
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-900">
                            {formatCurrency(returnQty * item.unit_price)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Return Summary & Settings */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                Return Configuration
              </h3>

              {/* Payment Mode Selection */}
              <div className="space-y-3 mb-6">
                <p className="text-xs font-bold text-gray-500 uppercase">Settlement Method</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setPaymentMode('CASH');
                      setCashRefunded(totalReturnAmount);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      paymentMode === 'CASH'
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-100 hover:border-gray-200 text-gray-500'
                    }`}
                  >
                    <BanknotesIcon className="h-6 w-6" />
                    <span className="text-sm font-bold">Cash Refund</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMode('CREDIT');
                      setCashRefunded(0);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      paymentMode === 'CREDIT'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-100 hover:border-gray-200 text-gray-500'
                    }`}
                  >
                    <CreditCardIcon className="h-6 w-6" />
                    <span className="text-sm font-bold">A/C Adjustment</span>
                  </button>
                </div>
              </div>

              {/* Cash Amount Input */}
              {paymentMode === 'CASH' && (
                <div className="space-y-2 mb-6 animate-fadeIn">
                  <label className="text-xs font-bold text-gray-500 uppercase">Actual Cash Refunded</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">Rs</span>
                    <input
                      type="number"
                      value={cashRefunded}
                      onChange={(e) => setCashRefunded(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-green-200 rounded-xl focus:border-green-500 focus:ring-0 text-xl font-bold text-green-700"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    Remaining {formatCurrency(totalReturnAmount - cashRefunded)} will adjust the customer's ledger.
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Return Goods Value</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalReturnAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cash Refunded Now</span>
                  <span className="font-bold text-red-600">-{formatCurrency(paymentMode === 'CASH' ? cashRefunded : 0)}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 flex justify-between">
                  <span className="font-bold text-gray-900">Ledger Adjustment</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(totalReturnAmount - (paymentMode === 'CASH' ? cashRefunded : 0))}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Return Notes</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Reason for return..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-0 min-h-[80px] text-sm"
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-bold mb-1">Professional Settlement</p>
                <p>The system will systematically update inventory and the entity's ledger in two professional steps: the return of goods and the refund of cash.</p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default ReturnTransactionPage;
