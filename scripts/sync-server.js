/**
 * Minimal Sync Server (for testing / self-hosting)
 * ===============================================
 * No external deps: uses Node http + filesystem.
 *
 * Endpoints:
 *  POST /api/sync/verify  { apiKey } -> { success }
 *  POST /api/sync/push    { apiKey, businessId, deviceId, snapshotId, hash, createdAt, dbBase64 }
 *  GET  /api/sync/pull?apiKey=...&businessId=...&knownHash=...
 *
 * Keys:
 *  - Set env SYNC_KEYS="key1,key2" or default "dev-sync-key"
 *
 * Storage:
 *  - Stores snapshots in ./sync-storage/<businessId>/<snapshotId>.db
 *  - Writes ./sync-storage/<businessId>/latest.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(process.cwd(), 'sync-storage');
const KEYS = (process.env.SYNC_KEYS || 'dev-sync-key').split(',').map(s => s.trim()).filter(Boolean);

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 100 * 1024 * 1024) reject(new Error('Payload too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isKeyValid(apiKey) {
  return !!apiKey && KEYS.includes(apiKey);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'POST' && url.pathname === '/api/sync/verify') {
      const body = JSON.parse(await readBody(req) || '{}');
      if (!isKeyValid(body.apiKey)) return json(res, 403, { success: false, message: 'Invalid API key' });
      return json(res, 200, { success: true, data: { plan: 'SYNC', valid: true } });
    }

    if (req.method === 'POST' && url.pathname === '/api/sync/push') {
      const body = JSON.parse(await readBody(req) || '{}');
      const { apiKey, businessId, snapshotId, hash, dbBase64 } = body;
      if (!isKeyValid(apiKey)) return json(res, 403, { success: false, message: 'Invalid API key' });
      if (!businessId || !snapshotId || !hash || !dbBase64) return json(res, 400, { success: false, message: 'Missing fields' });

      const bizDir = path.join(ROOT, businessId);
      ensureDir(bizDir);

      const buf = Buffer.from(dbBase64, 'base64');
      const computed = sha256(buf);
      if (computed !== hash) return json(res, 400, { success: false, message: 'Hash mismatch' });

      const filePath = path.join(bizDir, `${snapshotId}.db`);
      fs.writeFileSync(filePath, buf);
      fs.writeFileSync(path.join(bizDir, 'latest.json'), JSON.stringify({
        snapshotId,
        hash,
        createdAt: body.createdAt || new Date().toISOString(),
      }, null, 2));

      return json(res, 200, { success: true, data: { snapshotId, hash } });
    }

    if (req.method === 'GET' && url.pathname === '/api/sync/pull') {
      const apiKey = url.searchParams.get('apiKey');
      const businessId = url.searchParams.get('businessId');
      const knownHash = url.searchParams.get('knownHash') || '';
      if (!isKeyValid(apiKey)) return json(res, 403, { success: false, message: 'Invalid API key' });
      if (!businessId) return json(res, 400, { success: false, message: 'businessId required' });

      const bizDir = path.join(ROOT, businessId);
      const latestPath = path.join(bizDir, 'latest.json');
      if (!fs.existsSync(latestPath)) return json(res, 200, { success: true, data: { upToDate: true } });

      const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
      if (latest.hash && knownHash && latest.hash === knownHash) {
        return json(res, 200, { success: true, data: { upToDate: true } });
      }

      const filePath = path.join(bizDir, `${latest.snapshotId}.db`);
      if (!fs.existsSync(filePath)) return json(res, 500, { success: false, message: 'Latest snapshot file missing' });

      const buf = fs.readFileSync(filePath);
      return json(res, 200, {
        success: true,
        data: {
          snapshotId: latest.snapshotId,
          hash: latest.hash || sha256(buf),
          createdAt: latest.createdAt,
          dbBase64: buf.toString('base64'),
        },
      });
    }

    return json(res, 404, { success: false, message: 'Not found' });
  } catch (e) {
    return json(res, 500, { success: false, message: e?.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`[sync-server] listening on http://localhost:${PORT}`);
  console.log(`[sync-server] valid keys: ${KEYS.join(', ')}`);
  console.log(`[sync-server] storage: ${ROOT}`);
});

