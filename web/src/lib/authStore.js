const KEY = 'uims_web_auth';

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function setAuth(val) {
  localStorage.setItem(KEY, JSON.stringify(val));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}

