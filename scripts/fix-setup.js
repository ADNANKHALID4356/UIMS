/**
 * fix-setup.js
 * Run with: electron scripts/fix-setup.js
 * 
 * Fixes:
 *  1. Activates the software license (no internet needed)
 *  2. Creates the admin user (admin / Admin@123)
 */

const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// CRITICAL: Set the correct app name so we edit the real database!
app.setName('enterprise-inventory-system');

app.on('ready', async () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       Enterprise Inventory Fix Setup     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    const appDataPath = app.getPath('userData');
    const dataPath = path.join(appDataPath, 'data');
    const dbPath = path.join(dataPath, 'inventory.db');
    const keyFilePath = path.join(appDataPath, '.db_key');
    const licensePath = path.join(appDataPath, 'license.encrypted');

    console.log('[INFO] App data path:', appDataPath);
    console.log('[INFO] Database path:', dbPath);

    // Ensure data directory exists
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
      console.log('[INFO] Created data directory');
    }

    // ── Step 1: Get or create encryption key ──────────────────────────────
    let encKey;
    if (fs.existsSync(keyFilePath)) {
      const encryptedKey = fs.readFileSync(keyFilePath);
      if (safeStorage.isEncryptionAvailable()) {
        encKey = safeStorage.decryptString(encryptedKey);
        console.log('[INFO] Read existing encryption key from safeStorage');
      } else {
        encKey = encryptedKey.toString('utf8');
        console.log('[INFO] Read existing encryption key (plaintext fallback)');
      }
    } else {
      encKey = crypto.randomBytes(32).toString('hex');
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(encKey);
        fs.writeFileSync(keyFilePath, encrypted);
      } else {
        fs.writeFileSync(keyFilePath, encKey, 'utf8');
      }
      console.log('[INFO] Generated new encryption key');
    }

    // ── Step 2: Open (or create) the database ─────────────────────────────
    const Database = require('better-sqlite3-multiple-ciphers');
    const bcrypt = require('bcrypt');

    const isPlainSqlite = (filePath) => {
      try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(16);
        fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        return buf.toString('utf8', 0, 15) === 'SQLite format 3';
      } catch { return false; }
    };

    let db;
    if (fs.existsSync(dbPath)) {
      if (isPlainSqlite(dbPath)) {
        db = new Database(dbPath);
        db.pragma(`rekey = '${encKey}'`);
        console.log('[INFO] Opened unencrypted DB and re-encrypted it');
      } else {
        db = new Database(dbPath);
        db.pragma(`key = '${encKey}'`);
        console.log('[INFO] Opened encrypted database');
      }
    } else {
      db = new Database(dbPath);
      db.pragma(`key = '${encKey}'`);
      console.log('[INFO] Created new encrypted database');
    }

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // ── Step 3: Ensure Users table exists ────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS Users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        role VARCHAR(20) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME DEFAULT NULL,
        password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username)
      )
    `);

    // ── Step 4: Ensure SystemLicense table exists ─────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS SystemLicense (
        license_id INTEGER PRIMARY KEY AUTOINCREMENT,
        hardware_fingerprint TEXT NOT NULL,
        license_key TEXT NOT NULL,
        shop_name TEXT NOT NULL,
        shop_owner_name TEXT NOT NULL,
        activation_date TEXT NOT NULL,
        expiry_date TEXT,
        is_active INTEGER DEFAULT 1,
        last_validated TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Step 5: Create/reset admin user ───────────────────────────────────
    const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get().count;
    console.log(`[INFO] Current user count: ${userCount}`);

    const passwordHash = await bcrypt.hash('Admin@123', 10);

    if (userCount === 0) {
      db.prepare(`
        INSERT INTO Users (username, password_hash, full_name, email, role, is_active, password_changed_at)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run('admin', passwordHash, 'Administrator', 'admin@system.local', 'OWNER');
      console.log('[✅] Admin user CREATED: username=admin, password=Admin@123');
    } else {
      // Reset existing admin password
      db.prepare(`
        UPDATE Users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, is_active = 1 WHERE username = 'admin'
      `).run(passwordHash);
      console.log('[✅] Admin user PASSWORD RESET: username=admin, password=Admin@123');
    }

    // ── Step 6: Activate License ──────────────────────────────────────────
    const hardwareFingerprint = crypto.createHash('sha256')
      .update(app.getPath('userData') + process.platform + process.arch)
      .digest('hex');

    const licenseKey = crypto.createHash('sha512')
      .update(`${hardwareFingerprint}|FixSetup|${Date.now()}`)
      .digest('hex')
      .substring(0, 32);

    const licenseData = {
      hardwareFingerprint,
      licenseKey,
      shopName: 'My Business',
      shopOwner: 'Administrator',
      activationDate: new Date().toISOString(),
      isActive: true,
    };

    // Write license file
    const ENCRYPTION_KEY = 'dev-key-change-in-production';
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(JSON.stringify(licenseData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    fs.writeFileSync(licensePath, encrypted);
    console.log('[✅] License file written:', licensePath);

    // Write license to DB
    const existingLicense = db.prepare('SELECT COUNT(*) as count FROM SystemLicense').get().count;
    if (existingLicense === 0) {
      db.prepare(`
        INSERT INTO SystemLicense (hardware_fingerprint, license_key, shop_name, shop_owner_name, activation_date, is_active, last_validated)
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(hardwareFingerprint, licenseKey, 'My Business', 'Administrator', new Date().toISOString());
    } else {
      db.prepare(`
        UPDATE SystemLicense SET hardware_fingerprint = ?, license_key = ?, is_active = 1, last_validated = CURRENT_TIMESTAMP
      `).run(hardwareFingerprint, licenseKey);
    }
    console.log('[✅] License activated in database');

    db.close();

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║              FIX COMPLETE! ✅            ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Username : admin                        ║');
    console.log('║  Password : Admin@123                    ║');
    console.log('║  License  : Activated ✅                 ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('Now run: npm run dev:app\n');

  } catch (error) {
    console.error('[❌] Fix script failed:', error);
    console.error(error.stack);
  } finally {
    app.quit();
  }
});
