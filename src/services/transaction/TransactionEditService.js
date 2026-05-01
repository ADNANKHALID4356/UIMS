import { DatabaseService } from '../database/DatabaseService.js';

/**
 * TransactionEditService - Handles editing of transactions
 * Supports both single-item and multi-item transactions
 * Automatically updates stock, ledger, and entity balances
 * 
 * All stock operations use synchronous better-sqlite3 calls directly
 * (bypassing the async StockService) to ensure correct execution
 * inside synchronous db.transaction() blocks.
 */
class TransactionEditService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Normalize entity_table to plural form
   * v1 TransactionService stored singular ('Farmer', 'Dealer', 'Company')
   * v2 TransactionServiceV2 stores plural ('Farmers', 'Dealers', 'Companies')
   * This helper ensures consistent lookup regardless of source version.
   */
  normalizeEntityTable(entityTable) {
    if (!entityTable) return entityTable;
    const lower = entityTable.toLowerCase();
    if (lower === 'farmer' || lower === 'farmers') return 'Farmers';
    if (lower === 'dealer' || lower === 'dealers') return 'Dealers';
    if (lower === 'company' || lower === 'companies') return 'Companies';
    return entityTable;
  }

  /**
   * Edit Multi-Item Transaction
   * Supports editing both single-item and multi-item transactions
   * Automatically updates stock, ledger, and entity balances
   */
  async editTransaction(transactionId, updateData, userId) {
    try {
      console.log('[TransactionEditService] ==================== EDIT TRANSACTION ====================');
      console.log('[TransactionEditService] Transaction ID:', transactionId);
      console.log('[TransactionEditService] Update Data:', JSON.stringify(updateData, null, 2));

      // Step 1: Get original transaction with all items
      const originalTransaction = await this.getTransactionById(transactionId);
      if (!originalTransaction) {
        return { success: false, message: 'Transaction not found' };
      }

      console.log('[TransactionEditService] Original Transaction loaded');

      // Step 2: Begin database transaction
      const dbTransaction = this.db.db.transaction(() => {
        // Step 2a: Reverse original stock changes
        console.log('[TransactionEditService] Reversing original stock changes...');
        if (originalTransaction.items && originalTransaction.items.length > 0) {
          // Multi-item transaction
          for (const item of originalTransaction.items) {
            this.reverseStockForItem(item, originalTransaction.transaction_type, userId);
          }
        } else {
          // Single-item legacy transaction
          this.reverseStockForTransaction(originalTransaction, userId);
        }

        // Step 2b: Reverse original ledger entry
        console.log('[TransactionEditService] Reversing ledger entry...');
        const originalCreditAmount = originalTransaction.credit_amount || 0;
        if (originalTransaction.entity_id && originalCreditAmount > 0) {
          console.log('[TransactionEditService] Reversing ledger for entity:', originalTransaction.entity_name, 'Amount:', originalCreditAmount);
          this.reverseLedgerEntry(originalTransaction, userId);
        }

        // Step 3: Update transaction header
        console.log('[TransactionEditService] Updating transaction header...');
        
        const newTotalAmount = updateData.total_amount || originalTransaction.total_amount;
        const newPaymentType = updateData.payment_type || originalTransaction.payment_type;
        
        let newCashPaid = 0;
        let newCreditAmount = 0;
        
        if (newPaymentType === 'CASH') {
          newCashPaid = newTotalAmount;
          newCreditAmount = 0;
        } else if (newPaymentType === 'CREDIT') {
          newCashPaid = 0;
          newCreditAmount = newTotalAmount;
        } else if (newPaymentType === 'PARTIAL') {
          newCashPaid = updateData.cash_paid || 0;
          newCreditAmount = Math.max(0, newTotalAmount - newCashPaid);
        }

        this.db.db.prepare(
          `UPDATE Transactions SET
            total_amount = ?,
            overall_discount_type = ?,
            overall_discount_value = ?,
            overall_discount_amount = ?,
            payment_type = ?,
            cash_paid = ?,
            credit_amount = ?,
            description = ?
          WHERE transaction_id = ?`
        ).run(
          newTotalAmount,
          updateData.overall_discount_type || originalTransaction.overall_discount_type || 'amount',
          updateData.overall_discount_value || originalTransaction.overall_discount_value || 0,
          updateData.overall_discount_amount || originalTransaction.overall_discount_amount || 0,
          newPaymentType,
          newCashPaid,
          newCreditAmount,
          updateData.description !== undefined ? updateData.description : originalTransaction.description,
          transactionId
        );

        // Step 4: Update transaction items
        if (updateData.items && updateData.items.length > 0) {
          console.log('[TransactionEditService] Updating transaction items...');
          
          // Delete old items
          this.db.db.prepare('DELETE FROM TransactionItems WHERE transaction_id = ?').run(transactionId);
          
          // Insert updated items
          let lineNumber = 1;
          for (const item of updateData.items) {
            const lineTotal = (item.quantity * item.unit_price) - (item.discount_amount || 0);
            
            this.db.db.prepare(
              `INSERT INTO TransactionItems (
                transaction_id, line_number, item_type, item_reference_id,
                item_name, item_code, quantity, unit, unit_price,
                discount_amount, line_total, line_final_total, description
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              transactionId,
              lineNumber++,
              item.item_type.toLowerCase(), // Convert to lowercase for database constraint
              item.item_reference_id,
              item.item_name || '',
              item.item_code || '',
              item.quantity,
              item.unit || '',
              item.unit_price,
              item.discount_amount || 0,
              item.quantity * item.unit_price,
              lineTotal,
              item.description || null
            );

            // Apply new stock changes for this item
            this.applyStockForItem(
              item,
              originalTransaction.transaction_type,
              transactionId,
              originalTransaction.entity_name,
              userId
            );
          }
        }

        // Step 5: Apply new ledger entry
        console.log('[TransactionEditService] Creating new ledger entry...');
        console.log('[TransactionEditService] New credit amount:', newCreditAmount);
        console.log('[TransactionEditService] Entity table:', originalTransaction.entity_table);
        console.log('[TransactionEditService] Entity ID:', originalTransaction.entity_id);
        
        if (originalTransaction.entity_id && newCreditAmount > 0) {
          console.log('[TransactionEditService] Creating ledger entry for:', originalTransaction.entity_name, 'Amount:', newCreditAmount);
          this.createLedgerEntry(
            originalTransaction.entity_table,
            originalTransaction.entity_id,
            originalTransaction.transaction_type,
            newCreditAmount,
            transactionId,
            userId,
            `Updated: ${originalTransaction.transaction_number}`
          );
        } else {
          console.log('[TransactionEditService] Skipping ledger entry - no credit amount');
        }

        // Step 6: Log to history
        this.db.db.prepare(
          `INSERT INTO History (
            action_type, table_name, record_id, old_values, new_values,
            performed_by, performed_at, description
          ) VALUES ('UPDATE', 'Transactions', ?, ?, ?, ?, datetime('now'), ?)`
        ).run(
          transactionId,
          JSON.stringify(originalTransaction),
          JSON.stringify(updateData),
          userId,
          `Transaction ${originalTransaction.transaction_number} edited`
        );

        console.log('[TransactionEditService] ✅ Transaction edited successfully');
      });

      // Execute the transaction
      dbTransaction();

      return {
        success: true,
        message: `Transaction ${originalTransaction.transaction_number} updated successfully`,
        transaction_id: transactionId
      };

    } catch (error) {
      console.error('[TransactionEditService] ❌ Edit error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get transaction by ID with items
   */
  async getTransactionById(transactionId) {
    const transactions = this.db.db.prepare(
      `SELECT 
        t.*,
        f.name as farmer_name,
        d.name as dealer_name,
        c.company_name
      FROM Transactions t
      LEFT JOIN Farmers f ON LOWER(t.entity_table) IN ('farmer', 'farmers') AND t.entity_id = f.farmer_id
      LEFT JOIN Dealers d ON LOWER(t.entity_table) IN ('dealer', 'dealers') AND t.entity_id = d.dealer_id
      LEFT JOIN Companies c ON LOWER(t.entity_table) IN ('company', 'companies') AND t.entity_id = c.company_id
      WHERE t.transaction_id = ?`
    ).all(transactionId);

    if (transactions.length === 0) {
      return null;
    }

    const transaction = transactions[0];
    // Normalize entity_table to plural form for consistent downstream processing
    transaction.entity_table = this.normalizeEntityTable(transaction.entity_table);

    // Get transaction items
    const items = this.db.db.prepare(
      `SELECT * FROM TransactionItems 
       WHERE transaction_id = ? 
       ORDER BY line_number`
    ).all(transactionId);

    return {
      ...transaction,
      items: items
    };
  }

  /**
   * Helper: Reverse stock for a single item (SYNCHRONOUS - safe inside db.transaction)
   * Uses direct db.prepare() calls instead of async StockService to avoid
   * microtask deferral that causes stale-data overwrites.
   */
  reverseStockForItem(item, transactionType, userId) {
    const itemType = item.item_type?.toUpperCase() || 'PRODUCT';
    const quantity = parseFloat(item.quantity) || 0;
    if (quantity <= 0) return;

    const stockInTypes = ['COMPANY_DELIVERY', 'FARMER_SALE_GRAIN', 'RETAIL_PURCHASE', 'RETAIL_DISTRIBUTOR_PURCHASE', 'RETAIL_RETURN_IN'];
    const stockOutTypes = ['FARMER_PURCHASE', 'DEALER_PURCHASE', 'RETAIL_SALE', 'RETAIL_RETURN_OUT'];

    if (stockInTypes.includes(transactionType)) {
      // Original was stock IN → reverse by removing stock (FIFO)
      this._syncRemoveStock(itemType, item.item_reference_id, quantity, 'TRANSACTION_EDIT_REVERSE', item.transaction_id, `Reversing IN: ${transactionType}`, userId);
    } else if (stockOutTypes.includes(transactionType)) {
      // Original was stock OUT → reverse by adding stock back
      this._syncAddStock(itemType, item.item_reference_id, quantity, item.unit_price, 'TRANSACTION_EDIT_REVERSE', item.transaction_id, `Reversing OUT: ${transactionType}`, userId);
    }
  }

  /**
   * Helper: Reverse stock for legacy single-item transaction (SYNCHRONOUS)
   */
  reverseStockForTransaction(transaction, userId) {
    const itemType = transaction.item_type?.toUpperCase() || 'PRODUCT';
    const quantity = parseFloat(transaction.quantity) || 0;
    if (quantity <= 0) return;

    const stockInTypes = ['COMPANY_DELIVERY', 'FARMER_SALE_GRAIN', 'RETAIL_PURCHASE', 'RETAIL_DISTRIBUTOR_PURCHASE', 'RETAIL_RETURN_IN'];
    const stockOutTypes = ['FARMER_PURCHASE', 'DEALER_PURCHASE', 'RETAIL_SALE', 'RETAIL_RETURN_OUT'];

    if (stockInTypes.includes(transaction.transaction_type)) {
      this._syncRemoveStock(itemType, transaction.item_id, quantity, 'TRANSACTION_EDIT_REVERSE', transaction.transaction_id, `Reversing IN: ${transaction.transaction_type}`, userId);
    } else if (stockOutTypes.includes(transaction.transaction_type)) {
      this._syncAddStock(itemType, transaction.item_id, quantity, transaction.unit_price, 'TRANSACTION_EDIT_REVERSE', transaction.transaction_id, `Reversing OUT: ${transaction.transaction_type}`, userId);
    }
  }

  /**
   * Helper: Apply stock for a single item (SYNCHRONOUS - safe inside db.transaction)
   */
  applyStockForItem(item, transactionType, transactionId, entityName, userId) {
    const itemType = item.item_type?.toUpperCase() || 'PRODUCT';
    const quantity = parseFloat(item.quantity) || 0;
    if (quantity <= 0) return;

    const stockInTypes = ['COMPANY_DELIVERY', 'FARMER_SALE_GRAIN', 'RETAIL_PURCHASE', 'RETAIL_DISTRIBUTOR_PURCHASE', 'RETAIL_RETURN_IN'];
    const stockOutTypes = ['FARMER_PURCHASE', 'DEALER_PURCHASE', 'RETAIL_SALE', 'RETAIL_RETURN_OUT'];

    if (stockInTypes.includes(transactionType)) {
      this._syncAddStock(itemType, item.item_reference_id, quantity, item.unit_price, 'TRANSACTION', transactionId, `${transactionType} - ${entityName}`, userId);
    } else if (stockOutTypes.includes(transactionType)) {
      this._syncRemoveStock(itemType, item.item_reference_id, quantity, 'TRANSACTION', transactionId, `${transactionType} - ${entityName}`, userId);
    }
  }

  /**
   * Synchronous stock addition — bypasses async StockService.
   * Finds or creates a stock batch at the given price, increments quantity,
   * and records a stock movement. All via synchronous better-sqlite3 calls.
   */
  _syncAddStock(itemType, itemId, quantity, unitPrice, refType, refId, notes, userId) {
    const qty = parseFloat(quantity);
    const price = parseFloat(unitPrice) || 0;

    // Find existing batch at this price
    let stock = this.db.db.prepare(
      'SELECT * FROM Stock WHERE item_type = ? AND item_id = ? AND unit_price = ?'
    ).get(itemType, itemId, price);

    if (!stock) {
      // Create new batch
      const batchRef = `${itemType}-${itemId}-${Date.now()}`;
      this.db.db.prepare(
        'INSERT INTO Stock (item_type, item_id, quantity, unit_price, batch_reference, stock_location) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(itemType, itemId, qty, price, batchRef, 'Main Warehouse');

      stock = this.db.db.prepare(
        'SELECT * FROM Stock WHERE item_type = ? AND item_id = ? AND unit_price = ?'
      ).get(itemType, itemId, price);

      this.db.db.prepare(
        `INSERT INTO StockMovements (stock_id, movement_type, movement_reason, quantity, unit_price, reference_type, reference_id, previous_quantity, new_quantity, notes, created_by)
         VALUES (?, 'IN', 'EDIT_REVERSAL', ?, ?, ?, ?, 0, ?, ?, ?)`
      ).run(stock.stock_id, qty, price, refType, refId, qty, notes, userId);

      console.log(`[TransactionEditService] _syncAddStock: NEW batch created, qty=${qty}`);
    } else {
      const prevQty = parseFloat(stock.quantity);
      const newQty = prevQty + qty;

      this.db.db.prepare(
        'UPDATE Stock SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE stock_id = ?'
      ).run(newQty, stock.stock_id);

      this.db.db.prepare(
        `INSERT INTO StockMovements (stock_id, movement_type, movement_reason, quantity, unit_price, reference_type, reference_id, previous_quantity, new_quantity, notes, created_by)
         VALUES (?, 'IN', 'EDIT_REVERSAL', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(stock.stock_id, qty, price, refType, refId, prevQty, newQty, notes, userId);

      console.log(`[TransactionEditService] _syncAddStock: Updated batch ${stock.stock_id}, ${prevQty} → ${newQty}`);
    }
  }

  /**
   * Synchronous stock removal (FIFO) — bypasses async StockService.
   * Finds batches with quantity > 0 ordered oldest first, deducts using FIFO,
   * and records stock movements. All synchronous.
   */
  _syncRemoveStock(itemType, itemId, quantity, refType, refId, notes, userId) {
    let remaining = parseFloat(quantity);

    // Get batches FIFO (oldest first) with quantity > 0
    const batches = this.db.db.prepare(
      'SELECT * FROM Stock WHERE item_type = ? AND item_id = ? AND quantity > 0 ORDER BY created_at ASC'
    ).all(itemType, itemId);

    if (batches.length === 0) {
      console.warn(`[TransactionEditService] _syncRemoveStock: No stock batches found for ${itemType}/${itemId}. Creating negative batch.`);
      // Allow negative stock for edit reversals — create a batch with negative quantity
      const batchRef = `${itemType}-${itemId}-NEG-${Date.now()}`;
      this.db.db.prepare(
        'INSERT INTO Stock (item_type, item_id, quantity, unit_price, batch_reference, stock_location) VALUES (?, ?, ?, 0, ?, ?)'
      ).run(itemType, itemId, -remaining, batchRef, 'Main Warehouse');
      return;
    }

    for (const batch of batches) {
      if (remaining <= 0) break;
      const batchQty = parseFloat(batch.quantity);
      const toRemove = Math.min(remaining, batchQty);
      const newQty = batchQty - toRemove;

      this.db.db.prepare(
        'UPDATE Stock SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE stock_id = ?'
      ).run(newQty, batch.stock_id);

      this.db.db.prepare(
        `INSERT INTO StockMovements (stock_id, movement_type, movement_reason, quantity, unit_price, reference_type, reference_id, previous_quantity, new_quantity, notes, created_by)
         VALUES (?, 'OUT', 'EDIT_REAPPLY', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(batch.stock_id, toRemove, batch.unit_price, refType, refId, batchQty, newQty, notes, userId);

      remaining -= toRemove;
    }

    if (remaining > 0) {
      console.warn(`[TransactionEditService] _syncRemoveStock: Insufficient stock, ${remaining} units short for ${itemType}/${itemId}`);
    }

    console.log(`[TransactionEditService] _syncRemoveStock: Removed ${parseFloat(quantity) - remaining} of ${quantity} from ${itemType}/${itemId}`);
  }

  /**
   * Helper: Reverse ledger entry
   */
  reverseLedgerEntry(transaction, userId) {
    const creditAmount = parseFloat(transaction.credit_amount) || 0;
    if (creditAmount <= 0) return;

    const entityTable = this.normalizeEntityTable(transaction.entity_table);
    const entityId = transaction.entity_id;

    const entityOwesShop = ['FARMER_PURCHASE', 'DEALER_PURCHASE', 'RETAIL_SALE'];
    const shopOwesEntity = ['FARMER_SALE_GRAIN', 'COMPANY_DELIVERY', 'RETAIL_PURCHASE', 'RETAIL_DISTRIBUTOR_PURCHASE'];
    const returnReducesEntityDebt = ['RETAIL_RETURN_IN'];
    const returnReducesShopDebt = ['RETAIL_RETURN_OUT'];

    if (entityOwesShop.includes(transaction.transaction_type)) {
      if (entityTable === 'Farmers') {
        this.db.db.prepare(
          'UPDATE Farmers SET credit = credit - ? WHERE farmer_id = ?'
        ).run(creditAmount, entityId);
      } else if (entityTable === 'Dealers') {
        this.db.db.prepare(
          'UPDATE Dealers SET credit = credit - ? WHERE dealer_id = ?'
        ).run(creditAmount, entityId);
      }
    } else if (shopOwesEntity.includes(transaction.transaction_type)) {
      if (entityTable === 'Farmers') {
        this.db.db.prepare(
          'UPDATE Farmers SET balance = balance - ? WHERE farmer_id = ?'
        ).run(creditAmount, entityId);
      } else if (entityTable === 'Companies') {
        this.db.db.prepare(
          'UPDATE Companies SET balance = balance - ? WHERE company_id = ?'
        ).run(creditAmount, entityId);
      } else if (entityTable === 'Dealers') {
        this.db.db.prepare(
          'UPDATE Dealers SET credit = credit - ? WHERE dealer_id = ?'
        ).run(creditAmount, entityId);
      }
    } else if (returnReducesEntityDebt.includes(transaction.transaction_type)) {
      // Reverse of return: re-add what was reduced
      if (entityTable === 'Farmers') {
        this.db.db.prepare(
          'UPDATE Farmers SET credit = credit + ? WHERE farmer_id = ?'
        ).run(creditAmount, entityId);
      }
    } else if (returnReducesShopDebt.includes(transaction.transaction_type)) {
      if (entityTable === 'Companies') {
        this.db.db.prepare(
          'UPDATE Companies SET balance = balance + ? WHERE company_id = ?'
        ).run(creditAmount, entityId);
      }
    }

    const currentBalance = this.getCurrentBalance(entityTable, entityId);
    
    this.db.db.prepare(
      `INSERT INTO LedgerEntries (
        entity_type, entity_id, transaction_id, transaction_type,
        description, debit, credit, balance, entry_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    ).run(
      entityTable.toUpperCase(),
      entityId,
      transaction.transaction_id,
      transaction.transaction_type,
      `Reversal: ${transaction.transaction_number}`,
      shopOwesEntity.includes(transaction.transaction_type) ? creditAmount : 0,
      entityOwesShop.includes(transaction.transaction_type) ? creditAmount : 0,
      currentBalance,
      userId
    );
  }

  /**
   * Helper: Create new ledger entry
   */
  createLedgerEntry(entityTable, entityId, transactionType, creditAmount, transactionId, userId, description) {
    const normalizedTable = this.normalizeEntityTable(entityTable);
    const entityOwesShop = ['FARMER_PURCHASE', 'DEALER_PURCHASE', 'RETAIL_SALE'];
    const shopOwesEntity = ['FARMER_SALE_GRAIN', 'COMPANY_DELIVERY', 'RETAIL_PURCHASE', 'RETAIL_DISTRIBUTOR_PURCHASE'];
    const returnReducesEntityDebt = ['RETAIL_RETURN_IN'];
    const returnReducesShopDebt = ['RETAIL_RETURN_OUT'];

    if (entityOwesShop.includes(transactionType)) {
      if (normalizedTable === 'Farmers') {
        this.db.db.prepare(
          'UPDATE Farmers SET credit = credit + ? WHERE farmer_id = ?'
        ).run(creditAmount, entityId);
      } else if (normalizedTable === 'Dealers') {
        this.db.db.prepare(
          'UPDATE Dealers SET credit = credit + ? WHERE dealer_id = ?'
        ).run(creditAmount, entityId);
      }
    } else if (shopOwesEntity.includes(transactionType)) {
      if (normalizedTable === 'Farmers') {
        this.db.db.prepare(
          'UPDATE Farmers SET balance = balance + ? WHERE farmer_id = ?'
        ).run(creditAmount, entityId);
      } else if (normalizedTable === 'Companies') {
        this.db.db.prepare(
          'UPDATE Companies SET balance = balance + ? WHERE company_id = ?'
        ).run(creditAmount, entityId);
      } else if (normalizedTable === 'Dealers') {
        this.db.db.prepare(
          'UPDATE Dealers SET credit = credit + ? WHERE dealer_id = ?'
        ).run(creditAmount, entityId);
      }
    } else if (returnReducesEntityDebt.includes(transactionType)) {
      if (normalizedTable === 'Farmers') {
        this.db.db.prepare(
          'UPDATE Farmers SET credit = CASE WHEN credit >= ? THEN credit - ? ELSE 0 END WHERE farmer_id = ?'
        ).run(creditAmount, creditAmount, entityId);
      }
    } else if (returnReducesShopDebt.includes(transactionType)) {
      if (normalizedTable === 'Companies') {
        this.db.db.prepare(
          'UPDATE Companies SET balance = CASE WHEN balance >= ? THEN balance - ? ELSE 0 END WHERE company_id = ?'
        ).run(creditAmount, creditAmount, entityId);
      }
    }

    const currentBalance = this.getCurrentBalance(normalizedTable, entityId);
    
    this.db.db.prepare(
      `INSERT INTO LedgerEntries (
        entity_type, entity_id, transaction_id, transaction_type,
        description, debit, credit, balance, entry_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    ).run(
      normalizedTable.toUpperCase(),
      entityId,
      transactionId,
      transactionType,
      description,
      entityOwesShop.includes(transactionType) ? creditAmount : 0,
      shopOwesEntity.includes(transactionType) ? creditAmount : 0,
      currentBalance,
      userId
    );
  }

  /**
   * Helper: Get current balance for entity
   */
  getCurrentBalance(entityTable, entityId) {
    let balance = 0;
    const normalized = this.normalizeEntityTable(entityTable);
    
    if (normalized === 'Farmers') {
      const result = this.db.db.prepare('SELECT balance, credit FROM Farmers WHERE farmer_id = ?').get(entityId);
      if (result) {
        balance = (result.balance || 0) - (result.credit || 0);
      }
    } else if (normalized === 'Dealers') {
      const result = this.db.db.prepare('SELECT credit FROM Dealers WHERE dealer_id = ?').get(entityId);
      if (result) {
        balance = -(result.credit || 0);
      }
    } else if (normalized === 'Companies') {
      const result = this.db.db.prepare('SELECT balance FROM Companies WHERE company_id = ?').get(entityId);
      if (result) {
        balance = result.balance || 0;
      }
    }
    
    return balance;
  }
}

export default TransactionEditService;
