/**
 * Simple fixed-window rate limiter (in-memory). One bucket per key.
 * For multi-process deploys, replace with Redis or edge limits.
 */
export function createRateLimiter({ windowMs, max }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();
  let nextSweepAt = Date.now() + windowMs;

  return function allow(key) {
    if (!key || key === 'unknown') {
      return max > 0;
    }
    const now = Date.now();
    if (now >= nextSweepAt) {
      for (const [bucketKey, bucket] of buckets) {
        if (now >= bucket.resetAt) buckets.delete(bucketKey);
      }
      nextSweepAt = now + windowMs;
    }
    let b = buckets.get(key);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    if (b.count >= max) return false;
    b.count += 1;
    return true;
  };
}

/** Client IP for Socket.IO (trust proxy when behind reverse proxy). */
export function getClientIp(socket) {
  const raw = socket.request?.headers?.['x-forwarded-for'];
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',')[0].trim();
  }
  const addr = socket.handshake?.address;
  if (typeof addr === 'string' && addr.length) {
    return addr.replace(/^::ffff:/, '');
  }
  return 'unknown';
}
