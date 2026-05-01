const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');
const { app, safeStorage } = require('electron');

app.setName('enterprise-inventory-system');

app.on('ready', async () => {
  const appDataPath = app.getPath('userData');
  const dataPath = path.join(appDataPath, 'data');
  const dbPath = path.join(dataPath, 'inventory.db');
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

  const users = db.prepare('SELECT user_id, username, full_name, role FROM Users').all();
  console.log('--- USERS IN DATABASE ---');
  console.table(users);
  
  const license = db.prepare('SELECT is_active, shop_name FROM SystemLicense').all();
  console.log('--- LICENSE IN DATABASE ---');
  console.table(license);

  app.quit();
});
