import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Verify connection on startup
redis.ping().then(() => {
  console.log('✅ Upstash Redis connected');
}).catch((err) => {
  console.error('❌ Redis connection failed:', err.message);
});

export default redis;

// ─── Cache Helpers ───────────────────────────────────────────────────────────
export const cache = {
  /** Get parsed JSON from cache, returns null on miss */
  async get(key) {
    try {
      const val = await redis.get(key);
      return val ?? null;
    } catch {
      return null;
    }
  },

  /** Set JSON value with TTL in seconds */
  async set(key, value, ttlSeconds = 120) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } catch {
      // non-fatal – cache miss on next request
    }
  },

  /** Delete a cache key */
  async del(key) {
    try {
      await redis.del(key);
    } catch {}
  },

  /** Rate-limit helper: increments counter, returns current count */
  async incr(key, ttlSeconds = 60) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, ttlSeconds);
      return count;
    } catch {
      return 0;
    }
  },
};
