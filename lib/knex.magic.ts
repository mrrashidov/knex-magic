import { Knex } from 'knex';
import {
  CursorParams,
  CursorOptions,
  BaseResponse,
  CursorData,
  PageInfoInterface,
  FilterParamsInterface,
} from './interfaces';
import CursorManager from './managers/CursorManager';
import CountService from './services/CountService';
import FilterService from './services/FilterService';

/**
 * A utility class that provides cursor-based pagination and filtering capabilities for Knex.js queries.
 *
 * @class KnexMagic
 * @description Handles cursor-based pagination, filtering, and optimization of database queries using Knex.js.
 * Implements best practices for performance and scalability through cursor pagination, caching, and
 * estimated counts for large datasets.
 *
 * @example
 * ```typescript
 * const result = await KnexMagic.paginate({
 *   query: knex('users'),
 *   cursorParams: { take: 10, cursor: 'encoded-cursor' },
 *   options: { cursorColumn: 'id' }
 * });
 * ```
 */
export class KnexMagic {
  /**
   * Paginates query results using cursor-based pagination.
   *
   * @async
   * @template T - The type of records being paginated
   * @param {Object} params - The pagination parameters
   * @param {Knex.QueryBuilder} params.query - The base Knex query builder instance
   * @param {CursorParams} params.cursorParams - Cursor pagination parameters
   * @param {CursorOptions} [params.options={}] - Optional pagination configuration
   * @param {Knex.QueryBuilder} [params.countQuery] - Optional custom query for counting total records
   * @returns {Promise<BaseResponse<T>>} Paginated results with metadata
   * @throws {Error} If take parameter is invalid or cursor column mismatch occurs
   */
  public static async paginate<T>({
    query,
    cursorParams,
    options = {},
    countQuery, // Optional, custom count query for specific scenarios
  }: {
    query: Knex.QueryBuilder;
    cursorParams: CursorParams;
    options?: CursorOptions;
    countQuery?: Knex.QueryBuilder;
  }): Promise<BaseResponse<T>> {
    const startTime = Date.now();

    const {
      cursorColumn = 'id',
      orderByColumn = 'id',
      orderDirection = 'asc',
      timeout = 30000,
    } = options;

    const { take, direction = 'next', cursor: encodedCursor } = cursorParams;

    // Validation
    if (take <= 0 || take > 1000) {
      throw new Error('Take (limit) must be between 1 and 1000');
    }

    let decodedCursor: CursorData | null = null;
    if (encodedCursor) {
      decodedCursor = CursorManager.decodeCursor(encodedCursor);
      if (decodedCursor.column !== cursorColumn) {
        throw new Error(
          `Cursor column mismatch: expected '${cursorColumn}', got '${decodedCursor.column}'`,
        );
      }
    }

    // Prepare main data query
    const dataQuery = query.clone();
    if (decodedCursor) {
      const operator = this.getCursorOperator(direction, orderDirection);
      dataQuery.where(orderByColumn, operator, decodedCursor.value);
    }
    const finalOrder = this.getFinalOrderDirection(direction, orderDirection);
    dataQuery.orderBy(orderByColumn, finalOrder);

    // Execute data and count queries in parallel for efficiency
    const [results, totalCount] = await Promise.all([
      dataQuery.limit(take + 1).timeout(timeout) as Promise<T[]>,
      CountService.getOptimizedTotalCount(query, options, cursorParams, countQuery),
    ]);

    // Adjust results for hasMore and build page info
    const hasMore = results.length > take;
    if (hasMore) {
      results.pop(); // Remove the extra record used to determine hasMore
    }

    const pageInfo = this.buildPageInfo(
      results,
      cursorColumn,
      direction,
      encodedCursor,
      hasMore,
      totalCount, // Pass totalCount for potential totalPages calculation
    );

    const executionTime = Date.now() - startTime;

    return {
      data: results,
      pageInfo,
      totalCount,
      meta: {
        executionTime,
        isEstimated: options.useEstimatedCount,
      },
    };
  }

  /**
   * Provides streaming iteration over large datasets using cursor pagination.
   *
   * @async
   * @generator
   * @template T - The type of records being streamed
   * @param {Object} params - The streaming parameters
   * @param {Knex.QueryBuilder} params.query - The base Knex query builder instance
   * @param {CursorParams} params.cursorParams - Cursor pagination parameters
   * @param {CursorOptions} [params.options={}] - Optional streaming configuration
   * @param {Knex.QueryBuilder} [params.countQuery] - Optional custom count query
   * @yields {T} Individual records from the dataset
   * @throws {Error} If batch size is invalid
   */
  public static async *paginateStream<T>({
    query,
    cursorParams,
    options = {},
    countQuery, // Pass through custom count query for batches
  }: {
    query: Knex.QueryBuilder;
    cursorParams: CursorParams;
    options?: CursorOptions;
    countQuery?: Knex.QueryBuilder;
  }): AsyncIterable<T> {
    const { take: batchSize } = cursorParams;
    if (batchSize === undefined || batchSize <= 0) {
      throw new Error('Batch size must be greater than 0 for streaming.');
    }

    let currentCursor = cursorParams.cursor;
    let hasMore = true;

    while (hasMore) {
      const result = await KnexMagic.paginate<T>({
        query: query.clone(), // Clone for each batch to maintain query integrity
        cursorParams: {
          ...cursorParams,
          take: batchSize,
          cursor: currentCursor,
          skipTotalCount: true, // Always skip total count for streams
        },
        options,
        countQuery,
      });

      if (result.data.length === 0) {
        break; // No more data to stream
      }

      for (const item of result.data) {
        yield item;
      }

      hasMore = result.pageInfo.hasNextPage;
      currentCursor = result.pageInfo.endCursor ?? undefined;

      // Prevent infinite loop if hasNextPage is true but cursor doesn't advance
      if (hasMore && currentCursor === null) {
        console.warn(
          'Stream pagination: hasNextPage is true but endCursor is null. Stopping to prevent infinite loop.',
        );
        break;
      }
    }
  }

  /**
   * Determines the appropriate SQL operator for cursor-based pagination.
   *
   * @private
   * @static
   * @param {('next'|'prev')} direction - Pagination direction
   * @param {('asc'|'desc')} orderDirection - Sort order direction
   * @returns {string} SQL comparison operator ('>' or '<')
   * @example
   * const operator = KnexMagic.getCursorOperator('next', 'asc'); // Returns '>'
   */
  private static getCursorOperator(
    direction: 'next' | 'prev',
    orderDirection: 'asc' | 'desc',
  ): string {
    return direction === 'next'
      ? orderDirection === 'asc'
        ? '>'
        : '<'
      : orderDirection === 'asc'
        ? '<'
        : '>';
  }

  /**
   * Determines the final sort order direction based on pagination direction.
   *
   * @private
   * @static
   * @param {('next'|'prev')} direction - Pagination direction
   * @param {('asc'|'desc')} orderDirection - Initial sort order direction
   * @returns {('asc'|'desc')} Final sort order direction
   * @example
   * const finalOrder = KnexMagic.getFinalOrderDirection('prev', 'asc'); // Returns 'desc'
   */
  private static getFinalOrderDirection(
    direction: 'next' | 'prev',
    orderDirection: 'asc' | 'desc',
  ): 'asc' | 'desc' {
    return direction === 'next' ? orderDirection : orderDirection === 'asc' ? 'desc' : 'asc';
  }

  /**
   * Builds pagination metadata information.
   *
   * @private
   * @static
   * @template T - Type of the paginated records
   * @param {T[]} results - Array of query results
   * @param {string} cursorColumn - Column used for cursor
   * @param {('next'|'prev')} direction - Pagination direction
   * @param {string} [encodedCursor] - Current encoded cursor
   * @param {boolean} hasMore - Indicates if more records exist
   * @param {number} totalCount - Total count of records
   * @returns {PageInfoInterface} Object containing pagination metadata
   */
  private static buildPageInfo<T>(
    results: T[],
    cursorColumn: string,
    direction: 'next' | 'prev',
    encodedCursor: string | undefined,
    hasMore: boolean,
    totalCount: number,
  ): PageInfoInterface {
    if (results.length === 0) {
      return {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      };
    }

    const firstRecord = results[0] as any;
    const lastRecord = results[results.length - 1] as any;

    const startCursor = CursorManager.createCursor(firstRecord, cursorColumn);
    const endCursor = CursorManager.createCursor(lastRecord, cursorColumn);

    let hasNextPage: boolean;
    let hasPreviousPage: boolean;

    if (direction === 'next') {
      hasNextPage = hasMore;
      hasPreviousPage = !!encodedCursor; // `!!` converts to boolean
    } else {
      hasNextPage = !!encodedCursor;
      hasPreviousPage = hasMore;
    }

    // Optional: Calculate totalPages if totalCount is available and not skipped (-1)
    const totalPages =
      totalCount > 0 && totalCount !== -1 && results.length > 0
        ? Math.ceil(totalCount / results.length) // Use results.length as items per page
        : undefined;

    return {
      hasNextPage,
      hasPreviousPage,
      startCursor,
      endCursor,
      currentPage: undefined, // Current page is hard to determine accurately with cursor pagination without knowing page size globally
      totalPages,
    };
  }
}

/**
 * Service class providing pre-configured pagination methods for different use cases.
 *
 * @class PaginationService
 * @description Provides optimized pagination methods for different dataset sizes and use cases.
 * Combines FilterService and KnexMagic functionalities for comprehensive data access patterns.
 */
export class PaginationService {
  /**
   * Standard pagination method for small to medium datasets.
   *
   * @static
   * @async
   * @template T - Type of the records being paginated
   * @param {Knex.QueryBuilder} query - Base query to paginate
   * @param {number} limit - Number of records per page
   * @param {string} [cursor] - Optional cursor for pagination
   * @param {FilterParamsInterface} [filters] - Optional filters to apply
   * @returns {Promise<BaseResponse<T>>} Paginated response with metadata
   * @example
   * ```typescript
   * const result = await PaginationService.standard(
   *   knex('users'),
   *   10,
   *   'cursor-string',
   *   { search: { value: 'john', columns: ['name'] } }
   * );
   * ```
   */
  static async standard<T>(
    query: Knex.QueryBuilder,
    limit: number,
    cursor?: string, // Make cursor optional and last
    filters?: FilterParamsInterface,
  ): Promise<BaseResponse<T>> {
    const filteredQuery = FilterService.applyFilters(query, filters);

    return KnexMagic.paginate<T>({
      query: filteredQuery,
      cursorParams: {
        take: limit,
        cursor,
      },
      options: {
        useEstimatedCount: false,
        timeout: 10000,
      },
    });
  }

  /**
   * High-performance pagination for large datasets with optimizations.
   *
   * @static
   * @async
   * @template T - Type of the records being paginated
   * @param {Knex.QueryBuilder} query - Base query to paginate
   * @param {number} limit - Number of records per page
   * @param {string} [cursor] - Optional cursor for pagination
   * @param {FilterParamsInterface} [filters] - Optional filters to apply
   * @returns {Promise<BaseResponse<T>>} Paginated response with metadata
   * @example
   * ```typescript
   * const result = await PaginationService.highPerformance(
   *   knex('large_table'),
   *   100,
   *   'cursor-string',
   *   { filters: { status: 'active' } }
   * );
   * ```
   */
  static async highPerformance<T>(
    query: Knex.QueryBuilder,
    limit: number,
    cursor?: string, // Make cursor optional and last
    filters?: FilterParamsInterface,
  ): Promise<BaseResponse<T>> {
    const filteredQuery = FilterService.applyFilters(query, filters, {
      batchMode: true,
    });

    return KnexMagic.paginate<T>({
      query: filteredQuery,
      cursorParams: {
        take: limit,
        cursor,
        skipTotalCount: true, // Optimize by skipping exact count
      },
      options: {
        useEstimatedCount: true, // Use estimated for PG, fallback to exact
        cache: { enabled: true, ttl: 300 },
        timeout: 5000,
      },
    });
  }

  /**
   * Streams large datasets using efficient batch processing.
   *
   * @static
   * @async
   * @generator
   * @template T - Type of the records being streamed
   * @param {Knex.QueryBuilder} query - Base query to stream
   * @param {number} [batchSize=1000] - Size of each batch
   * @param {FilterParamsInterface} [filters] - Optional filters to apply
   * @yields {T} Individual records from the dataset
   * @example
   * ```typescript
   * for await (const record of PaginationService.stream(query, 1000)) {
   *   await processRecord(record);
   * }
   * ```
   */
  static async *stream<T>(
    query: Knex.QueryBuilder,
    batchSize: number = 1000,
    filters?: FilterParamsInterface,
  ): AsyncIterable<T> {
    const filteredQuery = FilterService.applyFilters(query, filters, {
      batchMode: true,
    });

    yield* KnexMagic.paginateStream<T>({
      query: filteredQuery,
      cursorParams: { take: batchSize },
      options: {},
    });
  }
}

export default KnexMagic;
