/**
 * Password Reset Script — runs inside Electron context
 * Usage:  npx electron scripts/electron-reset-password.js
 *
 * Resets ALL users' passwords to "Admin@123" and re-activates them.
 * Run this if you are locked out of the application.
 */

const { app } = require('electron');

// Must set name BEFORE app.whenReady() so getPath('userData') resolves correctly
app.setName('enterprise-inventory-system');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// We need bcrypt — load from node_modules
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (_) {
  try { bcrypt = require('bcryptjs'); } catch (__) {
    console.error('Cannot load bcrypt. Run npm install first.');
    app.exit(1);
  }
}

// Load SQLCipher-capable SQLite
let Database;
try {
  Database = require('better-sqlite3-multiple-ciphers');
} catch (_) {
  try { Database = require('better-sqlite3'); } catch (__) {
    console.error('Cannot load better-sqlite3. Run npm install first.');
    app.exit(1);
  }
}

app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  const dbPath = path.join(userData, 'data', 'inventory.db');
  const keyFilePath = path.join(userData, '.db_key');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Enterprise Inventory System — Password Reset Tool ');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n  userData : ${userData}`);
  console.log(`  database : ${dbPath}\n`);

  if (!fs.existsSync(dbPath)) {
    console.error('  ERROR: Database not found. Start the app once first.');
    app.exit(1);
    return;
  }

  // Resolve encryption key
  let encKey = null;
  try {
    const { safeStorage } = require('electron');
    if (fs.existsSync(keyFilePath)) {
      const keyData = fs.readFileSync(keyFilePath);
      if (safeStorage.isEncryptionAvailable()) {
        encKey = safeStorage.decryptString(keyData);
        console.log('  Key source: DPAPI (safeStorage)');
      } else {
        encKey = keyData.toString('utf8');
        console.log('  Key source: plain file');
      }
    }
  } catch (e) {
    // fallback: deterministic key
    encKey = crypto.createHash('sha256').update(userData).digest('hex');
    console.log('  Key source: deterministic fallback');
  }

  // Open database
  let db;
  try {
    db = new Database(dbPath);
    if (encKey) {
      db.pragma(`key = '${encKey}'`);
    }
    // Verify key works
    db.pragma('journal_mode');
    console.log('  Database opened successfully.\n');
  } catch (e) {
    console.error('  ERROR opening database:', e.message);
    console.log('\n  Hint: Try deleting the DB to start fresh:');
    console.log(`  del "${dbPath}"`);
    app.exit(1);
    return;
  }

  try {
    // List current users
    const users = db.prepare('SELECT user_id, username, full_name, role, is_active FROM Users').all();

    if (users.length === 0) {
      console.log('  No users found in database. Start the app normally to create defaults.\n');
      db.close();
      app.exit(0);
      return;
    }

    console.log('  Current users:');
    users.forEach(u =>
      console.log(`    [${u.user_id}] ${u.username.padEnd(20)} (${u.role})  active=${u.is_active}`)
    );

    const NEW_PASSWORD = 'Admin@123';
    const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

    const stmt = db.prepare(`
      UPDATE Users
      SET password_hash = ?, is_active = 1, failed_login_attempts = 0, locked_until = NULL
      WHERE 1=1
    `);
    const result = stmt.run(hashed);

    // Clear password history so they can log in without history block
    try { db.prepare('DELETE FROM PasswordHistory').run(); } catch (_) {}

    console.log(`\n  ✅ ${result.changes} user(s) reset successfully.`);
    console.log(`\n  ┌─────────────────────────────────────────────┐`);
    console.log(`  │  ALL USERS can now log in with:             │`);
    console.log(`  │                                             │`);
    users.forEach(u => {
      const line = `  Username: ${u.username}  Password: ${NEW_PASSWORD}`;
      console.log(`  │  ${line.padEnd(43)}│`);
    });
    console.log(`  │                                             │`);
    console.log(`  │  ⚠  Change your password after logging in. │`);
    console.log(`  └─────────────────────────────────────────────┘\n`);

    db.close();
  } catch (e) {
    console.error('  ERROR during reset:', e.message);
    try { db.close(); } catch (_) {}
    app.exit(1);
    return;
  }

  app.exit(0);
});
