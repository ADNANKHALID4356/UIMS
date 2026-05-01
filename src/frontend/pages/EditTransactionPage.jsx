import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useToast } from '../components/common/Toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

/**
 * EditTransactionPage - Edit both single-item and multi-item transactions
 * Features:
 * - Load transaction with all items
 * - Edit quantities, prices, discounts
 * - Add/remove items
 * - Update payment information
 * - Auto-calculate totals
 * - Validate stock availability
 * - Update ledger automatically
 */
const EditTransactionPage = () => {
  const navigate = useNavigate();
  const { transactionId } = useParams();
  const currentUser = useSelector((state) => state.auth.user);
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState(null);
  
  // Products and Grains for selection
  const [products, setProducts] = useState([]);
  const [grains, setGrains] = useState([]);
  
  // Items array for multi-item transactions
  const [items, setItems] = useState([]);
  
  // Overall discount
  const [overallDiscountType, setOverallDiscountType] = useState('amount');
  const [overallDiscountValue, setOverallDiscountValue] = useState(0);
  
  // Payment
  const [paymentType, setPaymentType] = useState('CASH');
  const [cashPaid, setCashPaid] = useState(0);
  const [description, setDescription] = useState('');
  
  // Totals
  const [totals, setTotals] = useState({
    itemsSubtotal: 0,
    totalItemDiscount: 0,
    subtotalAfterItemDiscount: 0,
    overallDiscount: 0,
    grandTotal: 0
  });

  useEffect(() => {
    loadTransaction();
    loadProducts();
    loadGrains();
  }, [transactionId]);

  // Calculate totals whenever items or discount changes
  useEffect(() => {
    calculateTotals();
  }, [items, overallDiscountType, overallDiscountValue]);

  // Auto-update cash paid when payment type or total changes
  useEffect(() => {
    if (paymentType === 'CASH') {
      setCashPaid(totals.grandTotal);
    } else if (paymentType === 'CREDIT') {
      setCashPaid(0);
    }
  }, [paymentType, totals.grandTotal]);

  const loadTransaction = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load transaction with items
      const txn = await window.electronAPI.transaction.getByIdWithItems(parseInt(transactionId));
      
      if (!txn) {
        throw new Error('Transaction not found');
      }
      
      console.log('[EditTransactionPage] Loaded transaction:', txn);
      setTransaction(txn);
      
      // Load items
      if (txn.items && txn.items.length > 0) {
        // Multi-item transaction
        const loadedItems = txn.items.map((item, index) => ({
          id: item.transaction_item_id || index,
          item_type: item.item_type || 'PRODUCT',
          item_reference_id: item.item_reference_id,
          item_name: item.item_name || '',
          item_code: item.item_code || '',
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || '',
          unit_price: parseFloat(item.unit_price) || 0,
          discount_amount: parseFloat(item.discount_amount) || 0,
          line_total: parseFloat(item.line_total) || 0,
          line_final_total: parseFloat(item.line_final_total) || 0
        }));
        setItems(loadedItems);
      } else {
        // Legacy single-item transaction - convert to item
        setItems([{
          id: 1,
          item_type: (txn.item_type || 'product').toUpperCase(),
          item_reference_id: txn.item_id,
          item_name: txn.item_name || '',
          item_code: '',
          quantity: parseFloat(txn.quantity) || 0,
          unit: txn.unit || '',
          unit_price: parseFloat(txn.unit_price) || 0,
          discount_amount: 0,
          line_total: parseFloat(txn.total_amount) || 0,
          line_final_total: parseFloat(txn.total_amount) || 0
        }]);
      }
      
      // Load discount info
      setOverallDiscountType(txn.overall_discount_type || 'amount');
      setOverallDiscountValue(parseFloat(txn.overall_discount_value) || 0);
      
      // Load payment info
      setPaymentType(txn.payment_type || 'CASH');
      setCashPaid(parseFloat(txn.cash_paid) || 0);
      setDescription(txn.description || '');
      
    } catch (err) {
      console.error('[EditTransactionPage] Error loading transaction:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const result = await window.electronAPI.product.getAll();
      setProducts(result || []);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const loadGrains = async () => {
    try {
      const result = await window.electronAPI.grain.getAll();
      setGrains(result || []);
    } catch (err) {
      console.error('Error loading grains:', err);
    }
  };

  const calculateTotals = () => {
    // Step 1: Calculate items subtotal and total item discounts
    const itemsSubtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price);
    }, 0);
    
    const totalItemDiscount = items.reduce((sum, item) => {
      return sum + (item.discount_amount || 0);
    }, 0);
    
    const subtotalAfterItemDiscount = itemsSubtotal - totalItemDiscount;
    
    // Step 2: Calculate overall discount
    let overallDiscount = 0;
    if (overallDiscountType === 'percentage') {
      overallDiscount = (subtotalAfterItemDiscount * overallDiscountValue) / 100;
    } else {
      overallDiscount = parseFloat(overallDiscountValue) || 0;
    }
    
    // Step 3: Calculate grand total
    const grandTotal = Math.max(0, subtotalAfterItemDiscount - overallDiscount);
    
    setTotals({
      itemsSubtotal,
      totalItemDiscount,
      subtotalAfterItemDiscount,
      overallDiscount,
      grandTotal
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Recalculate line totals
    if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount') {
      const item = newItems[index];
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const discount = parseFloat(item.discount_amount) || 0;
      
      newItems[index].line_total = qty * price;
      newItems[index].line_final_total = (qty * price) - discount;
    }
    
    setItems(newItems);
  };

  const handleItemSelect = (index, itemId) => {
    const itemType = items[index].item_type;
    const itemsList = itemType === 'PRODUCT' ? products : grains;
    const selectedItem = itemsList.find(i => 
      (itemType === 'PRODUCT' ? i.product_id : i.grain_id) === parseInt(itemId)
    );
    
    if (selectedItem) {
      handleItemChange(index, 'item_reference_id', parseInt(itemId));
      handleItemChange(index, 'item_name', itemType === 'PRODUCT' ? selectedItem.product_name : selectedItem.grain_name);
      handleItemChange(index, 'item_code', itemType === 'PRODUCT' ? selectedItem.product_code : selectedItem.grain_code);
      handleItemChange(index, 'unit', selectedItem.unit_of_measure || '');
      handleItemChange(index, 'unit_price', selectedItem.selling_price || 0);
    }
  };

  const addItem = () => {
    setItems([...items, {
      id: Date.now(),
      item_type: 'PRODUCT',
      item_reference_id: '',
      item_name: '',
      item_code: '',
      quantity: 0,
      unit: '',
      unit_price: 0,
      discount_amount: 0,
      line_total: 0,
      line_final_total: 0
    }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) {
      toast.success('Transaction must have at least one item');
      return;
    }
    
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const validateForm = () => {
    const errors = [];
    
    if (items.length === 0) {
      errors.push('Transaction must have at least one item');
    }
    
    items.forEach((item, index) => {
      if (!item.item_reference_id) {
        errors.push(`Item ${index + 1}: Please select an item`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      }
      if (!item.unit_price || item.unit_price < 0) {
        errors.push(`Item ${index + 1}: Unit price must be 0 or greater`);
      }
    });
    
    if (paymentType === 'PARTIAL') {
      if (cashPaid < 0) {
        errors.push('Cash paid cannot be negative');
      }
      if (cashPaid > totals.grandTotal) {
        errors.push('Cash paid cannot exceed total amount');
      }
    }
    
    return errors;
  };

  const handleSave = async () => {
    try {
      // Validate
      const errors = validateForm();
      if (errors.length > 0) {
        toast.error('Validation Errors:\n\n' + errors.join('\n'));
        return;
      }
      
      // Confirm with before/after comparison
      const confirmed = window.confirm(
        '=== UPDATE TRANSACTION ===\n\n' +
        `Original Total: Rs ${transaction.total_amount}\n` +
        `New Total: Rs ${totals.grandTotal.toFixed(2)}\n\n` +
        `Original Payment: ${transaction.payment_type}\n` +
        `New Payment: ${paymentType}\n\n` +
        `Items: ${items.length}\n\n` +
        'This will automatically update:\n' +
        '• Stock levels\n' +
        '• Entity ledger\n' +
        '• Entity balances\n\n' +
        'Continue?'
      );
      
      if (!confirmed) return;
      
      setSaving(true);
      
      // Prepare items data
      const itemsData = items.map(item => ({
        item_type: item.item_type,
        item_reference_id: item.item_reference_id,
        item_name: item.item_name,
        item_code: item.item_code,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unit_price: parseFloat(item.unit_price),
        discount_amount: parseFloat(item.discount_amount) || 0
      }));
      
      // Prepare update data
      const updateData = {
        items: itemsData,
        total_amount: totals.grandTotal,
        overall_discount_type: overallDiscountType,
        overall_discount_value: parseFloat(overallDiscountValue) || 0,
        overall_discount_amount: totals.overallDiscount,
        payment_type: paymentType,
        cash_paid: paymentType === 'CASH' ? totals.grandTotal : 
                   paymentType === 'CREDIT' ? 0 : 
                   parseFloat(cashPaid),
        description: description
      };
      
      console.log('[EditTransactionPage] Saving update:', updateData);
      
      // Call edit API
      const result = await window.electronAPI.transaction.editMultiItem({
        transactionId: parseInt(transactionId),
        updateData: updateData,
        userId: currentUser?.user_id || 1
      });
      
      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to update transaction');
      }
      
      toast.success('Transaction updated successfully!\n\nStock, ledger, and balances have been automatically updated.', 'Success', 7000);
      
      navigate(`/transactions/${transactionId}`);
      
    } catch (err) {
      console.error('[EditTransactionPage] Save error:', err);
      toast.error('Error updating transaction:\n\n' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading transaction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-red-800 font-bold text-lg mb-2 text-center">Error Loading Transaction</h2>
          <p className="text-red-600 text-center">{error}</p>
          <button
            onClick={() => navigate('/transactions')}
            className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Transactions
          </button>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/transactions')}
                className="p-2 hover:bg-slate-700 rounded-lg transition"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold">Edit Transaction</h1>
                <p className="text-gray-400 text-sm">
                  {transaction.transaction_number} • {transaction.entity_name || 'N/A'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Original Total</p>
              <p className="text-xl font-bold text-amber-400">{formatCurrency(transaction.total_amount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Items Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Transaction Items</h2>
            <button
              onClick={addItem}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-2 text-sm font-semibold">#</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold">Type</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold">Item</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold">Qty</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold">Unit Price</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold">Line Total</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold">Discount</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold">Final</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-3 px-2 text-sm">{index + 1}</td>
                    <td className="py-3 px-2">
                      <select
                        value={item.item_type}
                        onChange={(e) => handleItemChange(index, 'item_type', e.target.value)}
                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm"
                      >
                        <option value="PRODUCT">Product</option>
                        <option value="GRAIN">Grain</option>
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={item.item_reference_id}
                        onChange={(e) => handleItemSelect(index, e.target.value)}
                        className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm"
                      >
                        <option value="">Select...</option>
                        {(item.item_type === 'PRODUCT' ? products : grains).map(i => (
                          <option 
                            key={item.item_type === 'PRODUCT' ? i.product_id : i.grain_id}
                            value={item.item_type === 'PRODUCT' ? i.product_id : i.grain_id}
                          >
                            {item.item_type === 'PRODUCT' ? i.product_name : i.grain_name} ({item.item_type === 'PRODUCT' ? i.product_code : i.grain_code})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-right"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-right"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="py-3 px-2 text-right text-sm font-semibold">
                      {formatCurrency(item.line_total)}
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        value={item.discount_amount}
                        onChange={(e) => handleItemChange(index, 'discount_amount', e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-right"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="py-3 px-2 text-right text-sm font-bold text-green-400">
                      {formatCurrency(item.line_final_total)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => removeItem(index)}
                        disabled={items.length <= 1}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Discount & Description */}
          <div className="space-y-6">
            {/* Overall Discount */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Overall Transaction Discount</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Discount Type</label>
                  <select
                    value={overallDiscountType}
                    onChange={(e) => setOverallDiscountType(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg"
                  >
                    <option value="amount">Fixed Amount</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Discount Value {overallDiscountType === 'percentage' ? '(%)' : '(Rs)'}
                  </label>
                  <input
                    type="number"
                    value={overallDiscountValue}
                    onChange={(e) => setOverallDiscountValue(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div className="p-4 bg-orange-900/20 border border-orange-700/50 rounded-lg">
                  <p className="text-sm text-orange-300">
                    Discount Amount: <span className="font-bold">{formatCurrency(totals.overallDiscount)}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Description / Notes</h2>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg"
                rows="4"
                placeholder="Additional notes about this transaction..."
              />
            </div>
          </div>

          {/* Right Column - Summary & Payment */}
          <div className="space-y-6">
            {/* Transaction Summary */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Transaction Summary</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Items Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(totals.itemsSubtotal)}</span>
                </div>
                
                {totals.totalItemDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Item Discounts:</span>
                    <span className="font-semibold text-red-400">- {formatCurrency(totals.totalItemDiscount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal After Item Disc:</span>
                  <span className="font-semibold">{formatCurrency(totals.subtotalAfterItemDiscount)}</span>
                </div>
                
                {totals.overallDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Overall Discount:</span>
                    <span className="font-semibold text-red-400">- {formatCurrency(totals.overallDiscount)}</span>
                  </div>
                )}
                
                <div className="border-t border-slate-600 pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">Grand Total:</span>
                    <span className="text-2xl font-bold text-green-400">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Payment Type</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CREDIT">Credit</option>
                    <option value="PARTIAL">Partial Payment</option>
                  </select>
                </div>
                
                {paymentType === 'PARTIAL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Cash Paid</label>
                    <input
                      type="number"
                      value={cashPaid}
                      onChange={(e) => setCashPaid(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg"
                      min="0"
                      max={totals.grandTotal}
                      step="0.01"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Max: {formatCurrency(totals.grandTotal)}
                    </p>
                  </div>
                )}
                
                <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-300">Cash Paid:</span>
                    <span className="font-bold text-blue-300">
                      {formatCurrency(paymentType === 'CASH' ? totals.grandTotal : paymentType === 'CREDIT' ? 0 : cashPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-300">Credit Amount:</span>
                    <span className="font-bold text-amber-300">
                      {formatCurrency(paymentType === 'CASH' ? 0 : paymentType === 'CREDIT' ? totals.grandTotal : Math.max(0, totals.grandTotal - cashPaid))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-6 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
          <button
            onClick={() => navigate('/transactions')}
            disabled={saving}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircleIcon className="w-5 h-5" />
            <span className="font-semibold">{saving ? 'Saving Changes...' : 'Save Changes'}</span>
          </button>
        </div>

        {/* Info Banner */}
        <div className="mt-4 p-4 bg-cyan-900/30 border border-cyan-700/50 rounded-lg">
          <p className="text-cyan-300 text-sm">
            <strong>ℹ️ Auto-Update:</strong> When you save, the system will automatically:
          </p>
          <ul className="text-cyan-300 text-sm mt-2 ml-6 list-disc space-y-1">
            <li>Reverse original stock changes and apply new ones</li>
            <li>Update entity ledger with reversal and new entries</li>
            <li>Recalculate entity balances (credit/balance)</li>
            <li>Log all changes to audit history</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EditTransactionPage;
