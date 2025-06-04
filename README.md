# KnexMagic

![Version](https://img.shields.io/npm/v/knex-magic)
![License](https://img.shields.io/npm/l/knex-magic)
![Downloads](https://img.shields.io/npm/dm/knex-magic)

Advanced cursor-based pagination and filtering utility for Knex.js applications with TypeScript support.

## Features

- 🚀 **Cursor-based Pagination**: Efficient pagination for large datasets
- 🎯 **Smart Filtering**: Complex filtering with support for:
  - Range filters
  - Text search
  - Array filters
  - Nested object filters
- ⚡ **Performance Optimizations**:
  - Query caching
  - Estimated counts for large datasets
  - PostgreSQL-specific optimizations
- 📦 **TypeScript Support**: Full type safety and IntelliSense
- 🔧 **Customizable**: Flexible configuration options
- 🧪 **Well Tested**: Comprehensive test coverage

## Installation

```bash
# Using npm
npm install knex-magic

# Using yarn
yarn add knex-magic

# Using pnpm
pnpm add knex-magic
```

## Quick Start

```typescript
import { KnexMagic } from 'knex-magic';

// Basic pagination
const result = await KnexMagic.paginate({
  query: knex('users'),
  cursorParams: { 
    take: 10,
    cursor: 'next-page-cursor'
  }
});

// With filtering
const filteredResult = await KnexMagic.paginate({
  query: knex('users'),
  cursorParams: { take: 10 },
  filters: {
    status: 'active',
    age: { min: 18, max: 65 },
    skills: ['javascript', 'typescript'],
    search: {
      columns: ['name', 'email'],
      value: 'john',
      mode: 'contains'
    }
  }
});
```

## Detailed Usage

### Cursor-based Pagination

```typescript
const result = await KnexMagic.paginate({
  query: knex('users'),
  cursorParams: {
    take: 10,
    cursor: 'encoded-cursor-string',
    direction: 'next',
    skipTotalCount: false,
    estimatedTotal: 1000
  },
  options: {
    cursorColumn: 'id',
    orderByColumn: 'created_at',
    orderDirection: 'desc',
    useEstimatedCount: true,
    cache: {
      enabled: true,
      ttl: 300 // 5 minutes
    }
  }
});

console.log(result);
// {
//   data: [...],
//   pageInfo: {
//     hasNextPage: true,
//     hasPreviousPage: false,
//     startCursor: 'encoded-start',
//     endCursor: 'encoded-end'
//   },
//   totalCount: 1000,
//   meta: {
//     executionTime: 45,
//     isEstimated: true,
//     cacheHit: false
//   }
// }
```

### Advanced Filtering

```typescript
// Complex filtering example
const filters = {
  // Simple equality
  status: 'active',
  
  // Array values (IN clause)
  category: ['electronics', 'books'],
  
  // Range filters
  price: { min: 100, max: 1000 },
  created_at: { min: '2023-01-01' },
  
  // Text search
  search: {
    columns: ['title', 'description'],
    value: 'keyboard',
    mode: 'contains' // or 'starts_with', 'ends_with', 'exact'
  },
  
  // Nested object filters
  metadata: {
    color: 'red',
    size: { min: 'M', max: 'XL' }
  }
};

const result = await KnexMagic.paginate({
  query: knex('products'),
  cursorParams: { take: 10 },
  filters
});
```

### Streaming Large Datasets

```typescript
const stream = KnexMagic.paginateStream({
  query: knex('large_table'),
  cursorParams: { take: 1000 }
});

for await (const record of stream) {
  await processRecord(record);
}
```

## API Reference

### KnexMagic.paginate()

Main pagination method with following options:

| Parameter | Type | Description |
|-----------|------|-------------|
| query | Knex.QueryBuilder | Base query to paginate |
| cursorParams | CursorParams | Pagination parameters |
| options | CursorOptions | Optional configuration |
| filters | FilterParamsInterface | Optional filters |

[Full API Documentation](./docs/API.md)

## Performance Tips

- Enable caching for frequently accessed data
- Use `useEstimatedCount` for large tables
- Set appropriate `take` values
- Consider using `skipTotalCount` for better performance
- Index your cursor and filter columns

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](./docs)
- 🐛 [Issue Tracker](https://github.com/mrrashidov/knex-magic/issues)
- 💬 [Discussions](https://github.com/mrrashidov/knex-magic/discussions)

## Acknowledgments

- [Knex.js](https://knexjs.org/) team for the amazing query builder
- [Ithub](https://ithub.uz/) for supporting the project
- All the contributors who have helped this project grow

---

Made with ❤️ by [Shoxrux Rashidov](https://t.me/mrrashidov)
