import CacheManager from '@/managers/CacheManager';
import { createTestDb } from '../../helpers/setupTests';
import { Knex } from 'knex';

describe('CacheManager', () => {
  let db: Knex;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(() => {
    // Clear cache before each test
    CacheManager['cache'].clear();
  });

  describe('generateKey', () => {
    it('should generate unique keys for different queries', async () => {
      const query1 = db('users').where({ status: 'active' }).orderBy('id');
      const query2 = db('users').where({ status: 'inactive' }).orderBy('name');

      const key1 = CacheManager.generateKey(query1);
      const key2 = CacheManager.generateKey(query2);

      expect(key1).not.toBe(key2);
    });

    it('should generate consistent keys for same queries', () => {
      const query1 = db('users').where({ status: 'active' });
      const query2 = db('users').where({ status: 'active' });

      const key1 = CacheManager.generateKey(query1);
      const key2 = CacheManager.generateKey(query2);

      expect(key1).toBe(key2);
    });
  });

  describe('key generation edge cases', () => {
    it('should handle query serialization failure', () => {
      const circularQuery: any = {};
      circularQuery.self = circularQuery; // Create circular reference

      const key = CacheManager.generateKey(circularQuery);
      expect(key).toMatch(/^count_\d+$/); // Should fall back to timestamp
    });
  });
  describe('get and set', () => {
    it('should store and retrieve values', () => {
      const key = 'test_key';
      const data = { count: 42 };

      CacheManager.set(key, data, 60); // Cache for 60 seconds
      const cached = CacheManager.get(key);

      expect(cached).toEqual(data);
    });

    it('should return null for expired cache', async () => {
      const key = 'test_key';
      const data = { count: 42 };

      CacheManager.set(key, data, 1); // Cache for 1 second

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const cached = CacheManager.get(key);
      expect(cached).toBeNull();
    });

    it('should return null for non-existent keys', () => {
      const cached = CacheManager.get('non_existent_key');
      expect(cached).toBeNull();
    });

    it('should handle complex data structures', () => {
      const key = 'test_key';
      const data = {
        results: [
          { id: 1, name: 'Test' },
          { id: 2, name: 'Test 2' },
        ],
        meta: {
          total: 2,
          page: 1,
        },
      };

      CacheManager.set(key, data, 60);
      const cached = CacheManager.get(key);

      expect(cached).toEqual(data);
    });
  });

  describe('Cache invalidation', () => {
    it('should automatically remove expired items', async () => {
      const key = 'test_key';
      const data = { count: 42 };

      CacheManager.set(key, data, 1);

      // Verify data is cached
      expect(CacheManager.get(key)).toEqual(data);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Verify data is removed
      expect(CacheManager.get(key)).toBeNull();
      expect(CacheManager['cache'].has(key)).toBeFalsy();
    });

    it('should handle multiple cache entries correctly', () => {
      const entries = new Array(5).fill(0).map((_, i) => ({
        key: `key_${i}`,
        data: { value: i },
      }));

      // Set multiple cache entries
      entries.forEach((entry) => {
        CacheManager.set(entry.key, entry.data, 60);
      });

      // Verify all entries
      entries.forEach((entry) => {
        expect(CacheManager.get(entry.key)).toEqual(entry.data);
      });
    });
  });
});
