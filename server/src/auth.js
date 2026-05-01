import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { findUserByEmail, createUserRow } from './repo.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change';
const JWT_EXPIRES_IN = '7d';

export async function createUser({ email, password, isAdmin = false }) {
  const normalized = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalized);
  if (existing) throw new Error('Email already exists');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUserRow({ email: normalized, passwordHash, isAdmin });
  return { id: user.id, email: user.email, isAdmin: user.is_admin, createdAt: user.created_at };
}

export async function login({ email, password }) {
  const normalized = email.trim().toLowerCase();
  const user = await findUserByEmail(normalized);
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('Invalid credentials');
  const token = jwt.sign({ sub: user.id, admin: !!user.is_admin }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token, user: { id: user.id, email: user.email, isAdmin: !!user.is_admin } };
}

export function requireAuth(req, _res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
    if (!token) throw new Error('Missing token');
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, isAdmin: !!payload.admin };
    return next();
  } catch {
    return next(Object.assign(new Error('Unauthorized'), { status: 401 }));
  }
}

export function requireAdmin(req, _res, next) {
  if (!req.user?.isAdmin) return next(Object.assign(new Error('Forbidden'), { status: 403 }));
  return next();
}

