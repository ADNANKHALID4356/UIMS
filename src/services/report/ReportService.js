import { DatabaseService } from '../database/DatabaseService.js';

/**
 * ReportService - Sprint 7: Reporting & Analytics
 * Generates various business reports for the Universal Enterprise Inventory System
 */
class ReportService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Get Daily Sales Report
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   */
  async getDailySalesReport(startDate, endDate) {
    try {
      console.log('[ReportService] Generating Daily Sales Report:', startDate, 'to', endDate);

      // Get daily summaries
      const dailySummaries = await this.db.query(
        `SELECT 
          DATE(transaction_date) as date,
          COUNT(*) as transaction_count,
          SUM(CASE WHEN transaction_type LIKE '%PURCHASE%' THEN total_amount ELSE 0 END) as purchases,
          SUM(CASE WHEN transaction_type LIKE '%SALE%' THEN total_amount ELSE 0 END) as sales,
          SUM(cash_paid) as cash_received,
          SUM(credit_amount) as credit_given,
          SUM(total_amount) as total_amount
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
        GROUP BY DATE(transaction_date)
        ORDER BY DATE(transaction_date) DESC`,
        [startDate, endDate]
      );

      // Get totals
      const totals = await this.db.query(
        `SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN transaction_type LIKE '%PURCHASE%' THEN total_amount ELSE 0 END) as total_purchases,
          SUM(CASE WHEN transaction_type LIKE '%SALE%' THEN total_amount ELSE 0 END) as total_sales,
          SUM(cash_paid) as total_cash,
          SUM(credit_amount) as total_credit,
          SUM(total_amount) as grand_total
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?`,
        [startDate, endDate]
      );

      // Get transactions breakdown by type
      const byType = await this.db.query(
        `SELECT 
          transaction_type,
          COUNT(*) as count,
          SUM(total_amount) as total,
          SUM(cash_paid) as cash_total,
          SUM(credit_amount) as credit_total
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
        GROUP BY transaction_type
        ORDER BY total DESC`,
        [startDate, endDate]
      );

      // Get top entities by transaction value
      const topEntities = await this.db.query(
        `SELECT 
          COALESCE(entity_name, temp_customer_name, 'Unknown') as entity_name,
          entity_table,
          COUNT(*) as transaction_count,
          SUM(total_amount) as total_value,
          SUM(cash_paid) as cash_paid,
          SUM(credit_amount) as credit_given
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
        GROUP BY entity_name, entity_table
        ORDER BY total_value DESC
        LIMIT 10`,
        [startDate, endDate]
      );

      return {
        success: true,
        data: {
          report_type: 'DAILY_SALES',
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          daily_breakdown: dailySummaries,
          by_transaction_type: byType,
          top_entities: topEntities,
          totals: totals[0] || {
            total_transactions: 0,
            total_purchases: 0,
            total_sales: 0,
            total_cash: 0,
            total_credit: 0,
            grand_total: 0
          },
          analytics: {
            avg_transaction_value: totals[0] ? (totals[0].grand_total / totals[0].total_transactions) : 0,
            cash_percentage: totals[0] ? ((totals[0].total_cash / totals[0].grand_total) * 100) : 0,
            credit_percentage: totals[0] ? ((totals[0].total_credit / totals[0].grand_total) * 100) : 0
          }
        }
      };

    } catch (error) {
      console.error('[ReportService] Error generating daily sales report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get Outstanding Balance Report
   * Shows all entities with pending balances/credits
   */
  async getOutstandingBalanceReport() {
    try {
      console.log('[ReportService] Generating Outstanding Balance Report');

      // Get farmers with outstanding balances
      const farmers = await this.db.query(
        `SELECT 
          farmer_id as id,
          specific_id,
          name,
          phone,
          balance,
          credit,
          (balance - credit) as net_position,
          'customer' as entity_type
        FROM Farmers
        WHERE is_active = 1 AND (balance > 0 OR credit > 0)
        ORDER BY (balance + credit) DESC`
      );

      // Get dealers with outstanding balances
      const dealers = await this.db.query(
        `SELECT 
          dealer_id as id,
          specific_id,
          name,
          phone,
          balance,
          credit,
          (balance - credit) as net_position,
          'dealer' as entity_type
        FROM Dealers
        WHERE is_active = 1 AND (balance > 0 OR credit > 0)
        ORDER BY (balance + credit) DESC`
      );

      // Get companies with outstanding balances
      const companies = await this.db.query(
        `SELECT 
          company_id as id,
          specific_id,
          company_name as name,
          phone,
          balance,
          credit,
          (balance - credit) as net_position,
          'supplier' as entity_type
        FROM Companies
        WHERE is_active = 1 AND (balance > 0 OR credit > 0)
        ORDER BY (balance + credit) DESC`
      );

      // Calculate totals
      const farmerTotals = farmers.reduce((acc, f) => ({
        balance: acc.balance + (parseFloat(f.balance) || 0),
        credit: acc.credit + (parseFloat(f.credit) || 0)
      }), { balance: 0, credit: 0 });

      const dealerTotals = dealers.reduce((acc, d) => ({
        balance: acc.balance + (parseFloat(d.balance) || 0),
        credit: acc.credit + (parseFloat(d.credit) || 0)
      }), { balance: 0, credit: 0 });

      const companyTotals = companies.reduce((acc, c) => ({
        balance: acc.balance + (parseFloat(c.balance) || 0),
        credit: acc.credit + (parseFloat(c.credit) || 0)
      }), { balance: 0, credit: 0 });

      // Total receivables (what we're owed)
      const totalReceivables = farmerTotals.credit + dealerTotals.credit;
      // Total payables (what we owe)
      const totalPayables = farmerTotals.balance + companyTotals.balance;

      return {
        success: true,
        data: {
          report_type: 'OUTSTANDING_BALANCE',
          generated_at: new Date().toISOString(),
          farmers: {
            list: farmers,
            count: farmers.length,
            total_balance: farmerTotals.balance,
            total_credit: farmerTotals.credit
          },
          dealers: {
            list: dealers,
            count: dealers.length,
            total_balance: dealerTotals.balance,
            total_credit: dealerTotals.credit
          },
          companies: {
            list: companies,
            count: companies.length,
            total_balance: companyTotals.balance,
            total_credit: companyTotals.credit
          },
          summary: {
            total_receivables: totalReceivables,
            total_payables: totalPayables,
            net_position: totalReceivables - totalPayables
          }
        }
      };

    } catch (error) {
      console.error('[ReportService] Error generating outstanding balance report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get Stock Report
   * Shows current stock levels and values
   */
  async getStockReport() {
    try {
      console.log('[ReportService] Generating Stock Report');

      // Get product stock
      const productStock = await this.db.query(
        `SELECT 
          p.product_id as id,
          p.product_code as code,
          p.product_name as name,
          pc.category_name as category,
          p.unit_of_measure as unit,
          COALESCE(SUM(s.quantity), 0) as quantity,
          COALESCE(AVG(NULLIF(s.unit_price, 0)), 0) as avg_price,
          COALESCE(SUM(s.quantity * s.unit_price), 0) as total_value,
          'Product' as item_type
        FROM Products p
        LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        WHERE p.is_active = 1
        GROUP BY p.product_id
        ORDER BY p.product_name`
      );

      // Get grain stock
      const grainStock = await this.db.query(
        `SELECT 
          g.grain_id as id,
          g.grain_code as code,
          g.grain_name as name,
          'Grain' as category,
          g.unit_of_measure as unit,
          COALESCE(SUM(s.quantity), 0) as quantity,
          COALESCE(AVG(NULLIF(s.unit_price, 0)), 0) as avg_price,
          COALESCE(SUM(s.quantity * s.unit_price), 0) as total_value,
          'Grain' as item_type
        FROM GrainTypes g
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE g.is_active = 1
        GROUP BY g.grain_id
        ORDER BY g.grain_name`
      );

      // Calculate totals
      const productTotal = productStock.reduce((sum, p) => sum + (parseFloat(p.total_value) || 0), 0);
      const grainTotal = grainStock.reduce((sum, g) => sum + (parseFloat(g.total_value) || 0), 0);

      // Get low stock items (quantity < 10)
      const lowStock = [...productStock, ...grainStock].filter(item => 
        parseFloat(item.quantity) < 10 && parseFloat(item.quantity) >= 0
      );

      return {
        success: true,
        data: {
          report_type: 'STOCK',
          generated_at: new Date().toISOString(),
          products: {
            list: productStock,
            count: productStock.length,
            total_value: productTotal
          },
          grains: {
            list: grainStock,
            count: grainStock.length,
            total_value: grainTotal
          },
          low_stock: {
            list: lowStock,
            count: lowStock.length
          },
          summary: {
            total_products: productStock.length,
            total_grains: grainStock.length,
            total_inventory_value: productTotal + grainTotal
          }
        }
      };

    } catch (error) {
      console.error('[ReportService] Error generating stock report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get Customer Ledger Report
   * @param {string} entityType - 'farmer', 'dealer', or 'company'
   * @param {number} entityId - The entity ID
   * @param {string} startDate - Optional start date
   * @param {string} endDate - Optional end date
   */
  async getCustomerLedgerReport(entityType, entityId, startDate = null, endDate = null) {
    try {
      console.log('[ReportService] Generating Customer Ledger Report:', entityType, entityId);

      // Get entity details
      let entity = null;
      if (entityType === 'farmer') {
        const farmers = await this.db.query(
          'SELECT * FROM Farmers WHERE farmer_id = ?', [entityId]
        );
        entity = farmers[0];
      } else if (entityType === 'dealer') {
        const dealers = await this.db.query(
          'SELECT * FROM Dealers WHERE dealer_id = ?', [entityId]
        );
        entity = dealers[0];
      } else if (entityType === 'company') {
        const companies = await this.db.query(
          'SELECT * FROM Companies WHERE company_id = ?', [entityId]
        );
        entity = companies[0];
      }

      if (!entity) {
        return { success: false, message: 'Entity not found' };
      }

      // Build ledger query
      let ledgerQuery = `
        SELECT 
          le.*,
          t.transaction_number,
          t.transaction_type
        FROM LedgerEntries le
        LEFT JOIN Transactions t ON le.transaction_id = t.transaction_id
        WHERE LOWER(le.entity_type) = ? AND le.entity_id = ?
      `;
      const params = [entityType.toLowerCase(), entityId];

      if (startDate) {
        ledgerQuery += ' AND DATE(le.entry_date) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        ledgerQuery += ' AND DATE(le.entry_date) <= ?';
        params.push(endDate);
      }

      ledgerQuery += ' ORDER BY le.entry_date ASC, le.entry_id ASC';

      const ledgerEntries = await this.db.query(ledgerQuery, params);

      // Calculate running balance
      let runningBalance = 0;
      const entriesWithBalance = ledgerEntries.map(entry => {
        runningBalance += (parseFloat(entry.credit) || 0) - (parseFloat(entry.debit) || 0);
        return {
          ...entry,
          running_balance: runningBalance
        };
      });

      // Calculate totals
      const totalDebit = ledgerEntries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
      const totalCredit = ledgerEntries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);

      return {
        success: true,
        data: {
          report_type: 'CUSTOMER_LEDGER',
          generated_at: new Date().toISOString(),
          start_date: startDate,
          end_date: endDate,
          entity: {
            type: entityType,
            id: entityId,
            name: entity.name || entity.company_name,
            specific_id: entity.specific_id,
            phone: entity.phone,
            current_balance: parseFloat(entity.balance) || 0,
            current_credit: parseFloat(entity.credit) || 0
          },
          ledger_entries: entriesWithBalance,
          totals: {
            total_debit: totalDebit,
            total_credit: totalCredit,
            closing_balance: totalCredit - totalDebit
          }
        }
      };

    } catch (error) {
      console.error('[ReportService] Error generating customer ledger report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get Cash Flow Report
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   */
  async getCashFlowReport(startDate, endDate) {
    try {
      console.log('[ReportService] Generating Cash Flow Report:', startDate, 'to', endDate);

      // Get cash inflows (cash received from all sources)
      const inflows = await this.db.query(
        `SELECT 
          DATE(transaction_date) as date,
          transaction_type,
          entity_name,
          COUNT(*) as transaction_count,
          SUM(cash_paid) as amount
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
          AND cash_paid > 0
        GROUP BY DATE(transaction_date), transaction_type, entity_name
        ORDER BY DATE(transaction_date)`,
        [startDate, endDate]
      );

      // Get cash outflows (payments made to farmers for purchases)
      const outflows = await this.db.query(
        `SELECT 
          DATE(le.entry_date) as date,
          'PAYMENT_MADE' as transaction_type,
          le.entity_name,
          COUNT(*) as transaction_count,
          SUM(le.debit) as amount
        FROM LedgerEntries le
        WHERE DATE(le.entry_date) BETWEEN ? AND ?
          AND le.entry_type = 'PAYMENT_MADE'
          AND le.debit > 0
        GROUP BY DATE(le.entry_date), le.entity_name
        ORDER BY DATE(le.entry_date)`,
        [startDate, endDate]
      );

      // Get daily cash summary with proper inflows and outflows
      const dailyCash = await this.db.query(
        `SELECT 
          date,
          SUM(cash_in) as cash_in,
          SUM(cash_out) as cash_out,
          (SUM(cash_in) - SUM(cash_out)) as net_cash
        FROM (
          SELECT 
            DATE(transaction_date) as date,
            SUM(cash_paid) as cash_in,
            0 as cash_out
          FROM Transactions
          WHERE DATE(transaction_date) BETWEEN ? AND ?
          GROUP BY DATE(transaction_date)
          
          UNION ALL
          
          SELECT 
            DATE(entry_date) as date,
            0 as cash_in,
            SUM(debit) as cash_out
          FROM LedgerEntries
          WHERE DATE(entry_date) BETWEEN ? AND ?
            AND entry_type = 'PAYMENT_MADE'
            AND debit > 0
          GROUP BY DATE(entry_date)
        ) combined
        GROUP BY date
        ORDER BY date`,
        [startDate, endDate, startDate, endDate]
      );

      // Get totals
      const totals = await this.db.query(
        `SELECT 
          SUM(cash_paid) as total_cash_in,
          SUM(credit_amount) as total_credit
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?`,
        [startDate, endDate]
      );

      // Calculate total outflows and inflows
      const totalOutflows = outflows.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const totalInflows = parseFloat(totals[0]?.total_cash_in) || 0;

      return {
        success: true,
        data: {
          report_type: 'CASH_FLOW',
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          inflows: inflows,
          outflows: outflows,
          daily_summary: dailyCash,
          totals: {
            total_cash_in: totalInflows,
            total_cash_out: totalOutflows,
            net_cash_flow: totalInflows - totalOutflows,
            total_credit_given: parseFloat(totals[0]?.total_credit) || 0
          },
          summary: {
            total_inflow: totalInflows,
            total_outflow: totalOutflows,
            net_flow: totalInflows - totalOutflows,
            transaction_count: inflows.length + outflows.length
          }
        }
      };

    } catch (error) {
      console.error('[ReportService] Error generating cash flow report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get Transaction Details for Receipt
   * @param {number} transactionId - The transaction ID
   */
  async getTransactionForReceipt(transactionId) {
    try {
      console.log('[ReportService] Getting transaction for receipt:', transactionId);

      // Get transaction with all details
      const transactions = await this.db.query(
        `SELECT 
          t.*,
          COALESCE(t.entity_name, f.name, d.name, c.company_name, t.temp_customer_name) as entity_name,
          f.specific_id as farmer_specific_id,
          f.phone as farmer_phone,
          f.address as farmer_address,
          d.specific_id as dealer_specific_id,
          d.phone as dealer_phone,
          c.specific_id as company_specific_id,
          c.phone as company_phone,
          CASE 
            WHEN t.item_type = 'product' THEN p.product_name
            WHEN t.item_type = 'grain' THEN g.grain_name
          END as item_name,
          CASE 
            WHEN t.item_type = 'product' THEN p.product_code
            WHEN t.item_type = 'grain' THEN g.grain_code
          END as item_code,
          CASE 
            WHEN t.item_type = 'product' THEN p.unit_of_measure
            WHEN t.item_type = 'grain' THEN g.unit_of_measure
          END as unit
        FROM Transactions t
        LEFT JOIN Farmers f ON LOWER(t.entity_table) LIKE '%farmer%' AND t.entity_id = f.farmer_id
        LEFT JOIN Dealers d ON LOWER(t.entity_table) LIKE '%dealer%' AND t.entity_id = d.dealer_id
        LEFT JOIN Companies c ON LOWER(t.entity_table) LIKE '%company%' AND t.entity_id = c.company_id
        LEFT JOIN Products p ON t.item_type = 'product' AND t.item_id = p.product_id
        LEFT JOIN GrainTypes g ON t.item_type = 'grain' AND t.item_id = g.grain_id
        WHERE t.transaction_id = ?`,
        [transactionId]
      );

      if (transactions.length === 0) {
        return { success: false, message: 'Transaction not found' };
      }

      const transaction = transactions[0];

      // Get transaction items if multi-item
      const items = await this.db.query(
        `SELECT * FROM TransactionItems WHERE transaction_id = ? ORDER BY line_number`,
        [transactionId]
      );

      return {
        success: true,
        data: {
          ...transaction,
          items: items.length > 0 ? items : null,
          is_multi_item: items.length > 1
        }
      };

    } catch (error) {
      console.error('[ReportService] Error getting transaction for receipt:', error);
      return { success: false, message: error.message };
    }
  }
  // ========================================================================
  // Sprint 7 — Profit & Loss Report
  // ========================================================================

  /**
   * Get Profit & Loss Report
   * @param {string} startDate
   * @param {string} endDate
   */
  async getProfitAndLossReport(startDate, endDate) {
    try {
      console.log('[ReportService] Generating P&L Report:', startDate, 'to', endDate);

      // Revenue: Sales to dealers / companies / temp customers
      const revenue = await this.db.query(
        `SELECT
          transaction_type,
          COUNT(*) as count,
          SUM(total_amount) as total
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
          AND (transaction_type LIKE '%SALE%' OR transaction_type LIKE '%DELIVERY%')
        GROUP BY transaction_type`,
        [startDate, endDate]
      );

      // Cost of Goods Sold: Purchases from farmers / suppliers
      const cogs = await this.db.query(
        `SELECT
          transaction_type,
          COUNT(*) as count,
          SUM(total_amount) as total
        FROM Transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
          AND transaction_type LIKE '%PURCHASE%'
        GROUP BY transaction_type`,
        [startDate, endDate]
      );

      // Payments received
      const paymentsIn = await this.db.query(
        `SELECT SUM(debit) as total FROM LedgerEntries
         WHERE DATE(entry_date) BETWEEN ? AND ?
           AND entry_type = 'PAYMENT_RECEIVED'`,
        [startDate, endDate]
      );

      // Payments made
      const paymentsOut = await this.db.query(
        `SELECT SUM(debit) as total FROM LedgerEntries
         WHERE DATE(entry_date) BETWEEN ? AND ?
           AND entry_type = 'PAYMENT_MADE'`,
        [startDate, endDate]
      );

      const totalRevenue = revenue.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
      const totalCOGS = cogs.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
      const grossProfit = totalRevenue - totalCOGS;

      return {
        success: true,
        data: {
          report_type: 'PROFIT_AND_LOSS',
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          revenue: { breakdown: revenue, total: totalRevenue },
          cost_of_goods_sold: { breakdown: cogs, total: totalCOGS },
          gross_profit: grossProfit,
          gross_margin_pct: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0,
          payments_received: parseFloat(paymentsIn[0]?.total) || 0,
          payments_made: parseFloat(paymentsOut[0]?.total) || 0,
          net_cash_position: (parseFloat(paymentsIn[0]?.total) || 0) - (parseFloat(paymentsOut[0]?.total) || 0),
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating P&L report:', error);
      return { success: false, message: error.message };
    }
  }

  // ========================================================================
  // Sprint 7 — Industry-Specific Reports
  // ========================================================================

  /**
   * Expiry Report for Medical Industry
   */
  async getExpiryReport(daysThreshold = 90) {
    try {
      const batches = await this.db.query(
        `SELECT mb.*, p.product_name, p.product_code
         FROM MedicineBatches mb
         JOIN Products p ON mb.product_id = p.product_id
         WHERE mb.expiry_date IS NOT NULL
           AND mb.remaining_quantity > 0
           AND DATE(mb.expiry_date) <= DATE('now', '+' || ? || ' days')
         ORDER BY mb.expiry_date ASC`,
        [daysThreshold]
      );

      const expired = batches.filter((b) => new Date(b.expiry_date) < new Date());
      const critical = batches.filter((b) => {
        const d = new Date(b.expiry_date);
        const now = new Date();
        return d >= now && d <= new Date(now.getTime() + 30 * 86400000);
      });
      const warning = batches.filter((b) => {
        const d = new Date(b.expiry_date);
        const now = new Date();
        return d > new Date(now.getTime() + 30 * 86400000) && d <= new Date(now.getTime() + 60 * 86400000);
      });

      const totalValueAtRisk = batches.reduce((s, b) => s + (parseFloat(b.remaining_quantity) * parseFloat(b.unit_cost || 0)), 0);

      return {
        success: true,
        data: {
          report_type: 'EXPIRY_REPORT',
          generated_at: new Date().toISOString(),
          batches,
          expired: { list: expired, count: expired.length },
          critical: { list: critical, count: critical.length },
          warning: { list: warning, count: warning.length },
          total_value_at_risk: totalValueAtRisk,
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating expiry report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Property Portfolio Report for Real Estate Industry
   */
  async getPropertyPortfolioReport() {
    try {
      const properties = await this.db.query(
        `SELECT * FROM PropertyListings ORDER BY created_at DESC`
      );

      const byStatus = {};
      const byType = {};
      let totalValue = 0;

      properties.forEach((p) => {
        const status = p.status || 'UNKNOWN';
        const type = p.property_type || 'UNKNOWN';
        byStatus[status] = (byStatus[status] || 0) + 1;
        byType[type] = (byType[type] || 0) + 1;
        totalValue += parseFloat(p.asking_price || p.price || 0);
      });

      return {
        success: true,
        data: {
          report_type: 'PROPERTY_PORTFOLIO',
          generated_at: new Date().toISOString(),
          properties,
          by_status: byStatus,
          by_type: byType,
          total_listings: properties.length,
          total_portfolio_value: totalValue,
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating property portfolio report:', error);
      return { success: false, message: error.message };
    }
  }

  // ========================================================================
  // Phase 2 — Additional Reports (SRS v2.0 compliance)
  // ========================================================================

  /**
   * Stock Movement Report — tracks all stock ins/outs over a date range
   */
  async getStockMovementReport(startDate, endDate) {
    try {
      console.log('[ReportService] Generating Stock Movement Report:', startDate, 'to', endDate);

      const movements = await this.db.query(
        `SELECT
          sm.*,
          COALESCE(p.product_name, g.grain_name) as item_name,
          COALESCE(p.product_code, g.grain_code) as item_code,
          u.username as performed_by_name
        FROM StockMovements sm
        LEFT JOIN Products p ON sm.item_type = 'product' AND sm.item_id = p.product_id
        LEFT JOIN GrainTypes g ON sm.item_type = 'grain' AND sm.item_id = g.grain_id
        LEFT JOIN Users u ON sm.performed_by = u.user_id
        WHERE DATE(sm.movement_date) BETWEEN ? AND ?
        ORDER BY sm.movement_date DESC`,
        [startDate, endDate]
      );

      const byType = {};
      const byItem = {};
      let totalIn = 0;
      let totalOut = 0;

      movements.forEach((m) => {
        const mType = m.movement_type || 'UNKNOWN';
        byType[mType] = (byType[mType] || 0) + 1;

        const key = m.item_name || 'Unknown';
        if (!byItem[key]) byItem[key] = { in: 0, out: 0, count: 0 };
        byItem[key].count += 1;

        const qty = parseFloat(m.quantity) || 0;
        if (mType === 'IN' || mType === 'PURCHASE' || mType === 'ADJUSTMENT_IN' || mType === 'RETURN_IN') {
          totalIn += qty;
          byItem[key].in += qty;
        } else {
          totalOut += qty;
          byItem[key].out += qty;
        }
      });

      return {
        success: true,
        data: {
          report_type: 'STOCK_MOVEMENT',
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          movements,
          by_movement_type: byType,
          by_item: byItem,
          summary: {
            total_movements: movements.length,
            total_in: totalIn,
            total_out: totalOut,
            net_change: totalIn - totalOut,
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating stock movement report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Top-Selling Products Report
   */
  async getTopSellingReport(startDate, endDate, limit = 20) {
    try {
      console.log('[ReportService] Generating Top-Selling Products Report');

      // Product sales from TransactionItems (multi-item) + legacy Transactions
      const topProducts = await this.db.query(
        `SELECT
          item_name,
          item_code,
          SUM(quantity) as total_quantity_sold,
          SUM(line_total) as total_revenue,
          COUNT(DISTINCT transaction_id) as transaction_count
        FROM TransactionItems ti
        JOIN Transactions t USING (transaction_id)
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
          AND (t.transaction_type LIKE '%SALE%' OR t.transaction_type LIKE '%DELIVERY%')
        GROUP BY item_name, item_code
        ORDER BY total_revenue DESC
        LIMIT ?`,
        [startDate, endDate, limit]
      );

      // Fallback: also aggregate from legacy single-item transactions
      const legacySales = await this.db.query(
        `SELECT
          COALESCE(p.product_name, g.grain_name) as item_name,
          COALESCE(p.product_code, g.grain_code) as item_code,
          SUM(t.quantity) as total_quantity_sold,
          SUM(t.total_amount) as total_revenue,
          COUNT(*) as transaction_count
        FROM Transactions t
        LEFT JOIN Products p ON t.item_type = 'product' AND t.item_id = p.product_id
        LEFT JOIN GrainTypes g ON t.item_type = 'grain' AND t.item_id = g.grain_id
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
          AND (t.transaction_type LIKE '%SALE%' OR t.transaction_type LIKE '%DELIVERY%')
          AND t.transaction_id NOT IN (SELECT DISTINCT transaction_id FROM TransactionItems)
        GROUP BY item_name, item_code
        ORDER BY total_revenue DESC
        LIMIT ?`,
        [startDate, endDate, limit]
      );

      // Merge and sort
      const merged = [...topProducts, ...legacySales]
        .sort((a, b) => (parseFloat(b.total_revenue) || 0) - (parseFloat(a.total_revenue) || 0))
        .slice(0, limit);

      const grandTotal = merged.reduce((s, r) => s + (parseFloat(r.total_revenue) || 0), 0);

      return {
        success: true,
        data: {
          report_type: 'TOP_SELLING',
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          products: merged,
          summary: {
            total_products: merged.length,
            grand_total_revenue: grandTotal,
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating top-selling report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Dead Stock Report — products with zero or negligible movement over a period
   */
  async getDeadStockReport(daysSinceLastMovement = 90) {
    try {
      console.log('[ReportService] Generating Dead Stock Report, threshold:', daysSinceLastMovement);

      const deadStock = await this.db.query(
        `SELECT
          p.product_id,
          p.product_code,
          p.product_name,
          pc.category_name as category,
          p.unit_of_measure as unit,
          COALESCE(SUM(s.quantity), 0) as current_qty,
          COALESCE(SUM(s.quantity * s.unit_price), 0) as stock_value,
          MAX(sm.movement_date) as last_movement_date,
          CAST(JULIANDAY('now') - JULIANDAY(COALESCE(MAX(sm.movement_date), p.created_at)) AS INTEGER) as days_idle
        FROM Products p
        LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
        LEFT JOIN Stock s ON s.item_type = 'product' AND s.item_id = p.product_id
        LEFT JOIN StockMovements sm ON sm.item_type = 'product' AND sm.item_id = p.product_id
        WHERE p.is_active = 1
        GROUP BY p.product_id
        HAVING current_qty > 0
          AND days_idle >= ?
        ORDER BY days_idle DESC`,
        [daysSinceLastMovement]
      );

      const totalDeadValue = deadStock.reduce((s, d) => s + (parseFloat(d.stock_value) || 0), 0);

      return {
        success: true,
        data: {
          report_type: 'DEAD_STOCK',
          generated_at: new Date().toISOString(),
          threshold_days: daysSinceLastMovement,
          items: deadStock,
          summary: {
            total_dead_items: deadStock.length,
            total_dead_value: totalDeadValue,
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating dead stock report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Batch-wise Stock Report (Medical) — shows all batches with expiry, cost & quantity
   */
  async getBatchWiseStockReport() {
    try {
      console.log('[ReportService] Generating Batch-wise Stock Report');

      const batches = await this.db.query(
        `SELECT
          mb.batch_id,
          mb.batch_number,
          p.product_id,
          p.product_name,
          p.product_code,
          mb.manufacturing_date,
          mb.expiry_date,
          mb.initial_quantity,
          mb.remaining_quantity,
          mb.unit_cost,
          mb.selling_price,
          (mb.remaining_quantity * mb.unit_cost) as batch_value,
          CASE
            WHEN mb.expiry_date IS NOT NULL AND DATE(mb.expiry_date) < DATE('now') THEN 'EXPIRED'
            WHEN mb.expiry_date IS NOT NULL AND DATE(mb.expiry_date) <= DATE('now', '+30 days') THEN 'CRITICAL'
            WHEN mb.expiry_date IS NOT NULL AND DATE(mb.expiry_date) <= DATE('now', '+90 days') THEN 'WARNING'
            ELSE 'OK'
          END as expiry_status
        FROM MedicineBatches mb
        JOIN Products p ON mb.product_id = p.product_id
        WHERE mb.remaining_quantity > 0
        ORDER BY p.product_name, mb.expiry_date ASC`
      );

      const totalValue = batches.reduce((s, b) => s + (parseFloat(b.batch_value) || 0), 0);
      const totalQty = batches.reduce((s, b) => s + (parseFloat(b.remaining_quantity) || 0), 0);
      const expiredCount = batches.filter((b) => b.expiry_status === 'EXPIRED').length;

      return {
        success: true,
        data: {
          report_type: 'BATCH_WISE_STOCK',
          generated_at: new Date().toISOString(),
          batches,
          summary: {
            total_batches: batches.length,
            total_quantity: totalQty,
            total_value: totalValue,
            expired_batches: expiredCount,
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating batch-wise stock report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Patient Purchase History Report (Medical)
   */
  async getPatientHistoryReport(patientId = null) {
    try {
      console.log('[ReportService] Generating Patient History Report, patient:', patientId);

      let query = `
        SELECT
          f.farmer_id as patient_id,
          f.specific_id as patient_code,
          f.name as patient_name,
          f.phone,
          COUNT(DISTINCT t.transaction_id) as total_transactions,
          SUM(t.total_amount) as total_spent,
          SUM(t.cash_paid) as total_cash_paid,
          SUM(t.credit_amount) as total_credit,
          f.balance,
          f.credit as outstanding_credit,
          MAX(t.transaction_date) as last_purchase_date,
          COUNT(DISTINCT pr.prescription_id) as total_prescriptions
        FROM Farmers f
        LEFT JOIN Transactions t ON t.entity_table LIKE '%Farmer%' AND t.entity_id = f.farmer_id
        LEFT JOIN Prescriptions pr ON pr.patient_id = f.farmer_id
        WHERE f.is_active = 1
      `;
      const params = [];

      if (patientId) {
        query += ' AND f.farmer_id = ?';
        params.push(patientId);
      }

      query += `
        GROUP BY f.farmer_id
        ORDER BY total_spent DESC
      `;

      const patients = await this.db.query(query, params);

      // If single patient, get recent transactions
      let recentTransactions = [];
      let recentPrescriptions = [];
      if (patientId) {
        recentTransactions = await this.db.query(
          `SELECT t.*, COALESCE(p.product_name, g.grain_name) as item_name
           FROM Transactions t
           LEFT JOIN Products p ON t.item_type='product' AND t.item_id=p.product_id
           LEFT JOIN GrainTypes g ON t.item_type='grain' AND t.item_id=g.grain_id
           WHERE t.entity_table LIKE '%Farmer%' AND t.entity_id = ?
           ORDER BY t.transaction_date DESC LIMIT 50`,
          [patientId]
        );
        recentPrescriptions = await this.db.query(
          `SELECT * FROM Prescriptions WHERE patient_id = ? ORDER BY prescription_date DESC LIMIT 20`,
          [patientId]
        );
      }

      return {
        success: true,
        data: {
          report_type: 'PATIENT_HISTORY',
          generated_at: new Date().toISOString(),
          patients,
          recent_transactions: recentTransactions,
          recent_prescriptions: recentPrescriptions,
          summary: {
            total_patients: patients.length,
            total_revenue: patients.reduce((s, p) => s + (parseFloat(p.total_spent) || 0), 0),
            total_outstanding: patients.reduce((s, p) => s + (parseFloat(p.outstanding_credit) || 0), 0),
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating patient history report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Commission Earned Report (Real Estate / General)
   */
  async getCommissionEarnedReport(startDate, endDate) {
    try {
      console.log('[ReportService] Generating Commission Earned Report');

      const commissions = await this.db.query(
        `SELECT c.*,
          u.username as created_by_name
        FROM Commissions c
        LEFT JOIN Users u ON c.created_by = u.user_id
        WHERE DATE(c.created_at) BETWEEN ? AND ?
        ORDER BY c.created_at DESC`,
        [startDate, endDate]
      );

      const byStatus = {};
      const byAgent = {};
      let totalEarned = 0;
      let totalPending = 0;
      let totalPaid = 0;

      commissions.forEach((c) => {
        const status = c.status || 'UNKNOWN';
        byStatus[status] = (byStatus[status] || 0) + (parseFloat(c.commission_amount) || 0);

        const agent = c.agent_name || 'Unassigned';
        if (!byAgent[agent]) byAgent[agent] = { earned: 0, paid: 0, pending: 0, count: 0 };
        byAgent[agent].earned += parseFloat(c.commission_amount) || 0;
        byAgent[agent].count += 1;

        totalEarned += parseFloat(c.commission_amount) || 0;
        if (status === 'PAID') {
          totalPaid += parseFloat(c.commission_amount) || 0;
          byAgent[agent].paid += parseFloat(c.commission_amount) || 0;
        } else {
          totalPending += parseFloat(c.commission_amount) || 0;
          byAgent[agent].pending += parseFloat(c.commission_amount) || 0;
        }
      });

      return {
        success: true,
        data: {
          report_type: 'COMMISSION_EARNED',
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          commissions,
          by_status: byStatus,
          by_agent: byAgent,
          summary: {
            total_commissions: commissions.length,
            total_earned: totalEarned,
            total_paid: totalPaid,
            total_pending: totalPending,
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating commission earned report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Credit/Balance Aging Analysis Report
   */
  async getCreditAgingReport() {
    try {
      console.log('[ReportService] Generating Credit Aging Report');

      // Get all entities with outstanding balances and their oldest unpaid ledger entry
      const agingQuery = `
        SELECT
          le.entity_type,
          le.entity_id,
          le.entity_name,
          SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(le.entry_date) <= 30 THEN (le.credit - le.debit) ELSE 0 END) as bucket_0_30,
          SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(le.entry_date) > 30 AND JULIANDAY('now') - JULIANDAY(le.entry_date) <= 60 THEN (le.credit - le.debit) ELSE 0 END) as bucket_31_60,
          SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(le.entry_date) > 60 AND JULIANDAY('now') - JULIANDAY(le.entry_date) <= 90 THEN (le.credit - le.debit) ELSE 0 END) as bucket_61_90,
          SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(le.entry_date) > 90 THEN (le.credit - le.debit) ELSE 0 END) as bucket_90_plus,
          SUM(le.credit - le.debit) as total_outstanding,
          MIN(le.entry_date) as oldest_entry,
          MAX(le.entry_date) as newest_entry
        FROM LedgerEntries le
        GROUP BY le.entity_type, le.entity_id, le.entity_name
        HAVING total_outstanding > 0
        ORDER BY total_outstanding DESC
      `;

      const agingData = await this.db.query(agingQuery);

      const totals = agingData.reduce(
        (acc, row) => ({
          bucket_0_30: acc.bucket_0_30 + (parseFloat(row.bucket_0_30) || 0),
          bucket_31_60: acc.bucket_31_60 + (parseFloat(row.bucket_31_60) || 0),
          bucket_61_90: acc.bucket_61_90 + (parseFloat(row.bucket_61_90) || 0),
          bucket_90_plus: acc.bucket_90_plus + (parseFloat(row.bucket_90_plus) || 0),
          total: acc.total + (parseFloat(row.total_outstanding) || 0),
        }),
        { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0, total: 0 }
      );

      return {
        success: true,
        data: {
          report_type: 'CREDIT_AGING',
          generated_at: new Date().toISOString(),
          aging_data: agingData,
          summary: {
            total_entities: agingData.length,
            ...totals,
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating credit aging report:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Controlled Substance Register Report (Medical)
   */
  async getControlledSubstanceReport(startDate, endDate) {
    try {
      console.log('[ReportService] Generating Controlled Substance Register Report');

      const entries = await this.db.query(
        `SELECT csr.*,
          p.product_name, p.product_code,
          mb.batch_number,
          u.username as performed_by_name
        FROM ControlledSubstanceRegister csr
        LEFT JOIN Products p ON csr.medicine_id = p.product_id
        LEFT JOIN MedicineBatches mb ON csr.batch_id = mb.batch_id
        LEFT JOIN Users u ON csr.performed_by = u.user_id
        WHERE DATE(csr.created_at) BETWEEN ? AND ?
        ORDER BY csr.created_at DESC`,
        [startDate, endDate]
      );

      const totalIn = entries.filter((e) => e.transaction_type === 'IN').reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);
      const totalOut = entries.filter((e) => e.transaction_type === 'OUT').reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);

      return {
        success: true,
        data: {
          report_type: 'CONTROLLED_SUBSTANCE',
          start_date: startDate,
          end_date: endDate,
          generated_at: new Date().toISOString(),
          entries,
          summary: {
            total_entries: entries.length,
            total_in: totalIn,
            total_out: totalOut,
            net_stock: totalIn - totalOut,
          },
        },
      };
    } catch (error) {
      console.error('[ReportService] Error generating controlled substance report:', error);
      return { success: false, message: error.message };
    }
  }
}

export default ReportService;
