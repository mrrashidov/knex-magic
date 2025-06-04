import knex, { Knex } from 'knex';

let dbInstance: Knex | null = null;

export async function createTestDb(): Promise<Knex> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = knex({
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate: (conn: any, cb: any) => {
        conn.run('PRAGMA foreign_keys = ON;', cb);
      },
    },
  });

  try {
    await createTables(db);
    await seedData(db);
    dbInstance = db;
    return db;
  } catch (error) {
    await db.destroy();
    throw error;
  }
}

export async function closeTestDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
}

async function createTables(db: Knex): Promise<void> {
  // Drop tables in correct order (due to potential foreign keys)
  await db.schema.dropTableIfExists('products');
  await db.schema.dropTableIfExists('users');

  // Create users table
  await db.schema.createTable('users', (table) => {
    table.increments('id');
    table.string('name').notNullable();
    table.integer('age');
    table.string('email').notNullable();
    table.string('status').defaultTo('active');
    table.string('metadata'); // Store as string in SQLite
    table.timestamps(true, true);
  });

  // Create products table
  await db.schema.createTable('products', (table) => {
    table.increments('id');
    table.string('name').notNullable();
    table.decimal('price', 10, 2);
    table.string('category');
    table.string('metadata'); // Store as string in SQLite
    table.timestamps(true, true);
  });
}

async function seedData(db: Knex): Promise<void> {
  // Clear existing data
  await db('products').del();
  await db('users').del();

  // Insert users
  await db('users').insert([
    {
      name: 'John Doe',
      age: 25,
      email: 'john@example.com',
      status: 'active',
      metadata: JSON.stringify({ role: 'user' }),
    },
    {
      name: 'Jane Smith',
      age: 30,
      email: 'jane@example.com',
      status: 'active',
      metadata: JSON.stringify({ role: 'admin' }),
    },
    {
      name: 'Bob Wilson',
      age: 35,
      email: 'bob@example.com',
      status: 'inactive',
      metadata: JSON.stringify({ role: 'user' }),
    },
  ]);

  // Insert products
  await db('products').insert([
    {
      name: 'Laptop',
      price: 1200.0,
      category: 'electronics',
      metadata: JSON.stringify({ color: 'silver', brand: 'TechCo' }),
    },
    {
      name: 'Phone',
      price: 800.0,
      category: 'electronics',
      metadata: JSON.stringify({ color: 'black', brand: 'MobileCo' }),
    },
    {
      name: 'Book',
      price: 20.0,
      category: 'books',
      metadata: JSON.stringify({ pages: 300, author: 'John Author' }),
    },
  ]);
}

// Add helper function to parse metadata
export function parseMetadata<T>(metadata: string | null): T | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as T;
  } catch {
    return null;
  }
}

// Add interfaces for test data
export interface TestUser {
  id: number;
  name: string;
  age: number;
  email: string;
  status: string;
  metadata: string;
}

export interface TestProduct {
  id: number;
  name: string;
  price: number;
  category: string;
  metadata: string;
}
