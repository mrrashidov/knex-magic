import { Knex } from 'knex';

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
      // Using a basic hash of the SQL query string for a cache key.
      // For very high-traffic production, consider a more robust hashing algorithm (e.g., SHA256)
      // or a more predictable key based on query parameters.
      const sql = query.toSQL();
      return `count_${Buffer.from(JSON.stringify(sql)).toString('base64').slice(0, 32)}`;
    } catch {
      return `count_${Date.now()}`; // Fallback to a timestamp if serialization fails
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
