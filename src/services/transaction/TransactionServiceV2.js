import { DatabaseService } from '../database/DatabaseService.js';
import StockService from '../stock/StockService.js';
import { FarmerService } from '../farmer/FarmerService.js';
import { DealerService } from '../dealer/DealerService.js';
import { CompanyService } from '../company/CompanyService.js';
import ProductService from '../product/ProductService.js';
import GrainService from '../grain/GrainService.js';

/**
 * TransactionServiceV2 - Sprint 6: Multi-Item Transaction Processing
 * Supports multiple products/grains per transaction
 * Professional and systematic implementation
 */
class TransactionServiceV2 {
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
   * Validate transaction header
   */
  validateTransactionHeader(data) {
    const errors = [];

    if (!data.transaction_type) errors.push('Transaction type is required');
    if (!data.entity_type) errors.push('Entity type is required');
    
    if (data.entity_type === 'regular' && !data.entity_id) {
      errors.push('Entity ID is required for regular customers');
    }
    
    if (data.entity_type === 'irregular') {
      // Check for customer name in either temp_customer_name or temp_info.name
      const hasCustomerName = data.temp_customer_name || (data.temp_info && data.temp_info.name);
      if (!hasCustomerName) {
        errors.push('Customer name is required for walk-in customers');
      }
      
      // Check for category in either entity_category or module field
      const hasCategory = data.entity_category || data.module;
      if (!hasCategory) {
        errors.push('Customer category (Farmer/Dealer/Company) is required');
      }
    }
    
    if (!data.payment_type) errors.push('Payment type is required');
    
    // Payment validation
    const totalAmount = data.total_amount || 0;
    const cashPaid = data.cash_paid || 0;
    const creditAmount = data.credit_amount || 0;

    if (data.payment_type === 'CASH' && Math.abs(cashPaid - totalAmount) > 0.01) {
      errors.push('Cash paid must equal total amount for cash payment');
    } else if (data.payment_type === 'CREDIT' && Math.abs(creditAmount - totalAmount) > 0.01) {
      errors.push('Credit amount must equal total amount for credit payment');
    } else if (data.payment_type === 'PARTIAL') {
      if (Math.abs((cashPaid + creditAmount) - totalAmount) > 0.01) {
        errors.push('Cash paid + credit amount must equal total amount');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate line items array
   */
  validateLineItems(items) {
    const errors = [];

    if (!Array.isArray(items) || items.length === 0) {
      errors.push('At least one item is required');
      return { valid: false, errors };
    }

    if (items.length > 100) {
      errors.push('Maximum 100 items allowed per transaction');
    }

    items.forEach((item, index) => {
      const lineNum = index + 1;
      
      if (!item.item_type) {
        errors.push(`Line ${lineNum}: Item type is required`);
      } else if (!['product', 'grain'].includes(item.item_type)) {
        errors.push(`Line ${lineNum}: Item type must be 'product' or 'grain'`);
      }
      
      if (!item.item_reference_id) {
        errors.push(`Line ${lineNum}: Item reference ID is required`);
      }
      
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Line ${lineNum}: Quantity must be greater than 0`);
      }
      
      if (item.unit_price === undefined || item.unit_price < 0) {
        errors.push(`Line ${lineNum}: Unit price cannot be negative`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get entity information
   */
  async getEntityInfo(entity_type, entity_id, module, temp_info) {
    let entityData = {
      entity_name: '',
      entity_table: '',
      temp_customer_name: null,
      temp_customer_father_name: null,
      temp_customer_cnic: null,
      temp_customer_phone: null,
      temp_customer_address: null
    };

    if (entity_type === 'regular' && entity_id) {
      if (module === 'farmer') {
        const farmer = await this.farmerService.getFarmerById(entity_id);
        if (!farmer) throw new Error('Farmer not found');
        entityData.entity_name = farmer.name;
        entityData.entity_table = 'Farmers';
      } else if (module === 'dealer') {
        const dealer = await this.dealerService.getDealerById(entity_id);
        if (!dealer) throw new Error('Dealer not found');
        entityData.entity_name = dealer.name;
        entityData.entity_table = 'Dealers';
      } else if (module === 'company') {
        const company = await this.companyService.getCompanyById(entity_id);
        if (!company) throw new Error('Company not found');
        entityData.entity_name = company.company_name;
        entityData.entity_table = 'Companies';
      }
    } else if (entity_type === 'irregular' && temp_info) {
      entityData.entity_name = temp_info.name || 'Walk-in Customer';
      entityData.temp_customer_name = temp_info.name;
      entityData.temp_customer_father_name = temp_info.father_name;
      entityData.temp_customer_cnic = temp_info.cnic;
      entityData.temp_customer_phone = temp_info.phone;
      entityData.temp_customer_address = temp_info.address;
      
      // Entity table based on category
      if (module === 'farmer') entityData.entity_table = 'Farmers';
      else if (module === 'dealer') entityData.entity_table = 'Dealers';
      else if (module === 'company') entityData.entity_table = 'Companies';
    }

    return entityData;
  }

  /**
   * Enrich line items with product/grain details
   */
  async enrichLineItems(items) {
    const enrichedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const enriched = {
        line_number: i + 1,
        item_type: item.item_type,
        item_reference_id: item.item_reference_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        description: item.description || null
      };

      // Get item details
      if (item.item_type === 'product') {
        const product = await this.productService.getById(item.item_reference_id);
        if (!product) throw new Error(`Product with ID ${item.item_reference_id} not found`);
        
        enriched.item_name = product.product_name;
        enriched.item_code = product.product_code;
        enriched.unit = product.unit_of_measure || 'unit';
      } else if (item.item_type === 'grain') {
        const grain = await this.grainService.getById(item.item_reference_id);
        if (!grain) throw new Error(`Grain with ID ${item.item_reference_id} not found`);
        
        enriched.item_name = grain.grain_name;
        enriched.item_code = grain.grain_code;
        enriched.unit = grain.unit_of_measure || 'kg';
      }

      // Calculate totals
      enriched.line_total = enriched.quantity * enriched.unit_price;
      enriched.line_final_total = enriched.line_total - enriched.discount_amount;

      enrichedItems.push(enriched);
    }

    return enrichedItems;
  }

  /**
   * Check stock availability for OUT transactions
   */
  async checkStockAvailability(items, transaction_type) {
    const outTransactionTypes = [
      'FARMER_PURCHASE', 'DEALER_PURCHASE',
      'RETAIL_SALE', 'RETAIL_RETURN_OUT',
      'SALE'
    ];
    
    if (!outTransactionTypes.includes(transaction_type)) {
      return { available: true, errors: [] };
    }

    const errors = [];
    
    for (const item of items) {
      const itemType = item.item_type.toUpperCase();
      
      // Get all stock batches for this item and sum the quantities
      const batches = await this.stockService.getAllStockBatchesForItem(
        itemType,
        item.item_reference_id
      );
      
      const availableStock = batches.reduce((sum, batch) => sum + batch.quantity, 0);

      if (availableStock < item.quantity) {
        errors.push(
          `Insufficient stock for ${item.item_name}: Available ${availableStock} ${item.unit}, Requested ${item.quantity} ${item.unit}`
        );
      }
    }

    return {
      available: errors.length === 0,
      errors
    };
  }

  /**
   * Create multi-item transaction (Sprint 6)
   * Professional implementation with all validations
   */
  async createMultiItemTransaction(transactionData, items, userId) {
    try {
      console.log('[TransactionServiceV2] 🚀 Creating multi-item transaction...');
      console.log('[TransactionServiceV2] Transaction type:', transactionData.transaction_type);
      console.log('[TransactionServiceV2] Items count:', items.length);

      // Step 1: Validate transaction header
      const headerValidation = this.validateTransactionHeader(transactionData);
      if (!headerValidation.valid) {
        throw new Error(`Header validation failed: ${headerValidation.errors.join(', ')}`);
      }

      // Step 2: Validate line items
      const itemsValidation = this.validateLineItems(items);
      if (!itemsValidation.valid) {
        throw new Error(`Items validation failed: ${itemsValidation.errors.join(', ')}`);
      }

      // Step 3: Enrich line items with product/grain details
      const enrichedItems = await this.enrichLineItems(items);

      // Step 4: Calculate transaction totals
      const itemsSubtotal = enrichedItems.reduce((sum, item) => sum + item.line_total, 0);
      const totalItemDiscount = enrichedItems.reduce((sum, item) => sum + item.discount_amount, 0);
      const totalQuantity = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
      const subtotalAfterItemDiscount = itemsSubtotal - totalItemDiscount;
      
      // Handle overall discount from transactionData
      const overallDiscountAmount = transactionData.overall_discount_amount || 0;
      const totalAmount = Math.max(0, subtotalAfterItemDiscount - overallDiscountAmount);

      // Update transaction data with calculated totals
      transactionData.total_quantity = totalQuantity;
      transactionData.items_subtotal = itemsSubtotal;
      transactionData.items_discount = totalItemDiscount;
      transactionData.subtotal_after_item_discount = subtotalAfterItemDiscount;
      transactionData.overall_discount_type = transactionData.overall_discount_type || 'amount';
      transactionData.overall_discount_value = transactionData.overall_discount_value || 0;
      transactionData.overall_discount_amount = overallDiscountAmount;
      transactionData.total_amount = totalAmount;

      console.log('[TransactionServiceV2] 📊 Calculated totals:', {
        itemsSubtotal,
        totalItemDiscount,
        subtotalAfterItemDiscount,
        overallDiscount: overallDiscountAmount,
        finalTotal: totalAmount
      });

      // Step 5: Get entity information
      const entityInfo = await this.getEntityInfo(
        transactionData.entity_type,
        transactionData.entity_id,
        transactionData.module || 'farmer',
        transactionData.temp_info
      );

      // Step 6: Check stock availability for OUT transactions
      const stockCheck = await this.checkStockAvailability(
        enrichedItems,
        transactionData.transaction_type
      );
      
      if (!stockCheck.available) {
        throw new Error(`Stock check failed:\n${stockCheck.errors.join('\n')}`);
      }

      // Step 7: Generate transaction number
      const transactionNumber = await this.generateTransactionNumber();

      console.log('[TransactionServiceV2] ✅ Validation passed, starting database transaction...');

      // Step 8: Begin database transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // Step 9: Insert transaction header
        // For multi-item transactions, use 'product' as item_type and 0 as item_id (dummy values)
        // industry_type is resolved from the transaction_type prefix
        const industryType = this._resolveIndustryType(transactionData.transaction_type);

        const transactionResult = await this.db.execute(
          `INSERT INTO Transactions (
            transaction_number, transaction_type, transaction_date,
            entity_type, entity_id, entity_table, entity_name,
            temp_customer_name, temp_customer_father_name, temp_customer_cnic,
            temp_customer_phone, temp_customer_address,
            item_type, item_id,
            quantity, unit_price, total_amount,
            overall_discount_type, overall_discount_value, overall_discount_amount,
            payment_type, cash_paid, credit_amount,
            description, created_by, industry_type
          ) VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'product', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionNumber,
            transactionData.transaction_type,
            transactionData.entity_type,
            transactionData.entity_id || null,
            entityInfo.entity_table,
            entityInfo.entity_name,
            entityInfo.temp_customer_name,
            entityInfo.temp_customer_father_name,
            entityInfo.temp_customer_cnic,
            entityInfo.temp_customer_phone,
            entityInfo.temp_customer_address,
            totalQuantity,
            0, // unit_price set to 0 for multi-item (use TransactionItems)
            totalAmount,
            transactionData.overall_discount_type || 'amount',
            transactionData.overall_discount_value || 0,
            transactionData.overall_discount_amount || 0,
            transactionData.payment_type,
            transactionData.cash_paid || 0,
            transactionData.credit_amount || 0,
            transactionData.description || '',
            userId,
            industryType
          ]
        );

        const transactionId = transactionResult.lastInsertRowid;
        console.log('[TransactionServiceV2] ✅ Transaction header created, ID:', transactionId);

        // Step 10: Insert transaction items
        for (const item of enrichedItems) {
          await this.db.execute(
            `INSERT INTO TransactionItems (
              transaction_id, line_number, item_type, item_reference_id,
              item_name, item_code, quantity, unit, unit_price,
              line_total, discount_percent, discount_amount, line_final_total,
              description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              transactionId,
              item.line_number,
              item.item_type,
              item.item_reference_id,
              item.item_name,
              item.item_code,
              item.quantity,
              item.unit,
              item.unit_price,
              item.line_total,
              item.discount_percent,
              item.discount_amount,
              item.line_final_total,
              item.description
            ]
          );
        }

        console.log('[TransactionServiceV2] ✅ Inserted', enrichedItems.length, 'line items');

        // Step 11: Update stock for each item
        await this.updateStockForTransaction(
          transactionId,
          transactionData.transaction_type,
          enrichedItems,
          entityInfo.entity_name,
          userId
        );

        // Step 12: Create Ledger Entry for transaction
        // This ensures all transaction details are reflected in the entity's ledger
        await this.createTransactionLedgerEntry(
          transactionData,
          transactionId,
          transactionNumber,
          enrichedItems,
          entityInfo,
          totalAmount,
          userId
        );

        // Step 13: Update entity balance/credit if applicable
        await this.updateEntityBalance(
          transactionData.entity_type,
          transactionData.entity_id,
          transactionData.transaction_type,
          transactionData.credit_amount || 0,
          transactionId,
          userId
        );

        // Step 14: Commit transaction
        await this.db.execute('COMMIT');

        console.log('[TransactionServiceV2] ✅ Transaction completed successfully');

        return {
          success: true,
          message: 'Transaction created successfully',
          data: {
            transaction_id: transactionId,
            transaction_number: transactionNumber,
            entity_name: entityInfo.entity_name,
            items_count: enrichedItems.length,
            total_amount: totalAmount
          }
        };

      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('[TransactionServiceV2] ❌ Error:', error);
      throw error;
    }
  }

  /**
   * Update stock for all items in transaction
   */
  async updateStockForTransaction(transactionId, transactionType, items, entityName, userId) {
    // Determine stock direction — supports all industry types
    const inTransactionTypes = [
      'FARMER_SALE_GRAIN', 'COMPANY_DELIVERY', 'GRAIN_PURCHASE',
      'RETAIL_PURCHASE', 'RETAIL_DISTRIBUTOR_PURCHASE', 'RETAIL_RETURN_IN'
    ];
    const outTransactionTypes = [
      'FARMER_PURCHASE', 'DEALER_PURCHASE',
      'RETAIL_SALE', 'RETAIL_RETURN_OUT'
    ];
    
    const isStockIn = inTransactionTypes.includes(transactionType);
    const isStockOut = outTransactionTypes.includes(transactionType);

    if (!isStockIn && !isStockOut) {
      console.log('[TransactionServiceV2] No stock update needed for transaction type:', transactionType);
      return;
    }

    for (const item of items) {
      const itemTypeUpper = item.item_type.toUpperCase();
      const description = `${transactionType} - ${entityName} - ${item.item_name}`;

      if (isStockIn) {
        console.log(`[TransactionServiceV2] 📦 STOCK IN: ${item.item_name} +${item.quantity} ${item.unit}`);
        await this.stockService.addStock(
          itemTypeUpper,
          item.item_reference_id,
          item.quantity,
          item.unit_price,
          'TRANSACTION',
          transactionId,
          description,
          userId,
          'Main Warehouse'
        );
      } else if (isStockOut) {
        console.log(`[TransactionServiceV2] 📤 STOCK OUT: ${item.item_name} -${item.quantity} ${item.unit}`);
        const removeResult = await this.stockService.removeStock(
          itemTypeUpper,
          item.item_reference_id,
          item.quantity,
          'TRANSACTION',
          transactionId,
          description,
          userId
        );
        
        if (!removeResult.success) {
          throw new Error(`Failed to remove stock for ${item.item_name}: ${removeResult.message}`);
        }
      }
    }

    console.log('[TransactionServiceV2] ✅ Stock updated for all items');
  }

  /**
   * Create Ledger Entry for Transaction
   * =====================================
   * Creates a corresponding LedgerEntry for every transaction to ensure:
   * - All transaction details are reflected in entity ledgers
   * - Proper audit trail with transaction linkage
   * - Detailed description including all items
   * - Correct debit/credit based on transaction type
   */
  async createTransactionLedgerEntry(transactionData, transactionId, transactionNumber, items, entityInfo, totalAmount, userId) {
    // Skip ledger entry for irregular customers (walk-ins)
    if (transactionData.entity_type !== 'regular' || !transactionData.entity_id) {
      console.log('[TransactionServiceV2] Skipping ledger entry for irregular customer');
      return;
    }

    try {
      // Determine entity type from entity_table
      const entityTable = (entityInfo.entity_table || '').toLowerCase();
      let entityType = 'farmer'; // default
      
      if (entityTable.includes('dealer')) {
        entityType = 'dealer';
      } else if (entityTable.includes('company') || entityTable.includes('companies')) {
        entityType = 'company';
      }

      // Build detailed description with all items
      const itemsSummary = items.map((item, idx) =>
        `${item.item_name} (x${item.quantity})`
      ).join(', ');

      const entityName = entityInfo.entity_name || 'Customer';
      let description = '';

      const transType = transactionData.transaction_type;
      const cashPaid = parseFloat(transactionData.cash_paid) || 0;
      const creditAmount = parseFloat(transactionData.credit_amount) || 0;

      // Professional Description Mapping
      if (transType === 'FARMER_PURCHASE' || transType === 'RETAIL_SALE') {
        description = `SALE: Goods worth ${totalAmount.toFixed(2)} sold to ${entityName}. Cash received: ${cashPaid.toFixed(2)}, Credit: ${creditAmount.toFixed(2)}. Items: ${itemsSummary}`;
      } else if (transType === 'FARMER_SALE_GRAIN' || transType === 'FARMER_SALE') {
        description = `PURCHASE: Grain/Goods worth ${totalAmount.toFixed(2)} purchased from ${entityName}. Cash paid: ${cashPaid.toFixed(2)}, Balance: ${creditAmount.toFixed(2)}. Items: ${itemsSummary}`;
      } else if (transType === 'COMPANY_DELIVERY' || transType === 'RETAIL_PURCHASE') {
        description = `STOCK IN: Products worth ${totalAmount.toFixed(2)} received from ${entityName}. Cash paid: ${cashPaid.toFixed(2)}, Payable: ${creditAmount.toFixed(2)}. Items: ${itemsSummary}`;
      } else if (transType === 'RETAIL_RETURN_IN') {
        description = `RETURN IN: Goods worth ${totalAmount.toFixed(2)} returned by ${entityName} to Shop. Cash refunded: ${cashPaid.toFixed(2)}, Account adjusted: ${creditAmount.toFixed(2)}. Items: ${itemsSummary}`;
      } else if (transType === 'RETAIL_RETURN_OUT') {
        description = `RETURN OUT: Goods worth ${totalAmount.toFixed(2)} returned by Shop to ${entityName}. Cash received: ${cashPaid.toFixed(2)}, Account adjusted: ${creditAmount.toFixed(2)}. Items: ${itemsSummary}`;
      } else {
        description = `${transType}: ${itemsSummary}. Total: Rs ${totalAmount.toFixed(2)} [${transactionData.payment_type}]`;
      }
      // Calculate debit/credit based on transaction type and payment
      // Track FULL transaction amounts for complete audit trail
      let debit = 0;
      let credit = 0;
      
      // ═══════════════════════════════════════════════════════════════
      // AGRICULTURAL TRANSACTION TYPES
      // ═══════════════════════════════════════════════════════════════
      // FARMER_PURCHASE: Farmer buys products from shop
      // - Debit = total amount (goods given to farmer — farmer's liability)
      // - Credit = cash received from farmer
      if (transType === 'FARMER_PURCHASE') {
        debit = totalAmount;
        credit = cashPaid;
      }
      // DEALER_PURCHASE: Dealer buys grains from shop
      else if (transType === 'DEALER_PURCHASE') {
        debit = totalAmount;
        credit = cashPaid;
      }
      // FARMER_SALE_GRAIN: Farmer sells grain to shop
      else if (transType === 'FARMER_SALE_GRAIN') {
        debit = cashPaid;
        credit = totalAmount;
      }
      // COMPANY_DELIVERY: Company delivers products to shop
      else if (transType === 'COMPANY_DELIVERY') {
        debit = cashPaid;
        credit = totalAmount;
      }
      // ═══════════════════════════════════════════════════════════════
      // RETAIL TRANSACTION TYPES
      // ═══════════════════════════════════════════════════════════════
      // RETAIL_SALE: Customer buys products from shop (stock OUT)
      // - Debit = total amount (goods given — customer's liability)
      // - Credit = cash received from customer
      else if (transType === 'RETAIL_SALE') {
        debit = totalAmount;
        credit = cashPaid;
      }
      // RETAIL_PURCHASE: Supplier delivers products to shop (stock IN)
      // - Credit = total amount (goods received — shop's liability)
      // - Debit = cash paid to supplier
      else if (transType === 'RETAIL_PURCHASE') {
        debit = cashPaid;
        credit = totalAmount;
      }
      // RETAIL_DISTRIBUTOR_PURCHASE: Distributor delivers to shop (stock IN)
      // - Credit = total amount (goods received — shop's liability)
      // - Debit = cash paid to distributor
      else if (transType === 'RETAIL_DISTRIBUTOR_PURCHASE') {
        debit = cashPaid;
        credit = totalAmount;
      }
      // RETAIL_RETURN_IN: Customer returns product to shop (stock IN)
      // - Credit = total amount (goods back — reduces customer's liability)
      // - Debit = cash refunded to customer
      else if (transType === 'RETAIL_RETURN_IN') {
        debit = cashPaid;
        credit = totalAmount;
      }
      // RETAIL_RETURN_OUT: Shop returns product to supplier (stock OUT)
      // - Debit = total amount (goods returned — reduces shop's liability)
      // - Credit = cash refund from supplier
      else if (transType === 'RETAIL_RETURN_OUT') {
        debit = totalAmount;
        credit = cashPaid;
      }

      // Only create ledger entry if there's a financial amount to track
      // ALL transactions create ledger entries - both cash and credit
      if (totalAmount > 0) {
        const industryType = this._resolveIndustryType(transactionData.transaction_type);

        await this.db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by, entry_date, industry_type
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'), ?)`,
          [
            entityType,
            transactionData.entity_id,
            transactionData.transaction_type,
            transactionId,
            debit,
            credit,
            description,
            userId,
            industryType
          ]
        );

        console.log(`[TransactionServiceV2] ✅ Ledger entry created: ${entityType} ${transactionData.entity_id}, Debit: ${debit}, Credit: ${credit}`);
      } else {
        console.log('[TransactionServiceV2] ℹ️ No ledger entry needed (zero amount)');
      }

    } catch (error) {
      console.error('[TransactionServiceV2] ❌ Error creating ledger entry:', error);
      // Don't throw - ledger entry failure shouldn't block transaction
      // But log it for investigation
    }
  }

  /**
   * Update entity balance/credit in the database
   * Determines the entity table from entity_id and transaction context,
   * then applies the appropriate credit or balance change.
   */
  /**
   * Update entity balance in the database (Unified Model v18)
   * Positive (+) = Entity owes Shop (Receivable)
   * Negative (-) = Shop owes Entity (Payable)
   */
  async updateEntityBalance(entity_type, entity_id, transaction_type, amount, transaction_id, userId) {
    if (entity_type !== 'regular' || !entity_id || amount === 0) {
      return; 
    }

    // 1. Determine direction (Unified Model v18 - User Convention)
    // Credits increase the balance (Shop owes them MORE / Advance)
    const creditsEntity = [
      'FARMER_SALE_GRAIN', 'COMPANY_DELIVERY', 'RETAIL_PURCHASE', // Purchase from supplier
      'PAYMENT_RECEIVED', // Customer pays shop
      'RETAIL_RETURN_IN' // Customer returns goods to shop (increases shop liability)
    ];

    // Debits decrease the balance (Shop owes them LESS / Loan)
    const debitsEntity = [
      'FARMER_PURCHASE', 'DEALER_PURCHASE', 'RETAIL_SALE', // Sale to customer
      'PAYMENT_MADE', // Shop pays supplier/customer
      'RETAIL_RETURN_OUT' // Returning goods to supplier
    ];

    let netChange = 0;
    if (creditsEntity.includes(transaction_type)) {
      netChange = amount;
    } else if (debitsEntity.includes(transaction_type)) {
      netChange = -amount;
    } else {
      console.log(`[TransactionServiceV2] ℹ️ Unrecognized transaction type for balance update: ${transaction_type}`);
      return;
    }

    // 2. Resolve Table Name
    let tableName = 'Farmers';
    let idCol = 'farmer_id';

    // Quick lookup for table
    const farmer = await this.db.query('SELECT farmer_id FROM Farmers WHERE farmer_id = ?', [entity_id]);
    if (farmer && farmer.length > 0) {
      tableName = 'Farmers'; idCol = 'farmer_id';
    } else {
      const dealer = await this.db.query('SELECT dealer_id FROM Dealers WHERE dealer_id = ?', [entity_id]);
      if (dealer && dealer.length > 0) {
        tableName = 'Dealers'; idCol = 'dealer_id';
      } else {
        tableName = 'Companies'; idCol = 'company_id';
      }
    }

    // 3. Update Unified Account Balance
    await this.db.execute(
      `UPDATE ${tableName} SET account_balance = account_balance + ? WHERE ${idCol} = ?`,
      [netChange, entity_id]
    );

    console.log(`[TransactionServiceV2] ✅ ${tableName} ${entity_id} Account Balance Change: ${netChange > 0 ? '+' : ''}${netChange.toFixed(2)}`);
  }

  /**
   * Create professional return transaction
   * Links to original transaction and tracks returned quantities
   */
  async createReturnTransaction(originalTransactionId, returnItems, returnMetadata, userId) {
    try {
      console.log(`[TransactionServiceV2] 🔄 Initiating return for Transaction ID: ${originalTransactionId}`);
      
      // 1. Get original transaction with items
      const original = await this.getTransactionById(originalTransactionId);
      if (!original) throw new Error('Original transaction not found');
      
      // 2. Determine return transaction type
      let returnType = '';
      if (original.transaction_type === 'RETAIL_SALE' || original.transaction_type === 'FARMER_PURCHASE' || original.transaction_type === 'SALE') {
        returnType = 'RETAIL_RETURN_IN'; // Customer returns to shop
      } else if (original.transaction_type === 'RETAIL_PURCHASE' || original.transaction_type === 'COMPANY_DELIVERY') {
        returnType = 'RETAIL_RETURN_OUT'; // Shop returns to supplier
      } else {
        throw new Error(`Transactions of type ${original.transaction_type} cannot be returned through this process`);
      }

      // 3. Validate and Enrich Return Items
      const enrichedReturnItems = [];
      let returnTotalAmount = 0;

      for (const rItem of returnItems) {
        // Find corresponding original item
        const origItem = original.items.find(i => i.item_id === rItem.original_item_id);
        if (!origItem) throw new Error(`Item ${rItem.original_item_id} not found in original transaction`);

        const availableToReturn = origItem.quantity - (origItem.returned_quantity || 0);
        if (rItem.quantity > availableToReturn) {
          throw new Error(`Cannot return ${rItem.quantity} of ${origItem.item_name}. Only ${availableToReturn} available to return.`);
        }

        const lineTotal = rItem.quantity * origItem.unit_price;
        // Proportionate discount calculation if needed, but usually we return at the price sold
        // For simplicity, we use the original unit price
        
        enrichedReturnItems.push({
          ...origItem,
          original_item_id: origItem.item_id,
          quantity: rItem.quantity,
          line_total: lineTotal,
          line_final_total: lineTotal // simplified for returns
        });
        
        returnTotalAmount += lineTotal;
      }

      // 4. Generate transaction number
      const transactionNumber = await this.generateTransactionNumber();
      const industryType = original.industry_type || this._resolveIndustryType(returnType);

      // 5. Start Database Transaction
      await this.db.execute('BEGIN TRANSACTION');

      try {
        // 6. Create Return Transaction Header
        const returnResult = await this.db.execute(
          `INSERT INTO Transactions (
            transaction_number, transaction_type, transaction_date,
            entity_type, entity_id, entity_table, entity_name,
            parent_transaction_id,
            item_type, item_id,
            quantity, unit_price, total_amount,
            payment_type, cash_paid, credit_amount,
            description, created_by, industry_type, status
          ) VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, 'product', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [
            transactionNumber,
            returnType,
            original.entity_type,
            original.entity_id,
            original.entity_table,
            original.entity_name,
            originalTransactionId,
            enrichedReturnItems.reduce((sum, i) => sum + i.quantity, 0),
            0,
            returnTotalAmount,
            returnMetadata.payment_type || 'CASH',
            returnMetadata.cash_refunded || 0,
            returnMetadata.credit_adjusted || 0,
            returnMetadata.description || `Return for ${original.transaction_number}`,
            userId,
            industryType
          ]
        );

        const returnId = returnResult.lastInsertRowid;

        // 7. Insert Return Transaction Items & Update Original Returned Quantities
        for (const item of enrichedReturnItems) {
          // Insert return line item
          await this.db.execute(
            `INSERT INTO TransactionItems (
              transaction_id, line_number, item_type, item_reference_id,
              item_name, item_code, quantity, unit, unit_price,
              line_total, line_final_total, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              returnId,
              item.line_number,
              item.item_type,
              item.item_reference_id,
              item.item_name,
              item.item_code,
              item.quantity,
              item.unit,
              item.unit_price,
              item.line_total,
              item.line_final_total,
              `Return item from ${original.transaction_number}`
            ]
          );

          // Update original item returned_quantity
          await this.db.execute(
            `UPDATE TransactionItems SET returned_quantity = COALESCE(returned_quantity, 0) + ? 
             WHERE item_id = ?`,
            [item.quantity, item.original_item_id]
          );
        }

        // 8. Update Stock
        await this.updateStockForTransaction(
          returnId,
          returnType,
          enrichedReturnItems,
          original.entity_name,
          userId
        );

        // 9. Update Entity Balance/Credit (TWO STEPS for 100% precision)
        // Step A: Adjust for FULL GOODS RETURN (Always reduces debt or increases shop liability)
        const totalReturnAmount = returnMetadata.total_return_amount || returnTotalAmount;
        await this.updateEntityBalance(
          original.entity_type,
          original.entity_id,
          returnType,
          totalReturnAmount,
          returnId,
          userId
        );

        // Step B: Adjust for CASH REFUND (Reduces the impact of the return on the ledger)
        // If shop paid Ali 25000, Ali's credit goes back up or balance goes down
        if (returnMetadata.cash_refunded > 0) {
          // Reverse direction: Shop paying Ali is like a purchase/payment made
          const refundType = returnType === 'RETAIL_RETURN_IN' ? 'PAYMENT_MADE' : 'PAYMENT_RECEIVED';
          await this.updateEntityBalance(
            original.entity_type,
            original.entity_id,
            refundType,
            returnMetadata.cash_refunded,
            returnId,
            userId
          );
        }

        // 10. Ledger Entries (Explicitly visible "instances" as requested)
        const itemsSummary = enrichedReturnItems.map(i => `${i.item_name} (x${i.quantity})`).join(', ');
        
        // Entry 1: Goods Return
        let ledgerDesc1 = '';
        let ledgerDebit1 = 0;
        let ledgerCredit1 = 0;

        if (returnType === 'RETAIL_RETURN_IN') {
          ledgerDesc1 = `RETURN IN: Goods worth ${totalReturnAmount.toFixed(2)} returned by ${original.entity_name} to Shop. Items: ${itemsSummary}`;
          ledgerCredit1 = totalReturnAmount; // Ali's account credited
        } else {
          ledgerDesc1 = `RETURN OUT: Goods worth ${totalReturnAmount.toFixed(2)} returned by Shop to ${original.entity_name}. Items: ${itemsSummary}`;
          ledgerDebit1 = totalReturnAmount; // Shop's account debited (we are owed)
        }

        // Resolve entity type for ledger
        let ledgerEntityType = 'farmer';
        if (original.entity_table?.toLowerCase().includes('dealer')) ledgerEntityType = 'dealer';
        else if (original.entity_table?.toLowerCase().includes('compan')) ledgerEntityType = 'company';

        await this.db.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, transaction_id,
            debit, credit, balance, description, created_by, entry_date, industry_type
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'), ?)`,
          [ledgerEntityType, original.entity_id, returnType, returnId, ledgerDebit1, ledgerCredit1, ledgerDesc1, userId, industryType]
        );

        // Entry 2: Cash Refund (Visible instance)
        if (returnMetadata.cash_refunded > 0) {
          let ledgerDesc2 = '';
          let ledgerDebit2 = 0;
          let ledgerCredit2 = 0;

          if (returnType === 'RETAIL_RETURN_IN') {
            ledgerDesc2 = `CASH REFUND: Shop paid ${returnMetadata.cash_refunded.toFixed(2)} to ${original.entity_name} for returned goods.`;
            ledgerDebit2 = returnMetadata.cash_refunded; // Ali's account debited (he received cash)
          } else {
            ledgerDesc2 = `CASH REFUND: Shop received ${returnMetadata.cash_refunded.toFixed(2)} from ${original.entity_name} for returned goods.`;
            ledgerCredit2 = returnMetadata.cash_refunded; // Shop's account credited (we received cash)
          }

          await this.db.execute(
            `INSERT INTO LedgerEntries (
              entity_type, entity_id, transaction_type, transaction_id,
              debit, credit, balance, description, created_by, entry_date, industry_type
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'), ?)`,
            [ledgerEntityType, original.entity_id, 'PAYMENT', returnId, ledgerDebit2, ledgerCredit2, ledgerDesc2, userId, industryType]
          );
        }

        await this.db.execute('COMMIT');
        console.log(`[TransactionServiceV2] ✅ Return successful: ${transactionNumber}`);

        return {
          success: true,
          message: 'Return processed successfully',
          transaction_id: returnId,
          transaction_number: transactionNumber
        };

      } catch (dbError) {
        await this.db.execute('ROLLBACK');
        throw dbError;
      }

    } catch (error) {
      console.error('[TransactionServiceV2] ❌ Return Error:', error);
      throw error;
    }
  }

  /**
   * Get transaction with all line items
   */
  async getTransactionById(transactionId) {
    try {
      // Get transaction header with complete entity details
      const transactions = await this.db.query(
        `SELECT 
          t.*,
          f.name as farmer_name,
          f.specific_id as farmer_specific_id,
          f.father_name as farmer_father_name,
          f.cnic as farmer_cnic,
          f.phone as farmer_phone,
          f.address as farmer_address,
          d.name as dealer_name,
          d.specific_id as dealer_specific_id,
          d.contact_person as dealer_contact_person,
          d.cnic as dealer_cnic,
          d.phone as dealer_phone,
          d.address as dealer_address,
          c.company_name,
          c.specific_id as company_specific_id,
          c.contact_person as company_contact_person,
          c.phone as company_phone,
          c.address as company_address,
          u.username as created_by_name
        FROM Transactions t
        LEFT JOIN Farmers f ON t.entity_table = 'Farmers' AND t.entity_id = f.farmer_id
        LEFT JOIN Dealers d ON t.entity_table = 'Dealers' AND t.entity_id = d.dealer_id
        LEFT JOIN Companies c ON t.entity_table = 'Companies' AND t.entity_id = c.company_id
        LEFT JOIN Users u ON t.created_by = u.user_id
        WHERE t.transaction_id = ?`,
        [transactionId]
      );

      if (transactions.length === 0) {
        return null;
      }

      const transaction = transactions[0];

      // Get transaction items
      const items = await this.db.query(
        `SELECT * FROM TransactionItems 
         WHERE transaction_id = ? 
         ORDER BY line_number`,
        [transactionId]
      );

      return {
        ...transaction,
        items: items
      };

    } catch (error) {
      console.error('[TransactionServiceV2] Error getting transaction:', error);
      throw error;
    }
  }

  /**
   * Get all transactions with item count
   */
  async getAllTransactions(filters = {}) {
    try {
      let query = `
        SELECT 
          t.*,
          COUNT(ti.item_id) as items_count
        FROM Transactions t
        LEFT JOIN TransactionItems ti ON t.transaction_id = ti.transaction_id
      `;

      const conditions = [];
      const params = [];

      if (filters.transaction_type) {
        conditions.push('t.transaction_type = ?');
        params.push(filters.transaction_type);
      }

      if (filters.entity_type) {
        conditions.push('t.entity_type = ?');
        params.push(filters.entity_type);
      }

      if (filters.entity_table) {
        conditions.push('t.entity_table = ?');
        params.push(filters.entity_table);
      }

      if (filters.entity_id) {
        conditions.push('t.entity_id = ?');
        params.push(filters.entity_id);
      }

      if (filters.industry_type) {
        conditions.push('t.industry_type = ?');
        params.push(filters.industry_type);
      }

      if (filters.payment_type) {
        conditions.push('t.payment_type = ?');
        params.push(filters.payment_type);
      }

      if (filters.start_date) {
        conditions.push('DATE(t.transaction_date) >= ?');
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        conditions.push('DATE(t.transaction_date) <= ?');
        params.push(filters.end_date);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' GROUP BY t.transaction_id ORDER BY t.transaction_date DESC';

      if (filters.limit) {
        query += ` LIMIT ${filters.limit}`;
      }

      const transactions = await this.db.query(query, params);
      return transactions;

    } catch (error) {
      console.error('[TransactionServiceV2] Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Resolve industry type from a transaction type code.
   * RETAIL_ prefix → RETAIL, otherwise AGRICULTURAL (default).
   */
  _resolveIndustryType(transactionType) {
    if (!transactionType) return 'AGRICULTURAL';
    if (transactionType.startsWith('RETAIL_')) return 'RETAIL';
    if (transactionType.startsWith('MEDICAL_') || transactionType === 'DISPENSING' || transactionType === 'CONTROLLED_DISPENSING') return 'MEDICAL';
    if (transactionType.startsWith('PROPERTY_') || transactionType === 'INSTALLMENT' || transactionType === 'TOKEN_PAYMENT') return 'REAL_ESTATE';
    return 'AGRICULTURAL';
  }
}

export default TransactionServiceV2;
