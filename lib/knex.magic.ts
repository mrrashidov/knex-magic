import type { Knex } from "knex";
import {
  BaseResponse,
  CursorInterface,
  PageInfoInterface,
  FilterParamsInterface,
} from "./interfaces";

export class KnexMagic {
  /**
   * @description filter data with given params and return query
   * @param query { Knex.QueryBuilder }
   * @param params { FilterParamsInterface }
   */
  public static filter(
    query: Knex.QueryBuilder,
    params?: FilterParamsInterface,
  ): Knex.QueryBuilder {
    if (!params) {
      return query;
    }

    return Object.entries(params).reduce(
      (query: Knex.QueryBuilder, [key, value]: any) => {
        console.log(`Filtering by key: ${key}, value:`, value);
        if (key === 'search') {
          const { columns, value: searchValue }: any = value;

          if (!searchValue) return query;

          // Raqamli qidiruv uchun
          const isNumeric =
            !isNaN(searchValue) && !isNaN(parseFloat(searchValue));

          if (isNumeric) {
            const numericSearchValue = searchValue.toString();

            const numericConditions = columns.map((column, index) => {
              return index === 0
                ? `${column}::text LIKE ?`
                : ` OR ${column}::text LIKE ?`;
            });

            return query.whereRaw(
              '(' + numericConditions.join('') + ')',
              columns.map(() => `%${numericSearchValue}%`),
            );
          }

          // Matnli qidiruv uchun
          const textConditions = columns.map((column, index) => {
            return index === 0
              ? `LOWER(${column}::text) LIKE ?`
              : ` OR LOWER(${column}::text) LIKE ?`;
          });

          const likeValue = `%${searchValue.toString().toLowerCase()}%`;

          return query.whereRaw(
            '(' + textConditions.join('') + ')',
            columns.map(() => likeValue),
          );
        }
        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value !== null
        ) {
          // Date range va boshqa range filterlar uchun
          if (value.from !== undefined || value.to !== undefined) {
            const from = value.from
              ? new Date(value.from).toISOString()
              : undefined;
            const to = value.to ? new Date(value.to).toISOString() : undefined;

            if (from && to) {
              return query.whereBetween(key, [from, to]);
            } else if (from) {
              return query.where(key, '>=', from);
            } else if (to) {
              return query.where(key, '<=', to);
            }
          }

          return Object.entries(value).reduce(
            (query, [subKey, subValue]: any) => {
              if (Array.isArray(subValue)) {
                return query.whereIn(`${key}.${subKey}`, subValue);
              }
              if (typeof subValue === 'object' && subValue !== null) {
                if (subValue.from && subValue.to) {
                  return query.whereBetween(`${key}.${subKey}`, [
                    subValue.from,
                    subValue.to,
                  ]);
                }
              }
              return query.andWhere({ [key + '.' + subKey]: subValue });
            },
            query,
          );
        }
        if (Array.isArray(value) && value.length > 0) {
          return query.whereIn(key, value);
        }

        return query.where(key, value);
      },
      query,
    );
  }

  /**
   * @description paginate data with cursor pagination method and return data with pagination metadata and total count of data
   * @param query { Knex.QueryBuilder }
   * @param cursorParams { CursorInterface }
   * @param options { { key: string } }
   * @param countQuery { Knex.QueryBuilder }
   */
  public static async paginate<T>({
    query,
    cursorParams,
    options,
    countQuery,
  }: CursorInterface): Promise<BaseResponse<T>> {
    const { key: cursorColumn = 'id', keyPrefix: cursorColumnPrefix = 'id' } =
      options || {};

    const { cursor = '0', take = 10, direction = 'next' } = cursorParams;

    const cursorId = Number(cursor);
    const limit = Number(take);

    // Total count hisoblash
    const totalCount = await this.getTotalCount(
      query,
      countQuery,
      cursorColumnPrefix,
    );

    // Cursor pagination uchun query yasash
    const paginatedQuery = this.buildPaginationQuery(
      query,
      cursorColumnPrefix,
      cursorId,
      direction,
    );

    // Ma'lumotlarni olish
    const results = await paginatedQuery.limit(limit + 1);

    // Pagination meta ma'lumotlarini hisoblash
    const { data, pageInfo } = this.buildPaginationMeta({
      results,
      limit,
      cursorId,
      cursorColumn,
      direction,
    });

    return {
      data,
      pageInfo,
      totalCount,
    };
  }

  private static async getTotalCount(
    query: Knex.QueryBuilder,
    customCountQuery?: Knex.QueryBuilder,
    columnPrefix: string = 'id',
  ): Promise<number> {
    if (customCountQuery) {
      const result = await customCountQuery;
      return Number(result[0].count || 0);
    }

    const result = await query
      .clone()
      .clearSelect()
      .clearCounters()
      .clearGroup()
      .clearHaving()
      .clearOrder()
      .countDistinct(`${columnPrefix} as count`);

    return Number(result[0].count || 0);
  }

  private static buildPaginationQuery(
    query: Knex.QueryBuilder,
    columnPrefix: string,
    cursorId: number,
    direction: 'next' | 'prev',
  ): Knex.QueryBuilder {
    const { action, orderBy } = this.getWhereOperator(direction);

    if (cursorId !== 0) {
      return query
        .where(columnPrefix, action, cursorId)
        .orderBy(columnPrefix, orderBy);
    }

    return query.orderBy(columnPrefix, orderBy);
  }

  private static buildPaginationMeta({
    results,
    limit,
    cursorId,
    cursorColumn,
    direction,
  }: {
    results: any[];
    limit: number;
    cursorId: number;
    cursorColumn: string;
    direction: 'next' | 'prev';
  }): { data: any[]; pageInfo: PageInfoInterface } {
    const hasMore = results.length > limit;
    if (hasMore) {
      results.pop();
    }

    const pageInfo: PageInfoInterface = {
      hasNextPage: direction === 'next' ? hasMore : cursorId !== 0,
      hasPreviousPage: direction === 'next' ? cursorId !== 0 : hasMore,
      startCursor: results.length ? results[0][cursorColumn] : null,
      endCursor: results.length
        ? results[results.length - 1][cursorColumn]
        : null,
    };

    return { data: results, pageInfo };
  }

  /**
   * @description get where operator for cursor pagination
   * @param direction { "next" | "prev" }
   * @private
   * @returns { { action: string, orderBy: string } }
   */
  public static getWhereOperator(direction: 'next' | 'prev'): {
    action: string;
    orderBy: string;
  } {
    if (direction === 'next') {
      return { action: '>', orderBy: 'asc' };
    } else {
      return { action: '<', orderBy: 'desc' };
    }
  }
}