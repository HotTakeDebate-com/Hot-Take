import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

/**
 * Optional Redis: multi-instance Socket.IO + shared join-queue rate limits when REDIS_URL is set.
 * Safe to omit in dev/single-instance deploys.
 */

/**
 * @param {import('socket.io').Server} io
 * @param {{ redis: boolean }} flags — mutated to set flags.redis on success
 * @returns {Promise<{ joinClient: import('redis').RedisClientType, pubClient: import('redis').RedisClientType, subClient: import('redis').RedisClientType } | null>}
 */
export async function setupRedisIfConfigured(io, flags) {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  const joinClient = createClient({ url });
  joinClient.on('error', (err) => console.warn('[redis] rate-limit client:', err.message));

  const pubClient = createClient({ url });
  const subClient = pubClient.duplicate();
  pubClient.on('error', (err) => console.warn('[redis] pub client:', err.message));
  subClient.on('error', (err) => console.warn('[redis] sub client:', err.message));

  await Promise.all([joinClient.connect(), pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  flags.redis = true;
  console.log('[redis] Socket.IO Redis adapter + shared join rate limits enabled');
  return { joinClient, pubClient, subClient };
}

/**
 * @param {import('redis').RedisClientType | null} redisJoinClient
 * @param {string} ip
 * @param {number} windowMs
 * @param {number} max
 * @param {(ip: string) => boolean} memoryFallback
 */
export async function allowJoinQueueIp(redisJoinClient, ip, windowMs, max, memoryFallback) {
  if (!redisJoinClient) return memoryFallback(ip);
  const safe = String(ip || 'unknown')
    .replace(/[^\w.:@-]/g, '')
    .slice(0, 128);
  const key = `hottake:rl:join:${safe || 'unknown'}`;
  try {
    const n = await redisJoinClient.incr(key);
    if (n === 1) await redisJoinClient.pExpire(key, windowMs);
    return n <= max;
  } catch (e) {
    console.warn('[redis] join rate limit INCR failed, using memory limiter:', e?.message ?? e);
    return memoryFallback(ip);
  }
}

/**
 * @param {{ joinClient?: import('redis').RedisClientType, pubClient?: import('redis').RedisClientType, subClient?: import('redis').RedisClientType } | null | undefined} clients
 */
export async function shutdownRedisClients(clients) {
  if (!clients) return;
  const list = [clients.joinClient, clients.pubClient, clients.subClient].filter(Boolean);
  await Promise.allSettled(list.map((c) => c.quit().catch(() => {})));
}
