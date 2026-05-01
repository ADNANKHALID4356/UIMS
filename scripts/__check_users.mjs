import Database from 'better-sqlite3';
const dbPath = process.env.APPDATA + "\\enterprise-inventory-system\\data\\inventory.db";
try {
  const db = new Database(dbPath, { readonly: true });
  const users = db.prepare("SELECT user_id, username, full_name, role, is_active FROM Users").all();
  console.log("SUCCESS - Users:");
  users.forEach(u => console.log("  ID=" + u.user_id + " username=" + u.username + " name=" + u.full_name + " role=" + u.role + " active=" + u.is_active));
  db.close();
} catch(e) { console.log("ERROR: " + e.message); }
