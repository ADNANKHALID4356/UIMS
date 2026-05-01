import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DatabaseService } from '../database/DatabaseService.js';
import { HardwareService } from '../license/HardwareService.js';
import { sha256Hex, ensureIds } from './syncUtils.js';

/**
 * SyncService (Paid Optional Feature)
 * ==================================
 * Minimal, safe, opt-in "cloud sync" that uploads an encrypted DB snapshot
 * to a user-provided server endpoint and can pull/restore the latest snapshot.
 *
 * Design goals:
 * - Never affect offline workflows unless explicitly enabled
 * - Treat the local encrypted SQLite DB as the source of truth
 * - Keep implementation isolated behind IPC
 *
 * NOTE: This MVP syncs full snapshots (VACUUM INTO) rather than row-level diffs.
 */
export class SyncService {
  static instance = null;

  static getInstance() {
    if (!SyncService.instance) SyncService.instance = new SyncService();
    return SyncService.instance;
  }

  constructor() {
    this.db = DatabaseService.getInstance();
    this.hardware = new HardwareService();
    this.syncDir = path.join(app.getPath('userData'), 'sync');
    if (!fs.existsSync(this.syncDir)) fs.mkdirSync(this.syncDir, { recursive: true });
  }

  // -------------------------
  // Settings helpers (DB table: Settings)
  // -------------------------
  async _getSetting(key, fallback = null) {
    const rows = await this.db.query('SELECT value FROM Settings WHERE key = ? LIMIT 1', [key]);
    if (!rows || rows.length === 0) return fallback;
    return rows[0].value ?? fallback;
  }

  async _setSetting(key, value, description = null) {
    await this.db.execute(
      `INSERT INTO Settings (key, value, description, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, description=COALESCE(excluded.description, description), updated_at=CURRENT_TIMESTAMP`,
      [key, value == null ? null : String(value), description]
    );
  }

  async getConfig() {
    return {
      enabled: (await this._getSetting('sync_enabled', '0')) === '1',
      serverUrl: await this._getSetting('sync_server_url', ''),
      apiKey: await this._getSetting('sync_api_key', ''),
      businessId: await this._getSetting('sync_business_id', ''),
      deviceId: await this._getSetting('sync_device_id', ''),
      autoIntervalMinutes: Number(await this._getSetting('sync_auto_interval_minutes', '0')) || 0,
    };
  }

  async setConfig(partial) {
    // sanitize values
    if (partial.enabled != null) await this._setSetting('sync_enabled', partial.enabled ? '1' : '0', 'Enable cloud sync (paid feature)');
    if (partial.serverUrl != null) await this._setSetting('sync_server_url', partial.serverUrl.trim(), 'Sync server base URL');
    if (partial.apiKey != null) await this._setSetting('sync_api_key', partial.apiKey.trim(), 'Sync API key (paid entitlement)');
    if (partial.businessId != null) await this._setSetting('sync_business_id', partial.businessId.trim(), 'Business identifier for sync namespace');
    if (partial.deviceId != null) await this._setSetting('sync_device_id', partial.deviceId.trim(), 'Device identifier (per machine)');
    if (partial.autoIntervalMinutes != null) await this._setSetting('sync_auto_interval_minutes', String(Number(partial.autoIntervalMinutes) || 0), 'Auto-sync interval (minutes)');
    return { success: true };
  }

  async getStatus() {
    return {
      lastPushAt: await this._getSetting('sync_last_push_at', null),
      lastPullAt: await this._getSetting('sync_last_pull_at', null),
      lastSnapshotHash: await this._getSetting('sync_last_snapshot_hash', null),
      lastError: await this._getSetting('sync_last_error', null),
    };
  }

  async _setError(errMsg) {
    await this._setSetting('sync_last_error', errMsg || null, 'Last sync error');
  }

  // -------------------------
  // Paid gate: verify entitlement with server
  // -------------------------
  async _computeRecordCount() {
    // Pricing tiers are based on approximate total records.
    // MVP: sum rows across user tables (excluding sqlite_* and Settings).
    const tables = await this.db.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );
    const safe = (name) => /^[A-Za-z0-9_]+$/.test(name);
    let total = 0;
    for (const t of tables || []) {
      const name = t.name;
      if (!name || name === 'Settings') continue;
      if (!safe(name)) continue;
      // eslint-disable-next-line no-await-in-loop
      const r = await this.db.query(`SELECT COUNT(*) as c FROM "${name}"`);
      total += Number(r?.[0]?.c || 0);
    }
    return total;
  }

  async verifyEntitlement({ recordCount } = {}) {
    const cfg = await this.getConfig();
    if (!cfg.enabled) return { success: false, message: 'Sync is disabled' };
    if (!cfg.serverUrl) return { success: false, message: 'Sync server URL not configured' };
    if (!cfg.apiKey) return { success: false, message: 'Sync API key not configured (paid feature)' };

    const url = new URL('/api/sync/verify', cfg.serverUrl).toString();
    try {
      const fingerprint = await this.hardware.generateFingerprint();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: cfg.apiKey,
          fingerprint,
          recordCount: typeof recordCount === 'number' ? recordCount : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return { success: false, message: json?.message || `Verification failed (${res.status})` };
      }
      return { success: true, data: json.data || {} };
    } catch (e) {
      return { success: false, message: e?.message || 'Network error during verification' };
    }
  }

  // -------------------------
  // Snapshot creation
  // -------------------------
  async _createSnapshotFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = path.join(this.syncDir, `snapshot_${timestamp}.db`);
    await this.db.execute(`VACUUM INTO '${snapshotFile}'`);
    return snapshotFile;
  }

  _sha256(buffer) {
    return sha256Hex(buffer);
  }

  _ensureIds(cfg) {
    return ensureIds(cfg);
  }

  async getEstimate() {
    const fingerprint = await this.hardware.generateFingerprint();
    const recordCount = await this._computeRecordCount();
    return { success: true, data: { fingerprint, recordCount } };
  }

  async pushSnapshot() {
    const cfg0 = await this.getConfig();
    if (!cfg0.enabled) return { success: false, message: 'Sync is disabled' };

    const { cfg, changed } = this._ensureIds({ ...cfg0 });
    if (changed) await this.setConfig({ businessId: cfg.businessId, deviceId: cfg.deviceId });

    const recordCount = await this._computeRecordCount();
    const entitlement = await this.verifyEntitlement({ recordCount });
    if (!entitlement.success) return entitlement;

    try {
      await this._setError(null);
      const fingerprint = await this.hardware.generateFingerprint();
      const snapshotPath = await this._createSnapshotFile();
      const buf = fs.readFileSync(snapshotPath);
      const hash = this._sha256(buf);
      const snapshotId = path.basename(snapshotPath).replace('.db', '');

      const url = new URL('/api/sync/push', cfg.serverUrl).toString();
      const payload = {
        apiKey: cfg.apiKey,
        businessId: cfg.businessId,
        fingerprint,
        recordCount,
        hash,
        snapshotB64: buf.toString('base64'),
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const msg = json?.message || `Push failed (${res.status})`;
        await this._setError(msg);
        return { success: false, message: msg };
      }

      await this._setSetting('sync_last_push_at', new Date().toISOString());
      await this._setSetting('sync_last_snapshot_hash', hash);
      return { success: true, data: { snapshotId, hash, recordCount } };
    } catch (e) {
      const msg = e?.message || 'Unexpected push error';
      await this._setError(msg);
      return { success: false, message: msg };
    }
  }

  async pullLatest({ restore = false } = {}) {
    const cfg0 = await this.getConfig();
    if (!cfg0.enabled) return { success: false, message: 'Sync is disabled' };
    if (!cfg0.serverUrl) return { success: false, message: 'Sync server URL not configured' };
    if (!cfg0.apiKey) return { success: false, message: 'Sync API key not configured (paid feature)' };
    if (!cfg0.businessId) return { success: false, message: 'Business ID not configured' };

    const entitlement = await this.verifyEntitlement();
    if (!entitlement.success) return entitlement;

    try {
      await this._setError(null);
      const fingerprint = await this.hardware.generateFingerprint();
      const url = new URL('/api/sync/pull', cfg0.serverUrl).toString();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cfg0.apiKey, fingerprint, businessId: cfg0.businessId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const msg = json?.message || `Pull failed (${res.status})`;
        await this._setError(msg);
        return { success: false, message: msg };
      }

      const { snapshotB64 } = json.data || {};
      if (!snapshotB64) {
        const msg = 'Invalid pull response';
        await this._setError(msg);
        return { success: false, message: msg };
      }

      const buf = Buffer.from(snapshotB64, 'base64');
      const hash = this._sha256(buf);
      const snapshotId = `pulled_${new Date().toISOString().replace(/[:.]/g, '-')}`;

      // Save as a file in sync dir
      const filePath = path.join(this.syncDir, `${snapshotId}.db`);
      fs.writeFileSync(filePath, buf);

      await this._setSetting('sync_last_pull_at', new Date().toISOString());
      await this._setSetting('sync_last_snapshot_hash', hash);

      if (!restore) {
        return { success: true, data: { snapshotId, hash, savedTo: filePath, restored: false } };
      }

      // Restore (dangerous): close DB, replace current DB file, reinitialize.
      const currentDbPath = this.db.dbPath;
      this.db.close();
      fs.copyFileSync(filePath, currentDbPath);
      await this.db.initialize();

      return { success: true, data: { snapshotId, hash, savedTo: filePath, restored: true } };
    } catch (e) {
      const msg = e?.message || 'Unexpected pull error';
      await this._setError(msg);
      return { success: false, message: msg };
    }
  }
}

