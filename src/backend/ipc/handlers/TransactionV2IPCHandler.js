import TransactionServiceV2 from '../../../services/transaction/TransactionServiceV2.js';
import { DatabaseService } from '../../../services/database/DatabaseService.js';
import TransactionEditService from '../../../services/transaction/TransactionEditService.js';

const transactionServiceV2 = new TransactionServiceV2();
const transactionEditService = new TransactionEditService();
const db = DatabaseService.getInstance();

/**
 * Sprint 6 IPC Handlers - Multi-Item Transaction Support
 */
export const registerTransactionV2Handlers = (ipcMain) => {
  console.log('[TransactionV2IPCHandler] Registering Sprint 6 multi-item transaction handlers...');

  /**
   * Create multi-item Farmer Purchase transaction
   * Farmer buys multiple products in one transaction
   */
  ipcMain.handle('transaction:createFarmerPurchaseMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🛒 Farmer Purchase Multi-Item');
      console.log('[TransactionV2IPC] Items:', items.length);

      const result = await transactionServiceV2.createMultiItemTransaction(
        {
          ...transactionData,
          transaction_type: 'FARMER_PURCHASE',
          module: 'farmer'
        },
        items,
        userId
      );

      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Error:', error);
      throw error;
    }
  });

  /**
   * Create multi-item Farmer Sale Grain transaction
   * Farmer sells multiple grain types in one transaction
   */
  ipcMain.handle('transaction:createFarmerSaleMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🌾 Farmer Sale Grain Multi-Item');
      console.log('[TransactionV2IPC] Items:', items.length);

      const result = await transactionServiceV2.createMultiItemTransaction(
        {
          ...transactionData,
          transaction_type: 'FARMER_SALE_GRAIN',
          module: 'farmer'
        },
        items,
        userId
      );

      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Error:', error);
      throw error;
    }
  });

  /**
   * Create multi-item Dealer Purchase transaction (NEW - Sprint 6)
   * Dealer buys multiple grains from shop in one transaction
   */
  ipcMain.handle('transaction:createDealerPurchaseMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🛍️ Dealer Purchase Multi-Item (NEW)');
      console.log('[TransactionV2IPC] Items:', items.length);

      const result = await transactionServiceV2.createMultiItemTransaction(
        {
          ...transactionData,
          transaction_type: 'DEALER_PURCHASE',
          module: 'dealer'
        },
        items,
        userId
      );

      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Error:', error);
      throw error;
    }
  });

  /**
   * Create multi-item Company Delivery transaction (NEW - Sprint 6)
   * Company supplies multiple products to shop in one delivery
   */
  ipcMain.handle('transaction:createCompanyDeliveryMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🚚 Company Delivery Multi-Item (NEW)');
      console.log('[TransactionV2IPC] Items:', items.length);

      const result = await transactionServiceV2.createMultiItemTransaction(
        {
          ...transactionData,
          transaction_type: 'COMPANY_DELIVERY',
          module: 'company'
        },
        items,
        userId
      );

      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Error:', error);
      throw error;
    }
  });

  /**
   * Create Payment Received transaction (NEW - Sprint 6)
   * Record payment from Farmer/Dealer to reduce their credit
   */
  ipcMain.handle('transaction:createPaymentReceived', async (event, { transactionData, userId }) => {
    try {
      console.log('[TransactionV2IPC] 💰 Payment Received (NEW)');
      console.log('[TransactionV2IPC] From:', transactionData.entity_type, transactionData.entity_id);
      console.log('[TransactionV2IPC] Amount:', transactionData.payment_amount);

      const { entity_type, entity_id, payment_amount, payment_method, description } = transactionData;

      // Start transaction
      await db.execute('BEGIN TRANSACTION');

      try {
        // 1. Generate transaction number
        const transactionNumber = await transactionServiceV2.generateTransactionNumber();

        // 2. Get entity info
        const entityInfo = await transactionServiceV2.getEntityInfo(
          entity_type,
          entity_id,
          transactionData.module || 'farmer',
          null
        );

        // 3. Insert payment transaction
        const result = await db.execute(
          `INSERT INTO Transactions (
            transaction_number, transaction_type, transaction_date,
            entity_type, entity_id, entity_table, entity_name,
            item_type, item_id, quantity, unit_price, total_amount,
            payment_type, cash_paid, credit_amount,
            description, created_by
          ) VALUES (?, 'PAYMENT_RECEIVED', datetime('now'), ?, ?, ?, ?, NULL, NULL, 0, 0, ?, 'CASH', ?, 0, ?, ?)`,
          [
            transactionNumber,
            entity_type,
            entity_id,
            entityInfo.entity_table,
            entityInfo.entity_name,
            payment_amount,
            payment_amount,
            description || 'Payment received',
            userId
          ]
        );

        const transactionId = result.lastID;

        // 4. Update entity credit balance
        if (entity_type === 'regular' && entity_id) {
          if (transactionData.module === 'farmer') {
            await db.execute(
              'UPDATE Farmers SET credit = credit - ?, updated_at = CURRENT_TIMESTAMP WHERE farmer_id = ?',
              [payment_amount, entity_id]
            );
          } else if (transactionData.module === 'dealer') {
            await db.execute(
              'UPDATE Dealers SET credit = credit - ?, updated_at = CURRENT_TIMESTAMP WHERE dealer_id = ?',
              [payment_amount, entity_id]
            );
          }
        }

        // 5. Create ledger entry (CREDIT to entity - reduces their debt)
        await db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by
          ) VALUES (?, ?, 'PAYMENT_RECEIVED', ?, 0, ?, 0, ?, ?)`,
          [
            entityInfo.entity_table.toLowerCase().slice(0, -1), // Farmers -> farmer
            entity_id,
            transactionId,
            payment_amount,
            `Payment received - ${entityInfo.entity_name}`,
            userId
          ]
        );

        await db.execute('COMMIT');

        return {
          success: true,
          message: 'Payment recorded successfully',
          data: {
            transaction_id: transactionId,
            transaction_number: transactionNumber,
            entity_name: entityInfo.entity_name,
            payment_amount: payment_amount
          }
        };

      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[TransactionV2IPC] Error:', error);
      throw error;
    }
  });

  /**
   * Create Payment Made transaction (NEW - Sprint 6)
   * Record payment to Company to reduce shop's payable
   */
  ipcMain.handle('transaction:createPaymentMade', async (event, { transactionData, userId }) => {
    try {
      console.log('[TransactionV2IPC] 💸 Payment Made (NEW)');
      console.log('[TransactionV2IPC] To Company:', transactionData.entity_id);
      console.log('[TransactionV2IPC] Amount:', transactionData.payment_amount);

      const { entity_id, payment_amount, payment_method, description } = transactionData;

      await db.execute('BEGIN TRANSACTION');

      try {
        const transactionNumber = await transactionServiceV2.generateTransactionNumber();

        const company = await db.query('SELECT company_name FROM Companies WHERE company_id = ?', [entity_id]);
        if (company.length === 0) throw new Error('Company not found');

        const result = await db.execute(
          `INSERT INTO Transactions (
            transaction_number, transaction_type, transaction_date,
            entity_type, entity_id, entity_table, entity_name,
            item_type, item_id, quantity, unit_price, total_amount,
            payment_type, cash_paid, credit_amount,
            description, created_by
          ) VALUES (?, 'PAYMENT_MADE', datetime('now'), 'regular', ?, 'Companies', ?, NULL, NULL, 0, 0, ?, 'CASH', ?, 0, ?, ?)`,
          [
            transactionNumber,
            entity_id,
            company[0].company_name,
            payment_amount,
            payment_amount,
            description || 'Payment made to company',
            userId
          ]
        );

        const transactionId = result.lastID;

        // Update company balance (reduce shop's payable)
        await db.execute(
          'UPDATE Companies SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?',
          [payment_amount, entity_id]
        );

        // Create ledger entry
        await db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by
          ) VALUES ('company', ?, 'PAYMENT_MADE', ?, ?, 0, 0, ?, ?)`,
          [
            entity_id,
            transactionId,
            payment_amount,
            `Payment made to ${company[0].company_name}`,
            userId
          ]
        );

        await db.execute('COMMIT');

        return {
          success: true,
          message: 'Payment recorded successfully',
          data: {
            transaction_id: transactionId,
            transaction_number: transactionNumber,
            company_name: company[0].company_name,
            payment_amount: payment_amount
          }
        };

      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[TransactionV2IPC] Error:', error);
      throw error;
    }
  });

  /**
   * Get transaction with all line items
   */
  ipcMain.handle('transaction:getByIdWithItems', async (event, transactionId) => {
    try {
      const transaction = await transactionServiceV2.getTransactionById(transactionId);
      return transaction;
    } catch (error) {
      console.error('[TransactionV2IPC] Error getting transaction:', error);
      throw error;
    }
  });

  /**
   * Get all transactions with items count
   */
  ipcMain.handle('transaction:getAllWithItemsCount', async (event, filters) => {
    try {
      const transactions = await transactionServiceV2.getAllTransactions(filters);
      return transactions;
    } catch (error) {
      console.error('[TransactionV2IPC] Error getting transactions:', error);
      throw error;
    }
  });

  /**
   * Migrate existing transactions to TransactionItems
   */
  ipcMain.handle('transaction:migrateToMultiItem', async (event) => {
    try {
      const result = await db.migrateExistingTransactions();
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Migration error:', error);
      throw error;
    }
  });

  /**
   * Edit transaction (supports both single-item and multi-item)
   */
  ipcMain.handle('transaction:editMultiItem', async (event, { transactionId, updateData, userId }) => {
    try {
      console.log('[TransactionV2IPC] Editing transaction:', transactionId);
      const result = await transactionEditService.editTransaction(transactionId, updateData, userId);
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Edit error:', error);
      throw error;
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // RETAIL INDUSTRY TRANSACTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create multi-item Retail Sale transaction
   * Customer buys products from shop — stock OUT
   */
  ipcMain.handle('transaction:createRetailSaleMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🏪 Retail Sale Multi-Item');
      const result = await transactionServiceV2.createMultiItemTransaction(
        { ...transactionData, transaction_type: 'RETAIL_SALE', module: 'farmer' },
        items, userId
      );
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Retail Sale error:', error);
      throw error;
    }
  });

  /**
   * Create multi-item Retail Purchase transaction
   * Supplier delivers products to shop — stock IN
   */
  ipcMain.handle('transaction:createRetailPurchaseMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🏪 Retail Purchase Multi-Item');
      const result = await transactionServiceV2.createMultiItemTransaction(
        { ...transactionData, transaction_type: 'RETAIL_PURCHASE', module: 'company' },
        items, userId
      );
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Retail Purchase error:', error);
      throw error;
    }
  });

  /**
   * Create multi-item Retail Distributor Purchase transaction
   * Distributor delivers products to shop — stock IN
   */
  ipcMain.handle('transaction:createRetailDistributorPurchaseMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🏪 Retail Distributor Purchase Multi-Item');
      const result = await transactionServiceV2.createMultiItemTransaction(
        { ...transactionData, transaction_type: 'RETAIL_DISTRIBUTOR_PURCHASE', module: 'dealer' },
        items, userId
      );
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Retail Distributor Purchase error:', error);
      throw error;
    }
  });

  /**
   * Create multi-item Retail Return In (Customer Return) transaction
   * Customer returns product — stock IN, reduces customer credit
   */
  ipcMain.handle('transaction:createRetailReturnInMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🏪 Retail Return In (Customer Return)');
      const result = await transactionServiceV2.createMultiItemTransaction(
        { ...transactionData, transaction_type: 'RETAIL_RETURN_IN', module: 'farmer' },
        items, userId
      );
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Retail Return In error:', error);
      throw error;
    }
  });

  /**
   * Create multi-item Retail Return Out (Return to Supplier) transaction
   * Shop returns product to supplier — stock OUT, reduces shop payable
   */
  ipcMain.handle('transaction:createRetailReturnOutMulti', async (event, { transactionData, items, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🏪 Retail Return Out (To Supplier)');
      const result = await transactionServiceV2.createMultiItemTransaction(
        { ...transactionData, transaction_type: 'RETAIL_RETURN_OUT', module: 'company' },
        items, userId
      );
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Retail Return Out error:', error);
      throw error;
    }
  });

  /**
   * Create professional linked return transaction (Sprint 6/17)
   * Supports partial returns, tracks original quantities, updates stock/balance
   */
  ipcMain.handle('transaction:createReturnMulti', async (event, { originalTransactionId, returnItems, returnMetadata, userId }) => {
    try {
      console.log('[TransactionV2IPC] 🔄 Creating Linked Return for TXN:', originalTransactionId);
      const result = await transactionServiceV2.createReturnTransaction(
        originalTransactionId,
        returnItems,
        returnMetadata,
        userId
      );
      return result;
    } catch (error) {
      console.error('[TransactionV2IPC] Return error:', error);
      throw error;
    }
  });

  console.log('[TransactionV2IPCHandler] ✅ All transaction handlers registered (Agricultural + Retail)');
};
