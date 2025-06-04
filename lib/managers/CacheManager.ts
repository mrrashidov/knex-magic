import { Knex } from 'knex';
import { createHash } from 'node:crypto';

/**
 * Manages in-memory caching for query results.
 *
 * @class CacheManager
 * @description Provides in-memory caching functionality with TTL support.
 * Implements efficient cache key generation based on query structure.
 */
class CacheManager {
  private static cache = new Map<string, { data: any; expires: number }>();

  /**
   * Generates a unique cache key for a query.
   *
   * @static
   * @param {Knex.QueryBuilder} query - The query to generate a key for
   * @returns {string} A unique cache key
   */
  public static generateKey(query: Knex.QueryBuilder): string {
    try {
      // ...existing code...
      const sql = query.toSQL();
      const str = [sql.method, sql.sql, JSON.stringify(sql.bindings)].join('|');
      const hash = createHash('sha256').update(str).digest('hex');
      return `count_${hash}`;
    } catch {
      return `count_${Date.now()}`;
    }
  }

  /**
   * Retrieves a value from cache.
   *
   * @static
   * @template T - The type of cached data
   * @param {string} key - The cache key
   * @returns {T | null} The cached value or null if not found/expired
   */
  public static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    this.cache.delete(key); // Invalidate expired cache
    return null;
  }

  /**
   * Sets a value in the cache with expiration.
   *
   * @static
   * @param {string} key - The cache key to store data under
   * @param {any} data - The data to cache
   * @param {number} ttl - Time to live in seconds
   * @example
   * ```typescript
   * // Cache user data for 5 minutes
   * CacheManager.set('user_123', userData, 300);
   *
   * // Cache count result for 1 hour
   * CacheManager.set('count_query_key', totalCount, 3600);
   * ```
   */
  public static set(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl * 1000,
    });
  }
}
export default CacheManager;
