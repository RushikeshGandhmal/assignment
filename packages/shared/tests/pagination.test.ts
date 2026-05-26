import { describe, expect, it } from 'vitest';
import { paginationQuerySchema } from '../src/pagination.js';

describe('paginationQuerySchema', () => {
  it('applies defaults when no values are provided', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 25 });
  });

  it('coerces numeric strings (e.g. from URL query params)', () => {
    const parsed = paginationQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(parsed).toEqual({ page: 3, pageSize: 50 });
  });

  it('rejects non-positive pages', () => {
    expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => paginationQuerySchema.parse({ page: -1 })).toThrow();
  });

  it('caps pageSize at 100 to protect the API', () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });
});
