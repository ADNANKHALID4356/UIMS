import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import { app, safeStorage } from 'electron';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Database Service - Singleton pattern for SQLite database management
 * SRS Sprint 1: "SQLite + SQLCipher setup and encryption"
 * Uses better-sqlite3-multiple-ciphers with SQLCipher encryption.
 */
export class DatabaseService {
  static instance = null;
  db = null;
  dbPath = '';
  keyFilePath = '';

  constructor() {
    const dataPath = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    this.dbPath = path.join(dataPath, 'inventory.db');
    this.keyFilePath = path.join(app.getPath('userData'), '.db_key');
  }

  /**
   * Get or create the database encryption key.
   * Uses Electron's safeStorage (OS-level DPAPI on Windows) for secure key storage.
   * If safeStorage is unavailable, falls back to a file-based key.
   */
  getEncryptionKey() {
    try {
      if (fs.existsSync(this.keyFilePath)) {
        // Read existing encrypted key
        const encryptedKey = fs.readFileSync(this.keyFilePath);
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(encryptedKey);
        }
        // Fallback: key stored as hex
        return encryptedKey.toString('utf8');
      }

      // Generate new key
      const newKey = crypto.randomBytes(32).toString('hex');

      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(newKey);
        fs.writeFileSync(this.keyFilePath, encrypted);
      } else {
        // Fallback: store as-is (less secure, but functional)
        fs.writeFileSync(this.keyFilePath, newKey, 'utf8');
      }

      return newKey;
    } catch (error) {
      console.error('[DB] Error managing encryption key:', error);
      // Ultimate fallback: deterministic key from app path
      return crypto.createHash('sha256').update(app.getPath('userData')).digest('hex');
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Check if a file is a plain (unencrypted) SQLite database by reading its header.
   * Valid SQLite files start with "SQLite format 3\0".
   */
  isPlainSqliteFile(filePath) {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(16);
      fs.readSync(fd, buf, 0, 16, 0);
      fs.closeSync(fd);
      return buf.toString('utf8', 0, 15) === 'SQLite format 3';
    } catch {
      return false;
    }
  }

  /**
   * Initialize database connection and create tables
   * SRS Sprint 1: Database encrypted with SQLCipher
   */
  async initialize() {
    try {
      const dbExists = fs.existsSync(this.dbPath);

      // Get (or create) the encryption key
      const encKey = this.getEncryptionKey();

      if (dbExists) {
        const isPlain = this.isPlainSqliteFile(this.dbPath);

        if (isPlain) {
          // Existing unencrypted database — open without key, then migrate
          console.log('[DB] Unencrypted database detected. Migrating to encrypted...');
          this.db = new Database(this.dbPath);
          // Verify it opens fine
          this.db.pragma('journal_mode');
          // Apply encryption via rekey
          this.db.pragma(`rekey = '${encKey}'`);
          console.log('[DB] Database encrypted successfully.');
        } else {
          // File doesn't have plain SQLite header — try opening with encryption key
          try {
            this.db = new Database(this.dbPath);
            this.db.pragma(`key = '${encKey}'`);
            // Verify key works
            this.db.pragma('journal_mode');
            console.log('[DB] Encrypted database opened successfully.');
          } catch (encErr) {
            // Corrupted or wrong key — backup the old file and start fresh
            console.warn('[DB] Cannot open database (corrupted or wrong key). Creating fresh database...');
            try { if (this.db) this.db.close(); } catch (_) { /* ignore */ }
            const backupPath = this.dbPath + '.corrupt.' + Date.now();
            fs.renameSync(this.dbPath, backupPath);
            console.log('[DB] Old database backed up to:', backupPath);
            // Create brand new encrypted database
            this.db = new Database(this.dbPath);
            this.db.pragma(`key = '${encKey}'`);
            console.log('[DB] New encrypted database created.');
          }
        }
      } else {
        // Brand new database — encrypt from the start
        this.db = new Database(this.dbPath);
        this.db.pragma(`key = '${encKey}'`);
        console.log('[DB] New database created with encryption.');
      }

      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      // Create tables
      this.createTables();
      
      // Run migrations to update existing database schema
      this.runMigrations();
      
      // Initialize default admin user if no users exist
      await this.initializeDefaultAdmin();
      
      console.log('Database initialized successfully at:', this.dbPath);
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Run database schema migrations
   */
  runMigrations() {
    try {
      // Get current schema version
      const versionResult = this.db.pragma('user_version', { simple: true });
      const currentVersion = parseInt(versionResult) || 0;
      
      console.log(`Current database schema version: ${currentVersion}`);

      // Migration 1: Remove UNIQUE constraint and add batch tracking columns
      if (currentVersion < 1) {
        console.log('Running migration 1: Migrating Stock table to support batch tracking...');
        
        // Check if UNIQUE constraint exists
        const tableInfo = this.db.prepare(`
          SELECT sql FROM sqlite_master WHERE type='table' AND name='Stock'
        `).get();
        
        const hasUniqueConstraint = tableInfo && tableInfo.sql && 
          (tableInfo.sql.includes('UNIQUE(item_type, item_id)') || 
           tableInfo.sql.includes('UNIQUE (item_type, item_id)'));
        
        if (hasUniqueConstraint) {
          console.log('Found UNIQUE constraint - recreating Stock table...');
          
          // SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table
          this.db.exec(`
            -- Create new table without UNIQUE constraint
            CREATE TABLE Stock_new (
              stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
              item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('PRODUCT', 'GRAIN')),
              item_id INTEGER NOT NULL,
              quantity DECIMAL(15,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
              unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
              batch_reference VARCHAR(100),
              last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Copy data from old table, setting created_at to last_updated for existing records
            INSERT INTO Stock_new (stock_id, item_type, item_id, quantity, unit_price, batch_reference, last_updated, created_at)
            SELECT stock_id, item_type, item_id, quantity, unit_price, 
                   '${new Date().toISOString()}' as batch_reference,
                   last_updated, 
                   COALESCE(last_updated, CURRENT_TIMESTAMP) as created_at
            FROM Stock;
            
            -- Drop old table
            DROP TABLE Stock;
            
            -- Rename new table
            ALTER TABLE Stock_new RENAME TO Stock;
          `);
          
          console.log('Stock table recreated successfully without UNIQUE constraint');
        } else {
          // Table doesn't have UNIQUE constraint, just add missing columns if needed
          const columns = this.db.pragma('table_info(Stock)');
          const hasBatchRef = columns.some(col => col.name === 'batch_reference');
          const hasCreatedAt = columns.some(col => col.name === 'created_at');
          
          if (!hasBatchRef) {
            this.db.exec('ALTER TABLE Stock ADD COLUMN batch_reference VARCHAR(100)');
            console.log('Added batch_reference column');
          }
          
          if (!hasCreatedAt) {
            this.db.exec('ALTER TABLE Stock ADD COLUMN created_at DATETIME');
            this.db.exec('UPDATE Stock SET created_at = last_updated WHERE created_at IS NULL');
            console.log('Added created_at column');
          }
        }
        
        // Update version
        this.db.pragma('user_version = 1');
        console.log('Migration 1 completed');
      }

      // Migration 2: Add Sprint 5 columns to Transactions table
      if (currentVersion < 2) {
        console.log('Running migration 2: Adding Sprint 5 columns to Transactions table...');
        
        const transColumns = this.db.pragma('table_info(Transactions)');
        const columnNames = transColumns.map(col => col.name);
        
        // Add entity_table column
        if (!columnNames.includes('entity_table')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN entity_table VARCHAR(50)');
          console.log('Added entity_table column');
        }
        
        // Add entity_name column (stores actual entity name for both regular and irregular)
        if (!columnNames.includes('entity_name')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN entity_name VARCHAR(255)');
          console.log('Added entity_name column');
        }
        
        // Add temp customer detail columns
        if (!columnNames.includes('temp_customer_father_name')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN temp_customer_father_name VARCHAR(100)');
          console.log('Added temp_customer_father_name column');
        }
        
        if (!columnNames.includes('temp_customer_cnic')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN temp_customer_cnic VARCHAR(15)');
          console.log('Added temp_customer_cnic column');
        }
        
        if (!columnNames.includes('temp_customer_phone')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN temp_customer_phone VARCHAR(15)');
          console.log('Added temp_customer_phone column');
        }
        
        if (!columnNames.includes('temp_customer_address')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN temp_customer_address TEXT');
          console.log('Added temp_customer_address column');
        }
        
        // Update version
        this.db.pragma('user_version = 2');
        console.log('Migration 2 completed');
      }

      // Migration 3: Recreate Transactions table with updated constraints
      if (currentVersion < 3) {
        console.log('Running migration 3: Updating Transactions table CHECK constraints...');
        
        // Check current table structure to build appropriate copy query
        const oldColumns = this.db.pragma('table_info(Transactions)');
        const oldColumnNames = oldColumns.map(col => col.name);
        
        // Build column list for copying data (only existing columns)
        const columnsToSelect = [
          'transaction_id', 'transaction_number', 'transaction_date', 'transaction_type',
          'entity_type', 'entity_id', 'entity_table', 'entity_name',
          'temp_customer_name', 'temp_customer_father_name', 'temp_customer_cnic',
          'temp_customer_phone', 'temp_customer_address',
          'item_type', 'item_id', 'quantity', 'unit_price', 'total_amount',
          'payment_type', 'cash_paid', 'credit_amount',
          'description', 'created_by', 'created_at'
        ].filter(col => oldColumnNames.includes(col));
        
        const selectColumns = columnsToSelect.join(', ');
        
        // SQLite doesn't support modifying CHECK constraints, so we need to recreate the table
        this.db.exec(`
          -- Create new Transactions table with updated constraints
          CREATE TABLE Transactions_new (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_number VARCHAR(20) UNIQUE NOT NULL,
            transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            transaction_type VARCHAR(30) NOT NULL,
            
            entity_type VARCHAR(20) NOT NULL,
            entity_id INTEGER,
            entity_table VARCHAR(50),
            entity_name VARCHAR(255),
            temp_customer_name VARCHAR(100),
            temp_customer_father_name VARCHAR(100),
            temp_customer_cnic VARCHAR(15),
            temp_customer_phone VARCHAR(15),
            temp_customer_address TEXT,
            
            item_type VARCHAR(20) NOT NULL,
            item_id INTEGER NOT NULL,
            quantity DECIMAL(15,3) NOT NULL,
            unit_price DECIMAL(15,2) NOT NULL,
            total_amount DECIMAL(15,2) NOT NULL,
            
            overall_discount_type VARCHAR(20) DEFAULT 'amount',
            overall_discount_value DECIMAL(15,2) DEFAULT 0.00,
            overall_discount_amount DECIMAL(15,2) DEFAULT 0.00,
            
            payment_type VARCHAR(20) NOT NULL,
            cash_paid DECIMAL(15,2) DEFAULT 0.00,
            credit_amount DECIMAL(15,2) DEFAULT 0.00,
            
            description TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (created_by) REFERENCES Users(user_id),
            CHECK (entity_type IN ('regular', 'irregular')),
            CHECK (item_type IN ('product', 'grain')),
            CHECK (payment_type IN ('CASH', 'CREDIT', 'PARTIAL')),
            CHECK (quantity > 0),
            CHECK (unit_price >= 0),
            CHECK (total_amount >= 0),
            CHECK (overall_discount_type IN ('percentage', 'amount'))
          );
        `);
        
        // Copy data from old table (only columns that exist in both)
        console.log('Copying data with columns:', selectColumns);
        const copyQuery = `INSERT INTO Transactions_new (${selectColumns}) SELECT ${selectColumns} FROM Transactions`;
        this.db.exec(copyQuery);
        
        // Drop old table and rename
        this.db.exec(`
          DROP TABLE Transactions;
          ALTER TABLE Transactions_new RENAME TO Transactions;
        `);
        
        console.log('Transactions table recreated with updated constraints');
        
        // Update version
        this.db.pragma('user_version = 3');
        console.log('Migration 3 completed');
      }

      // Migration 4: Add stock_location column to Stock table
      if (currentVersion < 4) {
        console.log('Running migration 4: Adding stock_location column to Stock table...');
        
        const stockColumns = this.db.pragma('table_info(Stock)');
        const hasStockLocation = stockColumns.some(col => col.name === 'stock_location');
        
        if (!hasStockLocation) {
          this.db.exec('ALTER TABLE Stock ADD COLUMN stock_location VARCHAR(100) DEFAULT "Main Warehouse"');
          console.log('Added stock_location column to Stock table');
        }
        
        // Update version
        this.db.pragma('user_version = 4');
        console.log('Migration 4 completed');
      }

      // Migration 5: Ensure entity_name column exists in Transactions table
      if (currentVersion < 5) {
        console.log('Running migration 5: Adding entity_name column to Transactions table...');
        
        const transColumns = this.db.pragma('table_info(Transactions)');
        const hasEntityName = transColumns.some(col => col.name === 'entity_name');
        
        if (!hasEntityName) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN entity_name VARCHAR(255)');
          console.log('Added entity_name column to Transactions table');
        } else {
          console.log('entity_name column already exists in Transactions table');
        }
        
        // Update version
        this.db.pragma('user_version = 5');
        console.log('Migration 5 completed');
      }

      // Migration 6: Sprint 6 - Multi-Item Transaction System
      if (currentVersion < 6) {
        console.log('Running migration 6: Adding Sprint 6 multi-item transaction support...');
        
        // Create TransactionItems table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS TransactionItems (
            transaction_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            item_type TEXT NOT NULL CHECK(item_type IN ('PRODUCT', 'GRAIN')),
            item_reference_id INTEGER NOT NULL,
            quantity REAL NOT NULL CHECK(quantity > 0),
            unit_price REAL NOT NULL CHECK(unit_price >= 0),
            discount_amount REAL DEFAULT 0 CHECK(discount_amount >= 0),
            line_total REAL NOT NULL CHECK(line_total >= 0),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (transaction_id) REFERENCES Transactions(transaction_id) ON DELETE CASCADE
          )
        `);
        console.log('Created TransactionItems table');
        
        // Create indexes for performance
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction 
          ON TransactionItems(transaction_id)
        `);
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_transaction_items_item 
          ON TransactionItems(item_type, item_reference_id)
        `);
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_transaction_items_composite 
          ON TransactionItems(transaction_id, item_type)
        `);
        console.log('Created TransactionItems indexes');
        
        // Add columns to Transactions table
        const transColumns = this.db.pragma('table_info(Transactions)');
        const columnNames = transColumns.map(col => col.name);
        
        if (!columnNames.includes('supports_multiple_items')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN supports_multiple_items BOOLEAN DEFAULT 0');
          console.log('Added supports_multiple_items column to Transactions table');
        }
        
        if (!columnNames.includes('item_count')) {
          this.db.exec('ALTER TABLE Transactions ADD COLUMN item_count INTEGER DEFAULT 1');
          console.log('Added item_count column to Transactions table');
        }
        
        // Create trigger for updated_at timestamp
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS trigger_transaction_items_updated_at
          AFTER UPDATE ON TransactionItems
          FOR EACH ROW
          BEGIN
            UPDATE TransactionItems 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE transaction_item_id = NEW.transaction_item_id;
          END
        `);
        console.log('Created TransactionItems updated_at trigger');
        
        // Update version
        this.db.pragma('user_version = 6');
        console.log('Migration 6 completed - Sprint 6 multi-item transaction support enabled');
      }

      // Migration 7: Add father_name column to Dealers and Companies tables
      if (currentVersion < 7) {
        console.log('Running migration 7: Adding father_name columns to Dealers and Companies...');
        
        // Check Dealers table columns
        const dealerColumns = this.db.pragma('table_info(Dealers)');
        const dealerColumnNames = dealerColumns.map(col => col.name);
        
        if (!dealerColumnNames.includes('father_name')) {
          this.db.exec('ALTER TABLE Dealers ADD COLUMN father_name VARCHAR(100)');
          console.log('Added father_name column to Dealers table');
        }
        
        // Check Companies table columns
        const companyColumns = this.db.pragma('table_info(Companies)');
        const companyColumnNames = companyColumns.map(col => col.name);
        
        if (!companyColumnNames.includes('father_name')) {
          this.db.exec('ALTER TABLE Companies ADD COLUMN father_name VARCHAR(100)');
          console.log('Added father_name column to Companies table');
        }
        
        // Update version
        this.db.pragma('user_version = 7');
        console.log('Migration 7 completed - father_name support added for Dealers and Companies');
      }

      // Migration 8: v2.0 - OrganizationSettings table for multi-industry support
      if (currentVersion < 8) {
        console.log('Running migration 8: Creating OrganizationSettings table (v2.0 multi-industry)...');
        
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS OrganizationSettings (
            setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
            industry_type VARCHAR(30) NOT NULL CHECK (industry_type IN ('RETAIL', 'MEDICAL', 'REAL_ESTATE', 'AGRICULTURAL')),
            business_name VARCHAR(200) NOT NULL,
            owner_name VARCHAR(100) NOT NULL,
            address TEXT,
            phone VARCHAR(20),
            email VARCHAR(100),
            currency_symbol VARCHAR(10) DEFAULT 'PKR',
            date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
            theme VARCHAR(20) DEFAULT 'light',
            auto_logout_minutes INTEGER DEFAULT 30,
            backup_schedule VARCHAR(20) DEFAULT 'daily',
            config_json TEXT,
            logo_path TEXT,
            receipt_header TEXT,
            receipt_footer TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create index
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_org_settings_active ON OrganizationSettings(is_active);
          CREATE INDEX IF NOT EXISTS idx_org_settings_industry ON OrganizationSettings(industry_type);
        `);

        console.log('Created OrganizationSettings table');
        
        // Update version
        this.db.pragma('user_version = 8');
        console.log('Migration 8 completed - v2.0 multi-industry support enabled');
      }

      // Migration 9: v2.0 Sprint 2 - Industry-specific entity columns
      if (currentVersion < 9) {
        console.log('Running migration 9: Adding industry-specific entity columns...');

        // Helper: check if column exists before adding
        const columnExists = (table, column) => {
          const cols = this.db.pragma(`table_info(${table})`);
          return cols.some(c => c.name === column);
        };

        // Farmers table: Medical industry fields (Patient)
        if (!columnExists('Farmers', 'date_of_birth')) {
          this.db.exec('ALTER TABLE Farmers ADD COLUMN date_of_birth DATE');
        }
        if (!columnExists('Farmers', 'allergies')) {
          this.db.exec('ALTER TABLE Farmers ADD COLUMN allergies TEXT');
        }
        if (!columnExists('Farmers', 'chronic_conditions')) {
          this.db.exec('ALTER TABLE Farmers ADD COLUMN chronic_conditions TEXT');
        }

        // Farmers table: Real Estate industry fields (Client)
        if (!columnExists('Farmers', 'client_type')) {
          this.db.exec("ALTER TABLE Farmers ADD COLUMN client_type VARCHAR(30)");
        }
        if (!columnExists('Farmers', 'budget_min')) {
          this.db.exec('ALTER TABLE Farmers ADD COLUMN budget_min DECIMAL(15,2)');
        }
        if (!columnExists('Farmers', 'budget_max')) {
          this.db.exec('ALTER TABLE Farmers ADD COLUMN budget_max DECIMAL(15,2)');
        }
        if (!columnExists('Farmers', 'preferred_locations')) {
          this.db.exec('ALTER TABLE Farmers ADD COLUMN preferred_locations TEXT');
        }

        // Farmers table: Retail industry fields (Customer)
        if (!columnExists('Farmers', 'customer_group')) {
          this.db.exec("ALTER TABLE Farmers ADD COLUMN customer_group VARCHAR(30)");
        }

        // Dealers table: Real Estate industry fields (Agent)
        if (!columnExists('Dealers', 'commission_rate')) {
          this.db.exec('ALTER TABLE Dealers ADD COLUMN commission_rate DECIMAL(5,2)');
        }

        // Companies table: Medical industry fields (Pharma Company)
        if (!columnExists('Companies', 'drug_license_number')) {
          this.db.exec("ALTER TABLE Companies ADD COLUMN drug_license_number VARCHAR(100)");
        }

        console.log('Added industry-specific entity columns');

        // Update version
        this.db.pragma('user_version = 9');
        console.log('Migration 9 completed - industry-specific entity columns added');
      }

      // Migration 10: v2.0 Sprint 3 - Permanent/Temporary entity flag
      if (currentVersion < 10) {
        console.log('Running migration 10: Adding is_permanent flag to entity tables...');

        const columnExists = (table, column) => {
          const cols = this.db.pragma(`table_info(${table})`);
          return cols.some(c => c.name === column);
        };

        // Add is_permanent to Farmers (Customers/Patients/Clients)
        if (!columnExists('Farmers', 'is_permanent')) {
          this.db.exec('ALTER TABLE Farmers ADD COLUMN is_permanent BOOLEAN DEFAULT 1');
        }

        // Add is_permanent to Dealers (Distributors/Agents)
        if (!columnExists('Dealers', 'is_permanent')) {
          this.db.exec('ALTER TABLE Dealers ADD COLUMN is_permanent BOOLEAN DEFAULT 1');
        }

        // Add is_permanent to Companies (Suppliers/Pharma/Owners)
        if (!columnExists('Companies', 'is_permanent')) {
          this.db.exec('ALTER TABLE Companies ADD COLUMN is_permanent BOOLEAN DEFAULT 1');
        }

        this.db.pragma('user_version = 10');
        console.log('Migration 10 completed - is_permanent flag added to entity tables');
      }

      // Migration 11: v2.0 Sprint 2 - Add email column to Users + Settings table
      if (currentVersion < 11) {
        console.log('Running migration 11: Adding email column to Users + Settings table...');

        const columnExists = (table, column) => {
          const cols = this.db.pragma(`table_info(${table})`);
          return cols.some(c => c.name === column);
        };

        // Add email to Users table (SRS Sprint 2: user sets own email on first run)
        if (!columnExists('Users', 'email')) {
          this.db.exec("ALTER TABLE Users ADD COLUMN email VARCHAR(100)");
        }

        // Create Settings table (SRS Sprint 1: general key/value settings store)
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS Settings (
            setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT,
            description VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.db.pragma('user_version = 11');
        console.log('Migration 11 completed - email column + Settings table added');
      }

      // ══════════════════════════════════════════════════════════════════
      // Migration 12: Sprint 4 — Industry-Specific Inventory Schema
      // Adds: Retail (SKU, barcode, brand, warranty, serial tracking, variants)
      //       Medical (generic_name, composition, drug_form, strength, controlled, storage, expiry)
      //       Real Estate (PropertyListings table)
      //       MedicineBatches table, ProductVariants table, SerialNumbers table
      // ══════════════════════════════════════════════════════════════════
      if (currentVersion < 12) {
        console.log('Running migration 12: Sprint 4 — Industry-specific inventory schema...');

        const columnExists = (table, column) => {
          try {
            const cols = this.db.pragma(`table_info(${table})`);
            return cols.some(c => c.name === column);
          } catch { return false; }
        };

        // ─── Products table: Retail extensions ───
        if (!columnExists('Products', 'sku')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN sku VARCHAR(50)");
        }
        if (!columnExists('Products', 'barcode')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN barcode VARCHAR(100)");
        }
        if (!columnExists('Products', 'brand')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN brand VARCHAR(100)");
        }
        if (!columnExists('Products', 'warranty_months')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN warranty_months INTEGER DEFAULT 0");
        }
        if (!columnExists('Products', 'serial_tracking')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN serial_tracking BOOLEAN DEFAULT 0");
        }
        if (!columnExists('Products', 'has_variants')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN has_variants BOOLEAN DEFAULT 0");
        }
        if (!columnExists('Products', 'min_price')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN min_price DECIMAL(15,2) DEFAULT 0");
        }
        if (!columnExists('Products', 'max_price')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN max_price DECIMAL(15,2) DEFAULT 0");
        }

        // ─── Products table: Medical extensions ───
        if (!columnExists('Products', 'generic_name')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN generic_name VARCHAR(100)");
        }
        if (!columnExists('Products', 'brand_name')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN brand_name VARCHAR(100)");
        }
        if (!columnExists('Products', 'composition')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN composition TEXT");
        }
        if (!columnExists('Products', 'drug_form')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN drug_form VARCHAR(50)");
        }
        if (!columnExists('Products', 'strength')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN strength VARCHAR(50)");
        }
        if (!columnExists('Products', 'requires_prescription')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN requires_prescription BOOLEAN DEFAULT 0");
        }
        if (!columnExists('Products', 'controlled_substance')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN controlled_substance BOOLEAN DEFAULT 0");
        }
        if (!columnExists('Products', 'storage_conditions')) {
          this.db.exec("ALTER TABLE Products ADD COLUMN storage_conditions VARCHAR(200)");
        }

        // ─── MedicineBatches table ───
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS MedicineBatches (
            batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            batch_number VARCHAR(50) NOT NULL,
            manufacture_date DATE,
            expiry_date DATE NOT NULL,
            quantity DECIMAL(15,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
            unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
            supplier_id INTEGER,
            notes TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES Products(product_id),
            FOREIGN KEY (supplier_id) REFERENCES Companies(company_id)
          )
        `);

        // ─── ProductVariants table (Retail: size, color, model) ───
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS ProductVariants (
            variant_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            variant_name VARCHAR(100) NOT NULL,
            variant_type VARCHAR(50),
            sku VARCHAR(50),
            barcode VARCHAR(100),
            additional_price DECIMAL(15,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES Products(product_id)
          )
        `);

        // ─── SerialNumbers table (Retail: per-unit serial tracking) ───
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS SerialNumbers (
            serial_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            serial_number VARCHAR(100) UNIQUE NOT NULL,
            status VARCHAR(20) DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'sold', 'returned', 'warranty')),
            sold_to_entity_type VARCHAR(20),
            sold_to_entity_id INTEGER,
            transaction_id INTEGER,
            warranty_expiry DATE,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES Products(product_id),
            FOREIGN KEY (transaction_id) REFERENCES Transactions(transaction_id)
          )
        `);

        // ─── PropertyListings table (Real Estate) ───
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS PropertyListings (
            property_id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_code VARCHAR(20) UNIQUE NOT NULL,
            title VARCHAR(200) NOT NULL,
            property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('Residential', 'Commercial', 'Plot', 'Industrial', 'Agricultural')),
            listing_type VARCHAR(20) NOT NULL CHECK (listing_type IN ('Sale', 'Rent', 'Lease')),
            status VARCHAR(30) DEFAULT 'Available' CHECK (status IN ('Available', 'Sold', 'Rented', 'Under Negotiation', 'Reserved')),
            
            address TEXT,
            city VARCHAR(100),
            area VARCHAR(100),
            
            land_area DECIMAL(15,2),
            built_area DECIMAL(15,2),
            area_unit VARCHAR(20) DEFAULT 'sq_ft' CHECK (area_unit IN ('sq_ft', 'sq_yards', 'marla', 'kanal', 'acre')),
            
            bedrooms INTEGER DEFAULT 0,
            bathrooms INTEGER DEFAULT 0,
            floors INTEGER DEFAULT 1,
            parking_spaces INTEGER DEFAULT 0,
            
            price DECIMAL(18,2) NOT NULL DEFAULT 0,
            price_per_unit DECIMAL(18,2) DEFAULT 0,
            
            description TEXT,
            features TEXT,
            image_paths TEXT,
            
            owner_id INTEGER,
            agent_id INTEGER,
            
            is_active BOOLEAN DEFAULT 1,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (owner_id) REFERENCES Companies(company_id),
            FOREIGN KEY (agent_id) REFERENCES Dealers(dealer_id),
            FOREIGN KEY (created_by) REFERENCES Users(user_id)
          )
        `);

        // ─── Indexes for new tables ───
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_medicine_batches_product ON MedicineBatches(product_id);
          CREATE INDEX IF NOT EXISTS idx_medicine_batches_expiry ON MedicineBatches(expiry_date);
          CREATE INDEX IF NOT EXISTS idx_medicine_batches_batch ON MedicineBatches(batch_number);
          CREATE INDEX IF NOT EXISTS idx_product_variants_product ON ProductVariants(product_id);
          CREATE INDEX IF NOT EXISTS idx_serial_numbers_product ON SerialNumbers(product_id);
          CREATE INDEX IF NOT EXISTS idx_serial_numbers_serial ON SerialNumbers(serial_number);
          CREATE INDEX IF NOT EXISTS idx_serial_numbers_status ON SerialNumbers(status);
          CREATE INDEX IF NOT EXISTS idx_property_listings_code ON PropertyListings(property_code);
          CREATE INDEX IF NOT EXISTS idx_property_listings_type ON PropertyListings(property_type);
          CREATE INDEX IF NOT EXISTS idx_property_listings_status ON PropertyListings(status);
          CREATE INDEX IF NOT EXISTS idx_property_listings_city ON PropertyListings(city);
          CREATE INDEX IF NOT EXISTS idx_products_sku ON Products(sku);
          CREATE INDEX IF NOT EXISTS idx_products_barcode ON Products(barcode);
          CREATE INDEX IF NOT EXISTS idx_products_generic ON Products(generic_name);
        `);

        this.db.pragma('user_version = 12');
        console.log('Migration 12 completed — Sprint 4 industry-specific inventory schema added');
      }

      // Migration 13: Sprint 5 transaction void + Sprint 6 RBAC
      if (currentVersion < 13) {
        console.log('Running migration 13: Transaction status + RBAC columns...');

        const columnExists = (table, column) => {
          const cols = this.db.pragma(`table_info(${table})`);
          return cols.some(c => c.name === column);
        };

        // Add status column to Transactions for void support
        if (!columnExists('Transactions', 'status')) {
          this.db.exec(`ALTER TABLE Transactions ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE'`);
        }
        if (!columnExists('Transactions', 'voided_by')) {
          this.db.exec(`ALTER TABLE Transactions ADD COLUMN voided_by INTEGER`);
        }
        if (!columnExists('Transactions', 'voided_at')) {
          this.db.exec(`ALTER TABLE Transactions ADD COLUMN voided_at DATETIME`);
        }
        if (!columnExists('Transactions', 'void_reason')) {
          this.db.exec(`ALTER TABLE Transactions ADD COLUMN void_reason TEXT`);
        }

        // RBAC: Ensure Users table has proper role support
        if (!columnExists('Users', 'email')) {
          this.db.exec(`ALTER TABLE Users ADD COLUMN email VARCHAR(100)`);
        }
        if (!columnExists('Users', 'created_by')) {
          this.db.exec(`ALTER TABLE Users ADD COLUMN created_by INTEGER`);
        }
        if (!columnExists('Users', 'last_login')) {
          this.db.exec(`ALTER TABLE Users ADD COLUMN last_login DATETIME`);
        }

        // Create index on transaction status
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_transactions_status ON Transactions(status);
          CREATE INDEX IF NOT EXISTS idx_users_role ON Users(role);
          CREATE INDEX IF NOT EXISTS idx_users_email ON Users(email);
        `);

        this.db.pragma('user_version = 13');
        console.log('Migration 13 completed — Transaction void + RBAC columns');
      }

      // Migration 14: Commissions + Prescriptions tables
      if (currentVersion < 14) {
        console.log('Running migration 14: Commissions + Prescriptions tables...');

        // Commissions table — tracks commission earned per transaction/deal
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS Commissions (
            commission_id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER,
            deal_description TEXT,
            agent_id INTEGER,
            agent_name VARCHAR(100),
            client_id INTEGER,
            client_name VARCHAR(100),
            deal_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            commission_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            status VARCHAR(20) DEFAULT 'PENDING',
            payment_date DATETIME,
            payment_method VARCHAR(30),
            payment_reference VARCHAR(100),
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES Dealers(dealer_id),
            FOREIGN KEY (client_id) REFERENCES Farmers(farmer_id),
            FOREIGN KEY (created_by) REFERENCES Users(user_id)
          );
        `);

        // Prescriptions table — tracks prescriptions for Medical industry
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS Prescriptions (
            prescription_id INTEGER PRIMARY KEY AUTOINCREMENT,
            prescription_number VARCHAR(50) UNIQUE,
            patient_id INTEGER,
            patient_name VARCHAR(100),
            doctor_name VARCHAR(100),
            doctor_reg_number VARCHAR(50),
            prescription_date DATE NOT NULL,
            diagnosis TEXT,
            status VARCHAR(20) DEFAULT 'PENDING',
            dispensed_by INTEGER,
            dispensed_at DATETIME,
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES Farmers(farmer_id),
            FOREIGN KEY (dispensed_by) REFERENCES Users(user_id),
            FOREIGN KEY (created_by) REFERENCES Users(user_id)
          );
        `);

        // Prescription Items — individual medicines in a prescription
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS PrescriptionItems (
            item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            prescription_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name VARCHAR(100),
            dosage VARCHAR(100),
            frequency VARCHAR(100),
            duration VARCHAR(50),
            quantity_prescribed INTEGER NOT NULL DEFAULT 0,
            quantity_dispensed INTEGER DEFAULT 0,
            batch_id INTEGER,
            status VARCHAR(20) DEFAULT 'PENDING',
            dispensed_by INTEGER,
            dispensed_at DATETIME,
            notes TEXT,
            FOREIGN KEY (prescription_id) REFERENCES Prescriptions(prescription_id),
            FOREIGN KEY (product_id) REFERENCES Products(product_id),
            FOREIGN KEY (batch_id) REFERENCES MedicineBatches(batch_id),
            FOREIGN KEY (dispensed_by) REFERENCES Users(user_id)
          );
        `);

        // Indexes
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_commissions_agent ON Commissions(agent_id);
          CREATE INDEX IF NOT EXISTS idx_commissions_status ON Commissions(status);
          CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON Prescriptions(patient_id);
          CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON Prescriptions(status);
          CREATE INDEX IF NOT EXISTS idx_prescription_items_rx ON PrescriptionItems(prescription_id);
        `);

        this.db.pragma('user_version = 14');
        console.log('Migration 14 completed — Commissions + Prescriptions tables');
      }

      // Migration 15: ControlledSubstanceRegister + Real Estate deal tables
      if (currentVersion < 15) {
        console.log('Running migration 15: ControlledSubstance + RE deal tables...');

        // Controlled Substance Register — SRS Medical compliance
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS ControlledSubstanceRegister (
            register_id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id INTEGER NOT NULL,
            batch_id INTEGER,
            transaction_type VARCHAR(10) NOT NULL CHECK(transaction_type IN ('IN', 'OUT')),
            quantity DECIMAL(10,2) NOT NULL,
            patient_id INTEGER,
            patient_name VARCHAR(100),
            prescription_id INTEGER,
            performed_by INTEGER NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (medicine_id) REFERENCES Products(product_id),
            FOREIGN KEY (batch_id) REFERENCES MedicineBatches(batch_id),
            FOREIGN KEY (patient_id) REFERENCES Farmers(farmer_id),
            FOREIGN KEY (prescription_id) REFERENCES Prescriptions(prescription_id),
            FOREIGN KEY (performed_by) REFERENCES Users(user_id)
          );
        `);

        // Real Estate Clients
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS RealEstateClients (
            client_id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_code VARCHAR(50) UNIQUE,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20),
            email VARCHAR(100),
            cnic VARCHAR(20),
            address TEXT,
            client_type VARCHAR(20) DEFAULT 'BUYER',
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Real Estate Deals
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS RealEstateDeals (
            deal_id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_number VARCHAR(50) UNIQUE,
            property_id INTEGER,
            buyer_id INTEGER,
            seller_id INTEGER,
            agent_id INTEGER,
            deal_type VARCHAR(30) DEFAULT 'SALE',
            deal_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            commission_rate DECIMAL(5,2) DEFAULT 0,
            commission_amount DECIMAL(15,2) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'PENDING',
            deal_date DATE,
            closing_date DATE,
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES PropertyListings(property_id),
            FOREIGN KEY (buyer_id) REFERENCES RealEstateClients(client_id),
            FOREIGN KEY (seller_id) REFERENCES RealEstateClients(client_id),
            FOREIGN KEY (agent_id) REFERENCES Dealers(dealer_id),
            FOREIGN KEY (created_by) REFERENCES Users(user_id)
          );
        `);

        // Deal Payments
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS DealPayments (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            payment_number VARCHAR(50),
            amount DECIMAL(15,2) NOT NULL,
            payment_method VARCHAR(30) DEFAULT 'CASH',
            payment_date DATE NOT NULL,
            reference_number VARCHAR(100),
            is_installment INTEGER DEFAULT 0,
            installment_number INTEGER,
            notes TEXT,
            received_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (deal_id) REFERENCES RealEstateDeals(deal_id),
            FOREIGN KEY (received_by) REFERENCES Users(user_id)
          );
        `);

        // Property Viewings
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS PropertyViewings (
            viewing_id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_id INTEGER NOT NULL,
            client_id INTEGER,
            client_name VARCHAR(100),
            viewing_date DATETIME NOT NULL,
            agent_id INTEGER,
            feedback TEXT,
            interest_level VARCHAR(20) DEFAULT 'MEDIUM',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES PropertyListings(property_id),
            FOREIGN KEY (client_id) REFERENCES RealEstateClients(client_id),
            FOREIGN KEY (agent_id) REFERENCES Dealers(dealer_id)
          );
        `);

        // Commission Payments tracking
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS CommissionPayments (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            commission_id INTEGER NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            payment_method VARCHAR(30) DEFAULT 'CASH',
            payment_date DATE NOT NULL,
            reference_number VARCHAR(100),
            notes TEXT,
            paid_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (commission_id) REFERENCES Commissions(commission_id),
            FOREIGN KEY (paid_by) REFERENCES Users(user_id)
          );
        `);

        // Indexes
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_csr_medicine ON ControlledSubstanceRegister(medicine_id);
          CREATE INDEX IF NOT EXISTS idx_csr_patient ON ControlledSubstanceRegister(patient_id);
          CREATE INDEX IF NOT EXISTS idx_csr_date ON ControlledSubstanceRegister(created_at);
          CREATE INDEX IF NOT EXISTS idx_re_clients_code ON RealEstateClients(client_code);
          CREATE INDEX IF NOT EXISTS idx_re_deals_number ON RealEstateDeals(deal_number);
          CREATE INDEX IF NOT EXISTS idx_re_deals_property ON RealEstateDeals(property_id);
          CREATE INDEX IF NOT EXISTS idx_re_deals_status ON RealEstateDeals(status);
          CREATE INDEX IF NOT EXISTS idx_deal_payments_deal ON DealPayments(deal_id);
          CREATE INDEX IF NOT EXISTS idx_viewings_property ON PropertyViewings(property_id);
          CREATE INDEX IF NOT EXISTS idx_commission_payments ON CommissionPayments(commission_id);
        `);

        this.db.pragma('user_version = 15');
        console.log('Migration 15 completed — ControlledSubstance + RE deal tables');
      }

      // ──────────────────────────────────────────────────────────────────
      // Migration 16: Industry Data Isolation
      // Adds industry_type column to Transactions and LedgerEntries
      // so each industry's financial data is isolated and filterable.
      // ──────────────────────────────────────────────────────────────────
      if (currentVersion < 16) {
        console.log('Running migration 16: Industry data isolation columns...');

        // Add industry_type to Transactions
        const txnCols = this.db.prepare("PRAGMA table_info('Transactions')").all();
        if (!txnCols.find(c => c.name === 'industry_type')) {
          this.db.exec("ALTER TABLE Transactions ADD COLUMN industry_type VARCHAR(30) DEFAULT 'AGRICULTURAL'");
        }

        // Add industry_type to LedgerEntries
        const ledgerCols = this.db.prepare("PRAGMA table_info('LedgerEntries')").all();
        if (!ledgerCols.find(c => c.name === 'industry_type')) {
          this.db.exec("ALTER TABLE LedgerEntries ADD COLUMN industry_type VARCHAR(30) DEFAULT 'AGRICULTURAL'");
        }

        // Index for fast filtering
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_transactions_industry ON Transactions(industry_type);
          CREATE INDEX IF NOT EXISTS idx_ledger_industry ON LedgerEntries(industry_type);
        `);

        this.db.pragma('user_version = 16');
        console.log('Migration 16 completed — Industry data isolation columns');
      }

      // ──────────────────────────────────────────────────────────────────
      // Migration 17: Professional Return System
      // Adds parent_transaction_id to Transactions to link returns
      // Adds returned_quantity to TransactionItems to track partial returns
      // ──────────────────────────────────────────────────────────────────
      if (currentVersion < 17) {
        console.log('Running migration 17: Professional Return System columns...');

        // Add parent_transaction_id to Transactions
        const txnCols = this.db.prepare("PRAGMA table_info('Transactions')").all();
        if (!txnCols.find(c => c.name === 'parent_transaction_id')) {
          this.db.exec("ALTER TABLE Transactions ADD COLUMN parent_transaction_id INTEGER REFERENCES Transactions(transaction_id)");
        }

        // Add returned_quantity to TransactionItems
        const itemCols = this.db.prepare("PRAGMA table_info('TransactionItems')").all();
        if (!itemCols.find(c => c.name === 'returned_quantity')) {
          this.db.exec("ALTER TABLE TransactionItems ADD COLUMN returned_quantity DECIMAL(15,3) DEFAULT 0");
        }

        // Add industry_type to LedgerEntries for better filtering/isolation
        const ledgerCols = this.db.prepare("PRAGMA table_info('LedgerEntries')").all();
        if (!ledgerCols.find(c => c.name === 'industry_type')) {
          this.db.exec("ALTER TABLE LedgerEntries ADD COLUMN industry_type VARCHAR(20)");
        }

        // Index for linked transactions
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_transactions_parent ON Transactions(parent_transaction_id);
        `);

        this.db.pragma('user_version = 17');
        console.log('Migration 17 completed — Professional Return System columns');
      }

      // ──────────────────────────────────────────────────────────────────
      // Migration 18: Unified Enterprise Ledger System
      // Unifies 'credit' and 'balance' into a single 'account_balance'
      // Positive = Entity owes Shop (Receivable)
      // Negative = Shop owes Entity (Payable/Advance)
      // ──────────────────────────────────────────────────────────────────
      if (currentVersion < 18) {
        console.log('Running migration 18: Unified Enterprise Ledger System...');

        const tables = ['Farmers', 'Dealers', 'Companies'];
        
        for (const table of tables) {
          const cols = this.db.prepare(`PRAGMA table_info('${table}')`).all();
          if (!cols.find(c => c.name === 'account_balance')) {
            this.db.exec(`ALTER TABLE ${table} ADD COLUMN account_balance DECIMAL(15,2) DEFAULT 0.00`);
            
            // Populate account_balance from existing data: credit (they owe us) - balance (we owe them)
            // Note: Different tables have different ID column names
            const idCol = table === 'Farmers' ? 'farmer_id' : (table === 'Dealers' ? 'dealer_id' : 'company_id');
            this.db.exec(`UPDATE ${table} SET account_balance = COALESCE(credit, 0) - COALESCE(balance, 0)`);
          }
        }

        this.db.pragma('user_version = 18');
        console.log('Migration 18 completed — Unified Enterprise Ledger System');
      }

      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      console.error('Error details:', error.message);
      // Don't throw - allow app to continue with existing schema
    }
  }

  /**
   * Initialize default admin user if database is empty
   * v2.0: No longer auto-creates — first-run setup screen handles user creation.
   * Kept as a safety fallback only if called explicitly.
   */
  async initializeDefaultAdmin() {
    // v2.0: First-run setup screen prompts user for their own credentials.
    // This method is kept as a no-op for backward compatibility.
    // The FirstRunSetupPage will call auth:createFirstUser instead.
    try {
      const users = await this.query('SELECT COUNT(*) as count FROM Users');
      console.log(`[v2.0] Users in database: ${users[0].count}. First-run setup screen will handle user creation.`);
    } catch (error) {
      console.error('initializeDefaultAdmin check error:', error);
    }
  }

  /**
   * Create all necessary tables
   */
  createTables() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME DEFAULT NULL,
        password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username)
      );
    `);

    // System License table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS SystemLicense (
        license_id INTEGER PRIMARY KEY AUTOINCREMENT,
        hardware_fingerprint VARCHAR(255) UNIQUE NOT NULL,
        license_key TEXT NOT NULL,
        shop_name VARCHAR(100),
        shop_owner_name VARCHAR(100),
        activation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiry_date DATETIME,
        is_active BOOLEAN DEFAULT 1,
        last_validated DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // History table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS History (
        history_id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type VARCHAR(50) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        performed_by INTEGER,
        performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        FOREIGN KEY (performed_by) REFERENCES Users(user_id)
      );
    `);

    // Password history table for tracking password changes (SRS FR-1.2)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS PasswordHistory (
        history_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
      );
    `);

    // Farmers table (Sprint 2 - FR-3.1)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Farmers (
        farmer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        specific_id VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100),
        cnic VARCHAR(15) UNIQUE NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        balance DECIMAL(12,2) DEFAULT 0.00,
        credit DECIMAL(12,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // Dealers table (Sprint 3 - FR-3.2)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Dealers (
        dealer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        specific_id VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        contact_person VARCHAR(100),
        cnic VARCHAR(15) UNIQUE NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        balance DECIMAL(12,2) DEFAULT 0.00,
        credit DECIMAL(12,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // Companies table (Sprint 3 - FR-3.3)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Companies (
        company_id INTEGER PRIMARY KEY AUTOINCREMENT,
        specific_id VARCHAR(20) UNIQUE NOT NULL,
        company_name VARCHAR(100) NOT NULL,
        contact_person VARCHAR(100),
        address TEXT,
        phone VARCHAR(20),
        certifications TEXT,
        balance DECIMAL(12,2) DEFAULT 0.00,
        credit DECIMAL(12,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // ProductCategories table (Sprint 4 - FR-4.1)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ProductCategories (
        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_code VARCHAR(20) UNIQUE NOT NULL,
        category_name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // Products table (Sprint 4 - FR-4.1)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_code VARCHAR(20) UNIQUE NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        category_id INTEGER NOT NULL,
        unit_of_measure VARCHAR(20) NOT NULL,
        description TEXT,
        reorder_level DECIMAL(15,3) DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES ProductCategories(category_id),
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // GrainTypes table (Sprint 4 - FR-4.2)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS GrainTypes (
        grain_id INTEGER PRIMARY KEY AUTOINCREMENT,
        grain_code VARCHAR(20) UNIQUE NOT NULL,
        grain_name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        unit_of_measure VARCHAR(20) DEFAULT 'kg',
        reorder_level DECIMAL(15,3) DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // Stock table (Sprint 4 - FR-4.3)
    // Multiple entries per product allowed for different price batches
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Stock (
        stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('PRODUCT', 'GRAIN')),
        item_id INTEGER NOT NULL,
        quantity DECIMAL(15,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        batch_reference VARCHAR(100),
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // StockMovements table (Sprint 4 - FR-4.3)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS StockMovements (
        movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER NOT NULL,
        movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
        movement_reason VARCHAR(50),
        quantity DECIMAL(15,3) NOT NULL,
        unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        reference_type VARCHAR(20),
        reference_id INTEGER,
        previous_quantity DECIMAL(15,3),
        new_quantity DECIMAL(15,3),
        movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_by INTEGER,
        FOREIGN KEY (stock_id) REFERENCES Stock(stock_id),
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // LedgerEntries table (Sprint 2 - Basic structure)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS LedgerEntries (
        entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type VARCHAR(20) NOT NULL,
        entity_id INTEGER NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        transaction_id INTEGER,
        debit DECIMAL(12,2) DEFAULT 0.00,
        credit DECIMAL(12,2) DEFAULT 0.00,
        balance DECIMAL(12,2) DEFAULT 0.00,
        description TEXT,
        entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // Transactions table (Sprint 5 - FR-5.1)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Transactions (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number VARCHAR(20) UNIQUE NOT NULL,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        transaction_type VARCHAR(30) NOT NULL,
        
        entity_type VARCHAR(20) NOT NULL,
        entity_id INTEGER,
        entity_table VARCHAR(50),
        entity_name VARCHAR(255),
        temp_customer_name VARCHAR(100),
        temp_customer_father_name VARCHAR(100),
        temp_customer_cnic VARCHAR(15),
        temp_customer_phone VARCHAR(15),
        temp_customer_address TEXT,
        
        item_type VARCHAR(20) NOT NULL,
        item_id INTEGER NOT NULL,
        quantity DECIMAL(15,3) NOT NULL,
        unit_price DECIMAL(15,2) NOT NULL,
        total_amount DECIMAL(15,2) NOT NULL,
        
        overall_discount_type VARCHAR(20) DEFAULT 'amount',
        overall_discount_value DECIMAL(15,2) DEFAULT 0.00,
        overall_discount_amount DECIMAL(15,2) DEFAULT 0.00,
        
        payment_type VARCHAR(20) NOT NULL,
        cash_paid DECIMAL(15,2) DEFAULT 0.00,
        credit_amount DECIMAL(15,2) DEFAULT 0.00,
        
        description TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (created_by) REFERENCES Users(user_id),
        CHECK (entity_type IN ('regular', 'irregular')),
        CHECK (item_type IN ('product', 'grain')),
        CHECK (payment_type IN ('CASH', 'CREDIT', 'PARTIAL')),
        CHECK (quantity > 0),
        CHECK (unit_price >= 0),
        CHECK (total_amount >= 0),
        CHECK (overall_discount_type IN ('percentage', 'amount'))
      );
    `);

    // DailyTransactionsSummary table (Sprint 5 - FR-5.2)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS DailyTransactionsSummary (
        summary_id INTEGER PRIMARY KEY AUTOINCREMENT,
        summary_date DATE UNIQUE NOT NULL,
        total_transactions INTEGER DEFAULT 0,
        total_sales DECIMAL(15,2) DEFAULT 0.00,
        total_purchases DECIMAL(15,2) DEFAULT 0.00,
        cash_received DECIMAL(15,2) DEFAULT 0.00,
        cash_paid DECIMAL(15,2) DEFAULT 0.00,
        credit_given DECIMAL(15,2) DEFAULT 0.00,
        credit_received DECIMAL(15,2) DEFAULT 0.00,
        net_cash_flow DECIMAL(15,2) DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // TransactionItems table (Sprint 6 - Multi-Item Transaction Support)
    // Stores individual line items for each transaction
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS TransactionItems (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        line_number INTEGER NOT NULL,
        
        item_type VARCHAR(20) NOT NULL,
        item_reference_id INTEGER NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        item_code VARCHAR(50),
        
        quantity DECIMAL(15,3) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        unit_price DECIMAL(15,2) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        
        discount_percent DECIMAL(5,2) DEFAULT 0,
        discount_amount DECIMAL(15,2) DEFAULT 0,
        line_final_total DECIMAL(15,2) NOT NULL,
        
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (transaction_id) REFERENCES Transactions(transaction_id) ON DELETE CASCADE,
        CHECK (item_type IN ('product', 'grain')),
        CHECK (quantity > 0),
        CHECK (unit_price >= 0),
        CHECK (line_total >= 0),
        CHECK (line_final_total >= 0),
        UNIQUE (transaction_id, line_number)
      );
    `);

    // Backups table (Sprint 8 - Data Protection FR-8.1)
    // Stores backup history and metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Backups (
        backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_name VARCHAR(100) NOT NULL,
        backup_path TEXT NOT NULL,
        backup_size_mb DECIMAL(10, 2),
        backup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        notes TEXT,
        FOREIGN KEY (created_by) REFERENCES Users(user_id)
      );
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username);
      CREATE INDEX IF NOT EXISTS idx_license_fingerprint ON SystemLicense(hardware_fingerprint);
      CREATE INDEX IF NOT EXISTS idx_history_table ON History(table_name, record_id);
      CREATE INDEX IF NOT EXISTS idx_history_date ON History(performed_at);
      CREATE INDEX IF NOT EXISTS idx_password_history_user ON PasswordHistory(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_farmers_specific_id ON Farmers(specific_id);
      CREATE INDEX IF NOT EXISTS idx_farmers_cnic ON Farmers(cnic);
      CREATE INDEX IF NOT EXISTS idx_farmers_name ON Farmers(name);
      CREATE INDEX IF NOT EXISTS idx_dealers_specific_id ON Dealers(specific_id);
      CREATE INDEX IF NOT EXISTS idx_dealers_cnic ON Dealers(cnic);
      CREATE INDEX IF NOT EXISTS idx_dealers_name ON Dealers(name);
      CREATE INDEX IF NOT EXISTS idx_companies_specific_id ON Companies(specific_id);
      CREATE INDEX IF NOT EXISTS idx_companies_name ON Companies(company_name);
      CREATE INDEX IF NOT EXISTS idx_categories_code ON ProductCategories(category_code);
      CREATE INDEX IF NOT EXISTS idx_categories_name ON ProductCategories(category_name);
      CREATE INDEX IF NOT EXISTS idx_products_code ON Products(product_code);
      CREATE INDEX IF NOT EXISTS idx_products_name ON Products(product_name);
      CREATE INDEX IF NOT EXISTS idx_products_category ON Products(category_id);
      CREATE INDEX IF NOT EXISTS idx_grains_code ON GrainTypes(grain_code);
      CREATE INDEX IF NOT EXISTS idx_grains_name ON GrainTypes(grain_name);
      CREATE INDEX IF NOT EXISTS idx_stock_item ON Stock(item_type, item_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_stock ON StockMovements(stock_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON StockMovements(movement_date);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON StockMovements(movement_type);
      CREATE INDEX IF NOT EXISTS idx_ledger_entity ON LedgerEntries(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_date ON LedgerEntries(entry_date);
      CREATE INDEX IF NOT EXISTS idx_transactions_number ON Transactions(transaction_number);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON Transactions(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_transactions_entity ON Transactions(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON Transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_transactions_item ON Transactions(item_type, item_id);
      CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON DailyTransactionsSummary(summary_date);
      CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON TransactionItems(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_transaction_items_item ON TransactionItems(item_type, item_reference_id);
      CREATE INDEX IF NOT EXISTS idx_backups_date ON Backups(backup_date);
    `);

    console.log('Database tables created successfully');
  }

  /**
   * Migrate existing single-item transactions to TransactionItems table
   * Sprint 6 - Backward compatibility migration
   */
  async migrateExistingTransactions() {
    try {
      console.log('[DatabaseService] Starting transaction migration...');
      
      // Check if migration already done
      const migrationCheck = await this.query(
        `SELECT COUNT(*) as count FROM TransactionItems`
      );
      
      if (migrationCheck[0].count > 0) {
        console.log('[DatabaseService] TransactionItems already has data, skipping migration');
        return { success: true, message: 'Migration already completed', migrated: 0 };
      }

      // Get all transactions with item data
      const transactions = await this.query(
        `SELECT transaction_id, item_type, item_id, quantity, unit_price, total_amount 
         FROM Transactions 
         WHERE item_id IS NOT NULL`
      );

      if (transactions.length === 0) {
        console.log('[DatabaseService] No transactions to migrate');
        return { success: true, message: 'No transactions to migrate', migrated: 0 };
      }

      console.log(`[DatabaseService] Migrating ${transactions.length} transactions...`);

      this.db.exec('BEGIN TRANSACTION');

      let migrated = 0;
      for (const txn of transactions) {
        // Get item name
        let itemName = 'Unknown Item';
        let itemCode = null;
        let unit = 'unit';

        if (txn.item_type === 'product') {
          const product = await this.query(
            'SELECT product_name, product_code, unit_of_measure FROM Products WHERE product_id = ?',
            [txn.item_id]
          );
          if (product.length > 0) {
            itemName = product[0].product_name;
            itemCode = product[0].product_code;
            unit = product[0].unit_of_measure || 'unit';
          }
        } else if (txn.item_type === 'grain') {
          const grain = await this.query(
            'SELECT grain_name, grain_code, unit_of_measure FROM GrainTypes WHERE grain_id = ?',
            [txn.item_id]
          );
          if (grain.length > 0) {
            itemName = grain[0].grain_name;
            itemCode = grain[0].grain_code;
            unit = grain[0].unit_of_measure || 'kg';
          }
        }

        // Insert into TransactionItems
        await this.execute(
          `INSERT INTO TransactionItems (
            transaction_id, line_number, item_type, item_reference_id,
            item_name, item_code, quantity, unit, unit_price,
            line_total, line_final_total
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            txn.transaction_id,
            txn.item_type,
            txn.item_id,
            itemName,
            itemCode,
            txn.quantity,
            unit,
            txn.unit_price,
            txn.total_amount,
            txn.total_amount
          ]
        );

        migrated++;
      }

      this.db.exec('COMMIT');

      console.log(`[DatabaseService] ✅ Successfully migrated ${migrated} transactions to TransactionItems`);
      
      return {
        success: true,
        message: `Migrated ${migrated} transactions successfully`,
        migrated: migrated
      };

    } catch (error) {
      this.db.exec('ROLLBACK');
      console.error('[DatabaseService] Migration failed:', error);
      throw error;
    }
  }

  /**
   * Execute a SELECT query
   */
  async query(sql, params) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      return params ? stmt.all(...params) : stmt.all();
    } catch (error) {
      console.error('Query error:', error, 'SQL:', sql);
      throw error;
    }
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE command
   */
  async execute(sql, params) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      const info = params ? stmt.run(...params) : stmt.run();
      return {
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid,
      };
    } catch (error) {
      console.error('Execute error:', error, 'SQL:', sql);
      throw error;
    }
  }

  /**
   * Begin transaction
   */
  beginTransaction() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    this.db.exec('BEGIN TRANSACTION');
  }

  /**
   * Commit transaction
   */
  commit() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    this.db.exec('COMMIT');
  }

  /**
   * Rollback transaction
   */
  rollback() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    this.db.exec('ROLLBACK');
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database instance
   */
  getDB() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Create a history entry for tracking changes
   */
  async createHistoryEntry(tableName, recordId, actionType, oldValues, newValues, userId) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO History (
          action_type, table_name, record_id, 
          old_values, new_values, performed_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        actionType,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        userId
      );

      return { success: true };
    } catch (error) {
      console.error('Error creating history entry:', error);
      // Don't throw - history is optional, main operation should succeed
      return { success: false, error: error.message };
    }
  }

  /**
   * CLEANUP ALL USER DATA
   * =====================
   * Removes all user-entered data while preserving:
   * - Database schema and structure
   * - Default admin user (password reset to Admin@123)
   * - System license information
   * 
   * This is useful for:
   * - Clearing test data before production deployment
   * - Resetting the application to clean state
   * 
   * @returns {Object} Result with success status and details
   */
  async cleanupAllUserData() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           DATABASE CLEANUP - REMOVING ALL USER DATA            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const results = {
      success: true,
      tablesCleared: [],
      errors: [],
      adminReset: false
    };

    try {
      // Disable foreign key constraints temporarily
      this.db.pragma('foreign_keys = OFF');
      
      // Begin transaction
      this.db.exec('BEGIN TRANSACTION');

      // Tables to clear in order (respecting dependencies)
      const tablesToClear = [
        'TransactionItems',
        'Transactions',
        'LedgerEntries',
        'StockMovements',
        'Stock',
        'DailyTransactionsSummary',
        'Farmers',
        'Dealers',
        'Companies',
        'Products',
        'ProductCategories',
        'GrainTypes',
        'History',
        'Backups',
        'PasswordHistory'
      ];

      // Clear each table
      for (const table of tablesToClear) {
        try {
          const countBefore = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get()?.count || 0;
          this.db.exec(`DELETE FROM ${table}`);
          console.log(`  ✅ Cleared ${table} (${countBefore} records)`);
          results.tablesCleared.push({ table, recordsDeleted: countBefore });
        } catch (error) {
          console.error(`  ❌ Error clearing ${table}:`, error.message);
          results.errors.push({ table, error: error.message });
        }
      }

      // Reset Users table - keep admin but reset password
      try {
        const userCount = this.db.prepare('SELECT COUNT(*) as count FROM Users').get()?.count || 0;
        this.db.exec('DELETE FROM Users');
        
        // Recreate default admin user
        const bcrypt = await import('bcrypt');
        const defaultPassword = await bcrypt.default.hash('Admin@123', 10);
        this.db.prepare(`
          INSERT INTO Users (username, password_hash, full_name, role, is_active, password_changed_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run('admin', defaultPassword, 'Administrator', 'admin', 1);
        
        console.log(`  ✅ Users reset (${userCount} records, admin recreated)`);
        results.tablesCleared.push({ table: 'Users', recordsDeleted: userCount });
        results.adminReset = true;
      } catch (error) {
        console.error('  ❌ Error resetting Users:', error.message);
        results.errors.push({ table: 'Users', error: error.message });
      }

      // Reset auto-increment counters
      try {
        this.db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${tablesToClear.map(t => `'${t}'`).join(',')},'Users')`);
        console.log('  ✅ Auto-increment counters reset');
      } catch (error) {
        // sqlite_sequence might not exist, ignore
      }

      // Commit transaction
      this.db.exec('COMMIT');
      
      // Re-enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Vacuum to reclaim space
      this.db.exec('VACUUM');
      console.log('  ✅ Database vacuumed');

      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    CLEANUP COMPLETED                           ║');
      console.log('╠════════════════════════════════════════════════════════════════╣');
      console.log('║  ✅ All user data has been removed                             ║');
      console.log('║  ✅ Admin user reset (username: admin, password: Admin@123)    ║');
      console.log('║  ✅ Database structure preserved                               ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');

      return results;

    } catch (error) {
      // Rollback on error
      try {
        this.db.exec('ROLLBACK');
      } catch (e) {
        // Ignore rollback errors
      }
      
      // Re-enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      console.error('❌ Cleanup failed:', error.message);
      results.success = false;
      results.errors.push({ table: 'GENERAL', error: error.message });
      return results;
    }
  }
}
