/**
 * Redis client wrapper for the MCP Swarm layer.
 *
 * Provides a minimal, typed surface for:
 * - Key/value operations (get, set, del)
 * - TTL management (expire, ttl)
 * - Pub/sub channels for real-time agent telemetry
 *
 * Falls back to an in-memory Map-based store if Redis is unavailable,
 * ensuring the swarm can operate in degraded mode during development
 * or when Redis is intentionally disabled.
 */

import { logger } from "../middleware/logger.js";

export interface RedisClientOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RedisClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, handler: (message: string) => void): Promise<() => void>;
  keys(pattern: string): Promise<string[]>;
  flush(): Promise<void>;
  isHealthy(): Promise<boolean>;
  close(): Promise<void>;
}

/** In-memory fallback store for when Redis is unavailable. */
class MemoryStore implements RedisClient {
  private store = new Map<string, { value: unknown; expiresAt?: number }>();
  private subscribers = new Map<string, Set<(message: string) => void>>();
  private timers = new Map<string, NodeJS.Timeout>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.timers.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });

    if (ttlSeconds) {
      const existingTimer = this.timers.get(key);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        this.store.delete(key);
        this.timers.delete(key);
      }, ttlSeconds * 1000);
      this.timers.set(key, timer);
    }
    return true;
  }

  async del(key: string): Promise<boolean> {
    const existingTimer = this.timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    this.timers.delete(key);
    return this.store.delete(key);
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expiresAt) return -1;
    return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + seconds * 1000;
    const existingTimer = this.timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    this.timers.set(key, timer);
    return true;
  }

  async publish(channel: string, message: string): Promise<number> {
    const subs = this.subscribers.get(channel);
    if (!subs) return 0;
    subs.forEach((handler) => {
      try {
        handler(message);
      } catch {
        // swallow handler errors
      }
    });
    return subs.size;
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<() => void> {
    let subs = this.subscribers.get(channel);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(channel, subs);
    }
    subs.add(handler);
    return () => {
      subs?.delete(handler);
      if (subs && subs.size === 0) {
        this.subscribers.delete(channel);
      }
    };
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".")
          .replace(/\[/g, "\\[")
          .replace(/\]/g, "\\]") +
        "$",
    );
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }

  async flush(): Promise<void> {
    this.store.clear();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.subscribers.clear();
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    await this.flush();
  }
}

/** Minimal structural type for the subset of the `redis` client we use. */
interface RedisNativeClient {
  on(event: "error", listener: (err: unknown) => void): unknown;
  connect(): Promise<void>;
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  del(keys: string | string[]): Promise<unknown>;
  tTL(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, listener: (message: string) => void): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  quit(): Promise<unknown>;
}

/** Creates a Redis client with in-memory fallback. */
export async function createSwarmRedisClient(options: RedisClientOptions = {}): Promise<RedisClient> {
  const log = logger.child({ service: "mcp-swarm-redis" });
  const { host = "127.0.0.1", port = 6379, password, db = 0, keyPrefix = "swarm:" } = options;

  // Try to create a real Redis client. The `redis` package is an optional
  // peer dependency: it is not installed in every deployment, so the import
  // is intentionally dynamic and resolved through a variable to keep the
  // compiler from requiring the module to exist at build time.
  try {
    const moduleName = "redis";
    const redisModule = (await import(moduleName)) as {
      createClient: (options: { url: string }) => RedisNativeClient;
    };
    const client = redisModule.createClient({
      url: password ? `redis://:${password}@${host}:${port}/${db}` : `redis://${host}:${port}/${db}`,
    });

    client.on("error", (err: unknown) => {
      log.warn({ err }, "Redis client error");
    });

    await client.connect();
    await client.ping();

    log.info({ host, port, db }, "Redis client connected");

    const prefixKey = (key: string) => `${keyPrefix}${key}`;

    return {
      async get<T = unknown>(key: string): Promise<T | null> {
        const value = await client.get(prefixKey(key));
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      },

      async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        if (ttlSeconds) {
          await client.setEx(prefixKey(key), ttlSeconds, serialized);
        } else {
          await client.set(prefixKey(key), serialized);
        }
        return true;
      },

      async del(key: string): Promise<boolean> {
        await client.del(prefixKey(key));
        return true;
      },

      async ttl(key: string): Promise<number> {
        return client.tTL(prefixKey(key));
      },

      async expire(key: string, seconds: number): Promise<boolean> {
        const result = await client.expire(prefixKey(key), seconds);
        return result === 1;
      },

      async publish(channel: string, message: string): Promise<number> {
        return client.publish(`${keyPrefix}channel:${channel}`, message);
      },

      async subscribe(channel: string, handler: (message: string) => void): Promise<() => void> {
        const fullChannel = `${keyPrefix}channel:${channel}`;
        await client.subscribe(fullChannel, handler);
        return () => {
          client.unsubscribe(fullChannel).catch(() => {
            // ignore unsubscribe errors
          });
        };
      },

      async keys(pattern: string): Promise<string[]> {
        return client.keys(`${keyPrefix}${pattern}`);
      },

      async flush(): Promise<void> {
        const keys = await client.keys(`${keyPrefix}*`);
        if (keys.length > 0) {
          await client.del(keys);
        }
      },

      async isHealthy(): Promise<boolean> {
        try {
          await client.ping();
          return true;
        } catch {
          return false;
        }
      },

      async close(): Promise<void> {
        await client.quit();
      },
    };
  } catch (err) {
    log.warn({ err, host, port }, "Redis unavailable, using in-memory fallback");
    return new MemoryStore();
  }
}
