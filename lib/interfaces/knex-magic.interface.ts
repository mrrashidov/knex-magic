import { Knex } from "knex";

/**
 * Interface for the response object containing data, pagination information, and total count.
 * @template T - The type of data in the response.
 */
export interface BaseResponse<T> {
  /** An array of data of type T. */
  data: T[];
  /** Pagination information for the data. */
  pageInfo: PageInfoInterface;
  /** The total count of data. */
  totalCount: number;
}

/**
 * Interface for defining pagination information.
 */
export interface PageInfoInterface {
  /**
   * Indicates whether there is a next page available.
   */
  hasNextPage: boolean;
  /**
   * The cursor value for the end of the current page.
   */
  endCursor: string;
  /**
   * Indicates whether there is a previous page available.
   */
  hasPreviousPage: boolean;
  /**
   * The cursor value for the start of the current page.
   */
  startCursor: string;
}

/**
 * Interface for defining a cursor-based pagination query using Knex.
 */
export interface CursorInterface {
  /**
   * The Knex query builder instance for the main query.
   */
  query: Knex.QueryBuilder;

  /**
   * The cursor parameters for the pagination query.
   */
  cursorParams: {
    /**
     * The number of items to take per page.
     */
    take: number;

    /**
     * The direction of the pagination cursor, either "next" or "prev".
     */
    direction: "next" | "prev";

    /**
     * The cursor value to start from. Optional for "next" direction, required for "prev" direction.
     */
    cursor?: number;
  };

  /**
   * Additional options for the cursor-based pagination query.
   */
  options?: {
    /**
     * The name of the column to use as the cursor key. Defaults to "id".
     */
    key: string;

    /**
     * An optional prefix to use for the cursor key. Useful for avoiding conflicts with other query parameters.
     */
    keyPrefix?: string;
  };

  /**
   * An optional callback function to modify the count query used for pagination.
   */
  countQuery?: Knex.QueryBuilder;
}

/**
 * Interface for defining filter parameters.
 * @interface FilterParamsInterface
 */
export interface FilterParamsInterface {
  [key: string]: FilterParamValue | FilterParamObject;
}

/**
 * Represents the possible values for a filter parameter.
 * @typedef {string | number | boolean | string[] | FilterParamSearch} FilterParamValue
 */
export type FilterParamValue =
  | string
  | number
  | boolean
  | string[]
  | FilterParamSearch;

/**
 * An object representing a filter parameter, with keys as sub-keys and values as either a single value or a range of values.
 */
export interface FilterParamObject {
  [subKey: string]: FilterParamValue | FilterParamRange;
}

/**
 * Represents a range of values that can be used as a filter parameter.
 */
export interface FilterParamRange {
  from?: number | string | Date;
  to?: number | string | Date;
}

/**
 * Interface for defining a filter parameter for searching.
 */
export interface FilterParamSearch {
  /**
   * An array of column names to search in.
   */
  columns: string[];
  /**
   * The value to search for.
   */
  value: string;
}
