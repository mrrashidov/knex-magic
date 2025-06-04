import CursorManager from '@/managers/CursorManager';
import { createTestDb } from '../../helpers/setupTests';
import { Knex } from 'knex';

describe('CursorManager', () => {
  let db: Knex;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('createCursor', () => {
    it('should throw error for null values', () => {
      const record = { id: null };
      expect(() => {
        CursorManager.createCursor(record, 'id');
      }).toThrow('Invalid cursor value');
    });

    it('should create valid cursor for number value', () => {
      const record = { id: 1, name: 'Test' };
      const cursor = CursorManager.createCursor(record, 'id');

      expect(cursor).toBeTruthy();
      expect(typeof cursor).toBe('string');

      const decoded = CursorManager.decodeCursor(cursor);
      expect(decoded).toEqual({
        column: 'id',
        value: 1,
      });
    });

    // Update timestamp expectations
    it('should create valid cursor for number value', () => {
      const record = { id: 1, name: 'Test' };
      const cursor = CursorManager.createCursor(record, 'id');

      const decoded = CursorManager.decodeCursor(cursor);
      expect(decoded).toMatchObject({
        column: 'id',
        value: 1,
      });
      // expect(decoded).toHaveProperty('timestamp');
    });

    it('should create valid cursor for string value', () => {
      const record = { email: 'test@example.com' };
      const cursor = CursorManager.createCursor(record, 'email');

      const decoded = CursorManager.decodeCursor(cursor);
      expect(decoded).toEqual({
        column: 'email',
        value: 'test@example.com',
      });
    });

    it('should throw error for missing column', () => {
      const record = { id: 1 };
      expect(() => {
        CursorManager.createCursor(record, 'nonexistent');
      }).toThrow();
    });
  });

  describe('encodeCursor and decodeCursor', () => {
    it('should correctly encode and decode cursor data', () => {
      const cursorData = {
        column: 'id',
        value: 123,
      };

      const encoded = CursorManager.encodeCursor(cursorData);
      const decoded = CursorManager.decodeCursor(encoded);

      expect(decoded).toEqual(cursorData);
    });

    it('should handle special characters in values', () => {
      const cursorData = {
        column: 'email',
        value: 'test+special@example.com',
      };

      const encoded = CursorManager.encodeCursor(cursorData);
      const decoded = CursorManager.decodeCursor(encoded);

      expect(decoded).toEqual(cursorData);
    });

    it('should throw error for invalid cursor format', () => {
      expect(() => {
        CursorManager.decodeCursor('invalid-cursor-string');
      }).toThrow();
    });
  });

  describe('cursor operations with database', () => {
    it('should create valid cursor from database record', async () => {
      const user = await db('users').first();
      const cursor = CursorManager.createCursor(user, 'id');

      expect(cursor).toBeTruthy();

      const decoded = CursorManager.decodeCursor(cursor);
      expect(decoded.value).toBe(user.id);
    });

    it('should work with different column types', async () => {
      const testCases = [
        { table: 'users', column: 'id', type: 'number' },
        { table: 'users', column: 'email', type: 'string' },
        { table: 'users', column: 'created_at', type: 'date' },
      ];

      for (const testCase of testCases) {
        const record = await db(testCase.table).first();
        const cursor = CursorManager.createCursor(record, testCase.column);
        const decoded = CursorManager.decodeCursor(cursor);

        expect(decoded.column).toBe(testCase.column);
        expect(decoded.value).toBe(record[testCase.column]);
      }
    });
  });

  describe('error handling', () => {
    it('should handle null values gracefully', () => {
      const record = { id: null };
      expect(() => {
        CursorManager.createCursor(record, 'id');
      }).toThrow('Invalid cursor value');
    });

    it('should handle undefined values gracefully', () => {
      const record = {};
      expect(() => {
        CursorManager.createCursor(record, 'id');
      }).toThrow("Cannot create cursor: invalid value for column 'id'");
    });

    it('should validate cursor data structure', () => {
      expect(() => {
        CursorManager.encodeCursor({} as any);
      }).toThrow('Invalid cursor data structure');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in column values', () => {
      const record = {
        email: 'test+special@example.com',
        name: 'Test & Special < > " \' Characters',
      };

      const cursor = CursorManager.createCursor(record, 'email');
      const decoded = CursorManager.decodeCursor(cursor);

      expect(decoded.value).toBe(record.email);
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(1000);
      const record = { content: longValue };

      const cursor = CursorManager.createCursor(record, 'content');
      const decoded = CursorManager.decodeCursor(cursor);

      expect(decoded.value).toBe(longValue);
    });
  });
});
