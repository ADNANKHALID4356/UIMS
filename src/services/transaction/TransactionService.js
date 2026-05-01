import { DatabaseService } from '../database/DatabaseService.js';
import StockService from '../stock/StockService.js';
import { FarmerService } from '../farmer/FarmerService.js';
import { DealerService } from '../dealer/DealerService.js';
import { CompanyService } from '../company/CompanyService.js';
import ProductService from '../product/ProductService.js';
import GrainService from '../grain/GrainService.js';

/**
 * TransactionService - Sprint 5: Transaction Processing
 * Handles all business transactions (purchases, sales, payments)
 */
class TransactionService {
  constructor() {
    this.db = DatabaseService.getInstance();
    this.stockService = new StockService();
    this.farmerService = new FarmerService();
    this.dealerService = new DealerService();
    this.companyService = new CompanyService();
    this.productService = new ProductService();
    this.grainService = new GrainService();
  }

  /**
   * Generate unique transaction number: TXN-YYYYMMDD-###
   */
  async generateTransactionNumber() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const result = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM Transactions 
       WHERE DATE(transaction_date) = DATE('now')`
    );
    
    const count = result[0]?.count || 0;
    const sequence = String(count + 1).padStart(3, '0');
    
    return `TXN-${dateStr}-${sequence}`;
  }

  /**
   * Validate transaction data
   */
  validateTransaction(data) {
    const errors = [];

    // Required fields
    if (!data.transaction_type) errors.push('Transaction type is required');
    if (!data.entity_type) errors.push('Entity type is required');
    if (!data.entity_id && data.entity_type !== 'temporary') {
      errors.push('Entity ID is required');
    }
    if (data.entity_type === 'temporary' && !data.temp_customer_name) {
      errors.push('Customer name is required for temporary customers');
    }
    if (!data.item_type) errors.push('Item type is required');
    if (!data.item_id) errors.push('Item ID is required');
    if (!data.quantity || data.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }
    if (data.unit_price === undefined || data.unit_price < 0) {
      errors.push('Unit price must be 0 or greater');
    }
    if (!data.payment_type) errors.push('Payment type is required');

    // Payment validation
    const total = data.quantity * data.unit_price;
    if (data.payment_type === 'CASH') {
      if (data.cash_paid !== total) {
        errors.push('Cash paid must equal total amount for cash payment');
      }
    } else if (data.payment_type === 'CREDIT') {
      if (data.credit_amount !== total) {
        errors.push('Credit amount must equal total amount for credit payment');
      }
    } else if (data.payment_type === 'PARTIAL') {
      const totalPaid = (data.cash_paid || 0) + (data.credit_amount || 0);
      if (Math.abs(totalPaid - total) > 0.01) {
        errors.push('Cash paid + credit amount must equal total amount');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create Universal Transaction (Sprint 5)
   * Handles all transaction types: farmer buy/sell, company delivery, dealer purchase, stock adjustment
   */
  async createUniversalTransaction(payload) {
    try {
      const {
        module,
        entity_type,
        transaction_type,
        entity_id,
        entity_info,
        item_type,
        item_id,
        quantity,
        unit_price,
        total_amount,
        payment_type,
        cash_paid,
        credit_amount,
        description,
        created_by,
        stock_location
      } = payload;

      // Validate required fields
      if (!module || !entity_type || !transaction_type || !item_type || !item_id) {
        throw new Error('Missing required transaction fields');
      }

      // Validate business logic constraints
      if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
      }

      if (unit_price === undefined || unit_price === null || unit_price < 0) {
        throw new Error('Unit price cannot be negative');
      }

      if (!total_amount || total_amount <= 0) {
        throw new Error('Total amount must be greater than zero');
      }

      // Get entity name based on module and entity_type
      let entity_name = '';
      let entity_table = '';
      
      if (entity_type === 'regular' && entity_id) {
        // Get entity from database
        if (module === 'farmer') {
          const farmer = await this.farmerService.getFarmerById(entity_id);
          entity_name = farmer ? farmer.name : 'Unknown';
          entity_table = 'Farmer';
        } else if (module === 'company') {
          const company = await this.companyService.getCompanyById(entity_id);
          entity_name = company ? company.company_name : 'Unknown';
          entity_table = 'Company';
        } else if (module === 'dealer') {
          const dealer = await this.dealerService.getDealerById(entity_id);
          entity_name = dealer ? dealer.name : 'Unknown';
          entity_table = 'Dealer';
        } else if (module === 'stock') {
          entity_name = 'Stock Adjustment';
          entity_table = 'Stock';
        }
      } else if (entity_type === 'irregular' && entity_info) {
        // Walk-in customer info
        entity_name = entity_info.name || 'Walk-in Customer';
        
        // CRITICAL: Walk-in customers MUST have a category (Farmer/Company/Dealer)
        // The category is determined by which module they selected
        // There are ONLY 3 categories, even for walk-in customers
        if (module === 'farmer') {
          entity_table = 'Farmer';  // Walk-in Farmer
        } else if (module === 'company') {
          entity_table = 'Company'; // Walk-in Company
        } else if (module === 'dealer') {
          entity_table = 'Dealer';  // Walk-in Dealer
        } else {
          // This should NEVER happen - log error for debugging
          console.error(`[TransactionService] Invalid module for irregular customer: ${module}`);
          throw new Error(`Invalid entity module: ${module}. Must be 'farmer', 'company', or 'dealer'.`);
        }
      }

      // Get item details
      let item_name = '';
      let item_unit = '';
      
      if (item_type === 'product') {
        const product = await this.productService.getById(item_id);
        if (!product) throw new Error('Product not found');
        item_name = product.product_name;
        item_unit = product.unit;
        
        // Check stock availability for sales (farmer/dealer buying from shop)
        // TODO: Re-enable stock checking after initial stock is added
        if (false && ['buy', 'purchase'].includes(transaction_type)) {
          const stockLevels = await this.stockService.getStockLevels({ item_type: 'product' });
          const itemStock = stockLevels.find(s => s.item_id === item_id);
          const availableQty = itemStock ? itemStock.total_quantity : 0;
          
          if (availableQty < quantity) {
            throw new Error(`Insufficient stock. Available: ${availableQty}, Requested: ${quantity}`);
          }
        }
      } else if (item_type === 'grain') {
        const grain = await this.grainService.getById(item_id);
        if (!grain) throw new Error('Grain not found');
        item_name = grain.grain_name;
        item_unit = grain.unit;
        
        // Check stock availability for grain sales (dealer buying from shop)
        // TODO: Re-enable stock checking after initial stock is added
        if (false && ['purchase'].includes(transaction_type)) {
          const stockLevels = await this.stockService.getStockLevels({ item_type: 'grain' });
          const itemStock = stockLevels.find(s => s.item_id === item_id);
          const availableQty = itemStock ? itemStock.total_quantity : 0;
          
          if (availableQty < quantity) {
            throw new Error(`Insufficient stock. Available: ${availableQty}, Requested: ${quantity}`);
          }
        }
      }

      // Generate transaction number
      const transaction_number = await this.generateTransactionNumber();

      // Determine transaction direction for stock
      let stock_change_type = null;
      let transactionIcon = '';
      
      if (transaction_type === 'buy') {
        // Farmer/Dealer buys from shop - stock decreases
        stock_change_type = 'OUT';
        transactionIcon = '🛒';
        console.log(`[TransactionService] 🛒 FARMER/DEALER BUY - ${entity_name} purchasing ${item_name}`);
      } else if (transaction_type === 'sell') {
        // Farmer sells grain to shop - stock increases
        stock_change_type = 'IN';
        transactionIcon = '🌾';
        console.log(`[TransactionService] 🌾 FARMER SELL - ${entity_name} selling ${item_name} to shop`);
      } else if (transaction_type === 'delivery') {
        // Company delivers to shop - stock increases
        stock_change_type = 'IN';
        transactionIcon = '🚚';
        console.log(`[TransactionService] 🚚 COMPANY DELIVERY - ${entity_name} delivering ${item_name} to shop`);
      } else if (transaction_type === 'purchase') {
        // Dealer purchases from shop - stock decreases
        stock_change_type = 'OUT';
        transactionIcon = '🛍️';
        console.log(`[TransactionService] 🛍️ DEALER PURCHASE - ${entity_name} purchasing ${item_name} from shop`);
      } else if (transaction_type === 'adjustment') {
        // Manual stock adjustment
        stock_change_type = quantity > 0 ? 'IN' : 'OUT';
        transactionIcon = '⚙️';
        console.log(`[TransactionService] ⚙️ STOCK ADJUSTMENT - ${quantity > 0 ? 'Adding' : 'Removing'} ${item_name}`);
      }

      // Begin transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // Insert transaction record
        const transactionResult = await this.db.execute(
          `INSERT INTO Transactions (
            transaction_number,
            transaction_type,
            entity_type,
            entity_id,
            entity_table,
            entity_name,
            temp_customer_name,
            temp_customer_father_name,
            temp_customer_cnic,
            temp_customer_phone,
            temp_customer_address,
            item_type,
            item_id,
            quantity,
            unit_price,
            total_amount,
            payment_type,
            cash_paid,
            credit_amount,
            description,
            created_by,
            transaction_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            transaction_number,
            transaction_type,
            entity_type,
            entity_id,
            entity_table,
            entity_name, // Store entity name directly for both regular and irregular
            entity_type === 'irregular' ? entity_info?.name : null,
            entity_type === 'irregular' ? entity_info?.father_name : null,
            entity_type === 'irregular' ? entity_info?.cnic : null,
            entity_type === 'irregular' ? entity_info?.phone : null,
            entity_type === 'irregular' ? entity_info?.address : null,
            item_type,
            item_id,
            quantity,
            unit_price,
            total_amount,
            payment_type,
            cash_paid || 0,
            credit_amount || 0,
            description,
            created_by
          ]
        );

        const transaction_id = transactionResult.lastID;

        // Update stock levels
        // Convert item_type to uppercase for Stock table (Stock uses PRODUCT/GRAIN, Transactions uses product/grain)
        const stock_item_type = item_type.toUpperCase();
        
        if (stock_change_type === 'IN') {
          // Add stock (farmer sells grain, company delivers products)
          console.log(`[TransactionService] 📦 STOCK IN - Adding stock:`, {
            item_type: stock_item_type,
            item_id,
            item_name,
            quantity,
            unit_price,
            stock_location: stock_location || 'Main Warehouse',
            note: 'No stock validation - always accepts farmer grain'
          });
          
          const stockResult = await this.stockService.addStock(
            stock_item_type,
            item_id,
            quantity,
            unit_price,
            'TRANSACTION',
            transaction_id,
            `${transaction_type} - ${entity_name} - ${item_name}`,
            created_by,
            stock_location || 'Main Warehouse' // Pass stock location
          );
          
          console.log(`[TransactionService] ✅ Stock added successfully:`, {
            is_new_batch: stockResult.is_new_batch,
            previous_quantity: stockResult.previous_quantity,
            new_quantity: stockResult.new_quantity,
            message: stockResult.message
          });
        } else if (stock_change_type === 'OUT') {
          // Remove stock (farmer/dealer buys products/grains from shop)
          console.log(`[TransactionService] Calling removeStock with:`, {
            item_type: stock_item_type,
            item_id,
            item_id_type: typeof item_id,
            quantity,
            quantity_type: typeof quantity
          });
          
          const removeResult = await this.stockService.removeStock(
            stock_item_type,
            item_id,
            quantity,
            'TRANSACTION',
            transaction_id,
            `${transaction_type} - ${entity_name} - ${item_name}`,
            created_by
          );
          
          if (!removeResult.success) {
            throw new Error(removeResult.message || 'Failed to remove stock');
          }
        }

        // Update entity ledger if credit involved
        if (credit_amount > 0 && entity_type === 'regular' && entity_id) {
          // Record credit entry in entity ledger (will be implemented based on module)
          // For now, just log it
          console.log(`Credit of ${credit_amount} recorded for ${entity_table} ${entity_id}`);
        }

        // Commit transaction
        await this.db.execute('COMMIT');

        return {
          success: true,
          message: 'Transaction created successfully',
          data: {
            transaction_id,
            transaction_number,
            entity_name,
            item_name,
            total_amount
          }
        };

      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Error in createUniversalTransaction:', error);
      throw error;
    }
  }

  /**
   * Process Farmer Purchases Product
   * Farmer buys fertilizer/pesticide from shop
   */
  async processFarmerPurchase(data, userId) {
    const validation = this.validateTransaction(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Verify farmer exists
    const farmer = await this.farmerService.getById(data.entity_id);
    if (!farmer) {
      throw new Error('Farmer not found');
    }

    // Verify product exists
    const product = await this.productService.getById(data.item_id);
    if (!product) {
      throw new Error('Product not found');
    }

    // Check stock availability
    const availableStock = await this.stockService.getAvailableQuantity(
      'PRODUCT',
      data.item_id
    );
    if (availableStock < data.quantity) {
      throw new Error(
        `Insufficient stock. Available: ${availableStock}, Required: ${data.quantity}`
      );
    }

    const transactionNumber = await this.generateTransactionNumber();
    const totalAmount = data.quantity * data.unit_price;

    try {
      // Start transaction
      this.db.execute('BEGIN TRANSACTION');

      // 1. Create transaction record
      const transactionResult = await this.db.execute(
        `INSERT INTO Transactions (
          transaction_number, transaction_type, transaction_date,
          entity_type, entity_id, item_type, item_id,
          quantity, unit_price, total_amount,
          payment_type, cash_paid, credit_amount,
          description, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionNumber,
          'FARMER_PURCHASE',
          data.transaction_date || new Date().toISOString(),
          'farmer',
          data.entity_id,
          'product',
          data.item_id,
          data.quantity,
          data.unit_price,
          totalAmount,
          data.payment_type,
          data.cash_paid || 0,
          data.credit_amount || 0,
          data.description || `Farmer purchase - ${product.product_name}`,
          userId
        ]
      );

      const transactionId = transactionResult.lastInsertRowid;

      // 2. Remove stock using FIFO
      await this.stockService.removeStock(
        'PRODUCT',
        data.item_id,
        data.quantity,
        'SALE',
        'FARMER_PURCHASE',
        transactionId,
        userId
      );

      // 3. Update farmer credit if not full cash payment
      if (data.credit_amount > 0) {
        await this.db.execute(
          `UPDATE Farmers 
           SET credit = credit + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE farmer_id = ?`,
          [data.credit_amount, data.entity_id]
        );
      }

      // 4. Create ledger entry (DEBIT - farmer owes shop)
      if (data.credit_amount > 0) {
        const previousBalance = await this.getEntityBalance('farmer', data.entity_id);
        const newBalance = previousBalance + data.credit_amount;

        await this.db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'farmer',
            data.entity_id,
            'FARMER_PURCHASE',
            transactionId,
            data.credit_amount,
            0,
            newBalance,
            `Purchase on credit - ${product.product_name}`,
            userId
          ]
        );
      }

      // 5. Update daily summary
      await this.updateDailySummary(
        data.transaction_date || new Date().toISOString(),
        {
          total_sales: totalAmount,
          cash_received: data.cash_paid || 0,
          credit_given: data.credit_amount || 0
        }
      );

      // 6. Create history record
      await this.db.createHistoryEntry(
        'CREATE',
        'Transactions',
        transactionId,
        null,
        {
          transaction_number: transactionNumber,
          type: 'FARMER_PURCHASE',
          farmer: farmer.name,
          product: product.product_name,
          quantity: data.quantity,
          total_amount: totalAmount
        },
        userId,
        `Farmer purchase transaction created: ${transactionNumber}`
      );

      // Commit transaction
      this.db.execute('COMMIT');

      return {
        success: true,
        transaction_id: transactionId,
        transaction_number: transactionNumber,
        total_amount: totalAmount,
        message: 'Transaction processed successfully'
      };
    } catch (error) {
      // Rollback on error
      this.db.execute('ROLLBACK');
      console.error('Error processing farmer purchase:', error);
      throw error;
    }
  }

  /**
   * Process Farmer Sells Grain
   * Farmer sells wheat/maize to shop
   */
  async processFarmerSaleGrain(data, userId) {
    const validation = this.validateTransaction(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Verify farmer exists
    const farmer = await this.farmerService.getById(data.entity_id);
    if (!farmer) {
      throw new Error('Farmer not found');
    }

    // Verify grain exists
    const grain = await this.grainService.getById(data.item_id);
    if (!grain) {
      throw new Error('Grain not found');
    }

    const transactionNumber = await this.generateTransactionNumber();
    const totalAmount = data.quantity * data.unit_price;

    try {
      // Start transaction
      this.db.execute('BEGIN TRANSACTION');

      // 1. Create transaction record
      const transactionResult = await this.db.execute(
        `INSERT INTO Transactions (
          transaction_number, transaction_type, transaction_date,
          entity_type, entity_id, item_type, item_id,
          quantity, unit_price, total_amount,
          payment_type, cash_paid, credit_amount,
          description, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionNumber,
          'FARMER_SALE_GRAIN',
          data.transaction_date || new Date().toISOString(),
          'farmer',
          data.entity_id,
          'grain',
          data.item_id,
          data.quantity,
          data.unit_price,
          totalAmount,
          data.payment_type,
          data.cash_paid || 0,
          data.credit_amount || 0,
          data.description || `Farmer grain sale - ${grain.grain_name}`,
          userId
        ]
      );

      const transactionId = transactionResult.lastInsertRowid;

      // 2. Add stock (grain purchased from farmer)
      await this.stockService.addStock(
        'GRAIN',
        data.item_id,
        data.quantity,
        data.unit_price,
        'PURCHASE',              // referenceType
        transactionId,           // referenceId
        `Farmer grain sale - ${grain.grain_name} - TXN-${transactionNumber}`, // notes
        userId,                  // userId
        'Main Warehouse'         // stockLocation
      );

      // 3. Update farmer balance (shop owes farmer if not full cash)
      if (data.credit_amount > 0) {
        await this.db.execute(
          `UPDATE Farmers 
           SET balance = balance + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE farmer_id = ?`,
          [data.credit_amount, data.entity_id]
        );
      }

      // 4. Create ledger entry (CREDIT - shop owes farmer)
      if (data.credit_amount > 0) {
        const previousBalance = await this.getEntityBalance('farmer', data.entity_id);
        const newBalance = previousBalance - data.credit_amount; // Negative means shop owes

        await this.db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'farmer',
            data.entity_id,
            'FARMER_SALE_GRAIN',
            transactionId,
            0,
            data.credit_amount,
            newBalance,
            `Grain sale on credit - ${grain.grain_name}`,
            userId
          ]
        );
      }

      // 5. Update daily summary
      await this.updateDailySummary(
        data.transaction_date || new Date().toISOString(),
        {
          total_purchases: totalAmount,
          cash_paid: data.cash_paid || 0,
          credit_received: data.credit_amount || 0
        }
      );

      // 6. Create history record
      await this.db.createHistoryEntry(
        'CREATE',
        'Transactions',
        transactionId,
        null,
        {
          transaction_number: transactionNumber,
          type: 'FARMER_SALE_GRAIN',
          farmer: farmer.name,
          grain: grain.grain_name,
          quantity: data.quantity,
          total_amount: totalAmount
        },
        userId,
        `Farmer grain sale transaction created: ${transactionNumber}`
      );

      // Commit transaction
      this.db.execute('COMMIT');

      return {
        success: true,
        transaction_id: transactionId,
        transaction_number: transactionNumber,
        total_amount: totalAmount,
        message: 'Transaction processed successfully'
      };
    } catch (error) {
      // Rollback on error
      this.db.execute('ROLLBACK');
      console.error('Error processing farmer grain sale:', error);
      throw error;
    }
  }

  /**
   * Get entity balance from ledger
   */
  async getEntityBalance(entityType, entityId) {
    const result = await this.db.query(
      `SELECT balance 
       FROM LedgerEntries 
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY entry_date DESC, entry_id DESC
       LIMIT 1`,
      [entityType, entityId]
    );

    return result.length > 0 ? result[0].balance : 0;
  }

  /**
   * Update daily transactions summary
   */
  async updateDailySummary(date, updates) {
    const summaryDate = date.split('T')[0]; // Get date part only

    // Check if summary exists for today
    const existing = await this.db.query(
      'SELECT * FROM DailyTransactionsSummary WHERE summary_date = ?',
      [summaryDate]
    );

    if (existing.length > 0) {
      // Update existing summary
      const current = existing[0];
      await this.db.execute(
        `UPDATE DailyTransactionsSummary 
         SET total_transactions = total_transactions + 1,
             total_sales = total_sales + ?,
             total_purchases = total_purchases + ?,
             cash_received = cash_received + ?,
             cash_paid = cash_paid + ?,
             credit_given = credit_given + ?,
             credit_received = credit_received + ?,
             net_cash_flow = (cash_received + ?) - (cash_paid + ?),
             updated_at = CURRENT_TIMESTAMP
         WHERE summary_date = ?`,
        [
          updates.total_sales || 0,
          updates.total_purchases || 0,
          updates.cash_received || 0,
          updates.cash_paid || 0,
          updates.credit_given || 0,
          updates.credit_received || 0,
          (current.cash_received || 0) + (updates.cash_received || 0),  // Use cumulative cash_received for net calculation
          (current.cash_paid || 0) + (updates.cash_paid || 0),          // Use cumulative cash_paid for net calculation
          summaryDate
        ]
      );
    } else {
      // Create new summary
      await this.db.execute(
        `INSERT INTO DailyTransactionsSummary (
          summary_date, total_transactions,
          total_sales, total_purchases,
          cash_received, cash_paid,
          credit_given, credit_received, net_cash_flow
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          summaryDate,
          1,
          updates.total_sales || 0,
          updates.total_purchases || 0,
          updates.cash_received || 0,
          updates.cash_paid || 0,
          updates.credit_given || 0,
          updates.credit_received || 0,
          (updates.cash_received || 0) - (updates.cash_paid || 0)
        ]
      );
    }
  }

  /**
   * Get all transactions with filters
   */
  async getTransactions(filters = {}) {
    let query = `
      SELECT 
        t.*,
        COALESCE(
          t.entity_name,
          CASE 
            WHEN LOWER(t.entity_table) = 'farmer' THEN f.name
            WHEN LOWER(t.entity_table) = 'dealer' THEN d.name
            WHEN LOWER(t.entity_table) = 'company' THEN c.company_name
            ELSE t.temp_customer_name
          END
        ) as entity_name,
        CASE 
          WHEN t.item_type = 'product' THEN p.product_name
          WHEN t.item_type = 'grain' THEN g.grain_name
        END as item_name,
        u.username as created_by_name
      FROM Transactions t
      LEFT JOIN Farmers f ON LOWER(t.entity_table) = 'farmer' AND t.entity_id = f.farmer_id
      LEFT JOIN Dealers d ON LOWER(t.entity_table) = 'dealer' AND t.entity_id = d.dealer_id
      LEFT JOIN Companies c ON LOWER(t.entity_table) = 'company' AND t.entity_id = c.company_id
      LEFT JOIN Products p ON t.item_type = 'product' AND t.item_id = p.product_id
      LEFT JOIN GrainTypes g ON t.item_type = 'grain' AND t.item_id = g.grain_id
      LEFT JOIN Users u ON t.created_by = u.user_id
      WHERE 1=1
    `;

    const params = [];

    if (filters.transaction_type) {
      query += ' AND t.transaction_type = ?';
      params.push(filters.transaction_type);
    }

    if (filters.entity_type) {
      query += ' AND t.entity_type = ?';
      params.push(filters.entity_type);
    }

    if (filters.entity_id) {
      query += ' AND t.entity_id = ?';
      params.push(filters.entity_id);
    }

    if (filters.date_from) {
      query += ' AND DATE(t.transaction_date) >= ?';
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ' AND DATE(t.transaction_date) <= ?';
      params.push(filters.date_to);
    }

    if (filters.payment_type) {
      query += ' AND t.payment_type = ?';
      params.push(filters.payment_type);
    }

    query += ' ORDER BY t.transaction_date DESC, t.transaction_id DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return await this.db.query(query, params);
  }

  /**
   * Get transaction by ID
   */
  async getById(transactionId) {
    const result = await this.db.query(
      `SELECT 
        t.*,
        COALESCE(
          t.entity_name,
          CASE 
            WHEN LOWER(t.entity_table) = 'farmer' THEN f.name
            WHEN LOWER(t.entity_table) = 'dealer' THEN d.name
            WHEN LOWER(t.entity_table) = 'company' THEN c.company_name
            ELSE t.temp_customer_name
          END
        ) as entity_name,
        CASE 
          WHEN t.item_type = 'product' THEN p.product_name
          WHEN t.item_type = 'grain' THEN g.grain_name
        END as item_name,
        CASE 
          WHEN t.item_type = 'product' THEN p.unit_of_measure
          WHEN t.item_type = 'grain' THEN g.unit_of_measure
        END as unit,
        u.username as created_by_name,
        -- Entity Details from Permanent Records
        f.specific_id as farmer_specific_id,
        f.father_name as farmer_father_name,
        f.cnic as farmer_cnic,
        f.phone as farmer_phone,
        f.address as farmer_address,
        d.specific_id as dealer_specific_id,
        d.contact_person as dealer_contact_person,
        d.cnic as dealer_cnic,
        d.phone as dealer_phone,
        d.address as dealer_address,
        c.specific_id as company_specific_id,
        c.contact_person as company_contact_person,
        c.phone as company_phone,
        c.address as company_address
      FROM Transactions t
      LEFT JOIN Farmers f ON LOWER(t.entity_table) = 'farmer' AND t.entity_id = f.farmer_id
      LEFT JOIN Dealers d ON LOWER(t.entity_table) = 'dealer' AND t.entity_id = d.dealer_id
      LEFT JOIN Companies c ON LOWER(t.entity_table) = 'company' AND t.entity_id = c.company_id
      LEFT JOIN Products p ON t.item_type = 'product' AND t.item_id = p.product_id
      LEFT JOIN GrainTypes g ON t.item_type = 'grain' AND t.item_id = g.grain_id
      LEFT JOIN Users u ON t.created_by = u.user_id
      WHERE t.transaction_id = ?`,
      [transactionId]
    );

    console.log('[TransactionService] ==================== getById RESULT ====================');
    console.log('[TransactionService] Transaction ID requested:', transactionId);
    console.log('[TransactionService] Query returned rows:', result.length);
    if (result.length > 0) {
      console.log('[TransactionService] Transaction found:', result[0].transaction_number);
      console.log('[TransactionService] Entity Type:', result[0].entity_type);
      console.log('[TransactionService] Entity Table:', result[0].entity_table);
      console.log('[TransactionService] Entity Name:', result[0].entity_name);
      console.log('[TransactionService] Total Amount:', result[0].total_amount);
      console.log('[TransactionService] Item Name:', result[0].item_name);
      console.log('[TransactionService] All keys:', Object.keys(result[0]));
    } else {
      console.log('[TransactionService] No transaction found with ID:', transactionId);
    }
    console.log('[TransactionService] ====================================================================');

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get daily summary for a specific date
   */
  async getDailySummary(date) {
    const summaryDate = date.split('T')[0];
    const result = await this.db.query(
      'SELECT * FROM DailyTransactionsSummary WHERE summary_date = ?',
      [summaryDate]
    );

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get daily summaries with date range
   */
  async getDailySummaries(dateFrom, dateTo) {
    return await this.db.query(
      `SELECT * FROM DailyTransactionsSummary 
       WHERE summary_date BETWEEN ? AND ?
       ORDER BY summary_date DESC`,
      [dateFrom, dateTo]
    );
  }

  /**
   * Get transaction statistics
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN transaction_type LIKE '%PURCHASE%' OR transaction_type LIKE '%DELIVERY%' THEN total_amount ELSE 0 END) as total_purchases,
        SUM(CASE WHEN transaction_type LIKE '%SALE%' OR transaction_type LIKE '%RETAIL_SALE%' THEN total_amount ELSE 0 END) as total_sales,
        SUM(cash_paid) as total_cash,
        SUM(credit_amount) as total_credit
      FROM Transactions
      WHERE 1=1
    `;

    const params = [];

    if (filters.industry_type) {
      query += ' AND industry_type = ?';
      params.push(filters.industry_type);
    }

    if (filters.date_from || filters.start_date) {
      query += ' AND DATE(transaction_date) >= ?';
      params.push(filters.date_from || filters.start_date);
    }

    if (filters.date_to || filters.end_date) {
      query += ' AND DATE(transaction_date) <= ?';
      params.push(filters.date_to || filters.end_date);
    }

    const result = await this.db.query(query, params);
    return result[0];
  }

  /**
   * Check if transaction can be modified (same day only)
   * Sprint 6: Transaction Edit/Delete
   */
  canModifyTransaction(transaction) {
    const transactionDate = new Date(transaction.transaction_date).toDateString();
    const today = new Date().toDateString();
    return transactionDate === today;
  }

  /**
   * Reverse stock changes for a transaction
   * Sprint 6: Transaction Edit/Delete
   */
  async reverseStockChanges(transaction, userId) {
    console.log('[TransactionService] Reversing stock for transaction:', transaction.transaction_number);
    
    const itemType = transaction.item_type?.toUpperCase();
    const quantity = parseFloat(transaction.quantity) || 0;
    
    if (!itemType || !transaction.item_id || quantity <= 0) {
      console.log('[TransactionService] No stock to reverse - missing item data');
      return { success: true, message: 'No stock changes to reverse' };
    }

    // Determine original stock direction
    const inTransactionTypes = ['FARMER_SALE_GRAIN', 'COMPANY_DELIVERY', 'GRAIN_PURCHASE'];
    const outTransactionTypes = ['FARMER_PURCHASE', 'DEALER_PURCHASE'];
    
    const wasStockIn = inTransactionTypes.includes(transaction.transaction_type);
    const wasStockOut = outTransactionTypes.includes(transaction.transaction_type);

    try {
      if (wasStockIn) {
        // Original was IN, so we need to remove stock (reverse)
        console.log(`[TransactionService] Reversing STOCK IN: Removing ${quantity} of ${itemType} ${transaction.item_id}`);
        await this.stockService.removeStock(
          itemType,
          transaction.item_id,
          quantity,
          'REVERSAL',
          transaction.transaction_id,
          `Reversal of transaction ${transaction.transaction_number}`,
          userId
        );
      } else if (wasStockOut) {
        // Original was OUT, so we need to add stock back (reverse)
        console.log(`[TransactionService] Reversing STOCK OUT: Adding back ${quantity} of ${itemType} ${transaction.item_id}`);
        await this.stockService.addStock(
          itemType,
          transaction.item_id,
          quantity,
          transaction.unit_price || 0,
          'REVERSAL',
          transaction.transaction_id,
          `Reversal of transaction ${transaction.transaction_number}`,
          userId,
          'Main Warehouse'
        );
      }

      return { success: true, message: 'Stock changes reversed successfully' };
    } catch (error) {
      console.error('[TransactionService] Error reversing stock:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Reverse ledger/balance changes for a transaction
   * Sprint 6: Transaction Edit/Delete
   */
  async reverseLedgerChanges(transaction, userId) {
    console.log('[TransactionService] Reversing ledger for transaction:', transaction.transaction_number);
    
    if (transaction.entity_type !== 'regular' || !transaction.entity_id) {
      console.log('[TransactionService] No ledger to reverse - walk-in customer');
      return { success: true, message: 'No ledger changes to reverse' };
    }

    const creditAmount = parseFloat(transaction.credit_amount) || 0;
    if (creditAmount <= 0) {
      console.log('[TransactionService] No credit to reverse');
      return { success: true, message: 'No credit changes to reverse' };
    }

    try {
      const entityTable = transaction.entity_table?.toLowerCase() || '';
      
      // Determine how to reverse based on transaction type
      const entityOwesShop = ['FARMER_PURCHASE', 'DEALER_PURCHASE'];
      const shopOwesEntity = ['FARMER_SALE_GRAIN', 'COMPANY_DELIVERY'];

      if (entityOwesShop.includes(transaction.transaction_type)) {
        // Original increased entity's credit (they owe shop) - now decrease it
        if (entityTable === 'farmer' || entityTable === 'farmers') {
          await this.db.execute(
            'UPDATE Farmers SET credit = credit - ? WHERE farmer_id = ?',
            [creditAmount, transaction.entity_id]
          );
        } else if (entityTable === 'dealer' || entityTable === 'dealers') {
          await this.db.execute(
            'UPDATE Dealers SET credit = credit - ? WHERE dealer_id = ?',
            [creditAmount, transaction.entity_id]
          );
        }
        console.log(`[TransactionService] Decreased ${entityTable} credit by ${creditAmount}`);
      } else if (shopOwesEntity.includes(transaction.transaction_type)) {
        // Original increased entity's balance (shop owes them) - now decrease it
        if (entityTable === 'farmer' || entityTable === 'farmers') {
          await this.db.execute(
            'UPDATE Farmers SET balance = balance - ? WHERE farmer_id = ?',
            [creditAmount, transaction.entity_id]
          );
        } else if (entityTable === 'company' || entityTable === 'companies') {
          await this.db.execute(
            'UPDATE Companies SET balance = balance - ? WHERE company_id = ?',
            [creditAmount, transaction.entity_id]
          );
        }
        console.log(`[TransactionService] Decreased ${entityTable} balance by ${creditAmount}`);
      }

      // Add reversal ledger entry
      // REVERSAL logic: Undo the original transaction's effect
      // If original was PURCHASE (entity owes shop = DEBIT), reversal should be CREDIT
      // If original was SALE (shop owes entity = CREDIT), reversal should be DEBIT
      await this.db.execute(
        `INSERT INTO LedgerEntries (
          entity_type, entity_id, transaction_id, entry_date,
          transaction_type, description, debit, credit, balance
        ) VALUES (?, ?, ?, datetime('now'), 'REVERSAL', ?, ?, ?, 0)`,
        [
          entityTable,
          transaction.entity_id,
          transaction.transaction_id,
          `Reversal of ${transaction.transaction_number}`,
          shopOwesEntity.includes(transaction.transaction_type) ? creditAmount : 0,  // DEBIT: reverse a sale
          entityOwesShop.includes(transaction.transaction_type) ? creditAmount : 0   // CREDIT: reverse a purchase
        ]
      );

      return { success: true, message: 'Ledger changes reversed successfully' };
    } catch (error) {
      console.error('[TransactionService] Error reversing ledger:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Delete a transaction (soft delete with reversal)
   * Sprint 6: Transaction Delete
   * @param {number} transactionId - The transaction ID to delete
   * @param {number} userId - The user performing the deletion
   * @param {string} reason - Reason for deletion
   */
  async deleteTransaction(transactionId, userId, reason = '') {
    try {
      console.log('[TransactionService] ==================== DELETE TRANSACTION ====================');
      console.log('[TransactionService] Transaction ID:', transactionId);
      console.log('[TransactionService] User ID:', userId);
      console.log('[TransactionService] Reason:', reason);

      // Step 1: Get the transaction
      const transaction = await this.getById(transactionId);
      if (!transaction) {
        return { success: false, message: 'Transaction not found' };
      }

      // Step 2: Check if can be modified (same day only)
      if (!this.canModifyTransaction(transaction)) {
        return { 
          success: false, 
          message: 'Cannot delete transaction from previous days. Only same-day transactions can be deleted.' 
        };
      }

      // Step 3: Begin database transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // Step 4: Reverse stock changes
        const stockResult = await this.reverseStockChanges(transaction, userId);
        if (!stockResult.success) {
          throw new Error(`Stock reversal failed: ${stockResult.message}`);
        }

        // Step 5: Reverse ledger/balance changes
        const ledgerResult = await this.reverseLedgerChanges(transaction, userId);
        if (!ledgerResult.success) {
          throw new Error(`Ledger reversal failed: ${ledgerResult.message}`);
        }

        // Step 6: Delete transaction items (for multi-item transactions)
        await this.db.execute(
          'DELETE FROM TransactionItems WHERE transaction_id = ?',
          [transactionId]
        );

        // Step 7: Delete the transaction
        await this.db.execute(
          'DELETE FROM Transactions WHERE transaction_id = ?',
          [transactionId]
        );

        // Step 8: Update daily summary
        await this.updateDailySummaryOnDelete(transaction);

        // Step 9: Log to history
        await this.db.execute(
          `INSERT INTO History (
            action_type, table_name, record_id, old_values, 
            performed_by, performed_at, description
          ) VALUES ('DELETE', 'Transactions', ?, ?, ?, datetime('now'), ?)`,
          [
            transactionId,
            JSON.stringify(transaction),
            userId,
            `Transaction ${transaction.transaction_number} deleted. Reason: ${reason || 'Not specified'}`
          ]
        );

        // Step 10: Commit
        await this.db.execute('COMMIT');

        console.log('[TransactionService] ✅ Transaction deleted successfully');
        return { 
          success: true, 
          message: `Transaction ${transaction.transaction_number} deleted successfully`,
          deletedTransaction: transaction
        };

      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[TransactionService] ❌ Delete error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update daily summary when transaction is deleted
   */
  async updateDailySummaryOnDelete(transaction) {
    const summaryDate = new Date(transaction.transaction_date).toISOString().split('T')[0];
    
    const existingSummary = await this.db.query(
      'SELECT * FROM DailyTransactionsSummary WHERE summary_date = ?',
      [summaryDate]
    );

    if (existingSummary.length > 0) {
      const summary = existingSummary[0];
      const isSale = transaction.transaction_type.includes('SALE') || 
                     transaction.transaction_type.includes('PURCHASE');
      
      await this.db.execute(
        `UPDATE DailyTransactionsSummary SET
          total_transactions = total_transactions - 1,
          total_sales = total_sales - ?,
          cash_received = cash_received - ?,
          credit_given = credit_given - ?,
          updated_at = datetime('now')
        WHERE summary_date = ?`,
        [
          parseFloat(transaction.total_amount) || 0,
          parseFloat(transaction.cash_paid) || 0,
          parseFloat(transaction.credit_amount) || 0,
          summaryDate
        ]
      );
    }
  }

  /**
   * Edit a transaction
   * Sprint 6: Transaction Edit
   * @param {number} transactionId - The transaction ID to edit
   * @param {object} newData - The updated transaction data
   * @param {number} userId - The user performing the edit
   */
  async editTransaction(transactionId, newData, userId) {
    try {
      console.log('[TransactionService] ==================== EDIT TRANSACTION ====================');
      console.log('[TransactionService] Transaction ID:', transactionId);

      // Step 1: Get the original transaction
      const originalTransaction = await this.getById(transactionId);
      if (!originalTransaction) {
        return { success: false, message: 'Transaction not found' };
      }

      // Step 2: Check if can be modified (same day only)
      if (!this.canModifyTransaction(originalTransaction)) {
        return { 
          success: false, 
          message: 'Cannot edit transaction from previous days. Only same-day transactions can be edited.' 
        };
      }

      // Step 3: Begin database transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // Step 4: Reverse original stock changes
        const stockResult = await this.reverseStockChanges(originalTransaction, userId);
        if (!stockResult.success) {
          throw new Error(`Stock reversal failed: ${stockResult.message}`);
        }

        // Step 5: Reverse original ledger changes
        const ledgerResult = await this.reverseLedgerChanges(originalTransaction, userId);
        if (!ledgerResult.success) {
          throw new Error(`Ledger reversal failed: ${ledgerResult.message}`);
        }

        // Step 6: Update transaction record
        const quantity = newData.quantity || originalTransaction.quantity;
        const unitPrice = newData.unit_price || originalTransaction.unit_price;
        const totalAmount = quantity * unitPrice;
        const paymentType = newData.payment_type || originalTransaction.payment_type;
        
        let cashPaid = 0;
        let creditAmount = 0;
        
        if (paymentType === 'CASH') {
          cashPaid = totalAmount;
        } else if (paymentType === 'CREDIT') {
          creditAmount = totalAmount;
        } else if (paymentType === 'PARTIAL') {
          cashPaid = newData.cash_paid || 0;
          creditAmount = totalAmount - cashPaid;
        }

        await this.db.execute(
          `UPDATE Transactions SET
            quantity = ?,
            unit_price = ?,
            total_amount = ?,
            payment_type = ?,
            cash_paid = ?,
            credit_amount = ?,
            description = ?,
            created_at = datetime('now')
          WHERE transaction_id = ?`,
          [
            quantity,
            unitPrice,
            totalAmount,
            paymentType,
            cashPaid,
            creditAmount,
            newData.description || originalTransaction.description,
            transactionId
          ]
        );

        // Step 7: Apply new stock changes
        const newTransaction = {
          ...originalTransaction,
          quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          payment_type: paymentType,
          cash_paid: cashPaid,
          credit_amount: creditAmount
        };

        await this.applyStockChanges(newTransaction, userId);

        // Step 8: Apply new ledger changes
        if (creditAmount > 0 && originalTransaction.entity_type === 'regular') {
          await this.applyLedgerChanges(newTransaction, userId);
        }

        // Step 9: Log to history
        await this.db.execute(
          `INSERT INTO History (
            action_type, table_name, record_id, old_values, new_values,
            performed_by, performed_at, description
          ) VALUES ('UPDATE', 'Transactions', ?, ?, ?, ?, datetime('now'), ?)`,
          [
            transactionId,
            JSON.stringify(originalTransaction),
            JSON.stringify(newTransaction),
            userId,
            `Transaction ${originalTransaction.transaction_number} edited`
          ]
        );

        // Step 10: Commit
        await this.db.execute('COMMIT');

        console.log('[TransactionService] ✅ Transaction edited successfully');
        return { 
          success: true, 
          message: `Transaction ${originalTransaction.transaction_number} updated successfully`,
          transaction: newTransaction
        };

      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[TransactionService] ❌ Edit error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Apply stock changes for a transaction (used in edit)
   */
  async applyStockChanges(transaction, userId) {
    const itemType = transaction.item_type?.toUpperCase();
    const quantity = parseFloat(transaction.quantity) || 0;
    
    if (!itemType || !transaction.item_id || quantity <= 0) {
      return;
    }

    const inTransactionTypes = ['FARMER_SALE_GRAIN', 'COMPANY_DELIVERY', 'GRAIN_PURCHASE'];
    const outTransactionTypes = ['FARMER_PURCHASE', 'DEALER_PURCHASE'];
    
    const isStockIn = inTransactionTypes.includes(transaction.transaction_type);
    const isStockOut = outTransactionTypes.includes(transaction.transaction_type);

    if (isStockIn) {
      await this.stockService.addStock(
        itemType,
        transaction.item_id,
        quantity,
        transaction.unit_price || 0,
        'TRANSACTION',
        transaction.transaction_id,
        `${transaction.transaction_type} - ${transaction.entity_name || 'Unknown'}`,
        userId,
        'Main Warehouse'
      );
    } else if (isStockOut) {
      await this.stockService.removeStock(
        itemType,
        transaction.item_id,
        quantity,
        'TRANSACTION',
        transaction.transaction_id,
        `${transaction.transaction_type} - ${transaction.entity_name || 'Unknown'}`,
        userId
      );
    }
  }

  /**
   * Apply ledger changes for a transaction (used in edit)
   */
  async applyLedgerChanges(transaction, userId) {
    const creditAmount = parseFloat(transaction.credit_amount) || 0;
    if (creditAmount <= 0 || transaction.entity_type !== 'regular') {
      return;
    }

    const entityTable = transaction.entity_table?.toLowerCase() || '';
    const entityOwesShop = ['FARMER_PURCHASE', 'DEALER_PURCHASE'];

    if (entityOwesShop.includes(transaction.transaction_type)) {
      if (entityTable === 'farmer' || entityTable === 'farmers') {
        await this.db.execute(
          'UPDATE Farmers SET credit = credit + ? WHERE farmer_id = ?',
          [creditAmount, transaction.entity_id]
        );
      } else if (entityTable === 'dealer' || entityTable === 'dealers') {
        await this.db.execute(
          'UPDATE Dealers SET credit = credit + ? WHERE dealer_id = ?',
          [creditAmount, transaction.entity_id]
        );
      }
    } else {
      if (entityTable === 'farmer' || entityTable === 'farmers') {
        await this.db.execute(
          'UPDATE Farmers SET balance = balance + ? WHERE farmer_id = ?',
          [creditAmount, transaction.entity_id]
        );
      } else if (entityTable === 'company' || entityTable === 'companies') {
        await this.db.execute(
          'UPDATE Companies SET balance = balance + ? WHERE company_id = ?',
          [creditAmount, transaction.entity_id]
        );
      }
    }
  }

  /**
   * Void a transaction (soft delete - keeps record for audit trail)
   * Sprint 5: Transaction void with same-day restriction
   */
  async voidTransaction(transactionId, userId, reason = '') {
    try {
      console.log('[TransactionService] ==================== VOID TRANSACTION ====================');
      console.log('[TransactionService] Transaction ID:', transactionId);
      console.log('[TransactionService] User ID:', userId);
      console.log('[TransactionService] Reason:', reason);

      // Step 1: Get the transaction
      const transaction = await this.getById(transactionId);
      if (!transaction) {
        return { success: false, message: 'Transaction not found' };
      }

      // Step 2: Check if already voided
      if (transaction.status === 'VOIDED') {
        return { success: false, message: 'Transaction is already voided' };
      }

      // Step 3: Check if can be modified (same day only)
      if (!this.canModifyTransaction(transaction)) {
        return {
          success: false,
          message: 'Cannot void transaction from previous days. Only same-day transactions can be voided.'
        };
      }

      // Step 4: Begin database transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // Step 5: Reverse stock changes
        const stockResult = await this.reverseStockChanges(transaction, userId);
        if (!stockResult.success) {
          throw new Error(`Stock reversal failed: ${stockResult.message}`);
        }

        // Step 6: Reverse ledger/balance changes
        const ledgerResult = await this.reverseLedgerChanges(transaction, userId);
        if (!ledgerResult.success) {
          throw new Error(`Ledger reversal failed: ${ledgerResult.message}`);
        }

        // Step 7: Mark transaction as VOIDED (soft delete)
        await this.db.execute(
          `UPDATE Transactions SET 
            status = 'VOIDED',
            voided_by = ?,
            voided_at = datetime('now'),
            void_reason = ?
          WHERE transaction_id = ?`,
          [userId, reason || 'No reason provided', transactionId]
        );

        // Step 8: Update daily summary
        await this.updateDailySummaryOnDelete(transaction);

        // Step 9: Log to history
        await this.db.execute(
          `INSERT INTO History (
            action_type, table_name, record_id, old_values,
            performed_by, performed_at, description
          ) VALUES ('VOID', 'Transactions', ?, ?, ?, datetime('now'), ?)`,
          [
            transactionId,
            JSON.stringify(transaction),
            userId,
            `Transaction ${transaction.transaction_number} voided. Reason: ${reason || 'Not specified'}`
          ]
        );

        // Step 10: Commit
        await this.db.execute('COMMIT');

        console.log('[TransactionService] Transaction voided successfully');
        return {
          success: true,
          message: `Transaction ${transaction.transaction_number} voided successfully`,
          voidedTransaction: { ...transaction, status: 'VOIDED' }
        };

      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[TransactionService] Void error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Check if a specific transaction can be modified (IPC callable)
   */
  async canModifyTransactionById(transactionId) {
    try {
      const transaction = await this.getById(transactionId);
      if (!transaction) return { canModify: false, reason: 'Transaction not found' };
      if (transaction.status === 'VOIDED') return { canModify: false, reason: 'Transaction is voided' };
      const canModify = this.canModifyTransaction(transaction);
      return {
        canModify,
        reason: canModify ? 'Same-day transaction' : 'Only same-day transactions can be modified'
      };
    } catch (error) {
      return { canModify: false, reason: error.message };
    }
  }
}

export default TransactionService;
