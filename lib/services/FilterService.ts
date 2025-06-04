import { Knex } from 'knex';
import {
  FilterParamObject,
  FilterParamRange,
  FilterParamSearch,
  FilterParamsInterface,
} from '../interfaces';

/**
 * Service class for applying complex filters to Knex.js queries.
 *
 * @class FilterService
 * @description Provides methods for applying various types of filters to Knex.js queries,
 * including simple equality filters, range filters, search filters, and batch filters.
 */
class FilterService {
  /**
   * Applies filters to a Knex query builder instance.
   *
   * @static
   * @param {Knex.QueryBuilder} query - The Knex query builder instance
   * @param {FilterParamsInterface} [params] - Filter parameters to apply
   * @param {Object} [options={ batchMode?: boolean }] - Filtering options
   * @param {boolean} [options.batchMode] - Whether to use batch mode for filtering
   * @returns {Knex.QueryBuilder} The modified query builder instance
   */
  public static applyFilters(
    query: Knex.QueryBuilder,
    params?: FilterParamsInterface,
    options: { batchMode?: boolean } = {},
  ): Knex.QueryBuilder {
    if (!params || Object.keys(params).length === 0) {
      return query;
    }

    if (options.batchMode) {
      return this.applyBatchFilters(query, params);
    }

    let currentQuery = query.clone(); // Clone to prevent unintended side effects for method chaining
    for (const [key, value] of Object.entries(params)) {
      currentQuery = this.applySingleFilter(currentQuery, key, value);
    }
    return currentQuery;
  }

  /**
   * Applies search filters across multiple columns.
   *
   * @private
   * @static
   * @param {Knex.QueryBuilder} query - The query builder instance
   * @param {FilterParamSearch} searchFilter - Search parameters
   * @returns {Knex.QueryBuilder} Modified query with search conditions
   */
  private static applyBatchFilters(
    query: Knex.QueryBuilder,
    params: FilterParamsInterface,
  ): Knex.QueryBuilder {
    const simpleFilters: Array<[string, any]> = [];
    const complexFilters: Array<[string, any]> = [];

    Object.entries(params).forEach(([key, value]) => {
      if (this.isSimpleFilter(value)) {
        simpleFilters.push([key, value]);
      } else {
        complexFilters.push([key, value]);
      }
    });

    let currentQuery = query.clone();

    if (simpleFilters.length > 0) {
      currentQuery.where((builder) => {
        simpleFilters.forEach(([key, value]) => {
          if (Array.isArray(value)) {
            builder.whereIn(key, value);
          } else {
            builder.where(key, value);
          }
        });
      });
    }

    for (const [key, value] of complexFilters) {
      currentQuery = this.applySingleFilter(currentQuery, key, value);
    }

    return currentQuery;
  }

  /**
   * Applies a single filter condition to the query.
   *
   * @private
   * @static
   * @param {Knex.QueryBuilder} query - The base query builder instance
   * @param {string} key - The column name or filter key
   * @param {any} value - The filter value to apply
   * @returns {Knex.QueryBuilder} Modified query with applied filter
   * @throws {Error} If the filter value is invalid
   * @example
   * ```typescript
   * this.applySingleFilter(query, 'status', 'active');
   * this.applySingleFilter(query, 'age', { min: 18, max: 65 });
   * ```
   */
  private static applySingleFilter(
    query: Knex.QueryBuilder,
    key: string,
    value: any,
  ): Knex.QueryBuilder {
    if (value === null || value === undefined) {
      return query;
    }

    if (key === 'search' && this.isSearchFilter(value)) {
      return this.applySearchFilter(query, value);
    }

    if (this.isObjectFilter(value)) {
      return this.applyObjectFilter(query, key, value);
    }

    if (Array.isArray(value) && value.length > 0) {
      return query.whereIn(key, value);
    }

    return query.where(key, value);
  }

  /**
   * Applies text search filters across multiple columns.
   *
   * @private
   * @static
   * @param {Knex.QueryBuilder} query - The query builder instance
   * @param {FilterParamSearch} searchFilter - Search configuration object
   * @param {string[]} searchFilter.columns - Array of column names to search in
   * @param {string} searchFilter.value - Search text value
   * @param {('contains'|'starts_with'|'ends_with'|'exact')} [searchFilter.mode='contains'] - Search mode
   * @returns {Knex.QueryBuilder} Modified query with search conditions
   * @example
   * ```typescript
   * this.applySearchFilter(query, {
   *   columns: ['name', 'email'],
   *   value: 'john',
   *   mode: 'contains'
   * });
   * ```
   */
  private static applySearchFilter(
    query: Knex.QueryBuilder,
    searchFilter: FilterParamSearch,
  ): Knex.QueryBuilder {
    const { columns, value: searchValue, mode = 'contains' } = searchFilter;

    if (!columns || columns.length === 0 || !searchValue) {
      return query;
    }

    return query.where((builder) => {
      columns.forEach((column, index) => {
        const method = index === 0 ? 'where' : 'orWhere';
        let pattern: string;

        switch (mode) {
          case 'starts_with':
            pattern = `${searchValue.toLowerCase()}%`;
            break;
          case 'ends_with':
            pattern = `%${searchValue.toLowerCase()}`;
            break;
          case 'exact':
            pattern = searchValue.toLowerCase();
            break;
          default: // contains
            pattern = `%${searchValue.toLowerCase()}%`;
        }
        // Using raw for case-insensitive LIKE across databases if LOWER is available
        // Consider specific client raw if needed for better performance/compatibility
        builder[method](query.client.raw('LOWER(??) LIKE ?', [column, pattern]));
      });
    });
  }

  /**
   * Applies nested object filters to the query.
   *
   * @private
   * @static
   * @param {Knex.QueryBuilder} query - The query builder instance
   * @param {string} key - Base key for the object filter
   * @param {FilterParamObject} value - Object containing nested filter conditions
   * @returns {Knex.QueryBuilder} Modified query with object filters
   * @example
   * ```typescript
   * this.applyObjectFilter(query, 'metadata', {
   *   status: 'active',
   *   age: { min: 18, max: 65 }
   * });
   * ```
   */
  private static applyObjectFilter(
    query: Knex.QueryBuilder,
    key: string,
    value: FilterParamObject,
  ): Knex.QueryBuilder {
    let currentQuery = query;
    for (const [subKey, subValue] of Object.entries(value)) {
      const fullKey = `${key}.${subKey}`; // Assumes dot notation for nested objects in DB, adjust if needed

      if (Array.isArray(subValue)) {
        currentQuery = currentQuery.whereIn(fullKey, subValue);
      } else if (this.isRangeFilter(subValue)) {
        currentQuery = this.applyRangeFilter(currentQuery, fullKey, subValue);
      } else {
        currentQuery = currentQuery.where(fullKey, subValue);
      }
    }
    return currentQuery;
  }

  /**
   * Applies range-based filters to the query.
   *
   * @private
   * @static
   * @param {Knex.QueryBuilder} query - The query builder instance
   * @param {string} key - Column name for range filter
   * @param {FilterParamRange} range - Range filter configuration
   * @param {number} [range.min] - Minimum value of the range
   * @param {number} [range.max] - Maximum value of the range
   * @returns {Knex.QueryBuilder} Modified query with range conditions
   * @example
   * ```typescript
   * this.applyRangeFilter(query, 'age', { min: 18, max: 65 });
   * this.applyRangeFilter(query, 'price', { min: 100 });
   * ```
   */
  private static applyRangeFilter(
    query: Knex.QueryBuilder,
    key: string,
    range: FilterParamRange,
  ): Knex.QueryBuilder {
    if (range.min !== undefined && range.max !== undefined) {
      return query.whereBetween(key, [range.min, range.max]);
    } else if (range.min !== undefined) {
      return query.where(key, '>=', range.min);
    } else if (range.max !== undefined) {
      return query.where(key, '<=', range.max);
    }
    return query;
  }

  /**
   * Type guard to check if a value is a search filter.
   *
   * @private
   * @static
   * @param {any} value - Value to check
   * @returns {boolean} True if value is a SearchFilter
   * @example
   * ```typescript
   * if (this.isSearchFilter(value)) {
   *   // value is typed as FilterParamSearch
   * }
   * ```
   */
  private static isSearchFilter(value: any): value is FilterParamSearch {
    return (
      typeof value === 'object' &&
      value !== null &&
      Array.isArray(value.columns) &&
      typeof value.value === 'string'
    );
  }

  /**
   * Type guard to check if a value is an object filter.
   *
   * @private
   * @static
   * @param {any} value - Value to check
   * @returns {boolean} True if value is an ObjectFilter
   * @example
   * ```typescript
   * if (this.isObjectFilter(value)) {
   *   // value is typed as FilterParamObject
   * }
   * ```
   */
  private static isObjectFilter(value: any): value is FilterParamObject {
    return (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      !this.isSearchFilter(value) &&
      !this.isRangeFilter(value)
    );
  }

  /**
   * Type guard to check if a value is a range filter.
   *
   * @private
   * @static
   * @param {any} value - Value to check
   * @returns {boolean} True if value is a RangeFilter
   * @example
   * ```typescript
   * if (this.isRangeFilter(value)) {
   *   // value is typed as FilterParamRange
   * }
   * ```
   */
  private static isRangeFilter(value: any): value is FilterParamRange {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value.hasOwnProperty('min') || value.hasOwnProperty('max'))
    );
  }

  /**
   * Type guard to check if a value is a simple filter (primitive or array).
   *
   * @private
   * @static
   * @param {any} value - Value to check
   * @returns {boolean} True if value is a simple filter
   * @example
   * ```typescript
   * if (this.isSimpleFilter(value)) {
   *   // value is string | number | boolean | Array
   * }
   * ```
   */
  private static isSimpleFilter(value: any): boolean {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value)
    );
  }
}
export default FilterService;
