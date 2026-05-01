const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { app, safeStorage } = require('electron');

app.setName('enterprise-inventory-system');

app.on('ready', async () => {
  try {
    const appDataPath = app.getPath('userData');
    const dbPath = path.join(appDataPath, 'data', 'inventory.db');
    const keyFilePath = path.join(appDataPath, '.db_key');

    let encKey;
    const encryptedKey = fs.readFileSync(keyFilePath);
    if (safeStorage.isEncryptionAvailable()) {
      encKey = safeStorage.decryptString(encryptedKey);
    } else {
      encKey = encryptedKey.toString('utf8');
    }

    const db = new Database(dbPath);
    db.pragma(`key = '${encKey}'`);
    db.pragma('foreign_keys = ON');

    const passwordHash = await bcrypt.hash('Admin@123', 10);
    
    // Check if 'admin' exists
    const adminExists = db.prepare("SELECT COUNT(*) as count FROM Users WHERE username = 'admin'").get().count;
    
    if (adminExists === 0) {
      db.prepare(`
        INSERT INTO Users (username, password_hash, full_name, email, role, is_active, password_changed_at)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run('admin', passwordHash, 'System Administrator', 'admin@local.com', 'admin');
      console.log('✅ Created "admin" account.');
    } else {
      db.prepare(`
        UPDATE Users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, is_active = 1 WHERE username = 'admin'
      `).run(passwordHash);
      console.log('✅ Reset "admin" account password.');
    }

    // Just in case, let's also reset KYSED's password to Admin@123
    db.prepare(`
        UPDATE Users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, is_active = 1 WHERE username = 'KYSED'
    `).run(passwordHash);
    console.log('✅ Reset "KYSED" account password too.');

    db.close();
    console.log('DONE.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    app.quit();
  }
});
