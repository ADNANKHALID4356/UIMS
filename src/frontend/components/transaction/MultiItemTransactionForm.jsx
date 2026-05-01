import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ShoppingCartIcon, CalculatorIcon } from '@heroicons/react/24/outline';

/**
 * MultiItemTransactionForm - Sprint 6
 * Professional component for multi-item transaction entry
 * Supports dynamic line items with real-time calculations
 */
const MultiItemTransactionForm = ({
  transactionType,
  items,
  onChange,
  availableProducts = [],
  availableGrains = [],
  disabled = false
}) => {
  /**
   * Determine if we should show products or grains based on transaction type
   */
  const getDefaultItemType = () => {
    // All retail types use products only
    if (transactionType?.startsWith('RETAIL_')) {
      return 'product';
    }
    if (transactionType === 'FARMER_PURCHASE' || transactionType === 'COMPANY_DELIVERY') {
      return 'product';
    } else if (transactionType === 'DEALER_PURCHASE' || transactionType === 'FARMER_SALE_GRAIN') {
      return 'grain';
    }
    return 'product'; // default
  };

  /**
   * Create empty line item with default values
   */
  function createEmptyLineItem() {
    return {
      id: Date.now() + Math.random(), // Unique temporary ID
      item_type: getDefaultItemType(), // Use transaction-appropriate default
      item_reference_id: '',
      item_name: '',
      quantity: '',
      unit: '',
      unit_price: '',
      discount_percentage: 0,
      discount_amount: 0,
      line_total: 0,
      description: ''
    };
  }

  // Initialize with one empty row if no items provided
  const [lineItems, setLineItems] = useState(items?.length > 0 ? items : [createEmptyLineItem()]);
  const [overallDiscountType, setOverallDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [overallDiscountValue, setOverallDiscountValue] = useState(0);
  const [totals, setTotals] = useState({
    subtotal: 0,
    totalItemDiscount: 0,
    subtotalAfterItemDiscount: 0,
    overallDiscount: 0,
    grandTotal: 0,
    totalQuantity: 0
  });

  /**
   * Update line items when transaction type changes
   * This ensures the correct item type (product/grain) is used
   */
  useEffect(() => {
    const defaultType = getDefaultItemType();
    setLineItems(prevItems => 
      prevItems.map(item => {
        // Only update if item is empty (not yet selected)
        if (!item.item_reference_id) {
          return { ...item, item_type: defaultType };
        }
        return item;
      })
    );
  }, [transactionType]);

  /**
   * Update parent component when line items change
   */
  useEffect(() => {
    if (onChange) {
      // Convert line items to format expected by backend
      const formattedItems = lineItems
        .filter(item => item.item_reference_id && item.quantity > 0)
        .map(item => ({
          item_type: item.item_type,
          item_reference_id: parseInt(item.item_reference_id),
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price) || 0,
          discount_amount: parseFloat(item.discount_amount) || 0,
          description: item.description || null
        }));

      // Include overall discount information and grand total
      onChange({
        items: formattedItems,
        overallDiscount: {
          type: overallDiscountType,
          value: parseFloat(overallDiscountValue) || 0,
          amount: totals.overallDiscount,
          grandTotal: totals.grandTotal,
          subtotal: totals.subtotal
        }
      });
    }
  }, [lineItems, overallDiscountType, overallDiscountValue, totals.overallDiscount]);

  /**
   * Calculate totals whenever line items change or overall discount changes
   */
  useEffect(() => {
    const itemTotals = lineItems.reduce(
      (acc, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        const discount = parseFloat(item.discount_amount) || 0;
        const lineTotal = (qty * price) - discount;

        return {
          subtotal: acc.subtotal + (qty * price),
          totalItemDiscount: acc.totalItemDiscount + discount,
          subtotalAfterItemDiscount: acc.subtotalAfterItemDiscount + lineTotal,
          totalQuantity: acc.totalQuantity + qty
        };
      },
      { subtotal: 0, totalItemDiscount: 0, subtotalAfterItemDiscount: 0, totalQuantity: 0 }
    );

    // Calculate overall discount
    let overallDiscountAmount = 0;
    const discountValue = parseFloat(overallDiscountValue) || 0;
    
    if (overallDiscountType === 'percentage') {
      overallDiscountAmount = (itemTotals.subtotalAfterItemDiscount * discountValue) / 100;
    } else {
      overallDiscountAmount = discountValue;
    }

    // Ensure overall discount doesn't exceed subtotal
    overallDiscountAmount = Math.min(overallDiscountAmount, itemTotals.subtotalAfterItemDiscount);

    const grandTotal = itemTotals.subtotalAfterItemDiscount - overallDiscountAmount;

    setTotals({
      ...itemTotals,
      overallDiscount: overallDiscountAmount,
      grandTotal: Math.max(0, grandTotal)
    });
  }, [lineItems, overallDiscountType, overallDiscountValue]);

  /**
   * Add a new empty line item
   */
  const handleAddLine = () => {
    if (lineItems.length >= 50) {
      toast.warning('Maximum 50 items allowed per transaction');
      return;
    }
    setLineItems([...lineItems, createEmptyLineItem()]);
  };

  /**
   * Remove a line item
   */
  const handleRemoveLine = (id) => {
    if (lineItems.length === 1) {
      toast.warning('At least one item is required');
      return;
    }
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  /**
   * Update a specific line item field
   */
  const handleLineChange = (id, field, value) => {
    setLineItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // When item is selected, populate name, unit, and price
        if (field === 'item_reference_id' && value) {
          const selectedItem = getItemById(updated.item_type, value);
          if (selectedItem) {
            updated.item_name = selectedItem.name;
            updated.unit = selectedItem.unit;
            updated.unit_price = selectedItem.price.toString();
          }
        }

        // Handle discount percentage change - calculate amount
        if (field === 'discount_percentage') {
          const qty = parseFloat(updated.quantity) || 0;
          const price = parseFloat(updated.unit_price) || 0;
          const lineSubtotal = qty * price;
          const discountPercent = parseFloat(value) || 0;
          updated.discount_amount = (lineSubtotal * discountPercent) / 100;
        }

        // Handle discount amount change - calculate percentage
        if (field === 'discount_amount') {
          const qty = parseFloat(updated.quantity) || 0;
          const price = parseFloat(updated.unit_price) || 0;
          const lineSubtotal = qty * price;
          const discountAmt = parseFloat(value) || 0;
          updated.discount_percentage = lineSubtotal > 0 ? (discountAmt / lineSubtotal) * 100 : 0;
        }

        // Recalculate line total
        const qty = parseFloat(updated.quantity) || 0;
        const price = parseFloat(updated.unit_price) || 0;
        const discount = parseFloat(updated.discount_amount) || 0;
        updated.line_total = (qty * price) - discount;

        return updated;
      })
    );
  };

  /**
   * Get item by ID from available products/grains
   */
  const getItemById = (itemType, itemId) => {
    const items = itemType === 'product' ? availableProducts : availableGrains;
    const item = items.find(i => {
      if (itemType === 'product') return i.product_id === parseInt(itemId);
      if (itemType === 'grain') return i.grain_id === parseInt(itemId);
      return false;
    });

    if (!item) return null;

    return {
      name: item.product_name || item.grain_name,
      unit: item.unit_of_measure || item.unit || 'unit',
      price: item.avg_price || item.stock_price || item.min_price || item.price || 0,
      code: item.product_code || item.grain_code
    };
  };

  /**
   * Get available items based on type
   */
  const getAvailableItems = (itemType) => {
    return itemType === 'product' ? availableProducts : availableGrains;
  };

  /**
   * Check if item type can be changed
   */
  const canChangeItemType = () => {
    // Retail transactions are always product-only
    if (transactionType?.startsWith('RETAIL_')) {
      return false;
    }
    // For some agricultural transactions, both products and grains can be traded
    return ['FARMER_PURCHASE', 'DEALER_PURCHASE'].includes(transactionType);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2">
          <ShoppingCartIcon className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Transaction Items</h3>
            <p className="text-xs text-gray-600">Add multiple items to this transaction</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddLine}
          disabled={disabled || lineItems.length >= 50}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm" style={{maxWidth: '100%'}}>
        <table className="w-full divide-y divide-gray-200" style={{tableLayout: 'fixed', width: '100%'}}>
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '40px'}}>
                #
              </th>
              {canChangeItemType() && (
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '90px'}}>
                  Type
                </th>
              )}
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '25%', minWidth: '200px'}}>
                Item
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '90px'}}>
                Stock
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '100px'}}>
                Quantity
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '60px'}}>
                Unit
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '110px'}}>
                Unit Price
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '130px'}}>
                Discount (%)
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{width: '120px'}}>
                Line Total
              </th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase" style={{width: '50px'}}>
                Del
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lineItems.map((line, index) => (
              <tr key={line.id} className="hover:bg-gray-50">
                <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-500">
                  {index + 1}
                </td>

                {canChangeItemType() && (
                  <td className="px-2 py-2 whitespace-nowrap">
                    <select
                      value={line.item_type}
                      onChange={(e) => handleLineChange(line.id, 'item_type', e.target.value)}
                      disabled={disabled}
                      className="block w-full rounded border-gray-300 text-xs py-1 px-1 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="product">Product</option>
                      <option value="grain">Grain</option>
                    </select>
                  </td>
                )}

                <td className="px-2 py-2">
                  <select
                    value={line.item_reference_id}
                    onChange={(e) => handleLineChange(line.id, 'item_reference_id', e.target.value)}
                    disabled={disabled}
                    className="block w-full rounded border-gray-300 text-xs py-1 px-1 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                    required
                  >
                    <option value="">Select {line.item_type}...</option>
                    {getAvailableItems(line.item_type).map(item => {
                      const id = item.product_id || item.grain_id;
                      const name = item.product_name || item.grain_name;
                      const code = item.product_code || item.grain_code;
                      const stock = item.available_quantity || 0;
                      const unit = item.unit_of_measure || 'units';
                      const stockInfo = stock > 0 ? ` [Stock: ${stock} ${unit}]` : ' [OUT OF STOCK]';
                      return (
                        <option key={id} value={id} title={`${code} - ${name}${stockInfo}`}>
                          {code} - {name}{stockInfo}
                        </option>
                      );
                    })}
                  </select>
                </td>

                <td className="px-2 py-2 whitespace-nowrap text-xs text-center">
                  {line.item_reference_id ? (() => {
                    const item = getAvailableItems(line.item_type).find(i => 
                      (line.item_type === 'product' ? i.product_id : i.grain_id) === parseInt(line.item_reference_id)
                    );
                    const stock = item?.available_quantity || 0;
                    const stockClass = stock > 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold';
                    return <span className={stockClass}>{stock}</span>;
                  })() : <span className="text-gray-400">-</span>}
                </td>

                <td className="px-2 py-2">
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value)}
                    disabled={disabled}
                    className="block w-full rounded border-gray-300 text-xs py-1 px-1 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                  />
                </td>

                <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 font-medium">
                  {line.unit || '-'}
                </td>

                <td className="px-2 py-2">
                  <input
                    type="number"
                    value={line.unit_price}
                    onChange={(e) => handleLineChange(line.id, 'unit_price', e.target.value)}
                    disabled={disabled}
                    className="block w-full rounded border-gray-300 text-xs py-1 px-1 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </td>

                <td className="px-2 py-2">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        value={line.discount_percentage || ''}
                        onChange={(e) => handleLineChange(line.id, 'discount_percentage', e.target.value)}
                        disabled={disabled}
                        className="block w-full rounded border-gray-300 text-xs py-1 px-1 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                      <span className="text-xs text-gray-600 font-bold">%</span>
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      {(parseFloat(line.discount_amount) || 0).toFixed(0)}
                    </div>
                  </div>
                </td>

                <td className="px-2 py-2 whitespace-nowrap text-xs font-bold text-gray-900">
                  {line.line_total.toFixed(0)}
                </td>

                <td className="px-2 py-2 whitespace-nowrap text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(line.id)}
                    disabled={disabled || lineItems.length === 1}
                    className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove item"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Summary */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-3 shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <CalculatorIcon className="w-5 h-5 text-green-600" />
          <h4 className="text-base font-semibold text-gray-900">Transaction Summary</h4>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-white rounded p-2 border border-green-100 shadow-sm">
            <div className="text-xs text-gray-600 mb-0.5">Total Items</div>
            <div className="text-xl font-bold text-gray-900">{lineItems.length}</div>
          </div>

          <div className="bg-white rounded p-2 border border-green-100 shadow-sm">
            <div className="text-xs text-gray-600 mb-0.5">Total Qty</div>
            <div className="text-xl font-bold text-gray-900">{Math.round(totals.totalQuantity)}</div>
          </div>

          <div className="bg-white rounded p-2 border border-green-100 shadow-sm">
            <div className="text-xs text-gray-600 mb-0.5">Subtotal</div>
            <div className="text-xl font-bold text-blue-600">{totals.subtotal.toFixed(0)}</div>
          </div>

          {totals.totalItemDiscount > 0 && (
            <div className="bg-white rounded p-2 border border-orange-100 shadow-sm">
              <div className="text-xs text-gray-600 mb-0.5">Item Disc.</div>
              <div className="text-xl font-bold text-orange-600">-{totals.totalItemDiscount.toFixed(0)}</div>
            </div>
          )}
        </div>

        {/* Overall Discount Section */}
        <div className="bg-white rounded-lg px-3 py-2 border-2 border-purple-300 mb-2 shadow-sm">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-lg">🎁</span>
            <h5 className="text-sm font-bold text-gray-900">Overall Transaction Discount</h5>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Discount Type</label>
              <select
                value={overallDiscountType}
                onChange={(e) => setOverallDiscountType(e.target.value)}
                disabled={disabled}
                className="block w-full rounded border-gray-300 text-xs py-1 px-1 focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="amount">Fixed Amount</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {overallDiscountType === 'percentage' ? 'Percentage' : 'Amount'}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={overallDiscountValue || ''}
                  onChange={(e) => setOverallDiscountValue(e.target.value)}
                  disabled={disabled}
                  className="block w-full rounded border-gray-300 text-xs py-1 px-1 focus:border-purple-500 focus:ring-purple-500 disabled:bg-gray-100"
                  placeholder="0"
                  min="0"
                  max={overallDiscountType === 'percentage' ? 100 : totals.subtotalAfterItemDiscount}
                  step="0.01"
                />
                <span className="text-xs font-bold text-gray-700">
                  {overallDiscountType === 'percentage' ? '%' : 'Rs'}
                </span>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded p-2 border border-purple-200">
              <div className="text-xs text-gray-600 mb-0.5">Discount Amt</div>
              <div className="text-lg font-bold text-purple-600">-{totals.overallDiscount.toFixed(0)}</div>
            </div>
          </div>
          
          {overallDiscountValue > 0 && (
            <div className="mt-1 px-2 py-1 bg-purple-50 rounded border border-purple-200">
              <p className="text-xs text-purple-800">
                💡 Applied after item discounts
              </p>
            </div>
          )}
        </div>

        {/* Final Grand Total */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-white rounded p-2 border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-600 mb-0.5">After Item Disc.</div>
            <div className="text-lg font-bold text-gray-900">{totals.subtotalAfterItemDiscount.toFixed(0)}</div>
          </div>
          
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded px-2 py-2 border border-green-700 shadow-lg">
            <div className="text-xs text-green-100 mb-0.5">Grand Total</div>
            <div className="text-2xl font-bold text-white">Rs. {totals.grandTotal.toFixed(2)}</div>
          </div>
        </div>

        {/* Validation Messages */}
        {lineItems.filter(item => !item.item_reference_id || !item.quantity).length > 0 && (
          <div className="mt-2 px-2 py-1.5 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs text-yellow-800">
              ⚠️ Fill all required fields (Item & Quantity)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiItemTransactionForm;
