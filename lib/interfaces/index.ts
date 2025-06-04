/**
 * Base response structure for paginated queries.
 *
 * @interface BaseResponse
 * @template T - Type of the data items being paginated
 */
export interface BaseResponse<T> {
  /** Array of paginated records */
  data: T[];
  /** Pagination metadata and navigation info */
  pageInfo: PageInfoInterface;
  /** Total count of records (exact or estimated) */
  totalCount: number;
  /** Additional metadata about the query execution */
  meta?: {
    /** Query execution time in milliseconds */
    executionTime?: number;
    /** Indicates if count is estimated rather than exact */
    isEstimated?: boolean;
    /** Indicates if result was served from cache */
    cacheHit?: boolean;
  };
}

/**
 * Pagination metadata and navigation information.
 *
 * @interface PageInfoInterface
 */
export interface PageInfoInterface {
  /** Indicates if there are more records after the current page */
  hasNextPage: boolean;
  /** Indicates if there are records before the current page */
  hasPreviousPage: boolean;
  /** Cursor for the first record in the current page */
  startCursor: string | null;
  /** Cursor for the last record in the current page */
  endCursor: string | null;
  /** Current page number (if using offset pagination) */
  currentPage?: number;
  /** Total number of pages (if using offset pagination) */
  totalPages?: number;
}

/**
 * Parameters for cursor-based pagination.
 *
 * @interface CursorParams
 */
export interface CursorParams {
  /** Number of records to take per page */
  take: number;
  /** Pagination direction */
  direction?: 'next' | 'prev';
  /** Encoded cursor string for current position */
  cursor?: string;
  /** Whether to skip total count calculation */
  skipTotalCount?: boolean;
  /** Pre-defined estimated total count */
  estimatedTotal?: number;
}

/**
 * Configuration options for cursor-based pagination.
 *
 * @interface CursorOptions
 */
export interface CursorOptions {
  /** Column to use for cursor values */
  cursorColumn?: string;
  /** Column to use for ordering */
  orderByColumn?: string;
  /** Sort direction */
  orderDirection?: 'asc' | 'desc';
  /** Whether to use estimated counts for large datasets */
  useEstimatedCount?: boolean;
  /** Cache configuration */
  cache?: CacheOptions;
  /** Query timeout in milliseconds */
  timeout?: number;
}

/**
 * Cache configuration options.
 *
 * @interface CacheOptions
 */
export interface CacheOptions {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Cache TTL in seconds */
  ttl?: number;
  /** Custom cache key */
  key?: string;
}

/**
 * Structure for cursor data encoding/decoding.
 *
 * @interface CursorData
 */
export interface CursorData {
  /** Cursor value (usually from cursorColumn) */
  value: string | number;
  /** Column name the cursor is based on */
  column: string;
  /** Optional timestamp for cursor creation */
  timestamp?: number;
}

/**
 * Filter parameters structure for query filtering.
 *
 * @interface FilterParamsInterface
 */
export interface FilterParamsInterface {
  [key: string]: FilterParamValue | FilterParamObject;
}

/**
 * Valid types for filter parameter values.
 *
 * @typedef FilterParamValue
 */
export type FilterParamValue = string | number | boolean | string[] | FilterParamSearch;

/**
 * Nested object structure for complex filters.
 *
 * @interface FilterParamObject
 */
export interface FilterParamObject {
  [subKey: string]: FilterParamValue | FilterParamRange;
}

/**
 * Range filter configuration.
 *
 * @interface FilterParamRange
 */
export interface FilterParamRange {
  /** Minimum value for range */
  min?: number | string | Date;
  /** Maximum value for range */
  max?: number | string | Date;
}

/**
 * Text search filter configuration.
 *
 * @interface FilterParamSearch
 */
export interface FilterParamSearch {
  /** Columns to search in */
  columns: string[];
  /** Search text value */
  value: string;
  /** Search matching mode */
  mode?: 'contains' | 'starts_with' | 'ends_with' | 'exact';
}
