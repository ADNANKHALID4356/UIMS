/**
 * DATABASE CLEANUP SCRIPT
 * ========================
 * This script safely removes all user-entered test data from the database
 * while preserving the application structure, schema, and default admin user.
 * 
 * TABLES TO CLEAN (in proper order to respect foreign key constraints):
 * 
 * 1. TransactionItems - Line items for transactions
 * 2. Transactions - All transaction records
 * 3. LedgerEntries - All ledger entries
 * 4. StockMovements - Stock movement history
 * 5. Stock - Stock records
 * 6. DailyTransactionsSummary - Daily summaries
 * 7. Farmers - All farmer records
 * 8. Dealers - All dealer records
 * 9. Companies - All company records
 * 10. Products - All product records
 * 11. ProductCategories - All category records
 * 12. GrainTypes - All grain type records
 * 13. History - Audit history (optional)
 * 14. Backups - Backup history (optional)
 * 
 * PRESERVED:
 * - Users table (keeps admin user, resets password to default)
 * - PasswordHistory (clears but keeps structure)
 * - SystemLicense (keeps license info)
 * - Database schema and structure
 * - All indexes
 * 
 * Usage:
 *   node scripts/cleanup_user_data.js
 * 
 * WARNING: This will DELETE ALL USER DATA. Make a backup first!
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path - same as DatabaseService uses
const getDbPath = () => {
  // Try common locations
  const possiblePaths = [
    path.join(process.env.APPDATA || '', 'agricultural-inventory-system', 'data', 'inventory.db'),
    path.join(process.env.LOCALAPPDATA || '', 'agricultural-inventory-system', 'data', 'inventory.db'),
    path.join(__dirname, '..', 'data', 'inventory.db'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  // Default Electron path
  return path.join(process.env.APPDATA || process.env.HOME || '', 'agricultural-inventory-system', 'data', 'inventory.db');
};

async function cleanupDatabase() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     AGRICULTURAL INVENTORY SYSTEM - DATABASE CLEANUP           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const dbPath = getDbPath();
  console.log(`Database path: ${dbPath}`);
  
  if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found!');
    console.log('   Please run the application once to create the database.');
    process.exit(1);
  }
  
  // Create backup before cleanup
  const backupPath = dbPath.replace('.db', `_backup_${Date.now()}.db`);
  console.log(`\n📦 Creating backup at: ${backupPath}`);
  fs.copyFileSync(dbPath, backupPath);
  console.log('✅ Backup created successfully');
  
  // Connect to database
  const db = new Database(dbPath);
  db.pragma('foreign_keys = OFF'); // Temporarily disable for cleanup
  
  try {
    console.log('\n📊 Analyzing current data...\n');
    
    // Get counts before cleanup
    const counts = {
      TransactionItems: db.prepare('SELECT COUNT(*) as count FROM TransactionItems').get()?.count || 0,
      Transactions: db.prepare('SELECT COUNT(*) as count FROM Transactions').get()?.count || 0,
      LedgerEntries: db.prepare('SELECT COUNT(*) as count FROM LedgerEntries').get()?.count || 0,
      StockMovements: db.prepare('SELECT COUNT(*) as count FROM StockMovements').get()?.count || 0,
      Stock: db.prepare('SELECT COUNT(*) as count FROM Stock').get()?.count || 0,
      DailyTransactionsSummary: db.prepare('SELECT COUNT(*) as count FROM DailyTransactionsSummary').get()?.count || 0,
      Farmers: db.prepare('SELECT COUNT(*) as count FROM Farmers').get()?.count || 0,
      Dealers: db.prepare('SELECT COUNT(*) as count FROM Dealers').get()?.count || 0,
      Companies: db.prepare('SELECT COUNT(*) as count FROM Companies').get()?.count || 0,
      Products: db.prepare('SELECT COUNT(*) as count FROM Products').get()?.count || 0,
      ProductCategories: db.prepare('SELECT COUNT(*) as count FROM ProductCategories').get()?.count || 0,
      GrainTypes: db.prepare('SELECT COUNT(*) as count FROM GrainTypes').get()?.count || 0,
      History: db.prepare('SELECT COUNT(*) as count FROM History').get()?.count || 0,
      Users: db.prepare('SELECT COUNT(*) as count FROM Users').get()?.count || 0,
    };
    
    console.log('Current data in database:');
    console.log('─────────────────────────────────────');
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table.padEnd(25)} : ${count} records`);
    }
    console.log('─────────────────────────────────────');
    
    console.log('\n🧹 Starting cleanup process...\n');
    
    // Begin transaction for atomic cleanup
    db.exec('BEGIN TRANSACTION');
    
    try {
      // 1. Clear TransactionItems
      console.log('  Clearing TransactionItems...');
      db.exec('DELETE FROM TransactionItems');
      console.log('  ✅ TransactionItems cleared');
      
      // 2. Clear Transactions
      console.log('  Clearing Transactions...');
      db.exec('DELETE FROM Transactions');
      console.log('  ✅ Transactions cleared');
      
      // 3. Clear LedgerEntries
      console.log('  Clearing LedgerEntries...');
      db.exec('DELETE FROM LedgerEntries');
      console.log('  ✅ LedgerEntries cleared');
      
      // 4. Clear StockMovements
      console.log('  Clearing StockMovements...');
      db.exec('DELETE FROM StockMovements');
      console.log('  ✅ StockMovements cleared');
      
      // 5. Clear Stock
      console.log('  Clearing Stock...');
      db.exec('DELETE FROM Stock');
      console.log('  ✅ Stock cleared');
      
      // 6. Clear DailyTransactionsSummary
      console.log('  Clearing DailyTransactionsSummary...');
      db.exec('DELETE FROM DailyTransactionsSummary');
      console.log('  ✅ DailyTransactionsSummary cleared');
      
      // 7. Clear Farmers
      console.log('  Clearing Farmers...');
      db.exec('DELETE FROM Farmers');
      console.log('  ✅ Farmers cleared');
      
      // 8. Clear Dealers
      console.log('  Clearing Dealers...');
      db.exec('DELETE FROM Dealers');
      console.log('  ✅ Dealers cleared');
      
      // 9. Clear Companies
      console.log('  Clearing Companies...');
      db.exec('DELETE FROM Companies');
      console.log('  ✅ Companies cleared');
      
      // 10. Clear Products
      console.log('  Clearing Products...');
      db.exec('DELETE FROM Products');
      console.log('  ✅ Products cleared');
      
      // 11. Clear ProductCategories
      console.log('  Clearing ProductCategories...');
      db.exec('DELETE FROM ProductCategories');
      console.log('  ✅ ProductCategories cleared');
      
      // 12. Clear GrainTypes
      console.log('  Clearing GrainTypes...');
      db.exec('DELETE FROM GrainTypes');
      console.log('  ✅ GrainTypes cleared');
      
      // 13. Clear History
      console.log('  Clearing History...');
      db.exec('DELETE FROM History');
      console.log('  ✅ History cleared');
      
      // 14. Clear Backups (metadata only, not actual backup files)
      console.log('  Clearing Backups metadata...');
      db.exec('DELETE FROM Backups');
      console.log('  ✅ Backups metadata cleared');
      
      // 15. Clear PasswordHistory
      console.log('  Clearing PasswordHistory...');
      db.exec('DELETE FROM PasswordHistory');
      console.log('  ✅ PasswordHistory cleared');
      
      // 16. Reset Users - keep admin but reset password
      console.log('  Resetting Users table...');
      db.exec('DELETE FROM Users');
      
      // Recreate default admin user
      const defaultPassword = await bcrypt.hash('Admin@123', 10);
      db.prepare(`
        INSERT INTO Users (username, password_hash, full_name, role, is_active, password_changed_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run('admin', defaultPassword, 'Administrator', 'admin', 1);
      console.log('  ✅ Users reset (admin user recreated with default password)');
      
      // Reset auto-increment counters
      console.log('\n  Resetting auto-increment counters...');
      const tables = [
        'TransactionItems', 'Transactions', 'LedgerEntries', 'StockMovements',
        'Stock', 'DailyTransactionsSummary', 'Farmers', 'Dealers', 'Companies',
        'Products', 'ProductCategories', 'GrainTypes', 'History', 'Backups', 'PasswordHistory'
      ];
      
      for (const table of tables) {
        try {
          db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
        } catch (e) {
          // Table might not have auto-increment, ignore
        }
      }
      console.log('  ✅ Auto-increment counters reset');
      
      // Commit transaction
      db.exec('COMMIT');
      console.log('\n✅ All data cleaned successfully!');
      
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    
    // Re-enable foreign keys and run integrity check
    db.pragma('foreign_keys = ON');
    
    console.log('\n🔍 Running database integrity check...');
    const integrityResult = db.pragma('integrity_check');
    if (integrityResult[0].integrity_check === 'ok') {
      console.log('✅ Database integrity: OK');
    } else {
      console.log('⚠️  Database integrity issues found:', integrityResult);
    }
    
    // Vacuum to reclaim space
    console.log('\n📦 Vacuuming database to reclaim space...');
    db.exec('VACUUM');
    console.log('✅ Database vacuumed');
    
    // Show final state
    console.log('\n📊 Final database state:');
    console.log('─────────────────────────────────────');
    const finalCounts = {
      Users: db.prepare('SELECT COUNT(*) as count FROM Users').get()?.count || 0,
      TransactionItems: db.prepare('SELECT COUNT(*) as count FROM TransactionItems').get()?.count || 0,
      Transactions: db.prepare('SELECT COUNT(*) as count FROM Transactions').get()?.count || 0,
      LedgerEntries: db.prepare('SELECT COUNT(*) as count FROM LedgerEntries').get()?.count || 0,
      Stock: db.prepare('SELECT COUNT(*) as count FROM Stock').get()?.count || 0,
      Farmers: db.prepare('SELECT COUNT(*) as count FROM Farmers').get()?.count || 0,
      Dealers: db.prepare('SELECT COUNT(*) as count FROM Dealers').get()?.count || 0,
      Companies: db.prepare('SELECT COUNT(*) as count FROM Companies').get()?.count || 0,
    };
    
    for (const [table, count] of Object.entries(finalCounts)) {
      console.log(`  ${table.padEnd(25)} : ${count} records`);
    }
    console.log('─────────────────────────────────────');
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    CLEANUP COMPLETED                           ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log('║  ✅ All user data has been removed                             ║');
    console.log('║  ✅ Admin user reset (username: admin, password: Admin@123)    ║');
    console.log('║  ✅ Database structure preserved                               ║');
    console.log('║  📦 Backup saved at:                                           ║');
    console.log(`║     ${backupPath.substring(0, 55)}...  ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error('   Database has been rolled back to previous state.');
    console.error('   Backup is available at:', backupPath);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run cleanup
cleanupDatabase().catch(console.error);
