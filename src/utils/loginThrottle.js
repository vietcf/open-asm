// In-memory brute-force protection for the login and OTP forms.
// A key (e.g. "ip|username") is locked for LOCK_MINUTES after MAX_FAILURES
// failed attempts within WINDOW_MINUTES. Process-local by design: the app
// runs as a single container.
const MAX_FAILURES = Number(process.env.LOGIN_MAX_FAILURES || 10);
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MINUTES || 15) * 60 * 1000;
const LOCK_MS = Number(process.env.LOGIN_LOCK_MINUTES || 15) * 60 * 1000;

const entries = new Map(); // key -> { failures: number[], lockedUntil: number }

function prune(entry, now) {
  entry.failures = entry.failures.filter(ts => now - ts < WINDOW_MS);
}

export function isLocked(key) {
  const entry = entries.get(key);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return true;
  return false;
}

export function recordFailure(key) {
  const now = Date.now();
  const entry = entries.get(key) || { failures: [], lockedUntil: 0 };
  prune(entry, now);
  entry.failures.push(now);
  if (entry.failures.length >= MAX_FAILURES) {
    entry.lockedUntil = now + LOCK_MS;
    entry.failures = [];
  }
  entries.set(key, entry);
}

export function recordSuccess(key) {
  entries.delete(key);
}

// Periodic cleanup so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of entries) {
    prune(entry, now);
    if (!entry.failures.length && (!entry.lockedUntil || entry.lockedUntil < now)) entries.delete(key);
  }
}, 10 * 60 * 1000).unref();
