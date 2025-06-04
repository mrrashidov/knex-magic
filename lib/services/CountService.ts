import { Knex } from 'knex';
import { CursorOptions, CursorParams } from '../interfaces';
import CacheManager from '../managers/CacheManager';

/**
 * Service for handling database record counting operations.
 *
 * @class CountService
 * @description Provides optimized methods for counting database records, including:
 * - Exact and estimated count calculations
 * - Caching support
 * - PostgreSQL-specific optimizations
 * - Fallback mechanisms
 *
 * @example
 * ```typescript
 * const count = await CountService.getOptimizedTotalCount(
 *   query,
 *   { useEstimatedCount: true, cache: { enabled: true } },
 *   { skipTotalCount: false }
 * );
 * ```
 */
class CountService {
  /**
   * Gets the total count of records using optimized strategies.
   *
   * @static
   * @async
   * @param {Knex.QueryBuilder} query - The base query for counting
   * @param {Object} options - Count calculation options
   * @param {boolean} [options.useEstimatedCount] - Whether to use estimated counts for large tables
   * @param {Object} [options.cache] - Caching configuration
   * @param {number} [options.timeout] - Query timeout in milliseconds
   * @param {string} [options.orderByColumn] - Column to use for counting
   * @param {Object} cursorParams - Cursor-based pagination parameters
   * @param {boolean} [cursorParams.skipTotalCount] - Whether to skip count calculation
   * @param {number} [cursorParams.estimatedTotal] - Pre-defined estimated total
   * @param {Knex.QueryBuilder} [countQuery] - Optional custom count query
   * @returns {Promise<number>} Total count of records
   * @throws {Error} If count query fails
   */
  public static async getOptimizedTotalCount(
    query: Knex.QueryBuilder,
    options: Pick<CursorOptions, 'useEstimatedCount' | 'cache' | 'timeout' | 'orderByColumn'>,
    cursorParams: Pick<CursorParams, 'skipTotalCount' | 'estimatedTotal'>,
    countQuery?: Knex.QueryBuilder, // Optional, custom count query
  ): Promise<number> {
    const { skipTotalCount = false, estimatedTotal } = cursorParams;
    const { useEstimatedCount = false, cache, timeout = 30000, orderByColumn = 'id' } = options;

    if (skipTotalCount) {
      return -1; // Indicate that total count was skipped
    }

    if (estimatedTotal !== undefined) {
      return estimatedTotal;
    }

    // Check cache first
    if (cache?.enabled) {
      const cacheKey = cache.key || CacheManager.generateKey(query);
      const cached = CacheManager.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    let count: number;

    // Use PostgreSQL estimated count for large tables if enabled
    if (useEstimatedCount && query.client.config.client === 'pg') {
      try {
        const tableName = this.extractTableName(query);
        if (tableName) {
          count = await this.getPostgresEstimatedCount(query, tableName);
          console.log(`Estimated count for ${tableName}: ${count}`);
        } else {
          // Fallback to exact count if table name cannot be extracted (e.g., complex joins)
          count = await this.getExactCount(query, countQuery, orderByColumn, timeout);
        }
      } catch (error) {
        console.warn('PostgreSQL estimated count failed, falling back to exact count:', error);
        count = await this.getExactCount(query, countQuery, orderByColumn, timeout);
      }
    } else {
      count = await this.getExactCount(query, countQuery, orderByColumn, timeout);
    }

    // Cache the result
    if (cache?.enabled) {
      const cacheKey = cache.key || CacheManager.generateKey(query);
      CacheManager.set(cacheKey, count, cache.ttl || 300);
    }

    return count;
  }

  /**
   * Calculates exact count using standard SQL COUNT.
   *
   * @private
   * @static
   * @async
   * @param {Knex.QueryBuilder} query - Base query to count from
   * @param {Knex.QueryBuilder} [countQuery] - Optional custom count query
   * @param {string} [orderByColumn='id'] - Column to use for counting
   * @param {number} [timeout=30000] - Query timeout in milliseconds
   * @returns {Promise<number>} Exact count of records
   * @throws {Error} If count query times out or fails
   */
  private static async getExactCount(
    query: Knex.QueryBuilder,
    countQuery?: Knex.QueryBuilder,
    orderByColumn: string = 'id', // Default column for count
    timeout: number = 30000,
  ): Promise<number> {
    const finalCountQuery =
      countQuery ||
      query
        .clone()
        .clearSelect()
        .clearCounters()
        .clearGroup()
        .clearHaving()
        .clearOrder()
        .count(`${orderByColumn} as count`);

    const result = await finalCountQuery.timeout(timeout);
    return Number(result[0]?.count || 0);
  }

  /**
   * Gets estimated count from PostgreSQL statistics.
   *
   * @private
   * @static
   * @async
   * @param {Knex.QueryBuilder} query - Query containing table information
   * @param {string} tableName - Name of the table to estimate
   * @returns {Promise<number>} Estimated count from PostgreSQL statistics
   * @throws {Error} If PostgreSQL statistics query fails
   * @example
   * ```typescript
   * const estimate = await CountService.getPostgresEstimatedCount(query, 'users');
   * ```
   */
  private static async getPostgresEstimatedCount(
    query: Knex.QueryBuilder,
    tableName: string,
  ): Promise<number> {
    const result = await query.client.raw(
      `
      SELECT reltuples::BIGINT as estimate
      FROM pg_class
      WHERE relname = ?
    `,
      [tableName],
    );

    return Number(result.rows[0]?.estimate || 0);
  }

  /**
   * Extracts table name from a Knex query.
   *
   * @private
   * @static
   * @param {Knex.QueryBuilder} query - Query to extract table name from
   * @returns {string|null} Extracted table name or null if extraction fails
   * @example
   * ```typescript
   * const tableName = CountService.extractTableName(query);
   * if (tableName) {
   *   // Use table name for statistics
   * }
   * ```
   */
  private static extractTableName(query: Knex.QueryBuilder): string | null {
    try {
      const sql = query.toSQL();
      const match = sql.sql.match(/from\s+["`]?(\w+)["`]?/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
export default CountService;
