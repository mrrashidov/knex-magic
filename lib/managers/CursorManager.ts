import { CursorData } from '../interfaces';

/**
 * Manages cursor operations for pagination.
 *
 * @class CursorManager
 * @description Handles encoding, decoding, and creation of cursors for pagination.
 * Implements secure and efficient cursor handling using Base64 encoding.
 */
class CursorManager {
  /**
   * Encodes cursor data into a Base64 string.
   *
   * @static
   * @param {CursorData} data - The cursor data to encode
   * @returns {string} Base64 encoded cursor string
   * @throws {Error} If encoding fails
   */
  public static encodeCursor(data: CursorData): string {
    try {
      if (!data || !data.column || data.value === undefined) {
        throw new Error('Invalid cursor data structure');
      }
      const jsonString = JSON.stringify(data);
      return Buffer.from(jsonString).toString('base64');
    } catch (error: any) {
      throw new Error(`Failed to encode cursor: ${error.message}`);
    }
  }

  /**
   * Decodes a Base64 encoded cursor string.
   *
   * @static
   * @param {string} cursor - The encoded cursor string
   * @returns {CursorData} Decoded cursor data
   * @throws {Error} If decoding fails or cursor format is invalid
   */
  public static decodeCursor(cursor: string): CursorData {
    try {
      const jsonString = Buffer.from(cursor, 'base64').toString('utf8');
      const data = JSON.parse(jsonString);

      if (!data.value || !data.column) {
        throw new Error('Invalid cursor structure');
      }

      return data as CursorData;
    } catch (error: any) {
      throw new Error(`Failed to decode cursor: Invalid format or content. ${error.message}`);
    }
  }

  /**
   * Creates an encoded cursor string from a record and column.
   *
   * @static
   * @param {any} record - The database record to create cursor from
   * @param {string} column - The column name to use for cursor value
   * @returns {string} Base64 encoded cursor string
   * @throws {Error} If record is null/undefined or column doesn't exist
   * @example
   * ```typescript
   * const record = { id: 123, name: 'John' };
   * const cursor = CursorManager.createCursor(record, 'id');
   * // Returns encoded string containing: { column: 'id', value: 123 }
   * ```
   */
  public static createCursor(record: Record<string, any>, column: string): string {
    if (!record || record[column] === null) {
      throw new Error('Invalid cursor value');
    }

    if (!(column in record)) {
      throw new Error(`Cannot create cursor: invalid value for column '${column}'`);
    }

    return this.encodeCursor({
      column,
      value: record[column],
    });
  }
}
export default CursorManager;
