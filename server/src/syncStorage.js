import fs from 'fs';
import path from 'path';

function baseDir() {
  return path.join(process.cwd(), 'storage', 'snapshots');
}

function ensureDir() {
  const dir = baseDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeName(s) {
  const v = String(s || '').trim();
  // businessId can be uuid-ish; keep it strict.
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(v)) {
    throw new Error('Invalid businessId');
  }
  return v;
}

export function snapshotPathForBusiness(businessId) {
  const dir = ensureDir();
  const name = safeName(businessId);
  return path.join(dir, `${name}.sqlite`);
}

export function readSnapshotBase64(businessId) {
  const p = snapshotPathForBusiness(businessId);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  return buf.toString('base64');
}

export function writeSnapshotBase64(businessId, snapshotB64) {
  const p = snapshotPathForBusiness(businessId);
  const buf = Buffer.from(String(snapshotB64 || ''), 'base64');
  fs.writeFileSync(p, buf);
  return { path: p, bytes: buf.length };
}

