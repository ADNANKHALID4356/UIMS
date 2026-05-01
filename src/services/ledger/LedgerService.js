import { DatabaseService } from '../database/DatabaseService.js';

/**
 * LedgerService - Professional Ledger Management System
 * ========================================================
 * 
 * ENTITY-SPECIFIC LEDGER TRACKING SYSTEM
 * 
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           FARMER LEDGER MODEL                                  ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║ cash_received = Amount farmer has PAID to shop (cash payments)                ║
 * ║ credit        = Amount farmer OWES shop (unpaid purchases = loan)             ║
 * ║ total         = cash_received + credit (total transaction value)              ║
 * ║                                                                                ║
 * ║ Payment Recording: Farmer pays → +cash_received, -credit                       ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                        DEALER LEDGER MODEL                                     ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║ cash_paid = Amount shop has PAID to dealer                                     ║
 * ║ credit    = Amount shop OWES dealer (pending payment)                          ║
 * ║ total     = cash_paid + credit (total transaction value)                       ║
 * ║                                                                                ║
 * ║ Payment Recording: Shop pays dealer → +cash_paid, -credit                      ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                       COMPANY LEDGER MODEL                                     ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║ cash_paid = Amount shop has PAID to company                                    ║
 * ║ credit    = Amount shop OWES company (pending payment)                         ║
 * ║ total     = cash_paid + credit (total transaction value)                       ║
 * ║                                                                                ║
 * ║ Payment Recording: Shop pays company → +cash_paid, -credit                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * DATABASE FIELDS MAPPING:
 * - `credit` field in entity tables = Outstanding amount (what is owed)
 * - `balance` field in entity tables = Accumulated cash payments made/received
 * 
 * TRANSACTION FLOW:
 * ┌─────────────────────┬──────────────────────────────────────────────────────────────────┐
 * │ Farmer Purchase     │ Farmer buys products → cash_paid goes to cash_received          │
 * │                     │ credit_amount goes to farmer's credit (loan)                     │
 * ├─────────────────────┼──────────────────────────────────────────────────────────────────┤
 * │ Dealer Sale         │ Shop sells grain to dealer → cash_paid from dealer               │
 * │                     │ credit_amount = what dealer owes shop (treated like farmer)      │
 * ├─────────────────────┼──────────────────────────────────────────────────────────────────┤
 * │ Company Delivery    │ Company delivers products → shop owes company                    │
 * │                     │ credit_amount goes to company's credit (shop's liability)        │
 * └─────────────────────┴──────────────────────────────────────────────────────────────────┘
 */
class LedgerService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Helper to normalize entity types from frontend aliases to backend tables
   */
  _normalizeEntityType(entityType) {
    if (!entityType) return null;
    const lower = entityType.toLowerCase();
    if (lower === 'customer' || lower === 'patient' || lower === 'client') return 'farmer';
    if (lower === 'distributor' || lower === 'agent') return 'dealer';
    if (lower === 'supplier' || lower === 'owner') return 'company';
    return lower;
  }

  /**
   * Get entity table name based on entity type (for database table queries)
   */
  getEntityTableName(entityType) {
    if (!entityType) return null;
    const type = this._normalizeEntityType(entityType);
    switch (type) {
      case 'farmer':
        return 'Farmers';
      case 'dealer':
        return 'Dealers';
      case 'company':
        return 'Companies';
      default: return null;
    }
  }

  /**
   * Get all possible entity_table values that might be stored in Transactions
   * The system uses inconsistent naming, so we check all variations
   */
  getEntityTableVariations(entityType) {
    const type = this._normalizeEntityType(entityType);
    switch (type) {
      case 'farmer': return ['Farmer', 'Farmers', 'farmer', 'farmers', 'Customer', 'customer', 'Patient', 'patient', 'Client', 'client'];
      case 'dealer': return ['Dealer', 'Dealers', 'dealer', 'dealers', 'Distributor', 'distributor', 'Agent', 'agent'];
      case 'company': return ['Company', 'Companies', 'company', 'companies', 'Supplier', 'supplier', 'Owner', 'owner'];
      default: return [];
    }
  }

  /**
   * Get entity details with CALCULATED balance from transactions
   * This calculates the REAL balance from actual transactions, not the stale DB value
   */
  /**
   * Get entity details with CALCULATED ledger values
   * 
   * Returns entity-specific ledger data:
   * - FARMER: cash_received (paid to shop), credit (owes shop), total
   * - DEALER: cash_paid (shop paid), credit (shop owes), total
   * - COMPANY: cash_paid (shop paid), credit (shop owes), total
   */
  async getEntityDetails(entityType, entityId) {
    try {
      let query;
      const type = this._normalizeEntityType(entityType);
      
      switch (type) {
        case 'farmer':
          query = `SELECT farmer_id as id, specific_id, name, father_name, cnic, phone, address, account_balance, is_active, created_at FROM Farmers WHERE farmer_id = ?`;
          break;
        case 'dealer':
          query = `SELECT dealer_id as id, specific_id, name, contact_person, cnic, phone, address, account_balance, is_active, created_at FROM Dealers WHERE dealer_id = ?`;
          break;
        case 'company':
          query = `SELECT company_id as id, specific_id, company_name as name, contact_person, phone, address, account_balance, is_active, created_at FROM Companies WHERE company_id = ?`;
          break;
        default:
          throw new Error(`Invalid entity type: ${entityType}`);
      }

      const result = await this.db.query(query, [entityId]);
      
      if (result.length === 0) {
        return { success: false, message: 'Entity not found' };
      }

      const entity = result[0];
      const accountBalance = parseFloat(entity.account_balance) || 0;
      
      return {
        success: true,
        data: {
          ...entity,
          entity_type: entityType,
          // User Model (Professional Alignment):
          // Positive (+) = Advance (Shop owes them)
          // Negative (-) = Loan (Entity owes shop)
          account_balance: accountBalance,
          is_advance: accountBalance > 0,
          is_loan: accountBalance < 0,
          net_position_label: accountBalance > 0 ? 'Advance (Shop owes them)' : (accountBalance < 0 ? 'Loan (They owe shop)' : 'Settled'),
          // Helpers for UI cards
          advance_amount: accountBalance > 0 ? accountBalance : 0,
          loan_amount: accountBalance < 0 ? Math.abs(accountBalance) : 0
        }
      };
    } catch (error) {
      console.error('[LedgerService] Error getting entity details:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Calculate entity ledger totals from all transactions
   * 
   * FARMER MODEL:
   *   - cash_received = SUM of cash_paid from farmer's purchase transactions + payments received
   *   - credit = SUM of credit_amount from purchases - payments received
   *   - total = cash_received + credit
   * 
   * DEALER/COMPANY MODEL:
   *   - cash_paid = SUM of cash shop has paid to them (via PAYMENT_MADE entries)
   *   - credit = SUM of credit_amount (what shop owes) - payments made
   *   - total = cash_paid + credit
   */
  async calculateEntityLedgerTotals(entityType, entityId) {
    try {
      const entityTableVariations = this.getEntityTableVariations(entityType);
      const entityTypeLower = this._normalizeEntityType(entityType);

      // Get all transactions for this entity
      const transactionsQuery = `
        SELECT 
          t.transaction_type,
          t.total_amount,
          t.cash_paid,
          t.credit_amount,
          t.entity_table
        FROM Transactions t
        WHERE t.entity_id = ?
          AND LOWER(t.entity_table) IN (${entityTableVariations.map(v => `'${v.toLowerCase()}'`).join(',')})
      `;
      
      const transactions = await this.db.query(transactionsQuery, [entityId]);
      
      // Get all ledger entries (payments)
      const ledgerQuery = `
        SELECT 
          transaction_type,
          debit,
          credit
        FROM LedgerEntries
        WHERE LOWER(entity_type) = LOWER(?)
          AND entity_id = ?
      `;
      
      const ledgerEntries = await this.db.query(ledgerQuery, [entityType, entityId]);
      
      let totalCash = 0;      // Total cash transactions
      let totalCredit = 0;    // Entity owes shop (from BUYING transactions)
      let totalBalance = 0;   // Shop owes entity (from SELLING transactions)
      
      // ═══════════════════════════════════════════════════════════════════════════
      // INTELLIGENT LEDGER SYSTEM: Automatic Settlement
      // ═══════════════════════════════════════════════════════════════════════════
      // BUYING TRANSACTIONS (Entity purchases FROM shop):
      //   - Increases CREDIT (entity owes shop)
      //   - Types: FARMER_PURCHASE, DEALER_PURCHASE, PURCHASE, BUY
      //   - BUT: If entity has existing BALANCE (shop owes them), offset it first!
      //
      // SELLING TRANSACTIONS (Entity sells TO shop):
      //   - Increases BALANCE (shop owes entity)  
      //   - Types: FARMER_SALE_GRAIN, FARMER_SALE, COMPANY_DELIVERY, DELIVERY, SELL, SALE
      //   - BUT: If entity has existing CREDIT (they owe shop), offset it first!
      //
      // KEY PRINCIPLE: Credit and Balance are OFFSETTING - they net against each other
      // after EVERY transaction to maintain accurate running totals.
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Process transactions with AUTOMATIC SETTLEMENT after each one
      for (const t of transactions) {
        const transType = (t.transaction_type || '').toUpperCase();
        const cashPaid = parseFloat(t.cash_paid) || 0;
        const creditAmount = parseFloat(t.credit_amount) || 0;
        const totalAmount = parseFloat(t.total_amount) || 0;
        
        // Identify transaction direction: BUYING or SELLING
        const isBuyingTransaction = (
          transType === 'PURCHASE' || 
          transType === 'BUY' || 
          transType === 'FARMER_PURCHASE' || 
          transType === 'DEALER_PURCHASE' ||
          transType === 'RETAIL_SALE'  // Customer buys from shop → entity owes shop
        );
        
        const isSellingTransaction = (
          transType === 'SELL' || 
          transType === 'SALE' || 
          transType === 'FARMER_SALE_GRAIN' || 
          transType === 'FARMER_SALE' ||
          transType === 'DELIVERY' || 
          transType === 'COMPANY_DELIVERY' ||
          transType === 'RETAIL_PURCHASE' ||              // Supplier sells to shop → shop owes supplier
          transType === 'RETAIL_DISTRIBUTOR_PURCHASE'      // Distributor sells to shop → shop owes distributor
        );
        
        // RETURN transactions: reduce existing debt
        const isReturnReducingCredit = (
          transType === 'RETAIL_RETURN_IN'  // Customer returns product → reduces customer's credit
        );
        
        const isReturnReducingBalance = (
          transType === 'RETAIL_RETURN_OUT' // Return to supplier → reduces supplier's balance
        );
        
        // Add cash component (always counted)
        totalCash += cashPaid;
        
        if (isBuyingTransaction) {
          // BUYING: Entity purchases FROM shop → Entity OWES shop
          // This creates CREDIT (payable)
          totalCredit += creditAmount;
          
          console.log(`[LedgerService] 🛒 BUYING: ${transType}, Credit Amount: ${creditAmount}`);
          
          // AUTOMATIC SETTLEMENT: If shop owes entity (balance > 0), offset it against new credit
          if (totalBalance > 0 && totalCredit > 0) {
            const offsetAmount = Math.min(totalCredit, totalBalance);
            totalCredit -= offsetAmount;
            totalBalance -= offsetAmount;
            console.log(`[LedgerService] ⚖️ AUTO-SETTLEMENT: Offset Rs ${offsetAmount} (Credit: ${totalCredit}, Balance: ${totalBalance})`);
          }
          
        } else if (isSellingTransaction) {
          // SELLING: Entity sells TO shop → Shop OWES entity
          // This creates BALANCE (receivable)
          totalBalance += creditAmount;
          
          console.log(`[LedgerService] 📦 SELLING: ${transType}, Balance Amount: ${creditAmount}`);
          
          // AUTOMATIC SETTLEMENT: If entity owes shop (credit > 0), offset it against new balance
          if (totalCredit > 0 && totalBalance > 0) {
            const offsetAmount = Math.min(totalCredit, totalBalance);
            totalCredit -= offsetAmount;
            totalBalance -= offsetAmount;
            console.log(`[LedgerService] ⚖️ AUTO-SETTLEMENT: Offset Rs ${offsetAmount} (Credit: ${totalCredit}, Balance: ${totalBalance})`);
          }
        } else if (isReturnReducingCredit) {
          // RETURN_IN: Customer returns product → reduces what customer owes
          totalCredit -= creditAmount;
          console.log(`[LedgerService] ↩️ RETURN_IN: ${transType}, Reduced Credit by ${creditAmount}`);
          
          if (totalCredit < 0) {
            totalBalance += Math.abs(totalCredit);
            totalCredit = 0;
            console.log(`[LedgerService] ⚠️ RETURN excess converted to Balance: ${totalBalance}`);
          }
        } else if (isReturnReducingBalance) {
          // RETURN_OUT: Return to supplier → reduces what shop owes
          totalBalance -= creditAmount;
          console.log(`[LedgerService] ↩️ RETURN_OUT: ${transType}, Reduced Balance by ${creditAmount}`);
          
          if (totalBalance < 0) {
            totalCredit += Math.abs(totalBalance);
            totalBalance = 0;
            console.log(`[LedgerService] ⚠️ RETURN excess converted to Credit: ${totalCredit}`);
          }
        }
        
        console.log(`[LedgerService] Running totals → Credit: ${totalCredit}, Balance: ${totalBalance}, Cash: ${totalCash}`);
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PAYMENT PROCESSING: Payments reduce outstanding amounts with auto-settlement
      // ═══════════════════════════════════════════════════════════════════════════
      for (const e of ledgerEntries) {
        const transType = (e.transaction_type || '').toUpperCase();
        const debit = parseFloat(e.debit) || 0;
        const credit = parseFloat(e.credit) || 0;
        
        // PAYMENT_RECEIVED: Entity pays shop → Reduces CREDIT (entity owes less)
        if (transType === 'PAYMENT_RECEIVED' || transType === 'PAYMENT') {
          totalCash += credit;     // Cash received
          totalCredit -= credit;   // Reduces credit (entity owes shop)
          
          console.log(`[LedgerService] 💰 PAYMENT_RECEIVED: Rs ${credit} (Credit: ${totalCredit})`);
          
          // OVERPAYMENT HANDLING: If credit becomes negative, convert to balance
          // This means entity paid more than they owed, so shop now owes them
          if (totalCredit < 0) {
            totalBalance += Math.abs(totalCredit);  // Shop owes entity the overpayment
            totalCredit = 0;                         // Entity owes nothing
            console.log(`[LedgerService] ⚠️ OVERPAYMENT: Converted to Balance Rs ${totalBalance}`);
          }
        }
        
        // PAYMENT_MADE: Shop pays entity → Reduces BALANCE (shop owes less)
        else if (transType === 'PAYMENT_MADE') {
          totalCash += debit;      // Cash paid
          totalBalance -= debit;   // Reduces balance (shop owes entity)
          
          console.log(`[LedgerService] 💸 PAYMENT_MADE: Rs ${debit} (Balance: ${totalBalance})`);
          
          // OVERPAYMENT HANDLING: If balance becomes negative, convert to credit
          // This means shop paid more than it owed, so entity now owes shop
          if (totalBalance < 0) {
            totalCredit += Math.abs(totalBalance);  // Entity owes shop the overpayment
            totalBalance = 0;                        // Shop owes nothing
            console.log(`[LedgerService] ⚠️ OVERPAYMENT: Converted to Credit Rs ${totalCredit}`);
          }
        }
        
        // SETTLEMENT: Full settlement of accounts
        else if (transType === 'SETTLEMENT') {
          totalCash += credit + debit;
          totalCredit -= debit;
          totalBalance -= credit;
        }
        
        // ACCOUNT_OPENED: Opening balances
        else if (transType === 'ACCOUNT_OPENED' || transType === 'OPENING_BALANCE') {
          totalCredit += debit;    // Opening debit = entity owes
          totalBalance += credit;  // Opening credit = shop owes
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // CRITICAL FIX: NET OUT CREDIT AND BALANCE
      // ═══════════════════════════════════════════════════════════════════════════
      // An entity CANNOT simultaneously owe money (credit) AND be owed money (balance)
      // These are OFFSETTING accounts - they must net out against each other
      //
      // Business Logic:
      // - If credit > balance → Entity owes shop (credit - balance), balance = 0
      // - If balance > credit → Shop owes entity (balance - credit), credit = 0
      // - If equal → Both are 0 (fully settled)
      // ═══════════════════════════════════════════════════════════════════════════
      
      let finalCredit = 0;
      let finalBalance = 0;
      
      if (totalCredit > totalBalance) {
        // Entity owes shop more than shop owes entity
        // Net result: Entity owes shop (credit - balance)
        finalCredit = totalCredit - totalBalance;
        finalBalance = 0;
      } else if (totalBalance > totalCredit) {
        // Shop owes entity more than entity owes shop
        // Net result: Shop owes entity (balance - credit)
        finalBalance = totalBalance - totalCredit;
        finalCredit = 0;
      }
      // else: Both equal, both stay 0 (fully settled account)
      
      // Calculate total business value
      const total = totalCash + finalCredit + finalBalance;
      
      console.log(`[LedgerService] ═══ DUAL-LEDGER TOTALS for ${entityType} ${entityId} ═══`);
      console.log(`[LedgerService] Cash: ${totalCash.toFixed(2)}`);
      console.log(`[LedgerService] Raw Credit: ${totalCredit.toFixed(2)}, Raw Balance: ${totalBalance.toFixed(2)}`);
      console.log(`[LedgerService] >>> NETTED Credit (Entity Owes Shop): ${finalCredit.toFixed(2)}`);
      console.log(`[LedgerService] >>> NETTED Balance (Shop Owes Entity): ${finalBalance.toFixed(2)}`);
      console.log(`[LedgerService] Total Business Value: ${total.toFixed(2)}`);
      console.log(`[LedgerService] ═══════════════════════════════════════════════════════`);
      
      return {
        cashAmount: totalCash,
        credit: finalCredit,         // NETTED: Entity owes shop (from BUYING minus SELLING)
        balance: finalBalance,       // NETTED: Shop owes entity (from SELLING minus BUYING)
        total: total                 // Total business value
      };
    } catch (error) {
      console.error('[LedgerService] Error calculating entity ledger totals:', error);
      return { cashAmount: 0, credit: 0, total: 0 };
    }
  }

  /**
   * Calculate REAL entity balances from all transactions (LEGACY - for backward compatibility)
   * This is the source of truth - not the entity table fields
   * 
   * HANDLES ALL TRANSACTION TYPE VARIATIONS:
   * - Uppercase: 'PURCHASE', 'FARMER_PURCHASE', 'SELL', 'FARMER_SALE_GRAIN', 'DELIVERY', 'COMPANY_DELIVERY'
   * - Lowercase: 'purchase', 'buy', 'sell', 'delivery' (from Universal Transaction)
   * - Mixed case variations
   */
  async calculateEntityBalances(entityType, entityId) {
    try {
      const entityTableVariations = this.getEntityTableVariations(entityType);
      const entityTableCondition = entityTableVariations.map(v => `'${v}'`).join(',');

      // Get all transactions for this entity - using LOWER() for case-insensitive matching
      const transactionsQuery = `
        SELECT 
          t.transaction_type,
          t.entity_table,
          t.total_amount,
          t.cash_paid,
          t.credit_amount,
          t.payment_type
        FROM Transactions t
        WHERE t.entity_id = ?
          AND LOWER(t.entity_table) IN (${entityTableVariations.map(v => `'${v.toLowerCase()}'`).join(',')})
      `;
      
      const transactions = await this.db.query(transactionsQuery, [entityId]);
      
      console.log('[LedgerService] Found', transactions.length, 'transactions for', entityType, entityId);
      
      // Get all manual ledger entries
      const ledgerQuery = `
        SELECT 
          transaction_type,
          debit,
          credit
        FROM LedgerEntries
        WHERE LOWER(entity_type) = LOWER(?)
          AND entity_id = ?
      `;
      
      const ledgerEntries = await this.db.query(ledgerQuery, [entityType, entityId]);
      
      // Calculate balances
      let entityOwesShop = 0;  // Credit given to entity (they owe us) = entity.credit
      let shopOwesEntity = 0;   // Credit we owe to entity = entity.balance
      
      // Process transactions - HANDLE ALL CASE VARIATIONS
      for (const t of transactions) {
        const transType = (t.transaction_type || '').toUpperCase();
        const creditAmount = parseFloat(t.credit_amount) || 0;
        
        // Skip if no credit amount (fully cash transactions don't affect ledger balance)
        if (creditAmount <= 0) continue;
        
        // PURCHASE/BUY transactions: Entity bought from shop - credit_amount is what they OWE shop
        // Matches: 'buy', 'BUY', 'purchase', 'PURCHASE', 'FARMER_PURCHASE', 'DEALER_PURCHASE', 'RETAIL_SALE'
        if (transType === 'PURCHASE' || transType === 'BUY' || 
            transType === 'FARMER_PURCHASE' || transType === 'DEALER_PURCHASE' ||
            transType === 'RETAIL_SALE') {
          entityOwesShop += creditAmount;
          console.log(`[LedgerService] + ${creditAmount} to entityOwesShop (${transType})`);
        }
        // SELL/SALE transactions: Entity sold to shop - credit_amount is what shop OWES them
        // Matches: 'sell', 'SELL', 'sale', 'SALE', 'FARMER_SALE_GRAIN', 'FARMER_SALE'
        else if (transType === 'SELL' || transType === 'SALE' || 
                 transType === 'FARMER_SALE_GRAIN' || transType === 'FARMER_SALE') {
          shopOwesEntity += creditAmount;
          console.log(`[LedgerService] + ${creditAmount} to shopOwesEntity (${transType})`);
        }
        // DELIVERY transactions: Company/Supplier delivered to shop - credit_amount is what shop OWES them
        // Matches: 'delivery', 'DELIVERY', 'COMPANY_DELIVERY', 'RETAIL_PURCHASE', 'RETAIL_DISTRIBUTOR_PURCHASE'
        else if (transType === 'DELIVERY' || transType === 'COMPANY_DELIVERY' ||
                 transType === 'RETAIL_PURCHASE' || transType === 'RETAIL_DISTRIBUTOR_PURCHASE') {
          shopOwesEntity += creditAmount;
          console.log(`[LedgerService] + ${creditAmount} to shopOwesEntity (${transType})`);
        }
        // RETURN transactions: Reduce existing debts
        else if (transType === 'RETAIL_RETURN_IN') {
          // Customer returned product → reduces what customer owes
          entityOwesShop -= creditAmount;
          console.log(`[LedgerService] - ${creditAmount} from entityOwesShop (${transType} return)`);
        }
        else if (transType === 'RETAIL_RETURN_OUT') {
          // Return to supplier → reduces what shop owes
          shopOwesEntity -= creditAmount;
          console.log(`[LedgerService] - ${creditAmount} from shopOwesEntity (${transType} return)`);
        }
        // Handle any unrecognized transaction types by checking the entity_table context
        else {
          console.log(`[LedgerService] Unknown transaction type: ${transType}, credit_amount: ${creditAmount}`);
          // If entity is Farmer/Dealer buying, it's a debit
          // If entity is Farmer selling or Company delivering, it's a credit
          const entityTable = (t.entity_table || '').toLowerCase();
          if (entityTable.includes('company')) {
            // Companies typically deliver TO shop (shop owes them)
            shopOwesEntity += creditAmount;
          } else {
            // Farmers/Dealers typically buy FROM shop (they owe shop)
            entityOwesShop += creditAmount;
          }
        }
      }
      
      // Process manual ledger entries (payments, settlements, etc.)
      for (const e of ledgerEntries) {
        const transType = (e.transaction_type || '').toUpperCase();
        const debit = parseFloat(e.debit) || 0;
        const credit = parseFloat(e.credit) || 0;
        
        // PAYMENT_RECEIVED: Entity paid shop - reduces what entity owes
        if (transType === 'PAYMENT_RECEIVED' || transType === 'PAYMENT') {
          entityOwesShop -= credit;  // Reduce entity's debt
          console.log(`[LedgerService] - ${credit} from entityOwesShop (${transType})`);
        }
        // PAYMENT_MADE: Shop paid entity - reduces what shop owes
        else if (transType === 'PAYMENT_MADE') {
          shopOwesEntity -= debit;  // Reduce shop's debt
          console.log(`[LedgerService] - ${debit} from shopOwesEntity (${transType})`);
        }
        // SETTLEMENT: Offsetting of balances - both debit and credit are being cleared
        else if (transType === 'SETTLEMENT') {
          entityOwesShop -= debit;
          shopOwesEntity -= credit;
          console.log(`[LedgerService] Settlement: - ${debit} from entityOwes, - ${credit} from shopOwes`);
        }
        // ACCOUNT_OPENED: Opening balance entry - adds to balances
        else if (transType === 'ACCOUNT_OPENED' || transType === 'OPENING_BALANCE') {
          entityOwesShop += debit;
          shopOwesEntity += credit;
        }
        // For other ledger entry types (like transaction-linked entries), process debit/credit
        else if (transType.includes('PURCHASE') || transType.includes('BUY')) {
          // Already counted in transactions, skip double-counting
        } else if (transType.includes('SALE') || transType.includes('SELL') || transType.includes('DELIVERY')) {
          // Already counted in transactions, skip double-counting
        }
      }
      
      // Ensure values don't go negative
      entityOwesShop = Math.max(0, entityOwesShop);
      shopOwesEntity = Math.max(0, shopOwesEntity);
      
      console.log('[LedgerService] Final calculated balances for', entityType, entityId, 
                  '- Entity owes shop (credit):', entityOwesShop, ', Shop owes entity (balance):', shopOwesEntity);
      
      return {
        entityOwesShop,
        shopOwesEntity
      };
    } catch (error) {
      console.error('[LedgerService] Error calculating entity balances:', error);
      return { entityOwesShop: 0, shopOwesEntity: 0 };
    }
  }

  /**
   * Get complete ledger for an entity with ACCURATE transaction reflection
   * Every transaction is shown with exact amounts from the database
   */
  async getEntityLedger(entityType, entityId, options = {}) {
    try {
      const { dateFrom, dateTo, limit = 500 } = options;
      
      const entityResult = await this.getEntityDetails(entityType, entityId);
      if (!entityResult.success) return entityResult;

      const entityTypeLower = this._normalizeEntityType(entityType);
      
      let dateFilter = '';
      if (dateFrom) dateFilter += ` AND DATE(le.entry_date) >= '${dateFrom}'`;
      if (dateTo) dateFilter += ` AND DATE(le.entry_date) <= '${dateTo}'`;

      // PROFESSIONAL APPROACH: Use LedgerEntries as the ONLY source for financial history
      // This prevents duplicate rows from Transactions + LedgerEntries
      const ledgerQuery = `
        SELECT 
          le.entry_id,
          le.entry_date as transaction_date,
          le.transaction_type,
          le.transaction_id,
          le.debit,
          le.credit,
          le.description as manual_description,
          t.transaction_number,
          t.total_amount as t_total,
          t.cash_paid as t_cash,
          t.credit_amount as t_credit,
          COALESCE(
            (SELECT GROUP_CONCAT(ti.item_name, ', ') FROM TransactionItems ti WHERE ti.transaction_id = le.transaction_id),
            t.description,
            le.description
          ) as item_details
        FROM LedgerEntries le
        LEFT JOIN Transactions t ON le.transaction_id = t.transaction_id
        WHERE LOWER(le.entity_type) = LOWER(?) AND le.entity_id = ?
        ${dateFilter}
        ORDER BY le.entry_date ASC, le.entry_id ASC
      `;

      const rawEntries = await this.db.query(ledgerQuery, [entityType, entityId]);

      // Calculate Running Balance and Professional Formatting
      let runningBalance = 0;
      const processedEntries = rawEntries.map(e => {
        const debit = parseFloat(e.debit) || 0;
        const credit = parseFloat(e.credit) || 0;
        
        // Update Running Balance: User Model (Positive = Advance, Negative = Loan)
        // Jamaican/Urdu Accounting: Debit Column (Naam) = reduces balance, Credit Column (Jama) = increases balance
        runningBalance += (credit - debit);

        return {
          entry_source: e.transaction_id ? 'TRANSACTION' : 'MANUAL_PAYMENT',
          source_id: e.entry_id,
          reference_number: e.transaction_number || `PAY-${e.entry_id}`,
          entry_date: e.transaction_date,
          transaction_type: e.transaction_type,
          item_description: e.item_details || e.manual_description || '-',
          // These are for the UI columns
          debit: debit,   // Naam (Loan Impact)
          credit: credit,  // Jama (Advance Impact)
          running_balance: runningBalance
        };
      });

      // Reverse to show newest first for the table
      const finalEntries = [...processedEntries].reverse();
      const limitedEntries = limit ? finalEntries.slice(0, limit) : finalEntries;

      return {
        success: true,
        data: {
          entity: entityResult.data,
          entries: limitedEntries,
          statistics: {
            total_transactions: processedEntries.length,
            net_balance: runningBalance,
            advance: runningBalance > 0 ? runningBalance : 0,
            loan: runningBalance < 0 ? Math.abs(runningBalance) : 0
          }
        }
      };
    } catch (error) {
      console.error('[LedgerService] Error getting entity ledger:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Record a payment transaction
   * 
   * FARMER: Payment RECEIVED from farmer
   *   - Adds to cash_received (farmer paid)
   *   - Deducts from credit (farmer's debt reduced)
   * 
   * DEALER/COMPANY: Payment MADE by shop
   *   - Adds to cash_paid (shop paid)
   *   - Deducts from credit (shop's debt reduced)
   */
  async recordPayment(data) {
    try {
      const {
        entityType,
        entityId,
        amount,
        paymentType, // 'RECEIVED' (entity pays shop) or 'MADE' (shop pays entity)
        description,
        createdBy
      } = data;

      if (!amount || amount <= 0) {
        return { success: false, message: 'Amount must be greater than 0' };
      }

      const entityTypeLower = this._normalizeEntityType(entityType);
      
      // Get current entity details to determine payment direction
      const entityResult = await this.getEntityDetails(entityType, entityId);
      if (!entityResult.success) {
        return entityResult;
      }

      const entity = entityResult.data;
      const currentCredit = parseFloat(entity.credit) || 0;
      const currentBalance = parseFloat(entity.balance) || 0;
      const currentCashAmount = parseFloat(entity.cash_amount) || 0;
      
      // INTELLIGENT PAYMENT TYPE DETERMINATION:
      // - If entity has CREDIT (owes shop), payment should be RECEIVED (entity pays shop)
      // - If entity has BALANCE (shop owes entity), payment should be MADE (shop pays entity)
      // - If specified paymentType conflicts with ledger state, auto-correct it
      let actualPaymentType = paymentType;
      
      if (!paymentType || paymentType === 'AUTO') {
        // Auto-determine based on current ledger state
        if (currentCredit > 0) {
          actualPaymentType = 'RECEIVED';  // Entity owes shop, so they're paying
        } else if (currentBalance > 0) {
          actualPaymentType = 'MADE';      // Shop owes entity, so shop is paying
        } else {
          // No outstanding amounts, default to RECEIVED (entity making advance payment)
          actualPaymentType = 'RECEIVED';
        }
      }

      let debit = 0;
      let credit = 0;
      let transactionType;
      let paymentDescription;

      if (actualPaymentType === 'RECEIVED') {
        // Entity pays shop (reduces their CREDIT, or creates advance BALANCE)
        // - Adds to cash received
        // - Reduces entity's credit (what they owe)
        // - If overpayment, creates balance (shop owes them)
        transactionType = 'PAYMENT_RECEIVED';
        credit = amount;  // Credit entry in ledger (reduces entity's debt)
        paymentDescription = description || `Payment received from ${entityTypeLower}`;
      } else {
        // Shop pays entity (reduces their BALANCE, or creates negative CREDIT)
        // - Adds to cash paid
        // - Reduces shop's balance (what shop owes entity)
        transactionType = 'PAYMENT_MADE';
        debit = amount;   // Debit entry in ledger (shop paid out)
        paymentDescription = description || `Payment made to ${entityTypeLower}`;
      }

      // Start transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // Get industry_type for the entity (needed for ledger entry)
        let industryType = 'AGRICULTURAL';
        const settings = await this.db.query('SELECT industry_type FROM OrganizationSettings LIMIT 1');
        if (settings && settings.length > 0) industryType = settings[0].industry_type;

        // 1. Insert ledger entry
        const ledgerResult = await this.db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by, entry_date, industry_type
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, datetime('now'), ?)`,
          [
            entityTypeLower,
            entityId,
            transactionType,
            debit,
            credit,
            0, // Balance will be calculated dynamically
            paymentDescription,
            createdBy || 1,
            industryType
          ]
        );

        // 2. Update Unified Account Balance
        // RECEIVED: Entity pays Shop -> They owe us LESS (Decreases Receivable balance)
        // MADE: Shop pays Entity -> They owe us MORE (Increases Receivable balance, or reduces Payable)
        const netChange = actualPaymentType === 'RECEIVED' ? -amount : amount;
        
        await this.db.execute(
          `UPDATE ${this.getEntityTableName(entityType)} SET account_balance = account_balance + ?, updated_at = datetime('now') WHERE ${this._normalizeEntityType(entityType)}_id = ?`,
          [netChange, entityId]
        );

        await this.db.execute('COMMIT');

        console.log(`[LedgerService] Payment recorded: ${entityType} ${entityId}, Amount: ${amount}, Type: ${transactionType}, Net Balance Change: ${netChange}`);

        return {
          success: true,
          message: actualPaymentType === 'RECEIVED' 
            ? `Payment of Rs. ${amount} received from ${entityTypeLower}` 
            : `Payment of Rs. ${amount} made to ${entityTypeLower}`,
          data: {
            entry_id: ledgerResult.lastInsertRowid,
            amount: amount,
            payment_type: actualPaymentType,
            net_change: netChange
          }
        };

      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[LedgerService] Error recording payment:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Calculate and Settle Balance - Professional Settlement System
   * ================================================================
   * This handles the two-way business relationship:
   * 
   * 1. Entity BUYS from shop → entity.credit increases (entity owes shop)
   * 2. Entity SELLS to shop → entity.balance increases (shop owes entity)
   * 
   * Settlement Process:
   * - Calculate NET position by comparing credit and balance
   * - If credit > balance → Entity still owes shop (net payable)
   * - If balance > credit → Shop still owes entity (net receivable)
   * - Zero out both, set only the NET amount in appropriate field
   * - Create settlement ledger entry for audit trail
   * 
   * @param {string} entityType - 'farmer', 'dealer', or 'company'
   * @param {number} entityId - The entity's ID
   * @param {number} userId - User performing the settlement
   */
  async calculateAndSettleBalance(entityType, entityId, userId) {
    try {
      console.log('[LedgerService] Starting settlement for:', entityType, entityId);

      // Get current entity details
      const entityResult = await this.getEntityDetails(entityType, entityId);
      if (!entityResult.success) {
        return entityResult;
      }

      const entity = entityResult.data;
      const currentCredit = parseFloat(entity.credit) || 0;  // Entity owes shop
      const currentBalance = parseFloat(entity.balance) || 0; // Shop owes entity

      console.log('[LedgerService] Current state:', {
        entityName: entity.name,
        credit: currentCredit,
        balance: currentBalance
      });

      // If both are zero, nothing to settle
      if (currentCredit === 0 && currentBalance === 0) {
        return {
          success: true,
          message: 'Account already settled. No pending balances.',
          data: {
            entity_name: entity.name,
            previous_credit: 0,
            previous_balance: 0,
            new_credit: 0,
            new_balance: 0,
            settlement_amount: 0,
            settlement_direction: 'NONE',
            net_position: 0
          }
        };
      }

      // Calculate NET position
      let newCredit = 0;
      let newBalance = 0;
      let settlementAmount = 0;
      let settlementDirection = '';
      let settlementDescription = '';

      if (currentCredit > currentBalance) {
        // Entity owes more than shop owes → Entity still owes net amount
        settlementAmount = currentCredit - currentBalance;
        newCredit = settlementAmount;
        newBalance = 0;
        settlementDirection = 'ENTITY_OWES_SHOP';
        settlementDescription = `Settlement: Adjusted balances. Entity owes shop Rs ${settlementAmount.toLocaleString()}. (Previous: Credit Rs ${currentCredit.toLocaleString()}, Balance Rs ${currentBalance.toLocaleString()})`;
      } else if (currentBalance > currentCredit) {
        // Shop owes more than entity owes → Shop still owes net amount
        settlementAmount = currentBalance - currentCredit;
        newCredit = 0;
        newBalance = settlementAmount;
        settlementDirection = 'SHOP_OWES_ENTITY';
        settlementDescription = `Settlement: Adjusted balances. Shop owes entity Rs ${settlementAmount.toLocaleString()}. (Previous: Credit Rs ${currentCredit.toLocaleString()}, Balance Rs ${currentBalance.toLocaleString()})`;
      } else {
        // Both are equal → Everything cancels out
        settlementAmount = 0;
        newCredit = 0;
        newBalance = 0;
        settlementDirection = 'FULLY_SETTLED';
        settlementDescription = `Settlement: All balances cleared. Credit Rs ${currentCredit.toLocaleString()} offset by Balance Rs ${currentBalance.toLocaleString()}.`;
      }

      console.log('[LedgerService] Settlement calculation:', {
        settlementAmount,
        settlementDirection,
        newCredit,
        newBalance
      });

      // Start database transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // 1. Create settlement ledger entry for audit trail
        await this.db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by, entry_date
          ) VALUES (?, ?, 'SETTLEMENT', NULL, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            this._normalizeEntityType(entityType),
            entityId,
            currentCredit,   // Total debit being settled
            currentBalance,  // Total credit being settled
            newBalance - newCredit, // Net position after settlement
            settlementDescription,
            userId || 1
            ]        );

        // 2. Update entity with new settled balances
        await this.updateEntityBalanceAndCredit(entityType, entityId, newBalance, newCredit);

        await this.db.execute('COMMIT');

        console.log('[LedgerService] Settlement completed successfully');

        return {
          success: true,
          message: this.getSettlementMessage(settlementDirection, settlementAmount, entity.name),
          data: {
            entity_name: entity.name,
            entity_id: entityId,
            entity_type: entityType,
            previous_credit: currentCredit,
            previous_balance: currentBalance,
            new_credit: newCredit,
            new_balance: newBalance,
            settlement_amount: settlementAmount,
            settlement_direction: settlementDirection,
            net_position: newBalance - newCredit
          }
        };

      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[LedgerService] Error in settlement:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get human-readable settlement message
   */
  getSettlementMessage(direction, amount, entityName) {
    const formattedAmount = `Rs ${amount.toLocaleString()}`;
    
    switch (direction) {
      case 'ENTITY_OWES_SHOP':
        return `Settlement complete! After offsetting all transactions, ${entityName} owes the shop ${formattedAmount}.`;
      case 'SHOP_OWES_ENTITY':
        return `Settlement complete! After offsetting all transactions, the shop owes ${entityName} ${formattedAmount}.`;
      case 'FULLY_SETTLED':
        return `Settlement complete! All balances have been fully offset. Account is now clear.`;
      default:
        return `Settlement complete.`;
    }
  }

  /**
   * Get settlement preview without actually settling
   * Allows admin to see what will happen before confirming
   */
  async getSettlementPreview(entityType, entityId) {
    try {
      // Get current entity details (this now returns CALCULATED values)
      const entityResult = await this.getEntityDetails(entityType, entityId);
      if (!entityResult.success) {
        return entityResult;
      }

      const entity = entityResult.data;
      // These are now the CALCULATED values from transactions, not stale DB values
      const currentCredit = parseFloat(entity.credit) || 0;  // Entity owes shop
      const currentBalance = parseFloat(entity.balance) || 0; // Shop owes entity

      console.log('[LedgerService] Settlement preview for', entityType, entityId, 
                  '- Credit:', currentCredit, 'Balance:', currentBalance);

      // Calculate what settlement would look like
      let newCredit = 0;
      let newBalance = 0;
      let offsetAmount = Math.min(currentCredit, currentBalance);  // Amount being offset
      let netAmount = 0;
      let settlementDirection = '';
      let message = '';

      if (currentCredit > currentBalance) {
        // Entity owes more than shop owes → Entity still owes net amount
        netAmount = currentBalance - currentCredit;  // Negative = entity owes
        newCredit = currentCredit - currentBalance;
        newBalance = 0;
        settlementDirection = 'ENTITY_OWES_SHOP';
        message = `After settlement, ${entity.name} will owe the shop Rs ${newCredit.toLocaleString()}`;
      } else if (currentBalance > currentCredit) {
        // Shop owes more than entity owes → Shop still owes net amount
        netAmount = currentBalance - currentCredit;  // Positive = shop owes
        newCredit = 0;
        newBalance = currentBalance - currentCredit;
        settlementDirection = 'SHOP_OWES_ENTITY';
        message = `After settlement, the shop will owe ${entity.name} Rs ${newBalance.toLocaleString()}`;
      } else if (currentCredit === currentBalance && currentCredit > 0) {
        // Both are equal → Everything cancels out
        netAmount = 0;
        settlementDirection = 'FULLY_SETTLED';
        message = `All balances will be fully cleared. Account will be settled.`;
      } else {
        // Nothing to settle
        settlementDirection = 'NOTHING_TO_SETTLE';
        message = `No outstanding balances to settle.`;
      }

      return {
        success: true,
        data: {
          // Field names that match the UI expectations
          entityName: entity.name,
          entityId: entityId,
          entityType: entityType,
          currentCredit: currentCredit,   // What entity owes shop
          currentBalance: currentBalance, // What shop owes entity
          newCredit: newCredit,
          newBalance: newBalance,
          offsetAmount: offsetAmount,
          netAmount: netAmount,
          settlementDirection: settlementDirection,
          message: message
        }
      };

    } catch (error) {
      console.error('[LedgerService] Error getting settlement preview:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Add a manual ledger entry
   */
  async addLedgerEntry(data) {
    try {
      const {
        entityType,
        entityId,
        transactionType,
        transactionId,
        debit,
        credit,
        description,
        userId
      } = data;

      // Get current entity details
      const entityResult = await this.getEntityDetails(entityType, entityId);
      if (!entityResult.success) {
        return entityResult;
      }

      const entity = entityResult.data;
      const currentCredit = parseFloat(entity.credit) || 0;
      const currentBalance = parseFloat(entity.balance) || 0;

      // Calculate new balances
      let newCredit = currentCredit;
      let newBalance = currentBalance;

      if (debit > 0) {
        // Debit increases entity's debt OR decreases shop's liability
        newCredit = currentCredit + debit;
      }
      if (credit > 0) {
        // Credit decreases entity's debt OR increases shop's liability
        newCredit = Math.max(0, currentCredit - credit);
      }

      const netBalance = newBalance - newCredit;

      // Insert ledger entry
      const result = await this.db.execute(
        `INSERT INTO LedgerEntries (
          entity_type, entity_id, transaction_type, transaction_id,
          debit, credit, balance, description, created_by, entry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          this._normalizeEntityType(entityType),
          entityId,
          transactionType,
          transactionId || null,
          debit || 0,
          credit || 0,
          netBalance,
          description,
          userId || 1
        ]
      );

      // Update entity
      await this.updateEntityBalanceAndCredit(entityType, entityId, newBalance, newCredit);

      return {
        success: true,
        message: 'Ledger entry added successfully',
        data: {
          entry_id: result.lastInsertRowid,
          new_credit: newCredit,
          new_balance: newBalance,
          net_position: netBalance
        }
      };

    } catch (error) {
      console.error('[LedgerService] Error adding ledger entry:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update entity balance
   */
  async updateEntityBalance(entityType, entityId, newBalance) {
    const type = this._normalizeEntityType(entityType);
    const tableName = this.getEntityTableName(type);
    if (!tableName) throw new Error(`Invalid entity type: ${entityType}`);
    
    const idField = `${type}_id`;
    
    await this.db.execute(
      `UPDATE ${tableName} SET account_balance = ?, updated_at = datetime('now') WHERE ${idField} = ?`,
      [newBalance, entityId]
    );
  }

  /**
   * Update entity balance and credit together (Legacy - now uses account_balance)
   */
  async updateEntityBalanceAndCredit(entityType, entityId, newBalance, newCredit) {
    const type = this._normalizeEntityType(entityType);
    const tableName = this.getEntityTableName(type);
    if (!tableName) throw new Error(`Invalid entity type: ${entityType}`);
    
    const idField = `${type}_id`;
    
    // We still update both for backward compatibility, but primarily use account_balance
    await this.db.execute(
      `UPDATE ${tableName} SET balance = ?, credit = ?, account_balance = ?, updated_at = datetime('now') WHERE ${idField} = ?`,
      [newBalance, newCredit, newBalance - newCredit, entityId]
    );
  }

  /**
   * Get ledger summary for all entities of a type
   */
  async getEntityTypeSummary(entityType) {
    try {
      let query;
      const type = this._normalizeEntityType(entityType);
      
      switch (type) {
        case 'farmer':
          query = `
            SELECT 
              f.farmer_id as id,
              f.specific_id,
              f.name,
              f.phone,
              f.balance,
              f.credit,
              f.balance - f.credit as net_position,
              f.is_active,
              (SELECT COUNT(*) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'farmers' OR LOWER(t.entity_table) = 'farmer') 
               AND t.entity_id = f.farmer_id) as transaction_count,
              (SELECT SUM(COALESCE(t.total_amount, 0)) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'farmers' OR LOWER(t.entity_table) = 'farmer') 
               AND t.entity_id = f.farmer_id) as total_business,
              (SELECT MAX(t.transaction_date) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'farmers' OR LOWER(t.entity_table) = 'farmer') 
               AND t.entity_id = f.farmer_id) as last_transaction
            FROM Farmers f
            WHERE f.is_active = 1
            ORDER BY f.name
          `;
          break;
        case 'dealer':
          query = `
            SELECT 
              d.dealer_id as id,
              d.specific_id,
              d.name,
              d.phone,
              d.balance,
              d.credit,
              d.balance - d.credit as net_position,
              d.is_active,
              (SELECT COUNT(*) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'dealers' OR LOWER(t.entity_table) = 'dealer') 
               AND t.entity_id = d.dealer_id) as transaction_count,
              (SELECT SUM(COALESCE(t.total_amount, 0)) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'dealers' OR LOWER(t.entity_table) = 'dealer') 
               AND t.entity_id = d.dealer_id) as total_business,
              (SELECT MAX(t.transaction_date) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'dealers' OR LOWER(t.entity_table) = 'dealer') 
               AND t.entity_id = d.dealer_id) as last_transaction
            FROM Dealers d
            WHERE d.is_active = 1
            ORDER BY d.name
          `;
          break;
        case 'company':
          query = `
            SELECT 
              c.company_id as id,
              c.specific_id,
              c.company_name as name,
              c.phone,
              c.balance,
              c.credit,
              c.balance - c.credit as net_position,
              c.is_active,
              (SELECT COUNT(*) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'companies' OR LOWER(t.entity_table) = 'company') 
               AND t.entity_id = c.company_id) as transaction_count,
              (SELECT SUM(COALESCE(t.total_amount, 0)) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'companies' OR LOWER(t.entity_table) = 'company') 
               AND t.entity_id = c.company_id) as total_business,
              (SELECT MAX(t.transaction_date) FROM Transactions t 
               WHERE t.entity_type = 'regular'
               AND (LOWER(t.entity_table) = 'companies' OR LOWER(t.entity_table) = 'company') 
               AND t.entity_id = c.company_id) as last_transaction
            FROM Companies c
            WHERE c.is_active = 1
            ORDER BY c.company_name
          `;
          break;
        default:
          throw new Error(`Invalid entity type: ${entityType}`);
      }

      const entities = await this.db.query(query);

      // Calculate totals
      const totals = entities.reduce((acc, entity) => {
        acc.totalBalance += parseFloat(entity.balance) || 0;
        acc.totalCredit += parseFloat(entity.credit) || 0;
        acc.totalNetPosition += parseFloat(entity.net_position) || 0;
        acc.totalTransactions += parseInt(entity.transaction_count) || 0;
        acc.totalBusiness += parseFloat(entity.total_business) || 0;
        return acc;
      }, { 
        totalBalance: 0, 
        totalCredit: 0, 
        totalNetPosition: 0, 
        totalTransactions: 0,
        totalBusiness: 0 
      });

      return {
        success: true,
        data: {
          entities,
          totals,
          count: entities.length
        }
      };

    } catch (error) {
      console.error('[LedgerService] Error getting entity type summary:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get ledger statistics for an entity
   */
  async getLedgerStatistics(entityType, entityId, options = {}) {
    try {
      const ledgerResult = await this.getEntityLedger(entityType, entityId, options);
      
      if (!ledgerResult.success) {
        return ledgerResult;
      }

      return {
        success: true,
        data: {
          entity: ledgerResult.data.entity,
          statistics: ledgerResult.data.statistics
        }
      };

    } catch (error) {
      console.error('[LedgerService] Error getting ledger statistics:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get outstanding balances for all entities
   */
  async getOutstandingBalances(entityType) {
    try {
      let query;

      if (entityType) {
        const type = this._normalizeEntityType(entityType);
        const tableName = this.getEntityTableName(type);
        if (!tableName) throw new Error(`Invalid entity type: ${entityType}`);

        const idField = `${type}_id`;
        const nameField = type === 'company' ? 'company_name' : 'name';
        
        query = `
          SELECT ${idField} as id, specific_id, ${nameField} as name, phone, account_balance,
                 '${entityType}' as entity_type
          FROM ${tableName}
          WHERE is_active = 1 AND account_balance != 0
          ORDER BY ABS(account_balance) DESC
        `;
      } else {
        // All entity types
        query = `
          SELECT farmer_id as id, specific_id, name, phone, account_balance, 'farmer' as entity_type 
          FROM Farmers WHERE is_active = 1 AND account_balance != 0
          UNION ALL
          SELECT dealer_id as id, specific_id, name, phone, account_balance, 'dealer' as entity_type 
          FROM Dealers WHERE is_active = 1 AND account_balance != 0
          UNION ALL
          SELECT company_id as id, specific_id, company_name as name, phone, account_balance, 'company' as entity_type 
          FROM Companies WHERE is_active = 1 AND account_balance != 0
          ORDER BY ABS(account_balance) DESC
        `;
      }

      const entities = await this.db.query(query);

      // Calculate totals
      const totals = entities.reduce((acc, entity) => {
        const balance = parseFloat(entity.account_balance) || 0;
        acc.totalReceivable += balance > 0 ? balance : 0;
        acc.totalPayable += balance < 0 ? Math.abs(balance) : 0;
        return acc;
      }, { totalReceivable: 0, totalPayable: 0 });

      return {
        success: true,
        data: {
          entities,
          totals,
          count: entities.length
        }
      };

    } catch (error) {
      console.error('[LedgerService] Error getting outstanding balances:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all entities with their balances
   */
  async getAllEntitiesWithBalances(entityType, activeOnly = true) {
    try {
      const type = this._normalizeEntityType(entityType);
      const tableName = this.getEntityTableName(type);
      if (!tableName) throw new Error(`Invalid entity type: ${entityType}`);

      const idField = `${type}_id`;
      const nameField = type === 'company' ? 'company_name' : 'name';
      const activeCondition = activeOnly ? 'is_active = 1' : '1=1';
      
      const query = `
        SELECT ${idField} as id, specific_id, ${nameField} as name, phone, address, 
               balance, credit, balance - credit as net_position, 
               is_active, created_at, '${entityType}' as entity_type
        FROM ${tableName}
        WHERE ${activeCondition}
        ORDER BY ${nameField}
      `;

      const entities = await this.db.query(query);

      // Calculate summary
      const summary = entities.reduce((acc, entity) => {
        const netPos = parseFloat(entity.net_position) || 0;
        acc.totalBalance += parseFloat(entity.balance) || 0;
        acc.totalCredit += parseFloat(entity.credit) || 0;
        acc.totalNetPosition += netPos;
        if (netPos > 0) acc.receivableCount++;
        if (netPos < 0) acc.payableCount++;
        return acc;
      }, { totalBalance: 0, totalCredit: 0, totalNetPosition: 0, receivableCount: 0, payableCount: 0 });

      return {
        success: true,
        data: {
          entities,
          summary,
          count: entities.length
        }
      };

    } catch (error) {
      console.error('[LedgerService] Error getting all entities with balances:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Export entity ledger to CSV format (Unified v18)
   */
  async exportLedgerData(entityType, entityId, options = {}) {
    try {
      const ledgerResult = await this.getEntityLedger(entityType, entityId, { ...options, limit: null });

      if (!ledgerResult.success) {
        return ledgerResult;
      }

      const { entity, entries, statistics } = ledgerResult.data;
      const isAdvance = statistics.net_balance > 0;

      // Generate CSV content
      const headers = [
        'Date', 'Reference', 'Type', 'Description',
        'Naam (Debit/Loan Impact)', 'Jama (Credit/Advance Impact)', 'Running Balance'
      ];

      const rows = entries.map(entry => [
        entry.entry_date || '',
        entry.reference_number || entry.source_id || '',
        entry.transaction_type || '',
        entry.item_description || '-',
        entry.debit || 0,
        entry.credit || 0,
        entry.running_balance || 0
      ]);

      // Build CSV string
      let csvContent = `PROFESSIONAL LEDGER REPORT\n`;
      csvContent += `Entity Name: ${entity.name}\n`;
      csvContent += `Entity ID: ${entity.specific_id || entity.id}\n`;
      csvContent += `Entity Type: ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}\n`;
      csvContent += `Report Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `\n`;
      csvContent += `ACCOUNT STATUS\n`;
      csvContent += `Account Position: ${isAdvance ? 'ADVANCE (Shop owes Entity)' : (statistics.net_balance < 0 ? 'LOAN (Entity owes Shop)' : 'SETTLED')}\n`;
      csvContent += `Final Balance: ${Math.abs(statistics.net_balance).toFixed(2)}\n`;
      csvContent += `\n`;
      csvContent += `TRANSACTION HISTORY\n`;
      csvContent += headers.join(',') + '\n';
      csvContent += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      csvContent += `\n\n`;
      csvContent += `SUMMARY\n`;
      csvContent += `Total Transactions,${statistics.total_transactions}\n`;
      csvContent += `Total Naam (Loan Impact),${entries.reduce((sum, e) => sum + (e.debit || 0), 0)}\n`;
      csvContent += `Total Jama (Advance Impact),${entries.reduce((sum, e) => sum + (e.credit || 0), 0)}\n`;
      csvContent += `Final Position,${statistics.net_balance.toFixed(2)}\n`;

      return {
        success: true,
        data: csvContent
      };

    } catch (error) {
      console.error('[LedgerService] Error exporting ledger data:', error);
      return { success: false, message: error.message };
    }
  }}

export { LedgerService };
export default LedgerService;
